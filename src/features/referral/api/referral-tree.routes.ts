/**
 * Multi-Tier Referral Commission System
 *
 * Tables:
 *   referral_tree        — user hierarchy (parent / grandparent / great_grandparent)
 *   referral_commissions — per-order commission ledger
 *
 * Endpoints (Hono, mounted at /api/referral-tree):
 *   POST /register               — register user in referral tree
 *   POST /calculate-commission    — calculate & grant multi-tier commissions for an order
 *   GET  /my-network              — current user's referral network stats
 *   GET  /my-commissions          — current user's commission history (paginated)
 *   GET  /stats                   — admin: overall referral network stats
 *
 * Exported helper (for internal use, avoids HTTP round-trip):
 *   calculateMultiTierCommission(DB, orderId, orderAmount, buyerUserId)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser, requireAdmin } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database'

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const referralTreeRoutes = new Hono<{ Bindings: Env }>()

referralTreeRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

// ---------------------------------------------------------------------------
// Table creation (idempotent)
// ---------------------------------------------------------------------------

async function ensureReferralTreeTables(DB: D1Database) {
  try {
    await DB.batch([
      DB.prepare(`
        CREATE TABLE IF NOT EXISTS referral_tree (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE,
          user_type TEXT NOT NULL CHECK(user_type IN ('user','seller','agency')),
          parent_id TEXT,
          grandparent_id TEXT,
          great_grandparent_id TEXT,
          depth INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `),
      DB.prepare(`
        CREATE TABLE IF NOT EXISTS referral_commissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER,
          order_amount INTEGER NOT NULL,
          tier INTEGER NOT NULL CHECK(tier IN (1,2,3)),
          beneficiary_id TEXT NOT NULL,
          beneficiary_type TEXT NOT NULL,
          source_user_id TEXT NOT NULL,
          commission_rate REAL NOT NULL,
          commission_amount INTEGER NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','granted','withdrawn')),
          created_at TEXT DEFAULT (datetime('now'))
        )
      `),
    ])
  } catch { /* tables already exist */ }
}

// ---------------------------------------------------------------------------
// Helpers: commission rates from platform_settings
// ---------------------------------------------------------------------------

interface CommissionRates {
  tier1: number // percent, e.g. 10
  tier2: number // percent, e.g. 3
  tier3: number // percent, e.g. 1
}

async function getCommissionRates(DB: D1Database): Promise<CommissionRates> {
  const defaults: CommissionRates = { tier1: 10, tier2: 3, tier3: 1 }
  try {
    const rows = await executeQuery<{ key: string; value: string }>(
      DB,
      `SELECT key, value FROM platform_settings WHERE key IN (
        'tier1_commission_rate', 'tier2_commission_rate', 'tier3_commission_rate'
      )`,
      [],
    )
    for (const r of rows) {
      const v = parseInt(r.value, 10)
      if (isNaN(v) || v < 0) continue
      if (r.key === 'tier1_commission_rate') defaults.tier1 = v
      if (r.key === 'tier2_commission_rate') defaults.tier2 = v
      if (r.key === 'tier3_commission_rate') defaults.tier3 = v
    }
  } catch { /* platform_settings may not exist — use defaults */ }
  return defaults
}

// ---------------------------------------------------------------------------
// Helper: resolve referrer user_id from an affiliate_ref code / user_id / firebase_uid
// ---------------------------------------------------------------------------

