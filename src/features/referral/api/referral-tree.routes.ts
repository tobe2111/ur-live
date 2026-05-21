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
import { requireAuth, getCurrentUser, requireAdmin } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { executeRun, executeQuery, queryFirst } from '@/worker/utils/database'
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables'

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const referralTreeRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// ---------------------------------------------------------------------------
// Table creation (idempotent)
// ---------------------------------------------------------------------------

async function ensureReferralTreeTables(DB: D1Database) {
  if (_done_ensureReferralTreeTables.has(DB)) return
  _done_ensureReferralTreeTables.add(DB)
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
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','granted','withdrawal_requested','paid_out','withdrawn')),
          withdrawal_request_id INTEGER,
          paid_out_at TEXT,
          withdrawn_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `),
      DB.prepare(`
        CREATE TABLE IF NOT EXISTS commission_withdrawals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          beneficiary_id TEXT NOT NULL,
          beneficiary_type TEXT NOT NULL CHECK(beneficiary_type IN ('user','seller','agency')),
          total_amount INTEGER NOT NULL,
          commission_count INTEGER NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          bank_name TEXT,
          account_number TEXT,
          account_holder TEXT,
          requested_at TEXT DEFAULT (datetime('now')),
          processed_at TEXT,
          processed_by TEXT,
          admin_memo TEXT,
          rejection_reason TEXT
        )
      `),
    ])
    // 🛡️ 2026-05-21: 기존 production DB 에 누락된 컬럼 자동 ALTER (idempotent).
    for (const sql of [
      "ALTER TABLE referral_commissions ADD COLUMN withdrawn_at TEXT",
      "ALTER TABLE referral_commissions ADD COLUMN withdrawal_request_id INTEGER",
      "ALTER TABLE referral_commissions ADD COLUMN paid_out_at TEXT",
    ]) {
      try { await DB.prepare(sql).run() } catch { /* column exists */ }
    }
    try {
      await DB.prepare("CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_beneficiary ON commission_withdrawals(beneficiary_id, beneficiary_type, status)").run()
    } catch { /* ignore */ }
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

  // 🛡️ 2026-05-05 P0: 셀프 추천 / 셀프 구매 차단 (어뷰징 방지)
  //   - parent_id / grandparent_id 가 자기 자신 = 자기 추천
  //   - 주문의 seller user_id == buyer = 셀프 구매 (커미션 미지급)
  if (buyerNode.parent_id === buyerUserId || buyerNode.grandparent_id === buyerUserId) {
    try {
      await DB.prepare(
        `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
         VALUES ('self_referral', ?, 'order', ?, ?, 'high')`
      ).bind(buyerUserId, String(orderId), JSON.stringify({ buyerNode })).run()
    } catch { /* abuse_detections may not exist yet */ }
    return []
  }
  try {
    const sellerOwner = await queryFirst<{ user_id: string }>(
      DB,
      `SELECT s.user_id FROM orders o JOIN sellers s ON o.seller_id = s.id WHERE o.id = ? LIMIT 1`,
      [orderId],
    )
    if (sellerOwner?.user_id && String(sellerOwner.user_id) === String(buyerUserId)) {
      try {
        await DB.prepare(
          `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
           VALUES ('self_purchase', ?, 'order', ?, ?, 'high')`
        ).bind(buyerUserId, String(orderId), JSON.stringify({ sellerOwner })).run()
      } catch { /* */ }
      return []
    }
  } catch { /* */ }

  // 2. Prevent duplicate commissions for the same order
  const existing = await queryFirst<{ id: number }>(
    DB,
    'SELECT id FROM referral_commissions WHERE order_id = ? LIMIT 1',
    [orderId],
  )
  if (existing) return [] // already processed

  // HIGH-2: If order already has an affiliate_earnings entry, skip referral commissions
  // to prevent double-paying commission through both the affiliate and referral systems.
  try {
    const affExists = await queryFirst<{ one: number }>(
      DB,
      'SELECT 1 as one FROM affiliate_earnings WHERE order_id = ? LIMIT 1',
      [orderId],
    ).catch(() => null)
    if (affExists) {
      if (import.meta.env?.DEV) console.log('[Referral] Order already has affiliate earning, skipping referral commission')
      return []
    }
  } catch { /* affiliate_earnings table may not exist — proceed */ }

  // 3. Get commission rates
  const rates = await getCommissionRates(DB)

  // CRIT-4: Cap total commission rate at platform's max margin to prevent accidental
  // misconfiguration from paying out more than the platform earns.
  // NOTE: commission_rate here is stored as PERCENTAGE (e.g., 10 = 10%), not ratio (0.10).
  // Exception: donations.commission_rate stores as RATIO (0.10).
  const MAX_TOTAL_COMMISSION_RATE = 15 // platform's max margin (%)
  const totalRate = (rates.tier1 || 0) + (rates.tier2 || 0) + (rates.tier3 || 0)
  if (totalRate > MAX_TOTAL_COMMISSION_RATE) {
    if (import.meta.env?.DEV) console.warn(`[Referral] Total commission ${totalRate}% exceeds max ${MAX_TOTAL_COMMISSION_RATE}%; scaling proportionally`)
    const scale = MAX_TOTAL_COMMISSION_RATE / totalRate
    rates.tier1 *= scale
    rates.tier2 *= scale
    rates.tier3 *= scale
  }

  // 4. Build commission entries
  const commissions: Array<{
    tier: number
    beneficiary_id: string
    rate: number
    amount: number
  }> = []

  // CRIT-2: standardized to Math.round() across all settlement/commission
  // calculations to avoid accumulated drift from mixing Math.floor/Math.round.
  // Tier 1 — direct referrer (parent)
  if (buyerNode.parent_id) {
    const amount = Math.round(orderAmount * rates.tier1 / 100)
    if (amount > 0) {
      commissions.push({ tier: 1, beneficiary_id: buyerNode.parent_id, rate: rates.tier1, amount })
    }
  }

  // Tier 2 — referrer's referrer (grandparent)
  if (buyerNode.grandparent_id) {
    const amount = Math.round(orderAmount * rates.tier2 / 100)
    if (amount > 0) {
      commissions.push({ tier: 2, beneficiary_id: buyerNode.grandparent_id, rate: rates.tier2, amount })
    }
  }

  // 🛡️ 2026-05-05: Tier 3 (great-grandparent) 커미션 비활성화.
  //   한국 「방문판매 등에 관한 법률」 다단계 판매 적용 기준 회피:
  //   - 3단계 이상 + 하위 거래실적 비례 보상 = 다단계 판매업 등록 의무 대상
  //   - 본 서비스는 2단계까지만 보상 (parent / grandparent) → 다단계 미해당
  //   재활성화 필요 시 변호사 의견서 + 다단계 판매업 등록 후.
  // const TIER3_ENABLED = false
  // if (TIER3_ENABLED && buyerNode.great_grandparent_id) {
  //   const amount = Math.round(orderAmount * rates.tier3 / 100)
  //   if (amount > 0) {
  //     commissions.push({ tier: 3, beneficiary_id: buyerNode.great_grandparent_id, rate: rates.tier3, amount })
  //   }
  // }

  if (commissions.length === 0) return []

  // Ensure user_points table exists (production users table has no deal_balance column)
  await ensureUserPointsTable(DB)

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

    // Grant deal points to beneficiary via user_points table (Single Source of Truth)
    statements.push(
      DB.prepare(
        `INSERT INTO user_points (user_id, balance, total_charged)
         VALUES (?, ?, 0)
         ON CONFLICT(user_id) DO UPDATE SET
           balance = balance + excluded.balance,
           updated_at = datetime('now')`,
      ).bind(String(c.beneficiary_id), c.amount),
    )
  }

  // HIGH-3: D1 batch atomicity — do NOT fall back to per-statement execution on
  // batch failure. Partial commits (some commissions granted, some points granted)
  // are worse than a full failure we can retry safely.
  try {
    await DB.batch(statements)
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[ReferralTree] Commission batch failed:', err)
    throw new Error('Commission write failed')
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
        // 🛡️ 2026-04-22: 순환 참조 방지 (A→B→A 같은 cycle 차단)
        // 이전: 조상 chain 에 userId 있어도 INSERT 진행 → 무한 보상 루프
        if (
          referrerNode.parent_id === userId ||
          referrerNode.grandparent_id === userId
        ) {
          // 순환 감지 — referrer 없이 직접 depth 0 등록
          parentId = null
          grandparentId = null
          greatGrandparentId = null
          depth = 0
        } else {
          parentId = referrerNode.user_id
          grandparentId = referrerNode.parent_id || null
          greatGrandparentId = referrerNode.grandparent_id || null
          depth = referrerNode.depth + 1

          // 🛡️ depth 제한 — 무한 추천 chain 차단
          if (depth > 3) {
            parentId = null
            grandparentId = null
            greatGrandparentId = null
            depth = 0
          }
        }
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

referralTreeRoutes.post('/register', requireAuth(), async (c) => {
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

referralTreeRoutes.post('/calculate-commission', async (c) => {
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
  if (statusFilter && ['pending', 'granted', 'withdrawal_requested', 'paid_out', 'withdrawn'].includes(statusFilter)) {
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

// ---------------------------------------------------------------------------
// 🛡️ 2026-05-21: Commission 출금 신청 / 어드민 승인
// 흐름: status='granted' commissions → POST /withdrawals (사용자) →
//        status='withdrawal_requested' + commission_withdrawals row 생성 →
//        admin PATCH approve → status='paid_out' + 송금 (수동) OR reject → 'granted' 로 복원.
// ---------------------------------------------------------------------------

const MIN_WITHDRAWAL_AMOUNT = 10_000 // 1만원

referralTreeRoutes.post('/withdrawals', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const { DB } = c.env
  await ensureReferralTreeTables(DB)
  const userId = String(user.id)

  const body = await c.req.json<{ bank_name?: string; account_number?: string; account_holder?: string }>().catch(() => ({}) as { bank_name?: string; account_number?: string; account_holder?: string })
  const bankName = (body.bank_name || '').trim()
  const accountNumber = (body.account_number || '').trim()
  const accountHolder = (body.account_holder || '').trim()

  if (!bankName || !accountNumber || !accountHolder) {
    return c.json({ success: false, error: '은행명/계좌번호/예금주를 모두 입력하세요.' }, 400)
  }
  if (!/^[\d-]{5,30}$/.test(accountNumber)) {
    return c.json({ success: false, error: '계좌번호 형식이 올바르지 않습니다.' }, 400)
  }

  // 출금 가능 commissions 합산 + 잠금 (트랜잭션 대신 status 업데이트로 처리)
  const granted = await executeQuery<{ id: number; commission_amount: number; beneficiary_type: string }>(
    DB,
    "SELECT id, commission_amount, beneficiary_type FROM referral_commissions WHERE beneficiary_id = ? AND status = 'granted'",
    [userId],
  )
  if (granted.length === 0) {
    return c.json({ success: false, error: '출금 가능한 commission 이 없습니다.' }, 400)
  }
  const totalAmount = granted.reduce((sum, r) => sum + (r.commission_amount || 0), 0)
  if (totalAmount < MIN_WITHDRAWAL_AMOUNT) {
    return c.json({ success: false, error: `최소 출금 금액은 ${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}원입니다. (현재 ${totalAmount.toLocaleString()}원)` }, 400)
  }
  const beneficiaryType = granted[0].beneficiary_type || 'user'

  // 출금 요청 row 생성
  const insertResult = await DB.prepare(
    `INSERT INTO commission_withdrawals
       (beneficiary_id, beneficiary_type, total_amount, commission_count, status, bank_name, account_number, account_holder)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).bind(userId, beneficiaryType, totalAmount, granted.length, bankName, accountNumber, accountHolder).run()
  const withdrawalId = insertResult.meta.last_row_id as number

  // commission status 전환
  await DB.prepare(
    `UPDATE referral_commissions
       SET status = 'withdrawal_requested', withdrawal_request_id = ?
     WHERE beneficiary_id = ? AND status = 'granted'`,
  ).bind(withdrawalId, userId).run()

  return c.json({
    success: true,
    data: { withdrawal_id: withdrawalId, total_amount: totalAmount, commission_count: granted.length },
  })
})

