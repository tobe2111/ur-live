/**
 * referral-tree-user.routes.ts
 *
 * User-facing and internal commission endpoints for the referral tree:
 *   POST /register               — register user in referral tree
 *   POST /calculate-commission   — calculate & grant commissions (internal token)
 *   GET  /my-network             — current user's referral network stats
 *   GET  /my-commissions         — current user's commission history (paginated)
 */

import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { executeQuery, queryFirst } from '@/worker/utils/database'
import { calculateMultiTierCommission, registerInReferralTree } from './referral-tree-core'
import { ensureReferralTreeTables } from './referral-tree-helpers'

const referralTreeUserRoutes = new Hono<{ Bindings: Env }>()

// ---------------------------------------------------------------------------
// POST /register — Register a user in the referral tree
// ---------------------------------------------------------------------------

referralTreeUserRoutes.post('/register', requireAuth(), async (c) => {
  const { DB } = c.env
  const authUser = getCurrentUser(c)
  if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    user_id: string
    user_type: 'user' | 'seller' | 'agency'
    referrer_id?: string
  }>().catch(() => null)

  if (!body?.user_id || !body?.user_type) {
    return c.json({ success: false, error: 'user_id and user_type are required' }, 400)
  }

  if (!['user', 'seller', 'agency'].includes(body.user_type)) {
    return c.json({ success: false, error: 'user_type must be user, seller, or agency' }, 400)
  }

  // ✅ AUTH FIX: Only allow registering your own user_id (admin can register any)
  if (body.user_id !== String(authUser.id) && authUser.type !== 'admin') {
    return c.json({ success: false, error: 'forbidden' }, 403)
  }

  try {
    const result = await registerInReferralTree(DB, body.user_id, body.user_type, body.referrer_id)
    return c.json({ success: true, data: result })
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[ReferralTree] Register error:', err)
    return c.json({ success: false, error: 'Failed to register in referral tree' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /calculate-commission — Calculate multi-tier commissions for an order
// ---------------------------------------------------------------------------

referralTreeUserRoutes.post('/calculate-commission', async (c) => {
  const { DB } = c.env

  // ✅ AUTH FIX: Internal-only endpoint — require shared token
  const internalToken = c.env.INTERNAL_API_TOKEN
  if (!internalToken || c.req.header('X-Internal-Token') !== internalToken) {
    return c.json({ success: false, error: 'forbidden' }, 403)
  }

  const body = await c.req.json<{
    order_id: number
    order_amount: number
    buyer_user_id: string
  }>().catch(() => null)

  if (!body?.order_id || !body?.order_amount || !body?.buyer_user_id) {
    return c.json({ success: false, error: 'order_id, order_amount, and buyer_user_id are required' }, 400)
  }

  try {
    const commissions = await calculateMultiTierCommission(DB, body.order_id, body.order_amount, body.buyer_user_id)
    return c.json({ success: true, data: { commissions, count: commissions.length } })
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[ReferralTree] Commission calc error:', err)
    return c.json({ success: false, error: 'Failed to calculate commissions' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /my-network — View my referral network
// ---------------------------------------------------------------------------

referralTreeUserRoutes.get('/my-network', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const { DB } = c.env
  await ensureReferralTreeTables(DB)

  const userId = String(user.id)

  // Direct referrals (tier 1): users whose parent_id = me
  const directReferrals = await executeQuery<{
    user_id: string
    user_type: string
    created_at: string
  }>(
    DB,
    `SELECT rt.user_id, rt.user_type, rt.created_at
     FROM referral_tree rt
     WHERE rt.parent_id = ?
     ORDER BY rt.created_at DESC`,
    [userId],
  )

  // Tier 2: users whose grandparent_id = me
  const tier2Count = await queryFirst<{ cnt: number }>(
    DB,
    'SELECT COUNT(*) as cnt FROM referral_tree WHERE grandparent_id = ?',
    [userId],
  )

  // Tier 3: users whose great_grandparent_id = me
  const tier3Count = await queryFirst<{ cnt: number }>(
    DB,
    'SELECT COUNT(*) as cnt FROM referral_tree WHERE great_grandparent_id = ?',
    [userId],
  )

  // Total earned
  const totalEarned = await queryFirst<{ total: number }>(
    DB,
    "SELECT COALESCE(SUM(commission_amount), 0) as total FROM referral_commissions WHERE beneficiary_id = ? AND status IN ('granted', 'withdrawn')",
    [userId],
  )

  // Enrich direct referrals with name and their total earnings
  const enrichedReferrals = []
  for (const ref of directReferrals.slice(0, 50)) { // limit to 50
    let name = 'Unknown'
    try {
      const userRow = await queryFirst<{ name: string }>(DB, 'SELECT name FROM users WHERE id = ?', [ref.user_id])
      if (userRow?.name) name = userRow.name
    } catch { /* ignore */ }

    const earnings = await queryFirst<{ total: number }>(
      DB,
      "SELECT COALESCE(SUM(commission_amount), 0) as total FROM referral_commissions WHERE beneficiary_id = ? AND status IN ('granted', 'withdrawn')",
      [ref.user_id],
    )

    enrichedReferrals.push({
      user_id: ref.user_id,
      user_type: ref.user_type,
      name,
      join_date: ref.created_at,
      total_earnings: earnings?.total ?? 0,
    })
  }

  return c.json({
    success: true,
    data: {
      direct_referrals: directReferrals.length,
      tier2_referrals: tier2Count?.cnt ?? 0,
      tier3_referrals: tier3Count?.cnt ?? 0,
      total_earned: totalEarned?.total ?? 0,
      referrals: enrichedReferrals,
    },
  })
})

// ---------------------------------------------------------------------------
// GET /my-commissions — My commission history (paginated)
// ---------------------------------------------------------------------------

referralTreeUserRoutes.get('/my-commissions', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

  const { DB } = c.env
  await ensureReferralTreeTables(DB)

  const userId = String(user.id)
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('page_size') || '20', 10)))
  const offset = (page - 1) * pageSize

  // Optional filters
  const tierFilter = c.req.query('tier')
  const statusFilter = c.req.query('status')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')

  // Build dynamic WHERE clause
  const conditions: string[] = ['beneficiary_id = ?']
  const params: unknown[] = [userId]

  if (tierFilter && ['1', '2', '3'].includes(tierFilter)) {
    conditions.push('tier = ?')
    params.push(parseInt(tierFilter, 10))
  }
  if (statusFilter && ['pending', 'granted', 'withdrawn'].includes(statusFilter)) {
    conditions.push('status = ?')
    params.push(statusFilter)
  }
  if (dateFrom) {
    conditions.push('created_at >= ?')
    params.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('created_at <= ?')
    params.push(dateTo)
  }

  const whereClause = conditions.join(' AND ')

  // Total count
  const totalRow = await queryFirst<{ cnt: number }>(
    DB,
    `SELECT COUNT(*) as cnt FROM referral_commissions WHERE ${whereClause}`,
    params,
  )
  const total = totalRow?.cnt ?? 0

  // Paginated results
  const commissions = await executeQuery<{
    id: number
    order_id: number
    order_amount: number
    tier: number
    source_user_id: string
    commission_rate: number
    commission_amount: number
    status: string
    created_at: string
  }>(
    DB,
    `SELECT id, order_id, order_amount, tier, source_user_id, commission_rate, commission_amount, status, created_at
     FROM referral_commissions
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )

  // Summary totals
  const summaryRow = await queryFirst<{
    total_pending: number
    total_granted: number
    total_withdrawn: number
  }>(
    DB,
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as total_pending,
       COALESCE(SUM(CASE WHEN status = 'granted' THEN commission_amount ELSE 0 END), 0) as total_granted,
       COALESCE(SUM(CASE WHEN status = 'withdrawn' THEN commission_amount ELSE 0 END), 0) as total_withdrawn
     FROM referral_commissions
     WHERE beneficiary_id = ?`,
    [userId],
  )

  return c.json({
    success: true,
    data: {
      commissions,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
      summary: {
        total_pending: summaryRow?.total_pending ?? 0,
        total_granted: summaryRow?.total_granted ?? 0,
        total_withdrawn: summaryRow?.total_withdrawn ?? 0,
      },
    },
  })
})

export { referralTreeUserRoutes }
