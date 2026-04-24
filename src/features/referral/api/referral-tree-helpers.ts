/**
 * referral-tree-helpers.ts
 *
 * Shared internal helpers for the multi-tier referral tree system:
 *   - Table creation (idempotent)
 *   - Commission rates from platform_settings
 *   - resolveReferrerId
 *   - getBeneficiaryType
 */

import { executeQuery, queryFirst } from '@/worker/utils/database'

// ---------------------------------------------------------------------------
// Table creation (idempotent)
// ---------------------------------------------------------------------------

export async function ensureReferralTreeTables(DB: D1Database) {
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

export interface CommissionRates {
  tier1: number // percent, e.g. 10
  tier2: number // percent, e.g. 3
  tier3: number // percent, e.g. 1
}

export async function getCommissionRates(DB: D1Database): Promise<CommissionRates> {
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

export async function resolveReferrerId(DB: D1Database, referrerRef: string): Promise<string | null> {
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

export async function getBeneficiaryType(DB: D1Database, userId: string): Promise<string> {
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
