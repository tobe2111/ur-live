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
  // 🛡️ 2026-04-22: 자동 취소 시 재고 복구 누락 수정 — 기존 PENDING 에서 예약된 재고가
  //     CANCELLED 로 전환 시 복구되지 않으면 영구 손실. 이제 재고 복구 포함.
  try {
    // 자동 취소 대상 orders 를 먼저 조회 (재고 복구용)
    const toCancel = await DB.prepare(`
      SELECT id FROM orders
      WHERE status = 'PENDING'
        AND created_at < datetime('now', '-24 hours')
        AND (toss_payment_key IS NULL OR toss_payment_key = '')
        AND (payment_key IS NULL OR payment_key = '')
      LIMIT 200
    `).all<{ id: number }>();
    const cancelIds = (toCancel.results || []).map(r => r.id);

    if (cancelIds.length > 0) {
      // 재고 복구 (order_items 조회 후 products.stock 증가)
      const placeholders = cancelIds.map(() => '?').join(',');
      const items = await DB.prepare(
        `SELECT order_id, product_id, quantity FROM order_items WHERE order_id IN (${placeholders})`
      ).bind(...cancelIds).all<{ order_id: number; product_id: number; quantity: number }>();

      const stockStmts = (items.results || []).map(it =>
        DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.quantity, it.product_id)
      );
      if (stockStmts.length > 0) {
        try { await DB.batch(stockStmts); } catch (e) {
          console.error('[Reconciliation] Stock restore batch failed:', e);
        }
      }

      // 주문 상태 전환
      const { meta } = await DB.prepare(
        `UPDATE orders SET status = 'CANCELLED',
           cancel_reason = '자동 정리: 24시간 초과 미결제 (결제 증거 없음)',
           updated_at = datetime('now')
         WHERE id IN (${placeholders}) AND status = 'PENDING'`
      ).bind(...cancelIds).run();
      results.stuck_orders_fixed = meta.changes ?? 0;
      results.stuck_orders_stock_restored = stockStmts.length;
    } else {
      results.stuck_orders_fixed = 0;
    }
  } catch (e) {
    results.stuck_orders_error = (e as Error).message;
  }

  // ── 1b. Auto-reconcile orders WITH payment_key via Toss API ─────────────
  //     For orders stuck PENDING > 1 hour with a payment_key, query Toss
  //     directly. If Toss says DONE, our DB missed the webhook → fix it.
  //     Anything we can't resolve automatically is surfaced for manual review.
  try {
    const stuck = await DB.prepare(`
      SELECT id, order_number, toss_payment_key, total_amount
      FROM orders
      WHERE status = 'PENDING'
        AND created_at < datetime('now', '-1 hour')
        AND toss_payment_key IS NOT NULL
        AND toss_payment_key != ''
      LIMIT 50
    `).all<{ id: string | number; order_number: string; toss_payment_key: string; total_amount: number }>();

    let autoReconciled = 0;
    let stillStuck = 0;

    for (const order of (stuck.results || [])) {
      if (!env.TOSS_SECRET_KEY) {
        stillStuck++;
        continue;
      }
      try {
        const tossRes = await fetch(
          `https://api.tosspayments.com/v1/payments/${order.toss_payment_key}`,
          {
            headers: { Authorization: `Basic ${btoa(env.TOSS_SECRET_KEY + ':')}` },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (tossRes.ok) {
          const tossData = await tossRes.json() as { status?: string };
          if (tossData.status === 'DONE') {
            // Toss confirmed but our DB missed it — fix it.
            await DB.prepare(
              "UPDATE orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ? AND status = 'PENDING'"
            ).bind(order.id).run();
            autoReconciled++;
            details.push({ check: 'reconciled_paid', found: 1, action: `updated_to_paid:${order.order_number}` });
          } else {
            // Toss says not done → leave for manual review.
            stillStuck++;
          }
        } else {
          stillStuck++;
        }
      } catch {
        stillStuck++;
      }
    }

    results.auto_reconciled_paid = autoReconciled;
    if (stillStuck > 0) {
      results.stuck_with_payment_key = stillStuck;
      details.push({ check: 'stuck_with_payment_key', found: stillStuck, action: 'manual_review' });
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

  // 🛡️ 2026-04-22: 웹훅 이벤트 정리 (unbounded growth 방지)
  // 90일 지난 이벤트는 idempotency 관점에서 불필요 (webhook retry window 끝남).
  try {
    const { meta } = await DB.prepare(
      "DELETE FROM stripe_webhook_events WHERE processed_at < datetime('now', '-90 days')"
    ).run();
    results.expired_stripe_webhooks = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  try {
    const { meta } = await DB.prepare(
      "DELETE FROM toss_webhook_events WHERE processed_at < datetime('now', '-90 days')"
    ).run();
    results.expired_toss_webhooks = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // 🛡️ 만료된 계정 잠금 정리 (locked_until 지나면 row 삭제)
  try {
    const { meta } = await DB.prepare(
      "DELETE FROM account_lockouts WHERE locked_until IS NOT NULL AND locked_until < datetime('now')"
    ).run();
    results.expired_lockouts = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // 🛡️ 오래된 채팅 메시지 정리 (90일 이상) — DB 부담 감소
  try {
    const { meta } = await DB.prepare(
      "DELETE FROM chat_messages WHERE created_at < datetime('now', '-90 days')"
    ).run();
    results.expired_chats = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // 🛡️ 방치된 장바구니 (60일 이상) 정리 — 삭제된 상품 포함
  try {
    const { meta } = await DB.prepare(
      "DELETE FROM cart_items WHERE added_at < datetime('now', '-60 days')"
    ).run();
    results.expired_carts = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // Log summary (visible in Cloudflare Worker logs)
  console.log('[Reconciliation] Completed:', JSON.stringify(results));
  if (details.length > 0) {
    console.log('[Reconciliation] Details:', JSON.stringify(details));
  }

  // 🛡️ 2026-04-27: 매출 mismatch 임계값 초과 시 Discord 알림.
  // 기준 (조정 가능):
  //   - stuck_with_payment_key > 5: 토스 결제됐는데 우리 PENDING 인 주문 > 5건
  //   - auto_reconciled_paid > 10: 평소보다 너무 많은 누락 (웹훅 수신 이슈 가능성)
  //   - negative_stock_fixed > 0: 음수 재고 발견 (코드 버그)
  await alertOnReconciliationAnomaly(env, results);
}

interface ReconciliationAlertContext {
  stuck_with_payment_key?: number | string;
  auto_reconciled_paid?: number | string;
  negative_stock_fixed?: number | string;
  [k: string]: number | string | undefined;
}

const STUCK_THRESHOLD = 5;
const AUTO_RECONCILED_THRESHOLD = 10;

async function alertOnReconciliationAnomaly(
  env: Env,
  results: ReconciliationAlertContext,
): Promise<void> {
  const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  const alerts: string[] = [];

  const stuck = Number(results.stuck_with_payment_key) || 0;
  const autoReconciled = Number(results.auto_reconciled_paid) || 0;
  const negativeStock = Number(results.negative_stock_fixed) || 0;

  if (stuck > STUCK_THRESHOLD) {
    alerts.push(`🔴 stuck_with_payment_key=${stuck} (>${STUCK_THRESHOLD}) — 토스 결제됐으나 DB PENDING 주문. 수동 검토 필요.`);
  }
  if (autoReconciled > AUTO_RECONCILED_THRESHOLD) {
    alerts.push(`🟡 auto_reconciled_paid=${autoReconciled} (>${AUTO_RECONCILED_THRESHOLD}) — 평소보다 많은 웹훅 누락 가능성.`);
  }
  if (negativeStock > 0) {
    alerts.push(`🔴 negative_stock_fixed=${negativeStock} — 음수 재고 발견. 코드 버그 의심.`);
  }

  if (alerts.length === 0) return;

  try {
    const { sendDiscordAlert } = await import('../utils/discord-alert');
    await sendDiscordAlert(
      webhook,
      `📊 Daily Reconciliation Anomaly`,
      alerts.join('\n'),
      'warn'
    );
  } catch (err) {
    console.warn('[Reconciliation] Discord alert failed:', err);
  }
}
