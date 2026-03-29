/**
 * 라이브 후원(도네이션) API
 *
 * POST /api/donations/init        - 후원 결제 시작 (토스)
 * POST /api/donations/confirm     - 결제 완료 → 후원 기록
 * GET  /api/donations/stream/:id  - 스트림 후원 목록 (공개)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';

const donationsRoutes = new Hono<{ Bindings: Env }>();

donationsRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'https://ur-live.pages.dev', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

async function getUserIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<string | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { id?: string; user_id?: string; sub?: string };
    return payload.id ?? payload.user_id ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

// ── POST /api/donations/init ─────────────────────────────────────────────────
// 후원 결제 시작: 스트림 ID + 금액 → 토스 결제 정보 반환
donationsRoutes.post('/init', async (c) => {
  const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

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

  // 스트림 + 셀러 정보 조회
  let stream: { id: number; title: string; seller_id: number; seller_name: string; commission_rate: number; } | null = null;
  try {
    stream = await DB.prepare(
      `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name,
              COALESCE(s.donation_commission_rate, 15.0) AS commission_rate
       FROM live_streams ls
       JOIN sellers s ON ls.seller_id = s.id
       WHERE ls.id = ?`
    ).bind(body.stream_id).first<typeof stream>();
  } catch (err) {
    console.error('[donations/init] DB error:', (err as Error).message);
    return c.json({ success: false, error: 'DB 오류: ' + (err as Error).message }, 500);
  }

  if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

  const orderId = `DON-${userId}-${stream.id}-${Date.now()}`;

  return c.json({
    success: true,
    data: {
      orderId,
      amount: body.amount,
      orderName: `${stream.seller_name} 라이브 후원`,
      streamId: stream.id,
      sellerName: stream.seller_name,
      clientKey: c.env.TOSS_CLIENT_KEY,
      // 클라이언트에서 confirm 시 필요한 정보를 orderId에 포함
    },
  });
});

// ── POST /api/donations/confirm ──────────────────────────────────────────────
// 토스 결제 완료 → 후원 기록
donationsRoutes.post('/confirm', async (c) => {
  const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
    stream_id: number;
    message?: string;
    donor_name?: string;
    is_anonymous?: boolean;
  }>();

  if (!body.paymentKey || !body.orderId || !body.amount || !body.stream_id) {
    return c.json({ success: false, error: '필수 항목 누락' }, 400);
  }

  const { DB } = c.env;

  // 중복 결제 확인
  const dup = await DB.prepare('SELECT id FROM donations WHERE order_id = ?')
    .bind(body.orderId).first<{ id: number }>().catch(() => null);
  if (dup) return c.json({ success: false, error: '이미 처리된 결제입니다' }, 409);

  // 스트림 + 수수료율 조회
  const stream = await DB.prepare(
    `SELECT ls.seller_id, s.name AS seller_name,
            COALESCE(s.donation_commission_rate, 15.0) AS commission_rate
     FROM live_streams ls
     JOIN sellers s ON ls.seller_id = s.id
     WHERE ls.id = ?`
  ).bind(body.stream_id).first<{
    seller_id: number; seller_name: string; commission_rate: number;
  }>().catch(() => null);

  if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

  // 토스 결제 승인
  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, amount: body.amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string }>();
    return c.json({ success: false, error: err.message ?? '결제 승인 실패' }, 400);
  }

  const commissionAmount = Math.round(body.amount * stream.commission_rate / 100);
  const sellerAmount = body.amount - commissionAmount;

  // 후원 기록 저장
  await DB.prepare(`
    INSERT INTO donations
      (stream_id, seller_id, donor_user_id, donor_name, amount,
       commission_amount, seller_amount, commission_rate,
       payment_key, order_id, status, message, is_anonymous, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DONE', ?, ?, datetime('now'), datetime('now'))
  `).bind(
    body.stream_id, stream.seller_id, userId,
    body.is_anonymous ? '익명' : (body.donor_name ?? '익명'),
    body.amount, commissionAmount, sellerAmount, stream.commission_rate,
    body.paymentKey, body.orderId,
    body.message ?? null, body.is_anonymous ? 1 : 0,
  ).run();

  return c.json({
    success: true,
    data: {
      amount: body.amount,
      seller_amount: sellerAmount,
      commission_amount: commissionAmount,
      seller_name: stream.seller_name,
    },
    message: `${body.amount.toLocaleString()}원 후원이 완료되었습니다!`,
  });
});

// ── GET /api/donations/stream/:streamId ──────────────────────────────────────
// 스트림 후원 목록 (최근 50건, 이름 마스킹)
donationsRoutes.get('/stream/:streamId', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  try {
    const { results } = await DB.prepare(`
      SELECT id,
             CASE WHEN is_anonymous = 1 THEN '익명'
                  ELSE SUBSTR(donor_name, 1, 1) || REPLACE(SUBSTR(donor_name, 2), SUBSTR(donor_name, 2), '**')
             END AS donor_name,
             amount, message, created_at
      FROM donations
      WHERE stream_id = ? AND status = 'DONE'
      ORDER BY created_at DESC LIMIT 50
    `).bind(streamId).all();

    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

export { donationsRoutes };
