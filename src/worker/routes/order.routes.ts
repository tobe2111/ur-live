// ============================================================
// Order Routes - Multi-Seller Support
// POST /api/orders            - Create order for one seller
// GET  /api/orders            - List user's orders  
// GET  /api/orders/:id        - Get order detail
// POST /api/orders/:id/cancel - Cancel order (+ Toss Payments cancel)
// ============================================================

import { Hono } from 'hono';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { QueryBuilder } from '../repositories/query-builder';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { calculateShippingFee, generateId } from '../../shared/utils';
import type { CreateOrderRequest } from '../../shared/types';
import { tossCancelPayment } from '../utils/toss-payments';
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes';

// AuthVariables compatible with auth.ts AuthUser
type AuthVariables = { user: AuthUser };

const ordersRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// All order routes require authentication (Firebase + JWT support)
ordersRouter.use('*', requireAuth());

/**
 * Firebase UID → DB user_id 변환 헬퍼
 * users 테이블에서 firebase_uid로 정수 id를 조회
 * 없으면 Firebase UID 자체를 fallback으로 사용 (새 스키마 호환)
 */
async function getUserDbId(db: D1Database, firebaseUid: string): Promise<string> {
  try {
    const row = await (db
      .prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
      .bind(firebaseUid)
      .first() as Promise<{ id: string | number } | null>);
    if (row?.id != null) return String(row.id);
  } catch {
    // users 테이블에 firebase_uid 컬럼이 없는 경우 (새 스키마) → Firebase UID 직접 사용
  }
  return firebaseUid; // fallback: 새 스키마에서는 Firebase UID = users.id
}

const createOrderSchema = z.object({
  seller_id: z.string().optional().default(''),
  order_number: z.string().min(1),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive().max(99),
    options: z.record(z.string()).optional(),
  })).min(1),
  shipping_address: z.object({
    postal_code: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default('KR'),
    recipient_name: z.string().optional(),
  }),
  shipping_name: z.string(),
  shipping_phone: z.string(),
  shipping_memo: z.string().optional(),
  idempotency_key: z.string().min(1),
});

