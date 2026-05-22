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

// 🛡️ 2026-05-21 Phase D-4: 셀러 트래킹 클릭 기록 (funnel 측정).
//   capture page 진입 시 자동 호출. IP + UA hash 로 봇 dedup.
//   인증 X (셀러 ID 만 검증).
async function hashShort(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    const arr = Array.from(new Uint8Array(buf))
    return arr.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `len${input.length}`
  }
}

ledgerRoutes.post('/referral/click', async (c) => {
  const body = await c.req.json<{ seller_id?: string; product_id?: number }>().catch(() => ({} as { seller_id?: string; product_id?: number }))
  const sellerId = String(body.seller_id || '').trim()
  if (!/^\d+$/.test(sellerId)) return c.json({ success: false, error: 'Invalid seller_id' }, 400)
  const { DB } = c.env
  // seller 존재 검증 (가짜 ID 차단)
  const exists = await DB.prepare(
    "SELECT 1 FROM sellers WHERE id = ? UNION ALL SELECT 1 FROM users WHERE id = ? LIMIT 1",
  ).bind(sellerId, sellerId).first().catch(() => null)
  if (!exists) return c.json({ success: false, error: 'Seller not found' }, 404)
  // IP + UA 해시
  const ip = c.req.header('CF-Connecting-IP') || ''
  const ua = c.req.header('User-Agent') || ''
  const referer = c.req.header('Referer') || ''
  const ipHash = await hashShort(ip)
  const uaHash = await hashShort(ua)
  // 같은 IP+UA+seller 가 5분 내 재방문 → dedup (봇 방어)
  const recent = await DB.prepare(
    `SELECT id FROM referral_clicks WHERE seller_id = ? AND ip_hash = ? AND user_agent_hash = ?
       AND created_at > datetime('now', '-5 minutes') LIMIT 1`,
  ).bind(sellerId, ipHash, uaHash).first().catch(() => null)
  if (recent) return c.json({ success: true, deduplicated: true })
  await DB.prepare(
    `INSERT INTO referral_clicks (seller_id, product_id, ip_hash, user_agent_hash, referer)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(sellerId, body.product_id || null, ipHash, uaHash, referer.slice(0, 500) || null).run().catch(() => null)
  return c.json({ success: true })
})

// 셀러 본인 funnel KPI — 클릭/주문/commission 합산.
ledgerRoutes.get('/seller/funnel-kpi', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: 'Seller only' }, 403)
  const { DB } = c.env
  const sellerId = String(user.id)
  const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') || '30', 10)))

  const clicks = await DB.prepare(
    `SELECT COUNT(*) as total, COUNT(DISTINCT ip_hash || user_agent_hash) as unique_visitors
       FROM referral_clicks
      WHERE seller_id = ? AND created_at > datetime('now', '-' || ? || ' days')`,
  ).bind(sellerId, days).first<{ total: number; unique_visitors: number }>().catch(() => ({ total: 0, unique_visitors: 0 }))

  const orders = await DB.prepare(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(commission_amount), 0) as commission_total
       FROM referral_commissions
      WHERE beneficiary_id = ? AND created_at > datetime('now', '-' || ? || ' days')`,
  ).bind(sellerId, days).first<{ cnt: number; commission_total: number }>().catch(() => ({ cnt: 0, commission_total: 0 }))

  const totalClicks = Number(clicks?.total ?? 0)
  const totalOrders = Number(orders?.cnt ?? 0)
  const conversionRate = totalClicks > 0 ? totalOrders / totalClicks : 0

  return c.json({
    success: true,
    data: {
      days,
      clicks_total: totalClicks,
      unique_visitors: Number(clicks?.unique_visitors ?? 0),
      orders: totalOrders,
      commission_total: Number(orders?.commission_total ?? 0),
      conversion_rate: Math.round(conversionRate * 10000) / 100, // % 2 자리
    },
  })
})

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
