/**
 * 딜 포인트 리워드/결제 라우트
 *
 * POST /ad-reward        - 광고 시청 완료 후 딜 지급
 * GET  /ad-reward/status - 오늘 광고 시청 현황
 * POST /pay              - 딜로 상품 결제
 */

import { Hono } from 'hono';
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth';
import { rateLimit } from '../../../worker/middleware/rate-limit';
import type { Env } from '../../../worker/types/env';
import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from '../../../shared/constants';
import { createDashboardNotification } from '../../notifications/api/dashboard-notifications.routes';
import { ensureTables, AD_REWARD_POINTS, AD_DAILY_LIMIT, AD_REWARD_DESC_PREFIX } from './points-helpers';

export const pointsRewardRoutes = new Hono<{ Bindings: Env }>();

// ── POST /ad-reward — 광고 시청 완료 후 딜 지급 ───────────────────────
pointsRewardRoutes.post('/ad-reward', rateLimit({ action: 'points_ad_reward', max: 5, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id); // 항상 문자열로 통일

  // 오늘 이미 시청한 횟수 확인 (KST 기준)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const kstDateStr = kstNow.toISOString().slice(0, 10);

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

    // v24 FIX: lost-update 방지. 원자적 UPSERT (balance = balance + ?)로 전환.
    await DB.prepare(`
      INSERT INTO user_points (user_id, balance, total_charged, total_donated)
      VALUES (?, ?, 0, 0)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, AD_REWARD_POINTS).run();

    // 거래 기록용 최신 잔액 조회 (원자적 UPSERT 후)
    const afterRow = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    const newBalance = afterRow?.balance ?? AD_REWARD_POINTS;

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

// ── GET /ad-reward/status — 오늘 광고 시청 현황 ──────────────────────
pointsRewardRoutes.get('/ad-reward/status', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const kstDateStr = kstNow.toISOString().slice(0, 10);

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

// ── POST /pay — 딜로 상품 결제 ────────────────────────────────────────
pointsRewardRoutes.post('/pay', rateLimit({ action: 'points_pay', max: 20, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);

  // ✅ SECURITY FIX: Ignore client-supplied total_amount/price. Recompute server-side.
  const { order_number, items, shipping } = await c.req.json<{
    order_number: string;
    total_amount?: number; // ignored (kept for back-compat parsing)
    items: Array<{
      product_id: string | number;
      product_name?: string;
      quantity: number;
      price?: number; // ignored — fetched from DB
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

  if (!order_number || !items?.length || !shipping?.name) {
    return c.json({ success: false, error: '필수 항목이 누락되었습니다' }, 400);
  }

  // ✅ IDEMPOTENCY: client-supplied `order_number` doubles as the idempotency key.
  // HIGH-4: Use an exact-match pattern instead of arbitrary prefix `LIKE '${ord}%'`
  try {
    const existingOrder = await DB.prepare(
      `SELECT id, order_number, total_amount FROM orders
       WHERE (order_number = ? OR order_number LIKE ?)
         AND user_id = ?
       LIMIT 1`
    ).bind(order_number, `${order_number}_s%`, userId)
     .first<{ id: number; order_number: string; total_amount: number }>();
    if (existingOrder) {
      const wallet2 = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
        .bind(userId).first<{ balance: number }>();
      return c.json({
        success: true,
        data: {
          order_number,
          amount_paid: existingOrder.total_amount,
          balance: wallet2?.balance ?? 0,
          payment_method: 'deal_points',
        },
        message: '이미 처리된 결제입니다',
      });
    }
  } catch { /* ignore — defensive */ }

  // ✅ Server-side price lookup: fetch actual price + seller_id from DB
  const productIds = Array.from(new Set(items.map(i => Number(i.product_id)))).filter(n => !isNaN(n));
  if (productIds.length === 0) {
    return c.json({ success: false, error: '유효하지 않은 상품입니다' }, 400);
  }

  const placeholders = productIds.map(() => '?').join(',');
  const { results: productRows = [] } = await DB.prepare(
    `SELECT id, name, price, seller_id, stock FROM products WHERE id IN (${placeholders}) AND is_active = 1`
  ).bind(...productIds).all<{ id: number; name: string; price: number; seller_id: number | null; stock: number }>();

  const productMap = new Map<number, { id: number; name: string; price: number; seller_id: number | null; stock: number }>();
  for (const p of productRows) productMap.set(Number(p.id), p);

  // Validate all items exist + have stock
  for (const item of items) {
    const p = productMap.get(Number(item.product_id));
    if (!p) {
      return c.json({ success: false, error: `상품을 찾을 수 없거나 판매 중단된 상품입니다 (id: ${item.product_id})` }, 404);
    }
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) {
      return c.json({ success: false, error: '수량이 유효하지 않습니다' }, 400);
    }
    if (p.stock < qty) {
      return c.json({ success: false, error: `재고 부족: ${p.name}` }, 400);
    }
  }

  // Build server-side normalized items with authoritative price
  const normalizedItems = items.map(i => {
    const p = productMap.get(Number(i.product_id))!;
    return {
      product_id: p.id,
      product_name: p.name,
      price: Number(p.price),
      quantity: Number(i.quantity),
      seller_id: p.seller_id ? String(p.seller_id) : '0',
      option_value: i.option_value,
    };
  });

  // Group by seller to compute shipping fee per seller
  const sellerGroups = new Map<string, typeof normalizedItems>();
  for (const item of normalizedItems) {
    const sid = item.seller_id;
    if (!sellerGroups.has(sid)) sellerGroups.set(sid, []);
    sellerGroups.get(sid)!.push(item);
  }

  // Compute authoritative total (subtotal + shipping per seller group)
  let authoritativeTotal = 0;
  for (const [, groupItems] of sellerGroups) {
    const groupSubtotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingFee = groupSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
    authoritativeTotal += groupSubtotal + shippingFee;
  }

  // ✅ Validate balance BEFORE deducting
  const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
    .bind(userId).first<{ balance: number }>();

  if (!wallet || wallet.balance < authoritativeTotal) {
    return c.json({
      success: false,
      error: `딜이 부족합니다. (보유: ${wallet?.balance ?? 0}딜, 필요: ${authoritativeTotal}딜)`,
      code: 'INSUFFICIENT_POINTS',
    }, 400);
  }

  // ✅ Atomic deduct (balance >= authoritativeTotal guard)
  const deductRes = await DB.prepare(
    'UPDATE user_points SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?'
  ).bind(authoritativeTotal, userId, authoritativeTotal).run();
  if (!deductRes.meta.changes) {
    return c.json({ success: false, error: '딜이 부족합니다 (동시 결제 충돌)', code: 'INSUFFICIENT_POINTS' }, 400);
  }

  // Track stock reservations so we can roll back on failure
  const stockReserved: Array<{ product_id: number; quantity: number }> = [];

  try {
    const afterWallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(userId).first<{ balance: number }>();
    const newBalance = afterWallet?.balance ?? 0;

    // ✅ PERF: batch all stock reservations in a single D1 round-trip.
    const stockStmts = normalizedItems.map(item =>
      DB.prepare(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ? AND is_active = 1'
      ).bind(item.quantity, item.product_id, item.quantity)
    );
    const stockResults = await DB.batch(stockStmts);
    for (let i = 0; i < stockResults.length; i++) {
      const changes = stockResults[i]?.meta?.changes ?? 0;
      if (changes === 0) {
        throw new Error(`재고 부족 (동시 결제 충돌): ${normalizedItems[i].product_name}`);
      }
      stockReserved.push({
        product_id: normalizedItems[i].product_id,
        quantity: normalizedItems[i].quantity,
      });
    }

    // Transaction record
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
       VALUES (?, 'donate', ?, 0, ?, ?, ?, ?)`
    ).bind(userId, authoritativeTotal, authoritativeTotal, newBalance, `상품 구매 (${normalizedItems.length}건)`, order_number).run();

    // Create orders per seller
    // ✅ PERF: use INSERT meta.last_row_id (avoids a separate SELECT per order)
    //         and batch all order_items per order into a single multi-row INSERT.
    for (const [sellerId, groupItems] of sellerGroups) {
      const groupSubtotal = groupItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const shippingFee = groupSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
      const sellerOrderNumber = `${order_number}_s${sellerId}`;

      const orderInsert = await DB.prepare(`
        INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method, shipping_name, shipping_phone, shipping_address, shipping_memo)
        VALUES (?, ?, ?, ?, ?, 0, ?, 'KRW', 'PAID', 'deal_points', ?, ?, ?, '')
      `).bind(
        sellerOrderNumber, userId, sellerId === '0' ? null : sellerId,
        groupSubtotal, shippingFee, groupSubtotal + shippingFee,
        shipping.name, shipping.phone,
        JSON.stringify({ postal_code: shipping.postal_code, address1: shipping.address1, address2: shipping.address2 || '' })
      ).run();

      const orderId = orderInsert.meta.last_row_id as number | undefined;

      if (orderId && groupItems.length > 0) {
        const values = groupItems.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const bindings = groupItems.flatMap(item => [
          orderId,
          item.product_id,
          item.product_name,
          item.price,
          item.price,
          item.quantity,
          item.price * item.quantity,
        ]);
        await DB.prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal) VALUES ${values}`
        ).bind(...bindings).run();
      }
    }

    createDashboardNotification(DB, 'admin', null, 'deal_payment', '딜 결제', `${authoritativeTotal.toLocaleString()}딜 상품 결제`, '/admin/orders').catch(() => {});

    return c.json({
      success: true,
      data: {
        order_number,
        amount_paid: authoritativeTotal,
        balance: newBalance,
        payment_method: 'deal_points',
      },
      message: `${authoritativeTotal.toLocaleString()}딜로 결제가 완료되었습니다!`,
    });
  } catch (err) {
    console.error('[points/pay] Error:', err);
    // ✅ Refund deals on any failure
    try {
      await DB.prepare(
        'UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).bind(authoritativeTotal, userId).run();
    } catch (refundErr) {
      console.error('[points/pay] Refund failed:', refundErr);
    }
    // ✅ Roll back any stock reservations
    for (const r of stockReserved) {
      try {
        await DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(r.quantity, r.product_id).run();
      } catch (stockErr) {
        console.error('[points/pay] Stock rollback failed:', stockErr);
      }
    }
    return c.json({ success: false, error: '딜 결제 중 오류가 발생했습니다', detail: String(err) }, 500);
  }
});
