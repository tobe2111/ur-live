/**
 * 라이브 후원(도네이션) API
 *
 * POST /api/donations/init        - 후원 결제 시작 (토스)
 * POST /api/donations/confirm     - 결제 완료 → 후원 기록
 * GET  /api/donations/stream/:id  - 스트림 후원 목록 (공개)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { rateLimit } from '@/worker/middleware/rate-limit';
import type { Env } from '@/worker/types/env';
import { TOSS_PAYMENT_URL } from '@/shared/constants';

const donationsRoutes = new Hono<{ Bindings: Env }>();

donationsRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'https://world.ur-team.com', 'https://ur-live.pages.dev', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
}));

// ── POST /api/donations/init ─────────────────────────────────────────────────
// 후원 결제 시작: pending 레코드를 DB에 저장 후 토스 결제 정보 반환
// confirm 단계에서 DB 저장 금액으로 검증하여 금액 조작을 방지합니다.
donationsRoutes.post('/init', rateLimit({ action: 'donations_init', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const userId = user.id;

  const body = await c.req.json<{
    stream_id: number;
    amount: number;
    message?: string;
    donor_name?: string;
    is_anonymous?: boolean;
  }>();

  if (!body.stream_id || !body.amount) {
    return c.json({ success: false, error: '필수 항목 누락 (stream_id, amount)' }, 400);
  }
  if (body.amount < 1000 || body.amount % 100 !== 0) {
    return c.json({ success: false, error: '후원 금액은 최소 1,000원이며 100원 단위여야 합니다' }, 400);
  }

  const { DB } = c.env;

  // 스트림 + 셀러 정보 조회 (two-step: donation_commission_rate 컬럼 없을 수 있음)
  type StreamRow = { id: number; title: string; seller_id: number; seller_name: string; commission_rate: number; };
  let stream: StreamRow | null = null;
  try {
    stream = await DB.prepare(
      `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name,
              COALESCE(s.donation_commission_rate, 15.0) AS commission_rate
       FROM live_streams ls
       JOIN sellers s ON ls.seller_id = s.id
       WHERE ls.id = ?`
    ).bind(body.stream_id).first<StreamRow>();
  } catch {
    // Fallback: donation_commission_rate column may not exist yet
    try {
      stream = await DB.prepare(
        `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name, 15.0 AS commission_rate
         FROM live_streams ls
         JOIN sellers s ON ls.seller_id = s.id
         WHERE ls.id = ?`
      ).bind(body.stream_id).first<StreamRow>();
    } catch (err2) {
      console.error('[donations/init] DB error:', (err2 as Error).message);
      return c.json({ success: false, error: 'live_streams 테이블이 없습니다. 마이그레이션을 실행해주세요.' }, 500);
    }
  }

  if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

  // 라이브 중인 스트림에만 후원 가능
  const streamStatus = await DB.prepare('SELECT status FROM live_streams WHERE id = ?')
    .bind(body.stream_id).first<{ status: string }>().catch(() => null);
  if (!streamStatus || streamStatus.status !== 'live') {
    return c.json({ success: false, error: '현재 라이브 중인 방송에만 후원할 수 있습니다' }, 400);
  }

  const orderId = `DON-${userId}-${stream.id}-${Date.now()}`;
  const commissionAmount = Math.round(body.amount * stream.commission_rate / 100);
  const creditAmount = body.amount - commissionAmount;

  // pending 레코드를 DB에 저장 — confirm 단계에서 이 레코드의 금액으로 검증
  // DB 스키마: live_stream_id (NOT stream_id), credit_amount (NOT seller_amount),
  //           payment_status (NOT status), is_anonymous 컬럼 없음
  await DB.prepare(`
    INSERT INTO donations
      (live_stream_id, seller_id, donor_user_id, donor_name, amount,
       commission_amount, credit_amount, commission_rate,
       order_id, payment_status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    body.stream_id, stream.seller_id, userId,
    body.is_anonymous ? '익명' : (body.donor_name ?? '익명'),
    body.amount, commissionAmount, creditAmount, stream.commission_rate,
    orderId,
    body.message ?? '',
  ).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount: body.amount,
      orderName: `${stream.seller_name} 라이브 후원`,
      streamId: stream.id,
      sellerName: stream.seller_name,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /api/donations/confirm ──────────────────────────────────────────────
// 토스 결제 완료 → init에서 저장한 pending 레코드 기반으로 금액 검증 후 완료 처리
donationsRoutes.post('/confirm', rateLimit({ action: 'donations_confirm', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const userId = user.id;

  const body = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  if (!body.paymentKey || !body.orderId || !body.amount) {
    return c.json({ success: false, error: '필수 항목 누락' }, 400);
  }

  const { DB } = c.env;

  // init 단계에서 DB에 저장한 pending 레코드 조회 (금액 조작 방지)
  // DB 스키마: live_stream_id, credit_amount, payment_status
  type DonationRow = {
    id: number; live_stream_id: number; seller_id: number; amount: number;
    commission_amount: number; credit_amount: number; payment_status: string; donor_name: string;
  };
  const pending = await DB.prepare(
    'SELECT id, live_stream_id, seller_id, amount, commission_amount, credit_amount, payment_status, donor_name FROM donations WHERE order_id = ? AND donor_user_id = ?'
  ).bind(body.orderId, userId).first<DonationRow>().catch(() => null);

  if (!pending) return c.json({ success: false, error: '후원 정보를 찾을 수 없습니다. 다시 시도해주세요.' }, 404);
  if (pending.payment_status === 'completed') return c.json({ success: false, error: '이미 처리된 결제입니다' }, 409);

  // 클라이언트가 보낸 amount를 DB 저장값으로 검증 (금액 조작 방지)
  if (pending.amount !== body.amount) {
    console.error('[donations/confirm] Amount mismatch', { db: pending.amount, client: body.amount, orderId: body.orderId });
    return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400);
  }

  // 토스 결제 승인 (DB에서 검증된 금액 사용)
  // Idempotency-Key: paymentKey 기반 — 동일 결제의 중복 승인 요청 방지
  const tossRes = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': body.paymentKey,
    },
    body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: pending.amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string; code?: string }>();
    if (err.code !== 'ALREADY_PROCESSED_PAYMENT') {
      await DB.prepare('UPDATE donations SET payment_status = ? WHERE order_id = ?')
        .bind('failed', body.orderId).run();
      console.error('[donations/confirm] Toss error:', { code: err.code, message: err.message, orderId: body.orderId });
      return c.json({ success: false, error: err.message ?? '결제 승인 실패', code: err.code }, 400);
    }
  }

  // pending → completed 상태 업데이트 (payment_key 기록)
  await DB.prepare('UPDATE donations SET payment_status = ?, payment_key = ?, completed_at = datetime(\'now\') WHERE order_id = ?')
    .bind('completed', body.paymentKey, body.orderId).run();

  return c.json({
    success: true,
    data: {
      amount: pending.amount,
      credit_amount: pending.credit_amount,
      commission_amount: pending.commission_amount,
    },
    message: `${pending.amount.toLocaleString()}원 후원이 완료되었습니다!`,
  });
});

// ── GET /api/donations/stream/:streamId ──────────────────────────────────────
// 스트림 후원 목록 (최근 50건, 이름 마스킹)
donationsRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  try {
    const [donations, totalRow] = await Promise.all([
      DB.prepare(`
        SELECT id,
               SUBSTR(donor_name, 1, 1) || '**' AS donor_name,
               amount, message, created_at
        FROM donations
        WHERE live_stream_id = ? AND payment_status = 'completed'
        ORDER BY created_at DESC LIMIT 50
      `).bind(streamId).all(),
      DB.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM donations
        WHERE live_stream_id = ? AND payment_status = 'completed'
      `).bind(streamId).first<{ total: number }>(),
    ]);

    return c.json({ success: true, data: { donations: donations.results ?? [], total: totalRow?.total || 0 } });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

export { donationsRoutes };
