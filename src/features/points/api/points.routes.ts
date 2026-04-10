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

const DEFAULT_COMMISSION_RATE = 0.15; // 기본 15% (DB 설정으로 오버라이드 가능)

async function getDefaultCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_default'").first<{ value: string }>();
    if (row) return Number(row.value) / 100;
  } catch { /* table may not exist */ }
  return DEFAULT_COMMISSION_RATE;
}

// 충전: 1원 = 1딜 (수수료 없음, 셀러 정산 시 15% 차감)
const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 5000,   label: '5,000원 → 5,000딜' },
  { amount: 10000,  points: 10000,  label: '10,000원 → 10,000딜' },
  { amount: 30000,  points: 30000,  label: '30,000원 → 30,000딜' },
  { amount: 50000,  points: 50000,  label: '50,000원 → 50,000딜' },
  { amount: 100000, points: 100000, label: '100,000원 → 100,000딜' },
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
        type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund', 'ad_reward')),
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

  const orderId = `DEAL-${user.id}-${Date.now()}`;

  // pending 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
    VALUES (?, 'charge', ?, ?, ?, 0, ?, ?)
  `).bind(
    user.id, amount, 0, pkg.points, // 충전은 수수료 0 (1:1)
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

  if (!stream_id || !amount || amount < 500) {
    return c.json({ success: false, error: '후원 금액은 최소 500딜입니다' }, 400);
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

  // 포인트 차감 (atomic: balance >= amount 조건으로 race condition 방지)
  const deductResult = await DB.prepare(
    'UPDATE user_points SET balance = balance - ?, total_donated = total_donated + ?, updated_at = datetime(\'now\') WHERE user_id = ? AND balance >= ?'
  ).bind(amount, amount, user.id, amount).run();
  if (!deductResult.meta.changes) {
    return c.json({ success: false, error: '딜이 부족합니다 (동시 결제 충돌)' }, 400);
  }
  const updatedWallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(user.id).first<{ balance: number }>();
  const newBalance = updatedWallet?.balance ?? 0;

  // 트랜잭션 기록
  await DB.prepare(`
    INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, stream_id, seller_id)
    VALUES (?, 'donate', ?, ?, ?, ?, ?, ?)
  `).bind(
    user.id, amount, amount, newBalance,
    `${stream.seller_name ?? '셀러'} 라이브 후원`,
    stream_id, stream.seller_id
  ).run();

  // donations 테이블에도 기록 (셀러 정산 시 15% 수수료 적용)
  const COMMISSION_RATE = await getDefaultCommissionRate(DB);
  const commissionAmount = Math.round(amount * COMMISSION_RATE);
  const creditAmount = amount - commissionAmount; // 셀러 실수령액
  const donationOrderId = `DEAL-DON-${user.id}-${stream_id}-${Date.now()}`;
  await DB.prepare(`
    INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
      commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
  `).bind(
    stream_id, stream.seller_id, user.id, '후원자',
    amount, commissionAmount, creditAmount, COMMISSION_RATE, donationOrderId, message ?? ''
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

// ── 리워드 광고 ────────────────────────────────────────────────────
const AD_REWARD_POINTS = 50;   // 광고 1회 시청 = 50딜
const AD_DAILY_LIMIT = 10;      // 하루 최대 10회
const AD_REWARD_DESC_PREFIX = '[광고리워드]'; // description 기반 구분

// POST /api/points/ad-reward — 광고 시청 완료 후 딜 지급
pointsRoutes.post('/ad-reward', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id); // 항상 문자열로 통일

  // 오늘 이미 시청한 횟수 확인 (KST 기준)
  const todayStart = new Date();
  todayStart.setHours(todayStart.getHours() + 9);
  const kstDateStr = todayStart.toISOString().slice(0, 10);

  try {
    const countRow = await DB.prepare(
      `SELECT COUNT(*) as cnt FROM point_transactions
       WHERE user_id = ? AND description LIKE ? AND DATE(created_at, '+9 hours') = ?`
    ).bind(userId, `${AD_REWARD_DESC_PREFIX}%`, kstDateStr).first<{ cnt: number }>();

    const todayCount = countRow?.cnt ?? 0;
    if (todayCount >= AD_DAILY_LIMIT) {
      return c.json({
        success: false,
        error: `오늘 광고 시청 한도(${AD_DAILY_LIMIT}회)에 도달했습니다`,
        data: { todayCount, dailyLimit: AD_DAILY_LIMIT, nextResetKST: kstDateStr + ' 자정' },
      }, 429);
    }

    // 포인트 지급
    const currentRow = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();

    const currentBalance = currentRow?.balance ?? 0;
    const newBalance = currentBalance + AD_REWARD_POINTS;

    if (currentRow) {
      await DB.prepare('UPDATE user_points SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .bind(newBalance, userId).run();
    } else {
      await DB.prepare('INSERT INTO user_points (user_id, balance, total_charged, total_donated) VALUES (?, ?, 0, 0)')
        .bind(userId, newBalance).run();
    }

    // 거래 기록 (type='charge'로 저장, description으로 광고 리워드 구분)
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description)
       VALUES (?, 'charge', 0, 0, ?, ?, ?)`
    ).bind(userId, AD_REWARD_POINTS, newBalance, `${AD_REWARD_DESC_PREFIX} 광고 시청 리워드 (+${AD_REWARD_POINTS}딜)`).run();

    return c.json({
      success: true,
      data: {
        rewarded: AD_REWARD_POINTS,
        balance: newBalance,
        todayCount: todayCount + 1,
        dailyLimit: AD_DAILY_LIMIT,
      },
    });
  } catch (err) {
    console.error('[ad-reward] Error:', err);
    return c.json({ success: false, error: '리워드 지급 중 오류가 발생했습니다', detail: String(err) }, 500);
  }
});

