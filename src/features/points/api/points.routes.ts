/**
 * 딜 포인트 시스템 API
 *
 * GET  /api/points/balance       - 잔액 조회
 * POST /api/points/charge/init   - 충전 결제 시작
 * POST /api/points/charge/confirm - 충전 결제 확인 (토스 승인)
 * POST /api/points/donate        - 딜 후원 (포인트 차감)
 * GET  /api/points/history       - 거래 내역
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { TOSS_PAYMENT_URL, ALLOWED_ORIGINS } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

const pointsRoutes = new Hono<{ Bindings: Env }>();

pointsRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

const COMMISSION_RATE = 0.15; // 15% 수수료

const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 4250,   label: '5,000원 → 4,250딜' },
  { amount: 10000,  points: 8500,   label: '10,000원 → 8,500딜' },
  { amount: 30000,  points: 25500,  label: '30,000원 → 25,500딜' },
  { amount: 50000,  points: 42500,  label: '50,000원 → 42,500딜' },
  { amount: 100000, points: 85000,  label: '100,000원 → 85,000딜' },
];

// ── 테이블 자동 생성 (마이그레이션 미적용 시 fallback) ────────────────
async function ensureTables(DB: D1Database) {
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
    `).run();
  } catch { /* 이미 존재 */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund')),
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
    `).run();
  } catch { /* 이미 존재 */ }
}

// ── GET /api/points/balance ──────────────────────────────────────────
pointsRoutes.get('/balance', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const row = await DB.prepare('SELECT balance, total_charged, total_donated FROM user_points WHERE user_id = ?')
    .bind(user.id).first<{ balance: number; total_charged: number; total_donated: number }>();

  return c.json({
    success: true,
    data: {
      balance: row?.balance ?? 0,
      total_charged: row?.total_charged ?? 0,
      total_donated: row?.total_donated ?? 0,
    },
  });
});

// ── POST /api/points/charge/init ─────────────────────────────────────
pointsRoutes.post('/charge/init', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { amount } = await c.req.json<{ amount: number }>();

  const pkg = CHARGE_AMOUNTS.find(p => p.amount === amount);
  if (!pkg) {
    return c.json({ success: false, error: `유효하지 않은 충전 금액입니다. 가능: ${CHARGE_AMOUNTS.map(p => p.amount).join(', ')}` }, 400);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  const orderId = `TEAM-${user.id}-${Date.now()}`;

  // pending 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
    VALUES (?, 'charge', ?, ?, ?, 0, ?, ?)
  `).bind(
    user.id, amount, Math.round(amount * COMMISSION_RATE), pkg.points,
    `딜 ${pkg.points.toLocaleString()}개 충전`, orderId
  ).run();

  return c.json({
    success: true,
    data: {
      orderId,
      amount,
      points: pkg.points,
      commission: Math.round(amount * COMMISSION_RATE),
      orderName: `딜 ${pkg.points.toLocaleString()}개 충전`,
      clientKey: c.env.TOSS_CLIENT_KEY,
    },
  });
});

