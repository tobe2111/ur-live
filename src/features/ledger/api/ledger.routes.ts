/**
 * 🛡️ 2026-05-21 Phase D-2: 셀러/에이전시 본인 ledger 조회.
 *
 * GET /api/ledger/my — 본인 ledger entries 페이지네이션
 *   - 셀러: credit_account = 'seller:N' OR 'merchant:N'
 *   - 에이전시: credit_account = 'agency:N'
 *   - 합산 + entries 리스트
 *   - payout 처리됨 / 미처리 구분
 */
import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth'
import type { Env } from '../../../worker/types/env'

export const ledgerRoutes = new Hono<{ Bindings: Env }>()

ledgerRoutes.get('/ledger/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const { DB } = c.env

  // 토큰 type 따라 account prefix 결정
  let accounts: string[] = []
  if (user.type === 'seller') {
    // seller 는 seller commission + merchant payable 둘 다 가능
    accounts = [`seller:${user.id}`, `merchant:${user.id}`]
  } else if (user.type === 'agency') {
    accounts = [`agency:${user.id}`]
  } else if (user.type === 'admin') {
    // admin: 전체 (query param 으로 제한)
    const filter = c.req.query('account')
    if (filter) accounts = [filter]
    else return c.json({ success: false, error: 'admin 은 ?account= 명시 필수' }, 400)
  } else {
    return c.json({ success: false, error: '셀러/에이전시 전용' }, 403)
  }
  if (accounts.length === 0) return c.json({ success: true, data: { summary: {}, entries: [] } })

  const placeholders = accounts.map(() => '?').join(',')

  // 합산
  const summary = await DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN credit_account IN (${placeholders}) THEN amount ELSE 0 END), 0) as total_credit,
      COALESCE(SUM(CASE WHEN debit_account IN (${placeholders}) THEN amount ELSE 0 END), 0) as total_debit,
      COUNT(*) as entry_count
    FROM ledger_entries
    WHERE credit_account IN (${placeholders}) OR debit_account IN (${placeholders})
  `).bind(...accounts, ...accounts, ...accounts, ...accounts).first<{ total_credit: number; total_debit: number; entry_count: number }>().catch(() => ({ total_credit: 0, total_debit: 0, entry_count: 0 }))

  // 이미 payout 처리된 amount
  const paid = await DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payouts
    WHERE (payee_type || ':' || payee_id) IN (${placeholders})
      AND status IN ('approved','sent')
  `).bind(...accounts).first<{ total: number }>().catch(() => ({ total: 0 }))

  // 최근 50 entries
  const entries = await DB.prepare(`
    SELECT id, event_type, reference_id, amount,
           debit_account, credit_account, fee_amount, metadata, created_at
      FROM ledger_entries
     WHERE credit_account IN (${placeholders}) OR debit_account IN (${placeholders})
     ORDER BY created_at DESC
     LIMIT 50
  `).bind(...accounts, ...accounts).all().catch(() => ({ results: [] }))

  // 최근 payouts (송금 이력)
  const recentPayouts = await DB.prepare(`
    SELECT id, amount, status, period_start, period_end, sent_at, transaction_id
      FROM payouts
     WHERE (payee_type || ':' || payee_id) IN (${placeholders})
     ORDER BY created_at DESC
     LIMIT 20
  `).bind(...accounts).all().catch(() => ({ results: [] }))

  const totalEarned = Number(summary?.total_credit ?? 0)
  const totalPaid = Number(paid?.total ?? 0)

  return c.json({
    success: true,
    data: {
      summary: {
        total_earned: totalEarned,        // 누적 외상 발생
        total_paid: totalPaid,             // 이미 송금 완료
        pending: totalEarned - totalPaid,  // 미정산 잔액
        entry_count: Number(summary?.entry_count ?? 0),
      },
      entries: (entries.results || []).map(e => {
        const row = e as Record<string, unknown>
        return { ...row, metadata: row.metadata ? JSON.parse(String(row.metadata)) : null }
      }),
      recent_payouts: recentPayouts.results || [],
    },
  })
})