// GET /api/points/ad-reward/status — 오늘 광고 시청 현황
pointsRoutes.get('/ad-reward/status', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);
  const todayStart = new Date();
  todayStart.setHours(todayStart.getHours() + 9);
  const kstDateStr = todayStart.toISOString().slice(0, 10);

  const countRow = await DB.prepare(
    `SELECT COUNT(*) as cnt FROM point_transactions
     WHERE user_id = ? AND description LIKE ? AND DATE(created_at, '+9 hours') = ?`
  ).bind(userId, `${AD_REWARD_DESC_PREFIX}%`, kstDateStr).first<{ cnt: number }>();

  return c.json({
    success: true,
    data: {
      todayCount: countRow?.cnt ?? 0,
      dailyLimit: AD_DAILY_LIMIT,
      rewardPerAd: AD_REWARD_POINTS,
    },
  });
});

// ── POST /api/points/pay — 딜로 상품 결제 ───────────────────────────
pointsRoutes.post('/pay', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);

  const { order_number, total_amount, items, shipping } = await c.req.json<{
    order_number: string;
    total_amount: number;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      price: number;
      seller_id?: string;
      option_value?: string;
    }>;
    shipping: {
      name: string;
      phone: string;
      postal_code: string;
      address1: string;
      address2?: string;
    };
  }>();

  if (!order_number || !total_amount || !items?.length || !shipping?.name) {
    return c.json({ success: false, error: '필수 항목이 누락되었습니다' }, 400);
  }

  // 잔액 확인
  const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  if (!wallet || wallet.balance < total_amount) {
    return c.json({
      success: false,
      error: `딜이 부족합니다. (보유: ${wallet?.balance ?? 0}딜, 필요: ${total_amount}딜)`,
      code: 'INSUFFICIENT_POINTS',
    }, 400);
  }

  try {
    // 1. 딜 차감 (atomic: balance >= 조건으로 race condition 방지)
    const deductRes = await DB.prepare('UPDATE user_points SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?')
      .bind(total_amount, userId, total_amount).run();
    if (!deductRes.meta.changes) {
      return c.json({ success: false, error: '딜이 부족합니다 (동시 결제 충돌)', code: 'INSUFFICIENT_POINTS' }, 400);
    }
    const afterWallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(userId).first<{ balance: number }>();
    const newBalance = afterWallet?.balance ?? 0;

    // 2. 거래 기록
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
       VALUES (?, 'donate', ?, 0, ?, ?, ?, ?)`
    ).bind(userId, total_amount, total_amount, newBalance, `상품 구매 (${items.length}건)`, order_number).run();

    // 3. 주문 생성 (셀러별 그룹화)
    const sellerGroups = new Map<string, typeof items>();
    for (const item of items) {
      const sid = item.seller_id || '0';
      if (!sellerGroups.has(sid)) sellerGroups.set(sid, []);
      sellerGroups.get(sid)!.push(item);
    }

    for (const [sellerId, groupItems] of sellerGroups) {
      const groupTotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const shippingFee = groupTotal >= 50000 ? 0 : 3000;

      await DB.prepare(`
        INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, shipping_name, shipping_phone, shipping_address, shipping_memo)
        VALUES (?, ?, ?, ?, ?, 0, ?, 'KRW', 'paid', 'deal_points', ?, ?, ?, '')
      `).bind(
        order_number, userId, sellerId === '0' ? null : sellerId,
        groupTotal, shippingFee, groupTotal + shippingFee,
        shipping.name, shipping.phone,
        JSON.stringify({ postal_code: shipping.postal_code, address1: shipping.address1, address2: shipping.address2 || '' })
      ).run();

      // 주문 상세 아이템 INSERT
      const orderRow = await DB.prepare('SELECT id FROM orders WHERE order_number = ? AND seller_id = ? ORDER BY id DESC LIMIT 1')
        .bind(order_number, sellerId === '0' ? null : sellerId).first<{ id: number }>();

      if (orderRow) {
        for (const item of groupItems) {
          await DB.prepare(`
            INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(orderRow.id, item.product_id, item.product_name, item.price, item.quantity, item.price * item.quantity).run();
        }
      }
    }

    // 4. 알림
    createDashboardNotification(DB, 'admin', null, 'deal_payment', '딜 결제', `${total_amount.toLocaleString()}딜 상품 결제`, '/admin/orders').catch(() => {});

    return c.json({
      success: true,
      data: {
        order_number,
        amount_paid: total_amount,
        balance: newBalance,
        payment_method: 'deal_points',
      },
      message: `${total_amount.toLocaleString()}딜로 결제가 완료되었습니다!`,
    });
  } catch (err) {
    console.error('[points/pay] Error:', err);
    return c.json({ success: false, error: '딜 결제 중 오류가 발생했습니다', detail: String(err) }, 500);
  }
});

export { pointsRoutes };
