/**
 * 🛡️ 2026-05-21 Phase C: 어드민 payouts 관리 — 정산 검토 + 송금 처리.
 *
 * Endpoints:
 *   GET    /api/admin/payouts/pending — 정산 대기 중 그룹 (payee 별 합산)
 *   POST   /api/admin/payouts/generate — 주기간 ledger 집계 → payouts row 생성
 *   PATCH  /api/admin/payouts/:id/approve — 송금 승인 (status='approved')
 *   PATCH  /api/admin/payouts/:id/sent — 실제 송금 완료 마킹 (transaction_id 기록)
 *   PATCH  /api/admin/payouts/:id/cancel — 취소
 *   GET    /api/admin/payouts — 목록 조회 (status 필터)
 */
import { Hono } from 'hono'
import { requireAdmin } from '../../../worker/middleware/auth'
import type { Env } from '../../../worker/types/env'

export const adminPayoutsRoutes = new Hono<{ Bindings: Env }>()

interface PendingGroup {
  payee_type: string
  payee_id: string
  total: number
  entry_count: number
}

// 정산 대기 잔액 (ledger credit - 이미 payout 처리된 amount).
adminPayoutsRoutes.get('/admin/payouts/pending', requireAdmin(), async (c) => {
  const { DB } = c.env
  try {
    // ledger 의 모든 credit (외상 발생) - 이미 payout 처리된 합.
    const rows = await DB.prepare(`
      WITH credits AS (
        SELECT credit_account, SUM(amount) as total
          FROM ledger_entries
         WHERE credit_account LIKE 'merchant:%'
            OR credit_account LIKE 'seller:%'
            OR credit_account LIKE 'agency:%'
         GROUP BY credit_account
      ),
      paid AS (
        SELECT (payee_type || ':' || payee_id) as account, SUM(amount) as total
          FROM payouts
         WHERE status IN ('approved','sent')
         GROUP BY payee_type, payee_id
      )
      SELECT
        c.credit_account as account,
        c.total - COALESCE(p.total, 0) as pending_amount,
        c.total as total_credited,
        COALESCE(p.total, 0) as total_paid
      FROM credits c
      LEFT JOIN paid p ON p.account = c.credit_account
      WHERE c.total - COALESCE(p.total, 0) > 0
      ORDER BY pending_amount DESC
      LIMIT 200
    `).all<{ account: string; pending_amount: number; total_credited: number; total_paid: number }>().catch(() => ({ results: [] as Array<{ account: string; pending_amount: number; total_credited: number; total_paid: number }> }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 주기간 정산 일괄 생성 — pending 잔액을 payouts row 로 변환.
adminPayoutsRoutes.post('/admin/payouts/generate', requireAdmin(), async (c) => {
  const body = await c.req.json<{ period_start?: string; period_end?: string; min_amount?: number }>().catch(() => ({} as { period_start?: string; period_end?: string; min_amount?: number }))
  const periodStart = body.period_start || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const periodEnd = body.period_end || new Date().toISOString().slice(0, 10)
  const minAmount = Math.max(1000, Number(body.min_amount) || 10000)
  const { DB } = c.env

  // pending 조회
  const pendingRes = await fetch(new URL('/api/admin/payouts/pending', c.req.url).toString(), {
    headers: { Authorization: c.req.header('Authorization') || '' },
  }).catch(() => null)
  if (!pendingRes || !pendingRes.ok) {
    // fallback — 직접 쿼리
  }

  // 직접 SQL 로 pending 계산
  const pendingRows = await DB.prepare(`
    WITH credits AS (
      SELECT credit_account, SUM(amount) as total
        FROM ledger_entries
       WHERE (credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%')
         AND created_at BETWEEN ? AND ?
       GROUP BY credit_account
    ),
    paid AS (
      SELECT (payee_type || ':' || payee_id) as account, SUM(amount) as total
        FROM payouts
       WHERE status IN ('approved','sent')
       GROUP BY payee_type, payee_id
    )
    SELECT c.credit_account as account, c.total - COALESCE(p.total, 0) as pending_amount
      FROM credits c
      LEFT JOIN paid p ON p.account = c.credit_account
     WHERE c.total - COALESCE(p.total, 0) >= ?
  `).bind(periodStart + ' 00:00:00', periodEnd + ' 23:59:59', minAmount).all<{ account: string; pending_amount: number }>().catch(() => ({ results: [] as Array<{ account: string; pending_amount: number }> }))

  let created = 0
  for (const r of pendingRows.results || []) {
    const [type, id] = r.account.split(':')
    if (!type || !id) continue
    if (!['merchant', 'seller', 'agency', 'store_owner', 'user'].includes(type)) continue
    const payeeType = type === 'merchant' ? 'store_owner' : type
    // 계좌 정보 조회 (sellers / agencies)
    let bankName: string | null = null, accountNumber: string | null = null, accountHolder: string | null = null
    try {
      if (payeeType === 'store_owner' || payeeType === 'seller') {
        const row = await DB.prepare('SELECT bank_account, business_name FROM sellers WHERE id = ?').bind(id).first<{ bank_account: string | null; business_name: string | null }>()
        accountNumber = row?.bank_account || null
        accountHolder = row?.business_name || null
      } else if (payeeType === 'agency') {
        const row = await DB.prepare('SELECT name FROM agencies WHERE id = ?').bind(id).first<{ name: string | null }>()
        accountHolder = row?.name || null
      }
    } catch { /* graceful */ }

    try {
      await DB.prepare(
        `INSERT INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, bank_name, account_number, account_holder)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      ).bind(payeeType, id, r.pending_amount, periodStart, periodEnd, bankName, accountNumber, accountHolder).run()
      created++
    } catch (e) {
      console.error('[payouts generate] insert failed', e)
    }
  }

  return c.json({ success: true, data: { created, period_start: periodStart, period_end: periodEnd } })
})

adminPayoutsRoutes.get('/admin/payouts', requireAdmin(), async (c) => {
  const status = c.req.query('status') || 'pending'
  const { DB } = c.env
  const valid = ['pending', 'approved', 'sent', 'failed', 'cancelled', 'all']
  if (!valid.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
  const where = status === 'all' ? '' : 'WHERE status = ?'
  const params: unknown[] = status === 'all' ? [] : [status]
  const rows = await DB.prepare(
    `SELECT * FROM payouts ${where} ORDER BY created_at DESC LIMIT 200`,
  ).bind(...params).all().catch(() => ({ results: [] }))
  return c.json({ success: true, data: rows.results || [] })
})

adminPayoutsRoutes.patch('/admin/payouts/:id/approve', requireAdmin(), async (c) => {
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const { DB } = c.env
  const row = await DB.prepare('SELECT status FROM payouts WHERE id = ?').bind(id).first<{ status: string }>()
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)
  if (row.status !== 'pending') return c.json({ success: false, error: 'Not pending' }, 409)
  await DB.prepare(
    `UPDATE payouts SET status = 'approved', approved_at = datetime('now') WHERE id = ?`,
  ).bind(id).run()
  return c.json({ success: true })
})

adminPayoutsRoutes.patch('/admin/payouts/:id/sent', requireAdmin(), async (c) => {
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ transaction_id?: string; admin_memo?: string }>().catch(() => ({} as { transaction_id?: string; admin_memo?: string }))
  const txId = (body.transaction_id || '').trim()
  if (!txId) return c.json({ success: false, error: 'transaction_id 필수 (은행/토스 송금 ID)' }, 400)
  const { DB } = c.env
  const row = await DB.prepare('SELECT status FROM payouts WHERE id = ?').bind(id).first<{ status: string }>()
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)
  if (!['pending', 'approved'].includes(row.status)) return c.json({ success: false, error: '이미 처리됨' }, 409)
  await DB.prepare(
    `UPDATE payouts SET status = 'sent', sent_at = datetime('now'), transaction_id = ?, admin_memo = ? WHERE id = ?`,
  ).bind(txId, body.admin_memo || null, id).run()
  return c.json({ success: true })
})

adminPayoutsRoutes.patch('/admin/payouts/:id/cancel', requireAdmin(), async (c) => {
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
  const { DB } = c.env
  const row = await DB.prepare('SELECT status FROM payouts WHERE id = ?').bind(id).first<{ status: string }>()
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)
  if (row.status === 'sent') return c.json({ success: false, error: '이미 송금됨 — reverse 는 별도 처리' }, 409)
  await DB.prepare(
    `UPDATE payouts SET status = 'cancelled', error_message = ? WHERE id = ?`,
  ).bind(body.reason || '관리자 취소', id).run()
  return c.json({ success: true })
})
