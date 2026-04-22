/**
 * Fallback CREATE TABLE helpers.
 *
 * These exist because several code paths need `user_points` /
 * `point_transactions` to be present even if the corresponding migration
 * (`0130_add_user_points_system.sql`) has not yet been applied. Historically
 * each call-site inlined its own `CREATE TABLE IF NOT EXISTS` — with
 * slightly-different schemas. Consolidating here gives us ONE source of
 * truth so every fallback matches the migration exactly.
 *
 * Rules:
 * - Keep schemas byte-identical to the corresponding migration.
 * - Swallow errors (table already exists / concurrent CREATE) defensively.
 * - Never throw from ensure-helpers — they are best-effort.
 */

import type { D1Database } from '@cloudflare/workers-types'

/**
 * Log ensure-table failures only in DEV so we can diagnose schema drift
 * during local development. In production we stay silent — these are
 * best-effort fallbacks and the actual migration should already have run.
 */
function logDev(tag: string, err: unknown): void {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      console.warn(`[${tag}] failed:`, err)
    }
  } catch {
    // import.meta unavailable (test env, etc.) — stay silent.
  }
}

/**
 * Ensure the `user_points` table exists.
 *
 * Schema mirrors `migrations/0130_add_user_points_system.sql`:
 *   - user_id:        TEXT PK (always stored as String(userId))
 *   - balance:        INTEGER NOT NULL DEFAULT 0
 *   - total_charged:  INTEGER NOT NULL DEFAULT 0
 *   - total_donated:  INTEGER NOT NULL DEFAULT 0
 *   - created_at / updated_at: datetime('now') defaults
 */
export async function ensureUserPointsTable(DB: D1Database): Promise<void> {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_points (
        user_id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        total_charged INTEGER NOT NULL DEFAULT 0,
        total_donated INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `).run()
  } catch (e) {
    // Table already exists or a concurrent CREATE won the race — both fine.
    logDev('ensureUserPointsTable', e)
  }
}

/**
 * Ensure the `point_transactions` table exists.
 *
 * Schema mirrors `migrations/0130_add_user_points_system.sql`.
 */
export async function ensurePointTransactionsTable(DB: D1Database): Promise<void> {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        commission_amount INTEGER NOT NULL DEFAULT 0,
        points_amount INTEGER NOT NULL DEFAULT 0,
        balance_after INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        payment_key TEXT,
        order_id TEXT,
        stream_id INTEGER,
        seller_id INTEGER,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run()
  } catch {
    // Already exists — fine.
  }
}

/**
 * Convenience: ensure both point tables in one call.
 * Use this everywhere except `points.routes.ts`, which additionally enforces
 * a CHECK constraint on `type` and is kept separate for that reason.
 */
export async function ensurePointsTables(DB: D1Database): Promise<void> {
  await ensureUserPointsTable(DB)
  await ensurePointTransactionsTable(DB)
}
