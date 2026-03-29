// ============================================================
// Donation Routes — 라이브 후원 시스템
// POST /api/donations              — 후원 생성 (결제 전 레코드)
// POST /api/donations/confirm      — 결제 확인 후 크레딧 전환
// GET  /api/donations/stream/:id   — 특정 스트림의 후원 목록
// GET  /api/donations/seller       — 셀러 받은 후원 내역
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../../../worker/types/env';
import { requireAuth, type AuthUser } from '../../../worker/middleware/auth';
import { TOSS_PAYMENT_URL, DONATION_COMMISSION_RATE, CREDIT_UNIT_PRICE } from '../../../shared/constants';

type AuthVariables = { user: AuthUser };
const donationRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ── POST /api/donations — 후원 생성 ─────────────────────────────────────────
donationRoutes.post('/', requireAuth(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    streamId: number;
    amount: number;
    message?: string;
    donorName?: string;
  }>();

  const { streamId, amount, message = '', donorName } = body;

  if (!streamId || !amount || amount < 1000) {
    return c.json({ success: false, error: '최소 1,000원 이상 후원 가능합니다.' }, 400);
  }

  if (amount > 1000000) {
    return c.json({ success: false, error: '1회 최대 100만원까지 후원 가능합니다.' }, 400);
  }

  // 스트림 정보 조회 (셀러 ID 확인)
  const stream = await c.env.DB.prepare(
    'SELECT id, seller_id, title, status FROM live_streams WHERE id = ?'
  ).bind(streamId).first<{ id: number; seller_id: number; title: string; status: string }>();

  if (!stream) {
    return c.json({ success: false, error: '스트림을 찾을 수 없습니다.' }, 404);
  }

  if (stream.status !== 'live') {
    return c.json({ success: false, error: '라이브 중인 스트림에서만 후원이 가능합니다.' }, 400);
  }

  // 자기 자신 후원 방지
  // user.id는 Firebase UID (string)이므로 seller_id와 직접 비교 불가
  // sellers 테이블에서 확인
  const sellerCheck = await c.env.DB.prepare(
    'SELECT id FROM sellers WHERE firebase_uid = ? AND id = ?'
  ).bind(user.id, stream.seller_id).first();

  if (sellerCheck) {
    return c.json({ success: false, error: '본인 방송에는 후원할 수 없습니다.' }, 400);
  }

  // 수수료 계산
  const commissionAmount = Math.floor(amount * DONATION_COMMISSION_RATE);
  const creditAmount = amount - commissionAmount;

  // 고유 주문번호 생성
  const orderId = `DON-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 후원자 이름
  const displayName = donorName || user.name || '익명';

  // DB 저장 (pending 상태)
  await c.env.DB.prepare(`
    INSERT INTO donations (donor_user_id, donor_name, seller_id, live_stream_id,
      amount, commission_rate, commission_amount, credit_amount, message, order_id, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    user.id,
    displayName,
    stream.seller_id,
    streamId,
    amount,
    DONATION_COMMISSION_RATE,
    commissionAmount,
    creditAmount,
    message.slice(0, 100), // 메시지 100자 제한
    orderId,
  ).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount,
      commissionAmount,
      creditAmount,
      sellerName: stream.title,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /api/donations/confirm — 결제 확인 + 크레딧 전환 ────────────────────
donationRoutes.post('/confirm', requireAuth(), async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    paymentKey: string;
    orderId: string;
    amount: number;
  }>();

  const { paymentKey, orderId, amount } = body;

  if (!paymentKey || !orderId || !amount) {
    return c.json({ success: false, error: 'Invalid request' }, 400);
  }

  // 후원 레코드 조회
  const donation = await c.env.DB.prepare(
    'SELECT * FROM donations WHERE order_id = ? AND donor_user_id = ?'
  ).bind(orderId, user.id).first<any>();

  if (!donation) {
    return c.json({ success: false, error: '후원 기록을 찾을 수 없습니다.' }, 404);
  }

  if (donation.payment_status === 'completed') {
    return c.json({ success: true, message: '이미 처리된 후원입니다.' });
  }

  if (donation.amount !== amount) {
    return c.json({ success: false, error: '금액이 일치하지 않습니다.' }, 400);
  }

  // 토스페이먼츠 결제 확인
  const tossSecretKey = c.env.TOSS_SECRET_KEY;
  const tossResponse = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(tossSecretKey + ':')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': orderId,
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!tossResponse.ok) {
    const tossError = await tossResponse.json() as { code?: string; message?: string };

    if (tossError.code !== 'ALREADY_PROCESSED_PAYMENT') {
      // 결제 실패 → donation 상태 업데이트
      await c.env.DB.prepare(
        'UPDATE donations SET payment_status = ? WHERE order_id = ?'
      ).bind('failed', orderId).run();

      return c.json({
        success: false,
        error: tossError.message ?? '결제 확인에 실패했습니다.',
      }, 400);
    }
  }

  // 결제 성공 → 크레딧 전환
  const creditAmount = donation.credit_amount;

  // 셀러 알림톡 잔액 증가
  const accountResult = await c.env.DB.prepare(
    'UPDATE alimtalk_accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE seller_id = ?'
  ).bind(creditAmount, donation.seller_id).run();

  // 알림톡 계정이 없는 경우에도 후원 자체는 성공 처리
  // (나중에 계정 생성 시 잔액 반영 가능하도록 donation 테이블에 기록 남김)

  // donation 상태 업데이트
  await c.env.DB.prepare(`
    UPDATE donations SET
      payment_key = ?,
      payment_status = 'completed',
      completed_at = datetime('now')
    WHERE order_id = ?
  `).bind(paymentKey, orderId).run();

  // WebSocket으로 후원 메시지 브로드캐스트
  if (c.env.LIVE_STREAM) {
    try {
      const doId = c.env.LIVE_STREAM.idFromName(String(donation.live_stream_id));
      const stub = c.env.LIVE_STREAM.get(doId);
      await stub.fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'donation',
          data: {
            donorName: donation.donor_name,
            amount: donation.amount,
            message: donation.message,
            creditAmount,
          },
          timestamp: Date.now(),
        }),
      }) as any);
    } catch (err) {
      console.error('[Donation] DO broadcast failed:', err);
    }
  }

  return c.json({
    success: true,
    data: {
      amount: donation.amount,
      creditAmount,
      commissionAmount: donation.commission_amount,
      message: `${donation.amount.toLocaleString()}원 후원 완료! (${creditAmount.toLocaleString()}원 크레딧 적립)`,
    },
  });
});

