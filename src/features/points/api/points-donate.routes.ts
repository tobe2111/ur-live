/**
 * 딜 포인트 후원 라우트
 *
 * POST /donate - 딜 포인트로 라이브 후원 (포인트 즉시 차감)
 */

import { Hono } from 'hono';
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth';
import { rateLimit } from '../../../worker/middleware/rate-limit';
import type { Env } from '../../../worker/types/env';
import { MIN_DONATION_DEALS } from '../../../shared/constants';
import { createDashboardNotification } from '../../notifications/api/dashboard-notifications.routes';
import { idempotentWrite, IdempotencyConflictError } from '../../../worker/utils/idempotency';
import { ensureTables, getDefaultCommissionRate } from './points-helpers';
import type { D1Database } from '@cloudflare/workers-types';

export const pointsDonateRoutes = new Hono<{ Bindings: Env }>();

// ── POST /donate ──────────────────────────────────────────────────────
// 딜 포인트로 후원 (결제 없이 즉시 차감)
pointsDonateRoutes.post('/donate', rateLimit({ action: 'points_donate', max: 20, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{
    stream_id: number;
    amount: number;
    message?: string;
    /** Optional idempotency key — protects against double-click / retry. */
    idempotency_key?: string;
  }>();
  const { stream_id, amount, message } = body;

  if (!stream_id || !amount || amount < MIN_DONATION_DEALS) {
    return c.json({ success: false, error: `후원 금액은 최소 ${MIN_DONATION_DEALS}딜입니다` }, 400);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  // H8: user_points.user_id는 TEXT — 항상 String(user.id)로 통일
  const userId = String(user.id);

  // ✅ IDEMPOTENCY: if the client supplied a key, guard the whole handler.
  if (body.idempotency_key) {
    try {
      const result = await idempotentWrite<{ status: number; body: any }>(
        DB,
        `donate:${body.idempotency_key}`,
        userId,
        () => executeDonate(DB, userId, stream_id, amount, message),
        { ttlSeconds: 6 * 60 * 60 },
      );
      return c.json(result.body, result.status as 200 | 400 | 403 | 404 | 409 | 422 | 429 | 500 | 503);
    } catch (e) {
      if (e instanceof IdempotencyConflictError) {
        return c.json({ success: false, error: e.message }, 409);
      }
      throw e;
    }
  }

  const result = await executeDonate(DB, userId, stream_id, amount, message);
  return c.json(result.body, result.status as 200 | 400 | 403 | 404 | 409 | 422 | 429 | 500 | 503);
});

/**
 * Core donate logic, extracted so it can be wrapped by idempotentWrite.
 * Returns a { status, body } object instead of a Response because the
 * idempotency cache needs to serialize it.
 */
async function executeDonate(
  DB: D1Database,
  userId: string,
  stream_id: number,
  amount: number,
  message: string | undefined,
): Promise<{ status: number; body: any }> {
  // 잔액 확인
  const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  if (!wallet || wallet.balance < amount) {
    return {
      status: 400,
      body: {
        success: false,
        error: `딜이 부족합니다. (보유: ${wallet?.balance ?? 0}딜, 필요: ${amount}딜)`,
        code: 'INSUFFICIENT_POINTS',
      },
    };
  }

  // 스트림 + 셀러 정보
  const stream = await DB.prepare(
    `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name
     FROM live_streams ls
     LEFT JOIN sellers s ON ls.seller_id = s.id
     WHERE ls.id = ?`
  ).bind(stream_id).first<{ id: number; title: string; seller_id: number; seller_name: string }>();

  if (!stream) return { status: 404, body: { success: false, error: '스트림을 찾을 수 없습니다' } };

  // 포인트 차감 (atomic: balance >= amount 조건으로 race condition 방지)
  const deductResult = await DB.prepare(
    'UPDATE user_points SET balance = balance - ?, total_donated = total_donated + ?, updated_at = datetime(\'now\') WHERE user_id = ? AND balance >= ?'
  ).bind(amount, amount, userId, amount).run();
  if (!deductResult.meta.changes) {
    return { status: 400, body: { success: false, error: '딜이 부족합니다 (동시 결제 충돌)' } };
  }
  const updatedWallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(userId).first<{ balance: number }>();
  const newBalance = updatedWallet?.balance ?? 0;

  // 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, stream_id, seller_id)
    VALUES (?, 'donate', ?, ?, ?, ?, ?, ?)
  `).bind(
    userId, amount, amount, newBalance,
    `${stream.seller_name ?? '셀러'} 라이브 후원`,
    stream_id, stream.seller_id
  ).run();

  // donations 테이블에도 기록 (셀러 정산 시 platform_settings.commission_rate_default 적용, 기본 10%)
  const COMMISSION_RATE = await getDefaultCommissionRate(DB);
  const commissionAmount = Math.round(amount * COMMISSION_RATE);
  const creditAmount = amount - commissionAmount; // 셀러 실수령액
  const donationOrderId = `DEAL-DON-${userId}-${stream_id}-${Date.now()}`;
  await DB.prepare(`
    INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
      commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
  `).bind(
    stream_id, stream.seller_id, userId, '후원자',
    amount, commissionAmount, creditAmount, COMMISSION_RATE, donationOrderId, message ?? ''
  ).run();

  // 후원 받음 → 셀러 알림
  createDashboardNotification(DB, 'seller', String(stream.seller_id), 'donation_received', '후원 받음', `${amount}딜 후원`, '/seller/donations').catch(() => {});

  // 후원 발생 → 어드민 알림
  createDashboardNotification(DB, 'admin', null, 'donation_received', '후원 발생', `${amount}딜 후원`, '/admin/settlement').catch(() => {});

  return {
    status: 200,
    body: {
      success: true,
      data: {
        amount,
        balance: newBalance,
        seller_name: stream.seller_name,
      },
      message: `${amount.toLocaleString()}딜을 후원했습니다!`,
    },
  };
}