// ── POST /api/points/charge/confirm ──────────────────────────────────
pointsRoutes.post('/charge/confirm', requireAuth(), async (c) => {
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
  const pending = await DB.prepare(
    'SELECT id, amount, points_amount FROM point_transactions WHERE order_id = ? AND user_id = ? AND type = ?'
  ).bind(orderId, user.id, 'charge').first<{ id: number; amount: number; points_amount: number }>();

  if (!pending) return c.json({ success: false, error: '충전 정보를 찾을 수 없습니다' }, 404);
  if (pending.amount !== amount) return c.json({ success: false, error: '금액이 일치하지 않습니다' }, 400);

  // 토스 결제 승인
  const tossRes = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(c.env.TOSS_SECRET_KEY + ':')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': paymentKey,
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json<{ message?: string; code?: string }>();
    if (err.code !== 'ALREADY_PROCESSED_PAYMENT') {
      return c.json({ success: false, error: err.message ?? '결제 승인 실패' }, 400);
    }
  }

  // 포인트 적립
  const pointsToAdd = pending.points_amount;

  // user_points UPSERT
  await DB.prepare(`
    INSERT INTO user_points (user_id, balance, total_charged)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      balance = balance + ?,
      total_charged = total_charged + ?,
      updated_at = datetime('now')
  `).bind(user.id, pointsToAdd, pointsToAdd, pointsToAdd, pointsToAdd).run();

  // 잔액 조회
  const updated = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(user.id).first<{ balance: number }>();

  // 트랜잭션 업데이트
  await DB.prepare(
    'UPDATE point_transactions SET payment_key = ?, balance_after = ? WHERE id = ?'
  ).bind(paymentKey, updated?.balance ?? pointsToAdd, pending.id).run();

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

// ── POST /api/points/donate ──────────────────────────────────────────
// 딜 포인트로 후원 (결제 없이 즉시 차감)
pointsRoutes.post('/donate', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { stream_id, amount, message } = await c.req.json<{
    stream_id: number;
    amount: number;
    message?: string;
  }>();

  if (!stream_id || !amount || amount < 100) {
    return c.json({ success: false, error: '후원 금액은 최소 100딜입니다' }, 400);
  }

  const { DB } = c.env;
  await ensureTables(DB);

  // 잔액 확인
  const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(user.id).first<{ balance: number }>();

  if (!wallet || wallet.balance < amount) {
    return c.json({
      success: false,
      error: `딜이 부족합니다. (보유: ${wallet?.balance ?? 0}딜, 필요: ${amount}딜)`,
      code: 'INSUFFICIENT_POINTS',
    }, 400);
  }

  // 스트림 + 셀러 정보
  const stream = await DB.prepare(
    `SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name
     FROM live_streams ls
     LEFT JOIN sellers s ON ls.seller_id = s.id
     WHERE ls.id = ?`
  ).bind(stream_id).first<{ id: number; title: string; seller_id: number; seller_name: string }>();

  if (!stream) return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);

  // 포인트 차감
  const newBalance = wallet.balance - amount;
  await DB.prepare(
    'UPDATE user_points SET balance = ?, total_donated = total_donated + ?, updated_at = datetime(\'now\') WHERE user_id = ?'
  ).bind(newBalance, amount, user.id).run();

  // 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, stream_id, seller_id)
    VALUES (?, 'donate', ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id, amount, amount, newBalance,
    `${stream.seller_name ?? '셀러'} 라이브 후원`,
    stream_id, stream.seller_id
  ).run();

  // donations 테이블에도 기록 (기존 호환)
  const donationOrderId = `TEAM-DON-${user.id}-${stream_id}-${Date.now()}`;
  await DB.prepare(`
    INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
      commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
    VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, 'completed', ?)
  `).bind(
    stream_id, stream.seller_id, user.id, '후원자',
    amount, amount, donationOrderId, message ?? ''
  ).run();

  // 10. 후원 받음 → 셀러 알림
  createDashboardNotification(DB, 'seller', String(stream.seller_id), 'donation_received', '후원 받음', `${amount}딜 후원`, '/seller/donations').catch(() => {});

  // 후원 발생 → 어드민 알림
  createDashboardNotification(DB, 'admin', null, 'donation_received', '후원 발생', `${amount}딜 후원`, '/admin/settlement').catch(() => {});

  return c.json({
    success: true,
    data: {
      amount,
      balance: newBalance,
      seller_name: stream.seller_name,
    },
    message: `${amount.toLocaleString()}딜을 후원했습니다!`,
  });
});

// ── GET /api/points/history ──────────────────────────────────────────
pointsRoutes.get('/history', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const { results } = await DB.prepare(
    'SELECT id, type, amount, points_amount, balance_after, description, created_at FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).bind(user.id).all();

  return c.json({ success: true, data: results ?? [] });
});

// ── GET /api/points/charge-options ───────────────────────────────────
pointsRoutes.get('/charge-options', async (c) => {
  return c.json({ success: true, data: CHARGE_AMOUNTS });
});

export { pointsRoutes };
