/**
 * referral-tree-admin.routes.ts
 *
 * Admin endpoints for the multi-tier referral tree:
 *   GET /stats — overall referral network stats (admin only)
 */

import { Hono } from 'hono'
import { requireAdmin } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { executeQuery, queryFirst } from '@/worker/utils/database'
import { ensureReferralTreeTables } from './referral-tree-helpers'

const referralTreeAdminRoutes = new Hono<{ Bindings: Env }>()

// ---------------------------------------------------------------------------
// GET /stats — Admin: overall referral network stats
// ---------------------------------------------------------------------------

referralTreeAdminRoutes.get('/stats', requireAdmin(), async (c) => {
  const { DB } = c.env
  await ensureReferralTreeTables(DB)

  // Total users in tree
  const totalUsers = await queryFirst<{ cnt: number }>(
    DB,
    'SELECT COUNT(*) as cnt FROM referral_tree',
    [],
  )

  // Average depth
  const avgDepth = await queryFirst<{ avg_depth: number }>(
    DB,
    'SELECT COALESCE(AVG(depth), 0) as avg_depth FROM referral_tree WHERE depth > 0',
    [],
  )

  // Total commissions paid
  const totalPaid = await queryFirst<{ total: number }>(
    DB,
    "SELECT COALESCE(SUM(commission_amount), 0) as total FROM referral_commissions WHERE status IN ('granted', 'withdrawn')",
    [],
  )

  // Total pending
  const totalPending = await queryFirst<{ total: number }>(
    DB,
    "SELECT COALESCE(SUM(commission_amount), 0) as total FROM referral_commissions WHERE status = 'pending'",
    [],
  )

  // Commission count by tier
  const tierStats = await executeQuery<{ tier: number; cnt: number; total: number }>(
    DB,
    `SELECT tier, COUNT(*) as cnt, COALESCE(SUM(commission_amount), 0) as total
     FROM referral_commissions
     GROUP BY tier
     ORDER BY tier`,
    [],
  )

  // Top 10 earners
  const topEarners = await executeQuery<{
    beneficiary_id: string
    total_earned: number
    commission_count: number
  }>(
    DB,
    `SELECT beneficiary_id,
            COALESCE(SUM(commission_amount), 0) as total_earned,
            COUNT(*) as commission_count
     FROM referral_commissions
     WHERE status IN ('granted', 'withdrawn')
     GROUP BY beneficiary_id
     ORDER BY total_earned DESC
     LIMIT 10`,
    [],
  )

  // Enrich top earners with names
  const enrichedTopEarners = []
  for (const earner of topEarners) {
    let name = 'Unknown'
    try {
      const userRow = await queryFirst<{ name: string }>(DB, 'SELECT name FROM users WHERE id = ?', [earner.beneficiary_id])
      if (userRow?.name) name = userRow.name
    } catch { /* ignore */ }
    enrichedTopEarners.push({ ...earner, name })
  }

  // Users by type
  const usersByType = await executeQuery<{ user_type: string; cnt: number }>(
    DB,
    'SELECT user_type, COUNT(*) as cnt FROM referral_tree GROUP BY user_type',
    [],
  )

  return c.json({
    success: true,
    data: {
      total_users_in_tree: totalUsers?.cnt ?? 0,
      average_depth: Math.round((avgDepth?.avg_depth ?? 0) * 100) / 100,
      total_commissions_paid: totalPaid?.total ?? 0,
      total_commissions_pending: totalPending?.total ?? 0,
      tier_breakdown: tierStats,
      top_earners: enrichedTopEarners,
      users_by_type: usersByType,
    },
  })
})

export { referralTreeAdminRoutes }
