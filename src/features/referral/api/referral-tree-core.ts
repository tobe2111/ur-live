/**
 * referral-tree-core.ts
 *
 * Core business logic for the multi-tier referral tree:
 *   - calculateMultiTierCommission  (exported for internal use, avoids HTTP round-trip)
 *   - registerInReferralTree        (exported for internal use)
 */

import { executeRun, queryFirst } from '@/worker/utils/database'
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables'
import {
  ensureReferralTreeTables,
  getCommissionRates,
  getBeneficiaryType,
  resolveReferrerId,
} from './referral-tree-helpers'

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

  // Tier 3 — great-grandparent
  if (buyerNode.great_grandparent_id) {
    const amount = Math.round(orderAmount * rates.tier3 / 100)
    if (amount > 0) {
      commissions.push({ tier: 3, beneficiary_id: buyerNode.great_grandparent_id, rate: rates.tier3, amount })
    }
  }

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
