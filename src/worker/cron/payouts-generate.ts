/**
 * 🛡️ 2026-05-21 Phase C: 주 1회 정산 일괄 생성 cron.
 *
 * 매주 월요일 새벽 (KST 09 = UTC 00) 실행:
 *   - 지난주 ledger credit 집계
 *   - 이미 payouts 처리된 amount 차감
 *   - 잔액 10,000원 이상 payee 별 pending payouts row INSERT
 *
 * admin 이 /admin/payouts 페이지에서 검토 후 송금 처리.
 *
 * 멱등 (2026-06-11 머니 감사): 같은 (payee_type, payee_id, period_start, period_end) 조합은
 *   pre-check 로 skip + payouts UNIQUE index 기반 INSERT OR IGNORE 로 이중 차단 →
 *   cron 이 두 번 돌거나 수동 재실행돼도 중복 pending payout 이 생기지 않음.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

export async function handlePayoutsGenerate(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    const now = new Date()
    const lastMonday = new Date(now)
    lastMonday.setUTCDate(now.getUTCDate() - 7 - ((now.getUTCDay() + 6) % 7))
    const lastSunday = new Date(lastMonday)
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)
    const periodStart = lastMonday.toISOString().slice(0, 10)
    const periodEnd = lastSunday.toISOString().slice(0, 10)
    // 🛡️ 2026-05-22 정책 중앙화 — REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL
    const { REFUND_POLICY } = await import('../../shared/constants/policy')
    const MIN_AMOUNT = REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL

    // 🛡️ 2026-06-26 [머니수정] credit 집계를 '지난주만' → '전기간 누적' 으로 변경.
    //   기존엔 credit 은 1주치인데 차감(paid)은 전기간이라, 누적 payout 이 1주 credit 을
    //   넘는 기성 payee 는 pending 이 음수→skip(만성 미지급) + 누락된 주/MIN 미만 주의 credit 은
    //   영영 재포착 못 함(각 run 이 자기 7일 창만 봄). 이제 getPayablePending(ledger.ts) 의 정식
    //   공식 = (전기간 credit − 전기간 미완료 payout) 으로 실외상 잔액을 반영.
    // 💸 2026-07-01 (정산 정합 — 대표 승인): 이전엔 credit-only 합산이라 (A) 공구 seller 의 gross credit
    //   에서 수수료 미차감 + (B) seller:N 의 기존 debit(환불 역전·인플루언서/추천 커미션)을 무시 → 과다지급.
    //   정식 net 잔액 = (credit − fee_amount) − debit. getLedgerReceivable(ledger.ts) 와 동일 공식.
    //   (fee_amount 는 공구 seller credit 에만 존재 → 다른 payee/이용권 무영향. debit 는 payee receivable 차감.)
    const credits = await DB.prepare(`
      SELECT account, SUM(net) as total FROM (
        SELECT credit_account AS account, amount - COALESCE(fee_amount, 0) AS net
          FROM ledger_entries
         WHERE credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%'
        UNION ALL
        SELECT debit_account AS account, -amount AS net
          FROM ledger_entries
         WHERE debit_account LIKE 'merchant:%' OR debit_account LIKE 'seller:%' OR debit_account LIKE 'agency:%' OR debit_account LIKE 'user:%'
      )
      GROUP BY account
    `).all<{ account: string; total: number }>()
      .then(r => ({ results: (r.results || []).map(x => ({ credit_account: x.account, total: x.total })) }))
      .catch(() => ({ results: [] as Array<{ credit_account: string; total: number }> }))

    // 이미 payout 처리됐거나(완료) 처리 대기중인(pending) amount.
    // 🛡️ credit 이 전기간 누적이 됐으므로 차감도 전기간 — 'pending' 도 포함해야 직전 run 이 만든
    //   미승인 pending payout 이 다음 주(다른 period) run 에서 같은 외상으로 재생성되는 이중 pending 을 차단.
    //   (rejected/failed/cancelled 는 미차감 → 그 외상은 다음 run 에서 정상 재포착.)
    const paid = await DB.prepare(`
      SELECT (payee_type || ':' || payee_id) as account, SUM(amount) as total
        FROM payouts
       WHERE status IN ('pending','approved','sent')
       GROUP BY payee_type, payee_id
    `).all<{ account: string; total: number }>().catch(() => ({ results: [] as Array<{ account: string; total: number }> }))
    const paidMap = new Map((paid.results || []).map(r => [r.account, r.total]))

    let created = 0
    for (const c of credits.results || []) {
      const pending = c.total - (paidMap.get(c.credit_account) || 0)
      if (pending < MIN_AMOUNT) continue
      const [type, id] = c.credit_account.split(':')
      if (!type || !id) continue
      // userdeal:N 은 비사업자 딜 적립 audit 전용 → 현금 payout 대상 아님 (위 WHERE 의 user:% 와 구분됨).
      const payeeType = type === 'merchant' ? 'store_owner' : type
      if (!['store_owner', 'seller', 'agency', 'user'].includes(payeeType)) continue

      // 계좌 정보 조회
      let accountNumber: string | null = null, accountHolder: string | null = null
      try {
        if (payeeType === 'store_owner' || payeeType === 'seller') {
          const row = await DB.prepare('SELECT bank_account, business_name FROM sellers WHERE id = ?').bind(id).first<{ bank_account: string | null; business_name: string | null }>()
          accountNumber = row?.bank_account || null
          accountHolder = row?.business_name || null
        } else if (payeeType === 'user') {
          // 사업자 유저 영입 commission 현금 정산 (비사업자는 userdeal:N → 여기 안 옴).
          const row = await DB.prepare('SELECT bank_account, account_holder, business_name FROM users WHERE id = ?').bind(id).first<{ bank_account: string | null; account_holder: string | null; business_name: string | null }>()
          accountNumber = row?.bank_account || null
          accountHolder = row?.account_holder || row?.business_name || null
        } else {
          const row = await DB.prepare('SELECT name FROM agencies WHERE id = ?').bind(id).first<{ name: string | null }>()
          accountHolder = row?.name || null
        }
      } catch { /* graceful */ }

      // 🛡️ 2026-06-11 멱등: 같은 (payee, period) payout 이 이미 있으면 재생성 skip (재실행/이중실행 방어).
      const dup = await DB.prepare(
        `SELECT id FROM payouts WHERE payee_type = ? AND payee_id = ? AND period_start = ? AND period_end = ? LIMIT 1`,
      ).bind(payeeType, id, periodStart, periodEnd).first<{ id: number }>().catch(() => null)
      if (dup) continue

      try {
        // INSERT OR IGNORE + payouts UNIQUE index (repair-schema) → 동시 재실행에도 중복 0.
        const ins = await DB.prepare(
          `INSERT OR IGNORE INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, account_number, account_holder)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        ).bind(payeeType, id, pending, periodStart, periodEnd, accountNumber, accountHolder).run()
        if ((ins.meta?.changes ?? 0) > 0) created++
      } catch (e) {
        logError('[payouts-cron] insert failed', { account: c.credit_account, error: (e as Error).message })
      }
    }
    if (created > 0) logInfo(`[payouts-cron] created ${created} pending payouts for ${periodStart} ~ ${periodEnd}`)
  } catch (e) {
    logError('[payouts-cron] failed', { error: (e as Error).message })
  }
}