referralTreeRoutes.get('/withdrawals', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const { DB } = c.env
  await ensureReferralTreeTables(DB)
  const rows = await executeQuery(
    DB,
    `SELECT id, total_amount, commission_count, status, bank_name, account_number, account_holder,
            requested_at, processed_at, admin_memo, rejection_reason
       FROM commission_withdrawals
      WHERE beneficiary_id = ?
      ORDER BY requested_at DESC
      LIMIT 50`,
    [String(user.id)],
  )
  return c.json({ success: true, data: rows })
})

// ---- Admin endpoints ----

referralTreeRoutes.get('/admin/withdrawals', requireAdmin(), async (c) => {
  const { DB } = c.env
  await ensureReferralTreeTables(DB)
  const status = c.req.query('status') || 'pending'
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
    return c.json({ success: false, error: 'Invalid status' }, 400)
  }
  const where = status === 'all' ? '' : 'WHERE w.status = ?'
  const params: unknown[] = status === 'all' ? [] : [status]
  const rows = await executeQuery(
    DB,
    `SELECT w.id, w.beneficiary_id, w.beneficiary_type, w.total_amount, w.commission_count, w.status,
            w.bank_name, w.account_number, w.account_holder, w.requested_at, w.processed_at,
            w.admin_memo, w.rejection_reason,
            COALESCE(u.name, a.company_name, s.business_name) as beneficiary_name
       FROM commission_withdrawals w
       LEFT JOIN users u ON u.id = w.beneficiary_id AND w.beneficiary_type = 'user'
       LEFT JOIN agencies a ON a.id = w.beneficiary_id AND w.beneficiary_type = 'agency'
       LEFT JOIN sellers s ON s.id = w.beneficiary_id AND w.beneficiary_type = 'seller'
       ${where}
      ORDER BY w.requested_at DESC
      LIMIT 200`,
    params,
  )
  return c.json({ success: true, data: rows })
})

