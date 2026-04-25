/**
 * 딜 포인트 충전 관련 라우트
 *
 * GET  /balance        - 잔액 조회
 * GET  /charge-options - 충전 옵션 목록
 * GET  /history        - 거래 내역
 * POST /charge/init    - 충전 결제 시작
 * POST /charge/confirm - 충전 결제 확인 (토스 승인)
 */

import { Hono } from 'hono';
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth';
import { rateLimit } from '../../../worker/middleware/rate-limit';
import type { Env } from '../../../worker/types/env';
import { TOSS_PAYMENT_URL } from '../../../shared/constants';
import { createDashboardNotification } from '../../notifications/api/dashboard-notifications.routes';
import { CHARGE_AMOUNTS, ensureTables } from './points-helpers';

export const pointsChargeRoutes = new Hono<{ Bindings: Env }>();

// ── GET /balance ──────────────────────────────────────────────────────
pointsChargeRoutes.get('/balance', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  // H8: user_points.user_id는 TEXT — 항상 String(user.id)로 통일하여 TEXT/INTEGER 혼용 방지
  const userId = String(user.id);
  const row = await DB.prepare('SELECT balance, total_charged, total_donated FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number; total_charged: number; total_donated: number }>();

  return c.json({
    success: true,
    data: {
      balance: row?.balance ?? 0,
      total_charged: row?.total_charged ?? 0,
      total_donated: row?.total_donated ?? 0,
    },
  });
});

// ── GET /charge-options ───────────────────────────────────────────────
pointsChargeRoutes.get('/charge-options', async (c) => {
  return c.json({ success: true, data: CHARGE_AMOUNTS });
});

// ── GET /history ──────────────────────────────────────────────────────
pointsChargeRoutes.get('/history', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  // H8: user_points.user_id는 TEXT — 항상 String(user.id)로 통일
  const userId = String(user.id);
  const { results } = await DB.prepare(
    'SELECT id, type, amount, points_amount, balance_after, description, created_at FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).bind(userId).all();

  return c.json({ success: true, data: results ?? [] });
});

