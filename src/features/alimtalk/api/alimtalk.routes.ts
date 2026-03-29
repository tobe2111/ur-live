/**
 * 알림톡 크레딧 시스템 API
 *
 * GET  /api/seller/alimtalk/credits          - 잔액 + 이력 조회
 * POST /api/seller/alimtalk/credits/charge   - 충전 결제 시작 (토스)
 * POST /api/seller/alimtalk/credits/confirm  - 결제 완료 → 크레딧 지급
 * GET  /api/seller/alimtalk/logs             - 발송 이력
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const alimtalkRoutes = new Hono<{ Bindings: Env }>();

alimtalkRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// 충전 패키지 정의 (판매가 9원/건)
export const CREDIT_PACKAGES = [
  { id: 'p100',  credits: 100,  price: 900,    label: '100건' },
  { id: 'p500',  credits: 500,  price: 4500,   label: '500건' },
  { id: 'p1000', credits: 1000, price: 9000,   label: '1,000건' },
  { id: 'p3000', credits: 3000, price: 27000,  label: '3,000건' },
  { id: 'p5000', credits: 5000, price: 45000,  label: '5,000건' },
] as const;

// ── JWT에서 seller_id 추출 ────────────────────────────────────────────────────
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number };
    return payload.seller_id ?? null;
  } catch {
    return null;
  }
}

// ── GET /credits ──────────────────────────────────────────────────────────────
alimtalkRoutes.get('/credits', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  try {
    const [credit, history] = await Promise.all([
      DB.prepare('SELECT balance FROM seller_credits WHERE seller_id = ?')
        .bind(sellerId).first<{ balance: number }>(),
      DB.prepare(`
        SELECT id, type, amount, price_paid, description, created_at
        FROM credit_transactions
        WHERE seller_id = ?
        ORDER BY created_at DESC LIMIT 50
      `).bind(sellerId).all<{
        id: number; type: string; amount: number;
        price_paid: number | null; description: string | null; created_at: string;
      }>(),
    ]);

    return c.json({
      success: true,
      data: {
        balance: credit?.balance ?? 0,
        packages: CREDIT_PACKAGES,
        history: history.results ?? [],
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── POST /credits/charge ──────────────────────────────────────────────────────
// 충전 결제 시작: 패키지 선택 → 토스 결제창 오픈에 필요한 정보 반환
alimtalkRoutes.post('/credits/charge', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{ package_id: string }>();
  const pkg = CREDIT_PACKAGES.find(p => p.id === body.package_id);
  if (!pkg) return c.json({ success: false, error: '유효하지 않은 패키지입니다' }, 400);

  // 토스 결제용 주문 ID (고유해야 함)
  const orderId = `ALT-${sellerId}-${pkg.id}-${Date.now()}`;

  return c.json({
    success: true,
    data: {
      orderId,
      amount: pkg.price,
      orderName: `알림톡 ${pkg.label} 충전`,
      credits: pkg.credits,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /credits/confirm ─────────────────────────────────────────────────────
// 토스 결제 완료 후 크레딧 지급
alimtalkRoutes.post('/credits/confirm', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const body = await c.req.json<{ paymentKey: string; orderId: string; amount: number }>();

  // orderId에서 패키지 ID 추출 (ALT-{sellerId}-{pkgId}-{ts})
  const parts = body.orderId.split('-');
  const pkgId = parts[2] ? `p${parts[2].replace('p', '')}` : '';
  const pkg = CREDIT_PACKAGES.find(p => p.id === pkgId) ??
    // 금액 기반 폴백
    CREDIT_PACKAGES.find(p => p.price === body.amount);

  if (!pkg) return c.json({ success: false, error: '패키지 정보를 확인할 수 없습니다' }, 400);
  if (pkg.price !== body.amount) return c.json({ success: false, error: '결제 금액이 패키지와 다릅니다' }, 400);

  const { DB } = c.env;

  // 중복 결제 확인
  const dup = await DB.prepare(
    'SELECT id FROM credit_transactions WHERE payment_key = ?'
  ).bind(body.paymentKey).first<{ id: number }>();
  if (dup) return c.json({ success: false, error: '이미 처리된 결제입니다' }, 409);

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

  // D1 트랜잭션: 잔액 증가 + 이력 기록
  await DB.batch([
    DB.prepare(`
      INSERT INTO seller_credits (seller_id, balance, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(seller_id) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = datetime('now')
    `).bind(sellerId, pkg.credits),
    DB.prepare(`
      INSERT INTO credit_transactions (seller_id, type, amount, price_paid, description, payment_key, created_at)
      VALUES (?, 'charge', ?, ?, ?, ?, datetime('now'))
    `).bind(sellerId, pkg.credits, pkg.price, `알림톡 ${pkg.label} 충전`, body.paymentKey),
  ]);

  return c.json({
    success: true,
    data: { credits_added: pkg.credits, description: `알림톡 ${pkg.label} 충전` },
    message: `${pkg.credits.toLocaleString()}건이 충전되었습니다.`,
  });
});

// ── GET /logs ─────────────────────────────────────────────────────────────────
alimtalkRoutes.get('/logs', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 100);

  try {
    const logs = await DB.prepare(`
      SELECT id, receiver, template_code, message, order_id, success, error_msg, created_at
      FROM alimtalk_logs
      WHERE seller_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).bind(sellerId, limit).all();

    return c.json({ success: true, data: logs.results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });  // 테이블 없으면 빈 배열
  }
});

export { alimtalkRoutes };
