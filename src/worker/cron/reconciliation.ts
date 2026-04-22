/**
 * Reconciliation Cron — Daily data integrity checks & cleanup
 * Runs at 0 19 * * * (UTC 19:00 = KST 04:00)
 *
 * Tasks:
 * 1. Fix stuck PENDING orders > 24h → FAILED
 * 2. Clean orphan order_items (no parent order)
 * 3. Detect negative stock → set to 0
 * 4. Clean expired idempotency_keys
 * 5. Clean expired rate_limit_attempts
 * 6. Clean expired sessions
 */

import type { Env } from '../types/env';

export async function runReconciliation(env: Env): Promise<void> {
  const DB = env.DB;
  const results: Record<string, number | string> = {};
  const details: Array<{ check: string; found: number; action: string }> = [];

  // ── 1. Fix stuck PENDING orders > 24h → CANCELLED ──
  // ⚠️  SAFETY: Only auto-cancel orders that have NO payment evidence at Toss.
  //     If `toss_payment_key` (or legacy `payment_key`) is set, the user may
  //     have actually paid and we just missed the webhook. Those require
  //     manual review — never auto-cancel (accounting mismatch risk).
  try {
    const { meta } = await DB.prepare(`
      UPDATE orders
      SET status = 'CANCELLED', cancel_reason = '자동 정리: 24시간 초과 미결제 (결제 증거 없음)', updated_at = datetime('now')
      WHERE status = 'PENDING'
        AND created_at < datetime('now', '-24 hours')
        AND (toss_payment_key IS NULL OR toss_payment_key = '')
        AND (payment_key IS NULL OR payment_key = '')
    `).run();
    results.stuck_orders_fixed = meta.changes ?? 0;
  } catch (e) {
    results.stuck_orders_error = (e as Error).message;
  }

  // ── 1b. Surface stuck orders WITH payment_key for manual admin review ──
  //     Do not auto-cancel — they may have completed at Toss.
  try {
    const stuck = await DB.prepare(`
      SELECT COUNT(*) AS n FROM orders
      WHERE status = 'PENDING'
        AND created_at < datetime('now', '-24 hours')
        AND (
          (toss_payment_key IS NOT NULL AND toss_payment_key != '')
          OR (payment_key IS NOT NULL AND payment_key != '')
        )
    `).first<{ n: number }>();
    if (stuck && (stuck.n ?? 0) > 0) {
      results.stuck_with_payment_key = stuck.n;
      details.push({ check: 'stuck_with_payment_key', found: stuck.n, action: 'manual_review' });
    }
  } catch (e) {
    results.stuck_with_payment_key_error = (e as Error).message;
  }

  // ── 2. Clean orphan order_items (no parent order) ──
  try {
    const { meta } = await DB.prepare(`
      DELETE FROM order_items
      WHERE order_id NOT IN (SELECT id FROM orders)
    `).run();
    results.orphan_items_cleaned = meta.changes ?? 0;
  } catch (e) {
    results.orphan_items_error = (e as Error).message;
  }

  // ── 3. Detect negative stock → set to 0 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE products
      SET stock = 0, updated_at = datetime('now')
      WHERE stock < 0
    `).run();
    results.negative_stock_fixed = meta.changes ?? 0;
  } catch (e) {
    results.negative_stock_error = (e as Error).message;
  }

  // ── 4. Clean expired idempotency_keys (older than 7 days) ──
  try {
    const { meta } = await DB.prepare(`
      DELETE FROM idempotency_keys
      WHERE created_at < datetime('now', '-7 days')
    `).run();
    results.expired_idempotency_keys = meta.changes ?? 0;
  } catch (e) {
    // Table may not exist — ignore silently
    results.idempotency_keys_note = 'table may not exist';
  }

  // ── 5. Clean expired rate_limit_attempts (older than 1 day) ──
  try {
    const { meta } = await DB.prepare(`
      DELETE FROM rate_limit_attempts
      WHERE created_at < datetime('now', '-1 day')
    `).run();
    results.expired_rate_limits = meta.changes ?? 0;
  } catch (e) {
    // Table may not exist — ignore silently
    results.rate_limits_note = 'table may not exist';
  }

  // ── 6. Clean expired sessions (older than 30 days) ──
  try {
    const { meta } = await DB.prepare(`
      DELETE FROM sessions
      WHERE (expires_at IS NOT NULL AND expires_at < datetime('now'))
         OR created_at < datetime('now', '-30 days')
    `).run();
    results.expired_sessions = meta.changes ?? 0;
  } catch (e) {
    // Table may not exist — ignore silently
    results.sessions_note = 'table may not exist';
  }

  // Log summary (visible in Cloudflare Worker logs)
  console.log('[Reconciliation] Completed:', JSON.stringify(results));
  if (details.length > 0) {
    console.log('[Reconciliation] Details:', JSON.stringify(details));
  }
}
