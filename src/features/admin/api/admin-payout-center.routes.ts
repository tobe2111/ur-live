/**
 * 🏦 지급 센터 (2026-06-12 — 사용자 결정 "1번 그렇게 진행"):
 *   셀러 정산(settlements) · 큐레이터 환급(user_withdrawals) · 에이전시 영입 커미션
 *   (agency_store_intro_commissions, P3 결정으로 정본 레일) 의 "신청 → 입금완료" 를
 *   어드민 한 화면에서 처리. 운영 = 수동 이체 + 기록 + 주 1회(금요일) 루틴.
 *
 * 머니 룰: 모든 상태 전환은 CAS(meta.changes 검사) — 이중 지급 차단.
 * 공급사 출금은 기존 전용 플로우(supplier-withdrawal) 존치 — 본 화면에서 링크만.
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { safeError } from '../../../worker/utils/safe-error'
import { createDashboardNotification } from '../../notifications/api/dashboard-notifications.routes'

const payoutCenterRoutes = new Hono<{ Bindings: Env }>()
// 인증: adminApp 체인(CORS+IP whitelist+requireAdmin+audit)이 처리 — /api/admin/* 마운트 전제.

// ── 스키마 보강 (메모이즈 — repair-schema 에도 등록) ──
const _ensured = new WeakSet<D1Database>()
async function ensurePayoutCols(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  for (const sql of [
    'ALTER TABLE settlements ADD COLUMN paid_at DATETIME',
    'ALTER TABLE settlements ADD COLUMN admin_memo TEXT',
    'ALTER TABLE user_withdrawals ADD COLUMN deal_deducted INTEGER DEFAULT 0',
  ]) {
    await DB.prepare(sql).run().catch(() => { /* exists */ })
  }
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_commission_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      row_count INTEGER NOT NULL,
      admin_memo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run().catch(() => {})
}

// ── GET / — 3개 레일 대기 목록 + 최근 지급 이력 ──
payoutCenterRoutes.get('/', async (c) => {
  try {
    const DB = c.env.DB
    await ensurePayoutCols(DB)

    const [sellers, curators, agencies, recentPaid] = await Promise.all([
      DB.prepare(`
        SELECT st.id, st.seller_id, s.name AS seller_name, s.business_name,
               st.amount, st.period_start, st.period_end,
               st.bank_name, st.account_number, st.account_holder, st.status, st.created_at
        FROM settlements st LEFT JOIN sellers s ON s.id = st.seller_id
        WHERE st.status IN ('pending', 'approved')
        ORDER BY st.created_at ASC LIMIT 200
      `).all().catch(() => ({ results: [] })),
      DB.prepare(`
        SELECT w.id, w.user_id, u.name AS user_name,
               w.amount, w.withholding_tax, w.net_amount,
               w.bank_name, w.bank_account, w.account_holder, w.status, w.requested_at, w.deal_deducted
        FROM user_withdrawals w LEFT JOIN users u ON u.id = w.user_id
        WHERE w.status IN ('requested', 'approved')
        ORDER BY w.requested_at ASC LIMIT 200
      `).all().catch(() => ({ results: [] })),
      // 에이전시: T+7 성숙(환불창 경과)된 pending 커미션의 에이전시별 합계
      DB.prepare(`
        SELECT a.id AS agency_id, a.name AS agency_name,
               a.bank_name, a.bank_account, a.account_holder,
               SUM(cm.commission_amount) AS payable,
               COUNT(*) AS row_count,
               MIN(cm.created_at) AS oldest_at,
               SUM(CASE WHEN datetime(cm.created_at) > datetime('now', '-7 days') THEN cm.commission_amount ELSE 0 END) AS maturing
        FROM agency_store_intro_commissions cm
        JOIN agencies a ON a.id = cm.agency_id
        WHERE COALESCE(cm.status, 'pending') = 'pending'
        GROUP BY a.id HAVING SUM(cm.commission_amount) > 0
        ORDER BY payable DESC LIMIT 100
      `).all().catch(() => ({ results: [] })),
      DB.prepare(`
        SELECT 'seller' AS rail, st.id, s.name AS who, st.amount, st.paid_at AS at, st.admin_memo AS memo
          FROM settlements st LEFT JOIN sellers s ON s.id = st.seller_id
         WHERE st.status = 'paid' AND st.paid_at IS NOT NULL
        UNION ALL
        SELECT 'curator' AS rail, w.id, u.name AS who, w.net_amount AS amount, w.processed_at AS at, w.admin_memo AS memo
          FROM user_withdrawals w LEFT JOIN users u ON u.id = w.user_id
         WHERE w.status = 'paid'
        UNION ALL
        SELECT 'agency' AS rail, p.id, a.name AS who, p.amount, p.created_at AS at, p.admin_memo AS memo
          FROM agency_commission_payouts p LEFT JOIN agencies a ON a.id = p.agency_id
        ORDER BY at DESC LIMIT 30
      `).all().catch(() => ({ results: [] })),
    ])

    return c.json({
      success: true,
      data: {
        sellers: sellers.results || [],
        curators: curators.results || [],
        agencies: (agencies.results || []).map((r: Record<string, unknown>) => ({
          ...r,
          // 지급 가능 = 성숙분만 (전체 pending 합 - 7일 미경과분)
          payable_matured: Number(r.payable || 0) - Number(r.maturing || 0),
        })),
        recent_paid: recentPaid.results || [],
      },
    })
  } catch (err) {
    return safeError(c, err, '지급 센터 조회 중 오류가 발생했습니다', '[payout-center]')
  }
})