// ── GET /api/donations/stream/:streamId — 스트림별 후원 목록 ────────────────
donationRoutes.get('/stream/:streamId', async (c) => {
  const { streamId } = c.req.param();
  const limit = parseInt(c.req.query('limit') || '50');

  const donations = await c.env.DB.prepare(`
    SELECT donor_name, amount, message, created_at
    FROM donations
    WHERE live_stream_id = ? AND payment_status = 'completed'
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(streamId, limit).all();

  return c.json({ success: true, data: donations.results });
});

// ── GET /api/donations/seller — 셀러 후원 내역 (JWT 인증) ───────────────────
donationRoutes.get('/seller', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // JWT에서 seller_id 추출
  const token = authHeader.replace('Bearer ', '');
  let sellerId: number;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    sellerId = payload.seller_id || payload.sellerId;
    if (!sellerId) throw new Error('No seller_id');
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const [donations, stats] = await Promise.all([
    c.env.DB.prepare(`
      SELECT d.*, ls.title as stream_title
      FROM donations d
      LEFT JOIN live_streams ls ON d.live_stream_id = ls.id
      WHERE d.seller_id = ? AND d.payment_status = 'completed'
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(sellerId, limit, offset).all(),

    c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(credit_amount), 0) as total_credits,
        COALESCE(SUM(commission_amount), 0) as total_commission
      FROM donations
      WHERE seller_id = ? AND payment_status = 'completed'
    `).bind(sellerId).first<any>(),
  ]);

  return c.json({
    success: true,
    data: {
      donations: donations.results,
      stats: {
        totalCount: stats?.total_count || 0,
        totalAmount: stats?.total_amount || 0,
        totalCredits: stats?.total_credits || 0,
        totalCommission: stats?.total_commission || 0,
      },
      page,
      limit,
    },
  });
});

export { donationRoutes };