async function resolveReferrerId(DB: D1Database, referrerRef: string): Promise<string | null> {
  try {
    const row = await queryFirst<{ id: string }>(
      DB,
      'SELECT id FROM users WHERE id = ? OR firebase_uid = ? OR affiliate_ref = ?',
      [referrerRef, referrerRef, referrerRef],
    )
    return row ? String(row.id) : null
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[referral] affiliate_ref column missing', e)
    // Fallback: try without affiliate_ref (production schema may not have it)
    try {
      const row = await queryFirst<{ id: string }>(
        DB,
        'SELECT id FROM users WHERE id = ? OR firebase_uid = ?',
        [referrerRef, referrerRef],
      )
      return row ? String(row.id) : null
    } catch {
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: look up beneficiary type (user / seller / agency)
// ---------------------------------------------------------------------------

async function getBeneficiaryType(DB: D1Database, userId: string): Promise<string> {
  // Check referral_tree first
  const treeRow = await queryFirst<{ user_type: string }>(
    DB,
    'SELECT user_type FROM referral_tree WHERE user_id = ?',
    [userId],
  )
  if (treeRow?.user_type) return treeRow.user_type

  // Fall back to checking sellers table
  try {
    const sellerRow = await queryFirst<{ id: number }>(
      DB,
      'SELECT id FROM sellers WHERE id = ? OR user_id = ?',
      [userId, userId],
    )
    if (sellerRow) return 'seller'
  } catch { /* table may not exist */ }

  return 'user'
}

// ---------------------------------------------------------------------------
// Core: Calculate multi-tier commissions (exported for internal use)
// ---------------------------------------------------------------------------

export async function calculateMultiTierCommission(
  DB: D1Database,
  orderId: number,
  orderAmount: number,
  buyerUserId: string,
): Promise<Array<{ tier: number; beneficiary_id: string; commission_amount: number }>> {
  await ensureReferralTreeTables(DB)

  // 1. Look up buyer in referral_tree
  const buyerNode = await queryFirst<{
    parent_id: string | null
    grandparent_id: string | null
    great_grandparent_id: string | null
  }>(
    DB,
    'SELECT parent_id, grandparent_id, great_grandparent_id FROM referral_tree WHERE user_id = ?',
    [buyerUserId],
  )

  if (!buyerNode || !buyerNode.parent_id) return []

  // 2. Prevent duplicate commissions for the same order
  const existing = await queryFirst<{ id: number }>(
    DB,
    'SELECT id FROM referral_commissions WHERE order_id = ? LIMIT 1',
    [orderId],
  )
  if (existing) return [] // already processed

  // 3. Get commission rates
  const rates = await getCommissionRates(DB)

  // 4. Build commission entries
  const commissions: Array<{
    tier: number
    beneficiary_id: string
    rate: number
    amount: number
  }> = []

  // Tier 1 — direct referrer (parent)
  if (buyerNode.parent_id) {
    const amount = Math.floor(orderAmount * rates.tier1 / 100)
    if (amount > 0) {
      commissions.push({ tier: 1, beneficiary_id: buyerNode.parent_id, rate: rates.tier1, amount })
    }
  }

  // Tier 2 — referrer's referrer (grandparent)
  if (buyerNode.grandparent_id) {
    const amount = Math.floor(orderAmount * rates.tier2 / 100)
    if (amount > 0) {
      commissions.push({ tier: 2, beneficiary_id: buyerNode.grandparent_id, rate: rates.tier2, amount })
    }
  }

  // Tier 3 — great-grandparent
  if (buyerNode.great_grandparent_id) {
    const amount = Math.floor(orderAmount * rates.tier3 / 100)
    if (amount > 0) {
      commissions.push({ tier: 3, beneficiary_id: buyerNode.great_grandparent_id, rate: rates.tier3, amount })
    }
  }

  if (commissions.length === 0) return []

  // 5. Insert commissions + grant deal points in a single batch (atomic)
  const statements: D1PreparedStatement[] = []

  for (const c of commissions) {
    const beneficiaryType = await getBeneficiaryType(DB, c.beneficiary_id)

    // Insert commission record
    statements.push(
      DB.prepare(
        `INSERT INTO referral_commissions
         (order_id, order_amount, tier, beneficiary_id, beneficiary_type, source_user_id, commission_rate, commission_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'granted')`,
      ).bind(orderId, orderAmount, c.tier, c.beneficiary_id, beneficiaryType, buyerUserId, c.rate / 100, c.amount),
    )

    // Grant deal points to beneficiary
    // For sellers, we still credit deal_balance — they can choose bank withdrawal later
    statements.push(
      DB.prepare(
        'UPDATE users SET deal_balance = deal_balance + ? WHERE id = ?',
      ).bind(c.amount, c.beneficiary_id),
    )
  }

  try {
    await DB.batch(statements)
  } catch (err) {
    // If batch fails (e.g. user doesn't have deal_balance column), try one-by-one
    if (import.meta.env?.DEV) console.error('[ReferralTree] Batch commission failed:', err)
    for (const stmt of statements) {
      try { await stmt.run() } catch { /* individual statement failure is non-fatal */ }
    }
  }

  return commissions.map(c => ({
    tier: c.tier,
    beneficiary_id: c.beneficiary_id,
    commission_amount: c.amount,
  }))
}

// ---------------------------------------------------------------------------
// Core: Register user in referral tree (exported for internal use)
// ---------------------------------------------------------------------------

export async function registerInReferralTree(
  DB: D1Database,
  userId: string,
  userType: 'user' | 'seller' | 'agency',
  referrerId?: string | null,
): Promise<{ success: boolean; depth: number }> {
  await ensureReferralTreeTables(DB)

  // Check if already registered
  const existing = await queryFirst<{ id: number }>(
    DB,
    'SELECT id FROM referral_tree WHERE user_id = ?',
    [userId],
  )
  if (existing) return { success: true, depth: 0 } // already registered, idempotent

  let parentId: string | null = null
  let grandparentId: string | null = null
  let greatGrandparentId: string | null = null
  let depth = 0

  if (referrerId) {
    // Resolve referrer to actual user_id
    const resolvedReferrerId = await resolveReferrerId(DB, referrerId)
    if (resolvedReferrerId && resolvedReferrerId !== userId) {
      // Look up referrer's position in the tree
      const referrerNode = await queryFirst<{
        user_id: string
        parent_id: string | null
        grandparent_id: string | null
        depth: number
      }>(
        DB,
        'SELECT user_id, parent_id, grandparent_id, depth FROM referral_tree WHERE user_id = ?',
        [resolvedReferrerId],
      )

      if (referrerNode) {
        parentId = referrerNode.user_id
        grandparentId = referrerNode.parent_id || null
        greatGrandparentId = referrerNode.grandparent_id || null
        depth = referrerNode.depth + 1
      } else {
        // Referrer exists as user but not in referral_tree yet — register them first (depth 0)
        try {
          await executeRun(
            DB,
            `INSERT OR IGNORE INTO referral_tree (user_id, user_type, depth) VALUES (?, 'user', 0)`,
            [resolvedReferrerId],
          )
        } catch { /* ignore if already exists */ }
        parentId = resolvedReferrerId
        depth = 1
      }
    }
  }

  await executeRun(
    DB,
    `INSERT OR IGNORE INTO referral_tree (user_id, user_type, parent_id, grandparent_id, great_grandparent_id, depth)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, userType, parentId, grandparentId, greatGrandparentId, depth],
  )

  return { success: true, depth }
}

// ===========================================================================
// ENDPOINTS
// ===========================================================================

// ---------------------------------------------------------------------------
// POST /register — Register a user in the referral tree
// ---------------------------------------------------------------------------

referralTreeRoutes.post('/register', async (c) => {
  const { DB } = c.env

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

referralTreeRoutes.post('/calculate-commission', async (c) => {
  const { DB } = c.env

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

referralTreeRoutes.get('/my-network', requireAuth(), async (c) => {
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

referralTreeRoutes.get('/my-commissions', requireAuth(), async (c) => {
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

// ---------------------------------------------------------------------------
// GET /stats — Admin: overall referral network stats
// ---------------------------------------------------------------------------

referralTreeRoutes.get('/stats', requireAdmin(), async (c) => {
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

export { referralTreeRoutes }