// ── POST /charge/init ─────────────────────────────────────────────────
pointsChargeRoutes.post('/charge/init', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { amount } = await c.req.json<{ amount: number }>();

  const pkg = CHARGE_AMOUNTS.find(p => p.amount === amount);
  if (!pkg) {
    return c.json({ success: false, error: `유효하지 않은 충전 금액입니다. 가능: ${CHARGE_AMOUNTS.map(p => p.amount).join(', ')}` }, 400);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id); // H8: 항상 문자열로 통일
  const orderId = `DEAL-${userId}-${Date.now()}`;

  // ✅ SECURITY FIX (H5): Reject if this user already has a pending charge
  // within the last hour. Prevents creating many unconfirmed pending rows that
  // could later be abused for duplicate credit.
  try {
    const existing = await DB.prepare(
      "SELECT id FROM point_transactions WHERE user_id = ? AND type = 'charge' AND payment_key IS NULL AND created_at > datetime('now', '-1 hour')"
    ).bind(userId).first<{ id: number }>();
    if (existing) {
      return c.json({ success: false, error: '이미 진행 중인 충전이 있습니다. 잠시 후 다시 시도해주세요.' }, 409);
    }
  } catch { /* column/shape fallback: skip guard */ }

  // pending 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
    VALUES (?, 'charge', ?, ?, ?, 0, ?, ?)
  `).bind(
    userId, amount, 0, pkg.points, // 충전은 수수료 0 (1:1)
    `딜 ${pkg.points.toLocaleString()}개 충전`, orderId
  ).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount,
      points: pkg.points,
      commission: 0, // 충전은 수수료 없음
      orderName: `딜 ${pkg.points.toLocaleString()}개 충전`,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /charge/confirm ──────────────────────────────────────────────
pointsChargeRoutes.post('/charge/confirm', rateLimit({ action: 'points_charge_confirm', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { paymentKey, orderId, amount } = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  if (!paymentKey || !orderId || !amount) {
    return c.json({ success: false, error: '필수 항목 누락' }, 400);
  }

  const { DB } = c.env;

  // pending 트랜잭션 조회 (금액 검증)
  const userId = String(user.id); // H8: 항상 문자열로 통일
  const pending = await DB.prepare(
    'SELECT id, amount, points_amount, payment_key, balance_after FROM point_transactions WHERE order_id = ? AND user_id = ? AND type = ?'
  ).bind(orderId, userId, 'charge').first<{ id: number; amount: number; points_amount: number; payment_key: string | null; balance_after: number }>();

  if (!pending) return c.json({ success: false, error: '충전 정보를 찾을 수 없습니다' }, 404);
  if (pending.amount !== amount) return c.json({ success: false, error: '금액이 일치하지 않습니다' }, 400);

  // ✅ SECURITY FIX (Payment C6): If this transaction has already been credited
  // (payment_key populated), return existing balance WITHOUT re-crediting.
  if (pending.payment_key) {
    const current = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    return c.json({
      success: true,
      data: {
        points_added: 0,
        balance: current?.balance ?? pending.balance_after ?? 0,
      },
      message: '이미 처리된 충전입니다',
    });
  }

  // 토스 결제 승인
  const tossRes = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
      'Content-Type': 'application/json',
      // Scoped per (orderId, paymentKey) so retries against Toss are safely
      // de-duplicated even if the same paymentKey were ever reused across
      // different orders. Duplicate detection at the DB layer is enforced
      // above via the `payment_key`-CAS update.
      'Idempotency-Key': `points_charge_${orderId}_${paymentKey}`,
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string; code?: string }>();
    if (err.code !== 'ALREADY_PROCESSED_PAYMENT') {
      return c.json({ success: false, error: err.message ?? '결제 승인 실패' }, 400);
    }
    // ALREADY_PROCESSED_PAYMENT: double-check CAS didn't already credit
  }

  // 포인트 적립
  const pointsToAdd = pending.points_amount;

  // ✅ CAS (compare-and-swap) FIX for Payment C6: only credit if payment_key
  // is still NULL. If another concurrent request already won the race, skip.
  const casResult = await DB.prepare(
    'UPDATE point_transactions SET payment_key = ? WHERE id = ? AND payment_key IS NULL'
  ).bind(paymentKey, pending.id).run();

  if (!casResult.meta.changes) {
    // Another request already credited — return current balance untouched
    const current = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    return c.json({
      success: true,
      data: {
        points_added: 0,
        balance: current?.balance ?? 0,
      },
      message: '이미 처리된 충전입니다',
    });
  }

  // user_points UPSERT — only runs once per transaction thanks to CAS above
  await DB.prepare(`
    INSERT INTO user_points (user_id, balance, total_charged)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      balance = balance + ?,
      total_charged = total_charged + ?,
      updated_at = datetime('now')
  `).bind(userId, pointsToAdd, pointsToAdd, pointsToAdd, pointsToAdd).run();

  // 잔액 조회
  const updated = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  // 트랜잭션의 balance_after 업데이트 (payment_key는 CAS에서 이미 기록됨)
  await DB.prepare(
    'UPDATE point_transactions SET balance_after = ? WHERE id = ?'
  ).bind(updated?.balance ?? pointsToAdd, pending.id).run();

  // 딜 충전 → 어드민 알림
  createDashboardNotification(
    DB, 'admin', null, 'deal_charged',
    '딜 충전',
    `${amount.toLocaleString()}원 → ${pointsToAdd.toLocaleString()}딜 충전`,
    '/admin/deals'
  ).catch(() => {});

  return c.json({
    success: true,
    data: {
      points_added: pointsToAdd,
      balance: updated?.balance ?? pointsToAdd,
    },
    message: `${pointsToAdd.toLocaleString()}딜이 충전되었습니다!`,
  });
});