// POST /api/orders
ordersRouter.post('/', rateLimit({ action: 'create_order', max: 10, windowSec: 60 }), async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const body = await c.req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다',
        details: parsed.error.issues,
      }, 400);
    }

    const request: CreateOrderRequest = parsed.data;
    const orderRepo = new OrderRepository(c.env.DB);
    const productRepo = new ProductRepository(c.env.DB);

    // Idempotency check - return existing order if already created
    // ✅ BUG #43 FIX: Scope to current user to prevent cross-user idempotency collisions.
    const existingOrder = await orderRepo.findByIdempotencyKey(request.idempotency_key, userId);
    if (existingOrder) {
      if (import.meta.env.DEV) console.log('[ORDERS] Idempotent request, returning existing order:', existingOrder.id);
      return c.json({ success: true, data: existingOrder }, 200);
    }

    // Fetch seller info
    // Note: old schema (migration 0003 + 0035) uses 'shipping_fee' column
    //       new schema (001_initial.sql) uses 'base_shipping_fee' column
    //       Try new schema first, fall back to old schema column name
    const qb = new QueryBuilder(c.env.DB);
    type SellerRow = { id: string; name: string; base_shipping_fee: number; free_shipping_threshold: number | null; status: string };
    let seller: SellerRow | null = null;
    if (request.seller_id) {
      try {
        seller = await qb.queryOne<SellerRow>(
          'SELECT id, name, base_shipping_fee, free_shipping_threshold, status FROM sellers WHERE id = ?',
          [request.seller_id]
        );
      } catch {
        // Old schema: 'base_shipping_fee' column doesn't exist, try 'shipping_fee'
        try {
          const row = await qb.queryOne<Omit<SellerRow, 'base_shipping_fee'> & { shipping_fee: number }>(
            'SELECT id, name, shipping_fee, free_shipping_threshold, status FROM sellers WHERE id = ?',
            [request.seller_id]
          );
          if (row) seller = { ...row, base_shipping_fee: row.shipping_fee ?? 3000 };
        } catch {
          console.warn('[ORDERS] Seller query failed for seller_id:', request.seller_id, '— using default shipping fee');
        }
      }
    }

    // seller_id 없거나 ACTIVE 아닌 경우 기본값 사용 (주문 차단 대신 경고 로그)
    if (!seller) {
      console.warn('[ORDERS] Seller not found or inactive:', request.seller_id, '— using default shipping fee');
    }

    // Block orders targeting a suspended/unapproved seller.
    // Defensive: only enforce when a seller row was actually fetched (skip for
    // seller-less legacy orders where `seller` stays null).
    if (seller && request.seller_id) {
      try {
        const gate = await qb.queryOne<{ id: string }>(
          "SELECT id FROM sellers WHERE id = ? AND status = 'approved' AND (is_active IS NULL OR is_active = 1)",
          [request.seller_id]
        );
        if (!gate) {
          return c.json(
            { success: false, error: '판매자가 정지되었거나 존재하지 않습니다.' },
            400
          );
        }
      } catch {
        // If is_active column doesn't exist, fall back to status-only check
        try {
          const gate = await qb.queryOne<{ id: string }>(
            "SELECT id FROM sellers WHERE id = ? AND status = 'approved'",
            [request.seller_id]
          );
          if (!gate) {
            return c.json(
              { success: false, error: '판매자가 정지되었거나 존재하지 않습니다.' },
              400
            );
          }
        } catch { /* defensive — skip gate if schema doesn't support it */ }
      }
    }

    // Validate and fetch products
    const productIds = request.items.map(i => i.product_id);
    const products = await productRepo.findByIds(productIds);

    if (products.length !== productIds.length) {
      const missingIds = productIds.filter(id => !products.find(p => p.id === id));
      return c.json({ success: false, error: `일부 상품을 찾을 수 없습니다 (ID: ${missingIds.join(', ')})` }, 400);
    }

    // seller_id가 빈 문자열이면 null로 치환 (FK 위반 방지)
    // 상품에 seller_id가 없는 경우 (null) 주문 생성 시 seller_id도 null 허용
    const effectiveSellerId = request.seller_id || null;

    // Verify all products belong to the specified seller (skip if seller_id is empty/null)
    if (effectiveSellerId) {
      const wrongSeller = products.find(p => p.seller_id !== effectiveSellerId);
      if (wrongSeller) {
        return c.json({
          success: false,
          error: `상품 "${wrongSeller.name}"은 해당 판매자의 상품이 아닙니다`,
        }, 400);
      }
    }

    // Build order items with pre-flight stock check (READ phase)
    const orderItems = [];
    let subtotal = 0;

    for (const reqItem of request.items) {
      const product = products.find(p => p.id === reqItem.product_id);
      if (!product) {
        return c.json({ success: false, error: `상품을 찾을 수 없습니다: ${reqItem.product_id}` }, 400);
      }

      // Pre-flight 재고 체크 (낙관적 락 전 조기 실패 - UX 개선)
      // DB 스키마: stock (구) / stock_quantity (신) 양쪽 호환
      const currentStock = product.stock ?? product.stock_quantity ?? 0;
      if (currentStock < reqItem.quantity) {
        return c.json({
          success: false,
          error: `"${product.name}" 재고가 부족합니다 (남은 수량: ${currentStock})`,
        }, 400);
      }

      const itemSubtotal = product.price * reqItem.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        product_id: product.id,
        seller_id: product.seller_id,
        product_name: product.name,
        product_thumbnail: product.thumbnail_url,
        product_sku: product.sku,
        unit_price: product.price,
        quantity: reqItem.quantity,
        subtotal: itemSubtotal,
        options: reqItem.options,
      });
    }

    // Calculate shipping fee (default 3000원 if seller not found)
    const shippingFee = calculateShippingFee(
      subtotal,
      seller?.base_shipping_fee ?? 3000,
      seller?.free_shipping_threshold ?? undefined
    );

    // ── 동시성 안전 재고 차감 (Optimistic Lock) ─────────────────
    // D1 batch()는 원자적으로 실행됩니다.
    // 각 UPDATE에 `AND stock >= qty` 조건을 포함하여
    // 동시 주문으로 인한 초과 판매를 방지합니다.
    const stockResult = await orderRepo.reserveStock(
      orderItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        product_name: i.product_name,
      }))
    );

    if (!stockResult.success) {
      return c.json({
        success: false,
        error: `"${stockResult.insufficientProduct}" 재고가 부족합니다 (동시 주문으로 인해 품절 처리되었습니다)`,
        code: 'OUT_OF_STOCK',
      }, 409);
    }

    // Create order (재고 차감 완료 후 주문 생성)
    // Note: repository 내부에서 seller_id 빈 문자열 → null 변환 처리
    let order;
    try {
      order = await orderRepo.createOrder(userId, request, orderItems, subtotal, shippingFee);
    } catch (createErr) {
      // 주문 생성 실패 시 이미 차감한 재고를 복구 (보상 트랜잭션)
      console.error('[ORDERS] createOrder failed, restoring stock:', createErr);
      const restoreStmts = orderItems.map(item => ({
        sql: `UPDATE products
              SET stock      = stock + ?,
                  updated_at = datetime('now')
              WHERE id = ?`,
        params: [item.quantity, item.product_id],
      }));
      await orderRepo['qb'].batch(restoreStmts).catch(e =>
        console.error('[ORDERS] stock restore failed:', e)
      );
      throw createErr; // 상위 catch로 전달
    }

    if (import.meta.env.DEV) console.log('[ORDERS] Created:', {
      orderId: order.id,
      orderNumber: order.order_number,
      sellerId: order.seller_id,
      total: order.total_amount,
    });

    // Dashboard notification: notify admin about new order
    createDashboardNotification(
      c.env.DB, 'admin', null, 'new_order',
      '새 주문',
      `주문번호: ${order.order_number}`,
      '/admin/orders'
    ).catch(() => {});

    // 셀러에게도 알림 (seller_id가 있는 경우)
    if (order.seller_id) {
      createDashboardNotification(c.env.DB, 'seller', String(order.seller_id), 'new_order', '새 주문', `주문번호: ${order.order_number}`, '/seller/orders').catch(() => {});
    }

    // 재고 부족 체크
    for (const item of orderItems) {
      const product = products.find(p => p.id === item.product_id);
      if (product && ((product.stock ?? product.stock_quantity ?? 0) - item.quantity) <= 5) {
        createDashboardNotification(c.env.DB, 'seller', String(product.seller_id || ''), 'low_stock', '재고 부족', `${product.name}: ${(product.stock ?? product.stock_quantity ?? 0) - item.quantity}개 남음`, '/seller/inventory').catch(() => {});
      }
    }

    // 자동 알림톡 발송 (주문 확인) - 비동기로 처리, 실패해도 주문 생성에 영향 없음
    if (c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID) {
      import('../../lib/alimtalk-auto').then(({ sendOrderConfirmation }) => {
        sendOrderConfirmation(
          { DB: c.env.DB, ALIGO_API_KEY: c.env.ALIGO_API_KEY!, ALIGO_USER_ID: c.env.ALIGO_USER_ID!, ALIMTALK_SENDER_KEY: c.env.ALIMTALK_SENDER_KEY },
          typeof order.id === 'number' ? order.id : parseInt(String(order.id), 10)
        ).catch((err: Error) => console.error('[Alimtalk] Order confirmation failed:', err.message));
      }).catch(() => { /* alimtalk not critical */ });
    }

    // 제휴 마케팅 수수료 추적 (ref 파라미터)
    const referrerId = body.referrer_id || body.ref
    if (referrerId && referrerId !== String(userId)) {
      c.executionCtx?.waitUntil?.(
        fetch(`${c.req.url.split('/api/')[0]}/api/affiliate/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referrer_id: referrerId,
            order_id: order.id,
            product_id: request.items?.[0]?.product_id,
            product_name: (request.items?.[0] as any)?.product_name,
            buyer_id: String(userId),
            order_amount: order.total_amount,
          }),
        }).catch(() => {})
      )

      // 추천 트리 등록 (안전망: 카카오 콜백에서 등록 안 된 경우 대비)
      try {
        const { registerInReferralTree } = await import('../../features/referral/api/referral-tree.routes');
        await registerInReferralTree(c.env.DB, String(userId), 'user', referrerId);
      } catch { /* non-critical */ }
    }

    return c.json({ success: true, data: order }, 201);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[ORDERS] Create error:', errMsg, err);
    return c.json({ success: false, error: '주문 생성에 실패했습니다' }, 500);
  }
});

// GET /api/orders
ordersRouter.get('/', async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const { page = '1', limit = '20' } = c.req.query();
    const orderRepo = new OrderRepository(c.env.DB);

    const { orders, total } = await orderRepo.findByUserId(
      userId,
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 100)
    );

    return c.json({
      success: true,
      data: {
        items: orders,
        total,
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
        has_next: parseInt(page, 10) * Math.min(parseInt(limit, 10), 100) < total,
      },
    });
  } catch (err) {
    console.error('[ORDERS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch orders' }, 500);
  }
});

// GET /api/orders/:id
ordersRouter.get('/:id', async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const orderId = c.req.param('id')!;
    const orderRepo = new OrderRepository(c.env.DB);

    const order = await orderRepo.findById(orderId);

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Security: only owner can view
    if (order.user_id !== userId && c.get('user').type !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    return c.json({ success: true, data: order });
  } catch (err) {
    console.error('[ORDERS] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch order' }, 500);
  }
});

// POST /api/orders/refund  ← useOrder.ts에서 호출
// 환불 요청: Toss Cancel API 호출 후 DB 상태 CANCELLED + 재고 복구
ordersRouter.post('/refund', rateLimit({ action: 'order_refund', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const body = await c.req.json<{
      order_id: string;
      reason: string;
      refund_amount?: number;
    }>();

    if (!body.order_id || !body.reason) {
      return c.json({ success: false, error: 'order_id, reason 필드가 필요합니다' }, 400);
    }

    const orderRepo = new OrderRepository(c.env.DB);
    const order = await orderRepo.findById(body.order_id);

    if (!order) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }

    if (order.user_id !== userId) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const refundableStatuses = ['PAID', 'DONE', 'DELIVERED'];
    if (!refundableStatuses.includes(order.status)) {
      return c.json({
        success: false,
        error: `현재 상태(${order.status})에서는 환불 요청할 수 없습니다`,
      }, 400);
    }

    // 🛡️ 2026-04-22: payment_status 추가 검증 — 결제 미완료 주문 환불 차단
    // status 가 PAID 여도 payment_status 가 pending/failed 이면 Toss 호출 시 404/inconsistent → DB 오염.
    const payStatus = (order as any).payment_status;
    if (payStatus && payStatus !== 'approved') {
      return c.json({
        success: false,
        error: `결제가 완료되지 않은 주문입니다 (payment_status: ${payStatus})`,
      }, 400);
    }

    // Toss 결제 취소 API 호출 (실제 환불)
    const payInfo = await orderRepo.getPaymentInfo(body.order_id);
    const paymentKey = payInfo?.toss_payment_key;

    if (!paymentKey) {
      return c.json({
        success: false,
        error: '결제 키를 찾을 수 없습니다. 고객센터에 문의해 주세요.',
        code: 'PAYMENT_KEY_MISSING',
      }, 422);
    }

    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment service unavailable' }, 503);
    }

    // 🛡️ 2026-04-22: Toss 호출 전 CAS 로 refunded_amount 예약 — 동시 환불 race 차단
    // 이전: Toss 먼저 호출 → DB 업데이트. 동시 2건 요청 시 양쪽 다 Toss 성공 후 합이 total 초과 가능.
    // 수정: CAS 로 DB 에 먼저 기록 (total_amount 초과 불가). Toss 실패 시 롤백.
    const refundAmount = body.refund_amount && body.refund_amount > 0 ? Math.round(body.refund_amount) : order.total_amount;
    if (refundAmount <= 0 || refundAmount > order.total_amount) {
      return c.json({ success: false, error: '환불 금액이 유효하지 않습니다' }, 400);
    }

    // CAS: refunded_amount + refund_amount <= total_amount 일 때만 업데이트
    const reserveResult = await c.env.DB.prepare(
      "UPDATE orders SET refunded_amount = COALESCE(refunded_amount, 0) + ? WHERE id = ? AND COALESCE(refunded_amount, 0) + ? <= total_amount"
    ).bind(refundAmount, body.order_id, refundAmount).run().catch(() => null);

    if (!reserveResult || (reserveResult.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '환불 가능 금액을 초과하거나 이미 처리 중입니다' }, 409);
    }

    const tossResult = await tossCancelPayment(
      paymentKey,
      tossSecretKey,
      `[환불요청] ${body.reason}`,
      body.refund_amount,
    );

    if (!tossResult.success) {
      // 🛡️ Toss 실패 시 예약한 refunded_amount 롤백
      await c.env.DB.prepare(
        "UPDATE orders SET refunded_amount = MAX(0, COALESCE(refunded_amount, 0) - ?) WHERE id = ?"
      ).bind(refundAmount, body.order_id).run().catch((e) => { console.error('[ORDERS] refunded_amount rollback failed:', e) });

      const tossErrorMessages: Record<string, string> = {
        ALREADY_CANCELED_PAYMENT: '이미 취소된 결제입니다',
        EXCEED_CANCEL_AMOUNT: '환불 금액이 결제 금액을 초과합니다',
        NOT_CANCELABLE_PAYMENT: '취소할 수 없는 결제입니다',
      };
      return c.json({
        success: false,
        error: tossErrorMessages[tossResult.code] ?? `환불 처리 실패: ${tossResult.message}`,
        code: tossResult.code,
      }, 422);
    }

    // DB 상태 업데이트 + 재고 복구
    await orderRepo.updateStatusById(body.order_id, 'CANCELLED', {
      cancel_reason: `[환불요청] ${body.reason}`,
      cancelled_at: new Date().toISOString(),
    });
    await orderRepo.restoreStock(body.order_id);

    // ✅ 환불 시 추천 커미션도 회수 (webhook path 동등화)
    // 🛡️ 2026-04-22: CAS 로 이중 회수 방어 — 이미 withdrawn 인 커미션은 포인트 재차감 안 됨.
    // 기존 버그: UPDATE 이후 SELECT WHERE status='withdrawn' 하면 과거 회수분까지 포함 → 중복 차감.
    // 수정: UPDATE 시점에 회수된 row 만 RETURNING-style 로 조회 (updated_at 범위로 필터).
    try {
      const revokeTs = new Date().toISOString();
      // 먼저 granted 인 commission 을 읽고 CAS 로 withdrawn 전환
      const toRevoke = await c.env.DB.prepare(
        "SELECT id, user_id, amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
      ).bind(body.order_id).all<{ id: number; user_id: string; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; user_id: string; amount: number }> }));

      for (const co of (toRevoke.results || [])) {
        const cas = await c.env.DB.prepare(
          "UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = ? WHERE id = ? AND status = 'granted'"
        ).bind(revokeTs, co.id).run().catch(() => null);
        // CAS 성공한 경우에만 포인트 차감 (다른 요청이 이미 처리했으면 skip)
        if (cas && (cas.meta?.changes ?? 0) > 0) {
          await c.env.DB.prepare(
            'UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?'
          ).bind(co.amount, co.user_id).run().catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[ORDERS] Commission reversal (refund) skipped:', e);
    }

    // 🛡️ 2026-04-22: 딜 포인트로 결제한 주문은 환불 금액만큼 포인트 환급
    try {
      const payMethod = (order as any).payment_method;
      if (payMethod === 'deal_points' && refundAmount > 0) {
        await c.env.DB.prepare(
          'UPDATE user_points SET balance = balance + ? WHERE user_id = ?'
        ).bind(refundAmount, String(order.user_id)).run();
        await c.env.DB.prepare(
          "INSERT INTO point_transactions (user_id, type, amount, points_amount, description) VALUES (?, 'refund', ?, ?, ?)"
        ).bind(String(order.user_id), refundAmount, refundAmount, `[환불] 주문 환불 (order:${(order as any).order_number || body.order_id})`).run().catch(() => {});
      }
    } catch (e) {
      console.error('[ORDERS] Points refund error:', e);
    }

    // 유저에게 인앱 알림 (환불/주문 취소)
    try {
      const { notifyUser } = await import('../../lib/notifications');
      await notifyUser(c.env.DB, String(order.user_id), 'order_status', '\u274C 주문이 취소되었습니다.', `주문번호: ${(order as any).order_number || body.order_id}`, '/my-orders');
    } catch {} // fire and forget

    const latestCancel = tossResult.data.cancels[tossResult.data.cancels.length - 1];

    return c.json({
      success: true,
      message: '환불이 처리되었습니다. 3~5 영업일 내 반환됩니다.',
      data: {
        order_id: body.order_id,
        cancel_amount: latestCancel?.cancelAmount ?? order.total_amount,
        cancelled_at: latestCancel?.canceledAt ?? new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[ORDERS] Refund error:', err);
    return c.json({ success: false, error: '환불 요청 처리에 실패했습니다' }, 500);
  }
});

// POST /api/orders/:id/cancel
ordersRouter.post('/:id/cancel', rateLimit({ action: 'order_cancel', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const firebaseUid = String(c.get('user').id);
    const userId = await getUserDbId(c.env.DB, firebaseUid);
    const orderId = c.req.param('id')!;
    const body = await c.req.json<{ reason?: string; cancel_amount?: number }>();
    const reason = body.reason ?? '고객 요청';
    const cancelAmount = body.cancel_amount;

    const orderRepo = new OrderRepository(c.env.DB);

    const order = await orderRepo.findById(orderId);
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // ── 2. 권한 확인 ──────────────────────────────────────────
    if (order.user_id !== userId && c.get('user').type !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    // ── 3. 취소 가능 상태 검증 ────────────────────────────────
    const cancellableStatuses = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'DONE'];
    if (!cancellableStatuses.includes(order.status)) {
      return c.json({
        success: false,
        error: `현재 상태(${order.status})에서는 취소할 수 없습니다`,
      }, 400);
    }

    // ── 3-1. v26 CRITICAL: 부분 취소 금액 서버 검증 ────────────
    // 클라이언트 값 신뢰 금지 — Toss API 호출 전 반드시 범위 클램프
    if (cancelAmount !== undefined) {
      if (!Number.isFinite(cancelAmount) || !Number.isInteger(cancelAmount) || cancelAmount <= 0) {
        return c.json({ success: false, error: '유효한 취소 금액을 입력해주세요 (1원 이상 정수)' }, 400);
      }
      const alreadyRefunded = Number(order.refunded_amount ?? 0);
      const remaining = Number(order.total_amount ?? 0) - alreadyRefunded;
      if (cancelAmount > remaining) {
        return c.json({
          success: false,
          error: `취소 가능 금액을 초과합니다 (최대 ${remaining.toLocaleString()}원)`,
        }, 400);
      }
    }

    // ── 4. 결제 취소 (Toss Payments) ─────────────────────────
    // PAID / DONE 상태: 실제 결제가 이루어졌으므로 Toss Cancel API 호출
    const paymentMadeStatuses = ['PAID', 'DONE'];
    if (paymentMadeStatuses.includes(order.status)) {
      // toss_payment_key가 있어야 취소 가능
      const payInfo = await orderRepo.getPaymentInfo(orderId);
      const paymentKey = payInfo?.toss_payment_key;

      if (!paymentKey) {
        // payment key 없으면 이상 상태 — 취소 불가 처리
        return c.json({
          success: false,
          error: '결제 키를 찾을 수 없습니다. 고객센터에 문의해 주세요.',
          code: 'PAYMENT_KEY_MISSING',
        }, 422);
      }

      const tossSecretKey = c.env.TOSS_SECRET_KEY;
      if (!tossSecretKey) {
        console.error('[ORDERS] TOSS_SECRET_KEY not configured');
        return c.json({ success: false, error: 'Payment service unavailable' }, 503);
      }

      const tossResult = await tossCancelPayment(
        paymentKey,
        tossSecretKey,
        reason,
        cancelAmount,
      );

      if (!tossResult.success) {
        // Toss에서 취소 거부 → DB 상태는 변경하지 않고 오류 반환
        console.error('[ORDERS] Toss cancel failed:', tossResult.code, tossResult.message);

        // Toss 에러 코드에 따른 한국어 메시지 매핑
        const tossErrorMessages: Record<string, string> = {
          CANCEL_FAILED: '결제 취소 처리 중 오류가 발생했습니다',
          ALREADY_CANCELED_PAYMENT: '이미 취소된 결제입니다',
          EXCEED_CANCEL_AMOUNT: '취소 금액이 결제 금액을 초과합니다',
          INVALID_CANCEL_AMOUNT: '취소 금액이 유효하지 않습니다',
          NOT_CANCELABLE_PAYMENT: '취소할 수 없는 결제입니다',
          NOT_CANCELABLE_AMOUNT: '취소 불가능한 금액입니다',
          FORBIDDEN_CONSECUTIVE_REQUEST: '잠시 후 다시 시도해 주세요',
        };

        const userMessage = tossErrorMessages[tossResult.code]
          ?? `결제 취소 실패: ${tossResult.message}`;

        return c.json({
          success: false,
          error: userMessage,
          code: tossResult.code,
        }, 422);
      }

      // Toss 취소 성공 → DB 업데이트 (원자적 배치)
      await orderRepo.updateStatusById(orderId, 'CANCELLED', {
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      });

      // 재고 복구
      await orderRepo.restoreStock(orderId);

      // ✅ 추천 커미션 회수 (cancel paid 경로)
      // 🛡️ 2026-04-22: CAS 로 이중 회수 방어 (refund 와 동일 패턴)
      try {
        const toRevoke = await c.env.DB.prepare(
          "SELECT id, user_id, amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
        ).bind(orderId).all<{ id: number; user_id: string; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; user_id: string; amount: number }> }));

        for (const co of (toRevoke.results || [])) {
          const cas = await c.env.DB.prepare(
            "UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = datetime('now') WHERE id = ? AND status = 'granted'"
          ).bind(co.id).run().catch(() => null);
          if (cas && (cas.meta?.changes ?? 0) > 0) {
            await c.env.DB.prepare(
              'UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?'
            ).bind(co.amount, co.user_id).run().catch((err) => {
              console.error('[ORDERS] user_points debit failed (cancel paid):', err);
            });
          }
        }
      } catch (e) {
        console.error('[ORDERS] Commission reversal (cancel paid) error:', e);
      }

      // 🛡️ 2026-04-22: 딜 포인트로 결제한 주문은 포인트 환급 (payment_method='deal_points')
      try {
        const payMethod = (order as any).payment_method;
        if (payMethod === 'deal_points') {
          const refundPoints = cancelAmount ?? Number(order.total_amount ?? 0);
          if (refundPoints > 0) {
            await c.env.DB.prepare(
              'UPDATE user_points SET balance = balance + ? WHERE user_id = ?'
            ).bind(refundPoints, String(order.user_id)).run();
            await c.env.DB.prepare(
              "INSERT INTO point_transactions (user_id, type, amount, points_amount, description) VALUES (?, 'refund', ?, ?, ?)"
            ).bind(String(order.user_id), refundPoints, refundPoints, `[환불] 주문 취소 (order:${order.order_number})`).run().catch(() => {});
          }
        }
      } catch (e) {
        console.error('[ORDERS] Points refund (cancel paid) error:', e);
      }

      // 주문 취소 알림
      createDashboardNotification(c.env.DB, 'admin', null, 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/admin/orders').catch(() => {});
      if (order.seller_id) {
        createDashboardNotification(c.env.DB, 'seller', String(order.seller_id), 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/seller/orders').catch(() => {});
      }

      // 유저에게 인앱 알림 (주문 취소)
      try {
        const { notifyUser } = await import('../../lib/notifications');
        await notifyUser(c.env.DB, String(order.user_id), 'order_status', '\u274C 주문이 취소되었습니다.', `주문번호: ${order.order_number}`, '/my-orders');
      } catch {} // fire and forget

      const latestCancel = tossResult.data.cancels[tossResult.data.cancels.length - 1];

      if (import.meta.env.DEV) console.info('[ORDERS] Cancel success (paid):', {
        orderId,
        paymentKey,
        cancelAmount: latestCancel?.cancelAmount,
        tossStatus: tossResult.data.status,
      });

      return c.json({
        success: true,
        message: '주문 및 결제가 취소되었습니다',
        data: {
          order_id: orderId,
          cancel_amount: latestCancel?.cancelAmount ?? order.total_amount,
          cancelled_at: latestCancel?.canceledAt ?? new Date().toISOString(),
          toss_status: tossResult.data.status,
        },
      });
    }

    // ── 5. 미결제 주문 취소 (PENDING / AWAITING_PAYMENT) ─────
    // 결제가 일어나지 않았으므로 Toss API 불필요
    await orderRepo.updateStatusById(orderId, 'CANCELLED', {
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    });

    // 주문 취소 알림
    createDashboardNotification(c.env.DB, 'admin', null, 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/admin/orders').catch(() => {});
    if (order.seller_id) {
      createDashboardNotification(c.env.DB, 'seller', String(order.seller_id), 'order_cancelled', '주문 취소', `주문번호: ${order.order_number}`, '/seller/orders').catch(() => {});
    }

    // 유저에게 인앱 알림 (주문 취소)
    try {
      const { notifyUser } = await import('../../lib/notifications');
      await notifyUser(c.env.DB, String(order.user_id), 'order_status', '\u274C 주문이 취소되었습니다.', `주문번호: ${order.order_number}`, '/my-orders');
    } catch {} // fire and forget

    if (import.meta.env.DEV) console.info('[ORDERS] Cancel success (unpaid):', { orderId, status: order.status });

    return c.json({
      success: true,
      message: '주문이 취소되었습니다',
      data: {
        order_id: orderId,
        cancel_amount: 0,
        cancelled_at: new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error('[ORDERS] Cancel error:', err);
    return c.json({ success: false, error: 'Failed to cancel order' }, 500);
  }
});

export { ordersRouter };