// ── 셀러 정산 입금완료 ──
payoutCenterRoutes.patch('/seller/:id/paid', async (c) => {
  try {
    const DB = c.env.DB
    await ensurePayoutCols(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json<{ memo?: string }>().catch(() => ({} as { memo?: string }))
    const memo = (body.memo || '').slice(0, 300) || null

    const r = await DB.prepare(
      `UPDATE settlements SET status = 'paid', paid_at = datetime('now'), admin_memo = ?
        WHERE id = ? AND status IN ('pending', 'approved')`
    ).bind(memo, id).run()
    if (!r.meta?.changes) return c.json({ success: false, error: '이미 처리됐거나 없는 신청입니다' }, 409)

    const row = await DB.prepare('SELECT seller_id, amount FROM settlements WHERE id = ?')
      .bind(id).first<{ seller_id: number; amount: number }>().catch(() => null)
    if (row?.seller_id) {
      createDashboardNotification(
        DB, 'seller', String(row.seller_id), 'settlement_paid',
        '💸 정산금 입금 완료', `₩${Number(row.amount).toLocaleString('ko-KR')} 입금이 완료되었습니다`,
        '/seller/settlements',
      ).catch(() => {})
    }

    // 🧾 2026-07-01: 사업자 유저 셀러 정산 지급 → 매입세금계산서 역발행 초안 자동 생성(additive, fail-soft,
    //   멱등 settlement_id). provider 미설정 시 draft 로만 남음(cost-0). 정산 지급(CAS) *이후* 기록만 —
    //   금액/원천징수/지급 로직 전부 불변. 카카오 애드핏 = 유니포스트 역발행 모델.
    {
      const { generateSettlementReverseInvoice } = await import('../../seller/api/settlement-tax-invoices')
      const p = generateSettlementReverseInvoice(DB, c.env, id).catch(() => { /* fail-soft */ })
      if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(p); else await p
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '정산 지급 처리 중 오류가 발생했습니다', '[payout-center]')
  }
})

// ── 큐레이터 환급 입금완료 / 반려 ──
payoutCenterRoutes.patch('/curator/:id/paid', async (c) => {
  try {
    const DB = c.env.DB
    await ensurePayoutCols(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json<{ memo?: string }>().catch(() => ({} as { memo?: string }))

    const r = await DB.prepare(
      `UPDATE user_withdrawals SET status = 'paid', processed_at = datetime('now'), admin_memo = ?
        WHERE id = ? AND status IN ('requested', 'approved')`
    ).bind((body.memo || '').slice(0, 300) || null, id).run()
    if (!r.meta?.changes) return c.json({ success: false, error: '이미 처리됐거나 없는 신청입니다' }, 409)

    const row = await DB.prepare('SELECT user_id, net_amount FROM user_withdrawals WHERE id = ?')
      .bind(id).first<{ user_id: string; net_amount: number }>().catch(() => null)
    if (row?.user_id) {
      await DB.prepare(
        `INSERT INTO user_notifications (user_id, type, title, message, link)
         VALUES (?, 'withdrawal_paid', ?, ?, '/u/me/earnings')`
      ).bind(row.user_id, '💸 환급 입금 완료', `₩${Number(row.net_amount).toLocaleString('ko-KR')} (원천징수 차감 후) 입금이 완료되었습니다`).run().catch(() => {})
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '환급 지급 처리 중 오류가 발생했습니다', '[payout-center]')
  }
})

payoutCenterRoutes.patch('/curator/:id/reject', async (c) => {
  try {
    const DB = c.env.DB
    await ensurePayoutCols(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
    const reason = (body.reason || '').slice(0, 300) || '관리자 반려'

    // CAS 선점 후 — 신청 시 딜을 차감한 건(deal_deducted=1)만 복원 (구신청 이중 발행 방지)
    const r = await DB.prepare(
      `UPDATE user_withdrawals SET status = 'rejected', processed_at = datetime('now'), rejection_reason = ?
        WHERE id = ? AND status IN ('requested', 'approved')`
    ).bind(reason, id).run()
    if (!r.meta?.changes) return c.json({ success: false, error: '이미 처리됐거나 없는 신청입니다' }, 409)

    const row = await DB.prepare('SELECT user_id, amount, deal_deducted FROM user_withdrawals WHERE id = ?')
      .bind(id).first<{ user_id: string; amount: number; deal_deducted: number }>().catch(() => null)
    if (row?.user_id && Number(row.deal_deducted) === 1) {
      await DB.prepare(
        "UPDATE user_points SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?"
      ).bind(row.amount, row.user_id).run().catch(() => {})
      await DB.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description)
         VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)`
      ).bind(row.user_id, row.amount, row.amount, row.user_id, `환급 신청 반려 — 딜 복원 (#${id})`).run().catch(() => {})
    }
    if (row?.user_id) {
      await DB.prepare(
        `INSERT INTO user_notifications (user_id, type, title, message, link)
         VALUES (?, 'withdrawal_rejected', ?, ?, '/u/me/earnings')`
      ).bind(row.user_id, '환급 신청이 반려되었습니다', reason).run().catch(() => {})
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '환급 반려 처리 중 오류가 발생했습니다', '[payout-center]')
  }
})

// ── 에이전시 영입 커미션 일괄 지급 (T+7 성숙분) ──
payoutCenterRoutes.post('/agency/:agencyId/paid', async (c) => {
  try {
    const DB = c.env.DB
    await ensurePayoutCols(DB)
    const agencyId = Number(c.req.param('agencyId'))
    if (!Number.isFinite(agencyId) || agencyId <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const body = await c.req.json<{ memo?: string }>().catch(() => ({} as { memo?: string }))

    // 성숙 pending 행 조회 → 행별 CAS claim (동시 클릭 시 한쪽만)
    const { results: rows } = await DB.prepare(
      `SELECT id, commission_amount FROM agency_store_intro_commissions
        WHERE agency_id = ? AND COALESCE(status, 'pending') = 'pending'
          AND datetime(created_at) <= datetime('now', '-7 days')
        LIMIT 500`
    ).bind(agencyId).all<{ id: number; commission_amount: number }>()
    if (!rows?.length) return c.json({ success: false, error: '지급 가능한(7일 경과) 커미션이 없습니다' }, 400)

    const claims = await DB.batch(rows.map(r =>
      DB.prepare(
        "UPDATE agency_store_intro_commissions SET status = 'paid', paid_at = datetime('now') WHERE id = ? AND COALESCE(status, 'pending') = 'pending'"
      ).bind(r.id)
    ))
    const paidRows = rows.filter((_, i) => ((claims[i]?.meta?.changes ?? 0) > 0))
    const total = paidRows.reduce((s, r) => s + (r.commission_amount || 0), 0)
    if (!paidRows.length || total <= 0) return c.json({ success: false, error: '동시 처리됨 — 새로고침 후 확인하세요' }, 409)

    await DB.prepare(
      'INSERT INTO agency_commission_payouts (agency_id, amount, row_count, admin_memo) VALUES (?, ?, ?, ?)'
    ).bind(agencyId, total, paidRows.length, (body.memo || '').slice(0, 300) || null).run().catch(() => {})

    createDashboardNotification(
      DB, 'agency', String(agencyId), 'commission_paid',
      '💸 영입 커미션 입금 완료', `₩${total.toLocaleString('ko-KR')} (${paidRows.length}건) 입금이 완료되었습니다`,
      '/agency',
    ).catch(() => {})

    return c.json({ success: true, data: { amount: total, row_count: paidRows.length } })
  } catch (err) {
    return safeError(c, err, '에이전시 지급 처리 중 오류가 발생했습니다', '[payout-center]')
  }
})

export { payoutCenterRoutes }
