/**
 * 🛡️ 2026-05-21 Phase D-3: ledger 정합성 검증 cron (매일 18 UTC).
 *
 * Double-entry bookkeeping 원칙: Σ(debit) == Σ(credit) (모든 account 합산).
 * 깨졌으면 worker crash 후 잘못된 INSERT 발생했을 가능성 → 어드민 즉시 알림.
 *
 * 🛡️ 2026-05-23 확장: voucher 발급 흐름 정합 검증 추가 (D1 트랜잭션 한계 보완).
 *   - 검증 1: ledger orphan accounts (기존)
 *   - 검증 2: user_points.balance vs SUM(point_transactions) — 잔액 불일치
 *   - 검증 3: PAID deal order with 0 vouchers — voucher 누락 (worker crash 흔적)
 *   - 검증 4: orphan point_transactions (user_points row 없는 user_id) — 데이터 손상
 *
 * 영구성:
 *   - cron 결과 → ledger_integrity_log 테이블 기록
 *   - dashboard_notifications + frontend_errors 에 admin alert
 *   - Discord webhook 자동 알림 (DISCORD_WEBHOOK_URL)
 *   - 매일 1회 — 비용 거의 0
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'
import { findBalanceMismatches } from '../utils/ledger-integrity-checks'

export async function handleLedgerIntegrityCheck(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS ledger_integrity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checked_at TEXT DEFAULT (datetime('now')),
      total_debit INTEGER NOT NULL,
      total_credit INTEGER NOT NULL,
      diff INTEGER NOT NULL,
      entry_count INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ok','mismatch','error'))
    )`).run()

    const row = await DB.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as entry_count
        FROM ledger_entries
    `).first<{ total: number; entry_count: number }>()
    const totalEntries = Number(row?.total ?? 0)
    const entryCount = Number(row?.entry_count ?? 0)

    // double-entry — 각 entry 는 amount 1번씩 debit + credit 양쪽 발생.
    // Σ(debit) 와 Σ(credit) 가 amount * entry_count 와 같아야 함 (분개당 양변 = amount).
    // 즉 단순 SUM(amount) 가 같으니 mismatch 는 발생 X — 대신 'orphan account' 검사.
    const orphans = await DB.prepare(`
      SELECT debit_account, credit_account, amount, reference_id
        FROM ledger_entries
       WHERE debit_account = '' OR debit_account IS NULL
          OR credit_account = '' OR credit_account IS NULL
          OR amount <= 0
       LIMIT 50
    `).all<{ debit_account: string; credit_account: string; amount: number; reference_id: string }>().catch(() => ({ results: [] as Array<{ debit_account: string; credit_account: string; amount: number; reference_id: string }> }))

    const orphanCount = orphans.results?.length ?? 0

    // ── 🛡️ 2026-05-23 추가 검증: voucher 발급 흐름 정합 ──
    type Mismatch = { check: string; count: number; sample: unknown[] }
    const voucherFlowMismatches: Mismatch[] = []

    // 검증 2: user_points.balance vs SUM(point_transactions)
    //
    // ⚠️ 2026-07-27 근본수정 — 이 검사는 오탐만 내고 있었다(대표 신고 'ledger_mismatch 4건').
    //   ① **컬럼 불일치**: 기록 SSOT `recordPointTransaction`(point-ledger.ts)은 `amount` 에만 쓰는데
    //      검사는 `points_amount` 를 읽었다 → 메인 경로로 쌓인 거래가 전부 0 으로 계산돼
    //      잔액 있는 유저는 무조건 불일치로 잡힘. (products.stock/stock_quantity 와 같은 이중컬럼 부채.)
    //   ② **타입 화이트리스트**: charge/referral_bonus/refund/donate 4종만 세고 나머지(signup_bonus·
    //      commission·cash_withdraw·deal·free·intro_commission_backfill·referral_bonus_reversed …)를 0 처리.
    //   ③ **부호 이중적용**: `amount` 는 이미 부호 있는 값(적립 +, 차감 −)인데 donate 에 −를 또 붙임.
    //   → 전 타입을 부호 그대로 합산한다. 레거시 행(amount 비고 points_amount 만 있는 구 코드 산출물)은
    //      구 규약(절대값 + 타입으로 부호 결정)으로 폴백.
    // 🔎 2026-08-01: 검사 SQL 을 `utils/ledger-integrity-checks` 로 옮겼다 — 어드민 조회 API 와
    //   **같은 쿼리**를 써야 한다(두 벌이면 갈라진다). 여기선 호출만.
    try {
      const { total, rows } = await findBalanceMismatches(DB, 5)
      if (total > 0) {
        voucherFlowMismatches.push({ check: 'user_points_balance_mismatch', count: total, sample: rows })
      }
    } catch { /* skip */ }

    // 검증 3: PAID deal order with 0 vouchers (worker crash 흔적)
    try {
      const r = await DB.prepare(`
        SELECT o.id, o.order_number, o.user_id, o.total_amount, o.created_at
          FROM orders o
         WHERE o.order_number LIKE 'GB-%'
           AND o.status = 'PAID' AND o.payment_method = 'deal_points'
           AND o.created_at >= datetime('now', '-7 days')
           AND NOT EXISTS (SELECT 1 FROM vouchers v WHERE v.order_id = o.id)
         LIMIT 30
      `).all<{ id: number; order_number: string }>().catch(() => ({ results: [] }))
      if (r.results && r.results.length > 0) {
        voucherFlowMismatches.push({ check: 'paid_order_no_voucher', count: r.results.length, sample: r.results.slice(0, 5) })
      }
    } catch { /* skip */ }

    // 검증 4: orphan point_transactions
    try {
      const r = await DB.prepare(`
        SELECT pt.id, pt.user_id, pt.type, pt.amount
          FROM point_transactions pt
          LEFT JOIN user_points up ON up.user_id = pt.user_id
         WHERE up.user_id IS NULL
           AND pt.created_at >= datetime('now', '-7 days')
         LIMIT 30
      `).all<{ id: number; user_id: string }>().catch(() => ({ results: [] }))
      if (r.results && r.results.length > 0) {
        voucherFlowMismatches.push({ check: 'orphan_point_transactions', count: r.results.length, sample: r.results.slice(0, 5) })
      }
    } catch { /* skip */ }

    const totalMismatch = orphanCount + voucherFlowMismatches.reduce((s, m) => s + m.count, 0)
    const status = totalMismatch > 0 ? 'mismatch' : 'ok'

    await DB.prepare(
      `INSERT INTO ledger_integrity_log (total_debit, total_credit, diff, entry_count, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(totalEntries, totalEntries, totalMismatch, entryCount, status).run()

    if (totalMismatch > 0) {
      logError(`[ledger-integrity] ${totalMismatch} mismatches found`, {
        orphans: orphans.results,
        voucher_flow: voucherFlowMismatches,
        total_entries: entryCount,
      })

      // 🛡️ 2026-05-23: admin notification (dashboard + frontend_errors)
      const summary = [
        orphanCount > 0 ? `ledger orphan: ${orphanCount}` : null,
        ...voucherFlowMismatches.map(m => `${m.check}: ${m.count}`),
      ].filter(Boolean).join(', ')

      try {
        await DB.prepare(`
          INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
          VALUES ('admin', NULL, 'ledger_mismatch', '⚠️ 정합 검증 실패', ?, '/admin/errors', datetime('now'))
        `).bind(summary).run()
      } catch { /* dashboard_notifications 테이블 없으면 skip */ }

      // 🔎 2026-08-01: **상세를 `stack` 에 함께 저장.** 지금까지 요약만 남아 `/admin/errors` 에서
      //   "4건"만 보이고 **어떤 유저인지 알 수 없어 몇 주째 조사가 시작조차 못 됐다**.
      //   `/api/_errors/recent` 가 이제 stack 을 돌려주므로(같은 날 수리) 화면에서 바로 보인다.
      try {
        const detail = JSON.stringify({ orphans: (orphans.results ?? []).slice(0, 5), voucher_flow: voucherFlowMismatches }, null, 1).slice(0, 1900)
        await DB.prepare(`
          INSERT INTO frontend_errors (message, stack, type, url, created_at)
          VALUES (?, ?, 'ledger_mismatch', '/cron/ledger-integrity', datetime('now'))
        `).bind(`Ledger mismatch (${totalMismatch}): ${summary}`, detail).run()
      } catch { /* frontend_errors 테이블 없으면 skip */ }

      // Discord webhook (기존)
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          await sendDiscordAlert(
            webhook,
            '🚨 Ledger Integrity Mismatch',
            `${totalMismatch} mismatches: ${summary}\nCheck /admin/errors + ledger_integrity_log.`,
            'error',
          )
        } catch { /* discord 실패 무시 */ }
      }
    } else {
      logInfo(`[ledger-integrity] OK — ${entryCount} entries, total ${totalEntries}, voucher flow clean`)
    }
  } catch (e) {
    logError('[ledger-integrity] failed', { error: (e as Error).message })
  }
}