referralTreeRoutes.patch('/admin/withdrawals/:id/approve', requireAdmin(), async (c) => {
  const user = getCurrentUser(c)
  const { DB } = c.env
  await ensureReferralTreeTables(DB)
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ admin_memo?: string }>().catch(() => ({} as { admin_memo?: string }))

  const w = await queryFirst<{ status: string; beneficiary_id: string }>(
    DB,
    "SELECT status, beneficiary_id FROM commission_withdrawals WHERE id = ?",
    [id],
  )
  if (!w) return c.json({ success: false, error: 'Not found' }, 404)
  if (w.status !== 'pending') return c.json({ success: false, error: 'Already processed' }, 409)

  await DB.prepare(
    `UPDATE commission_withdrawals
       SET status = 'approved', processed_at = datetime('now'), processed_by = ?, admin_memo = ?
     WHERE id = ?`,
  ).bind(String(user?.id || 'admin'), body.admin_memo || null, id).run()

  await DB.prepare(
    `UPDATE referral_commissions
       SET status = 'paid_out', paid_out_at = datetime('now')
     WHERE withdrawal_request_id = ? AND status = 'withdrawal_requested'`,
  ).bind(id).run()

  return c.json({ success: true })
})

referralTreeRoutes.patch('/admin/withdrawals/:id/reject', requireAdmin(), async (c) => {
  const user = getCurrentUser(c)
  const { DB } = c.env
  await ensureReferralTreeTables(DB)
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ rejection_reason?: string }>().catch(() => ({} as { rejection_reason?: string }))
  const reason = (body.rejection_reason || '').trim()
  if (!reason) return c.json({ success: false, error: '거절 사유를 입력하세요.' }, 400)

  const w = await queryFirst<{ status: string }>(
    DB, "SELECT status FROM commission_withdrawals WHERE id = ?", [id],
  )
  if (!w) return c.json({ success: false, error: 'Not found' }, 404)
  if (w.status !== 'pending') return c.json({ success: false, error: 'Already processed' }, 409)

  await DB.prepare(
    `UPDATE commission_withdrawals
       SET status = 'rejected', processed_at = datetime('now'), processed_by = ?, rejection_reason = ?
     WHERE id = ?`,
  ).bind(String(user?.id || 'admin'), reason, id).run()

  // commissions 를 다시 granted 로 복원
  await DB.prepare(
    `UPDATE referral_commissions
       SET status = 'granted', withdrawal_request_id = NULL
     WHERE withdrawal_request_id = ? AND status = 'withdrawal_requested'`,
  ).bind(id).run()

  return c.json({ success: true })
})

export { referralTreeRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureReferralTreeTables = new WeakSet<object>()
