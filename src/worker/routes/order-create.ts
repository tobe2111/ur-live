import { Hono } from 'hono';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit';
import type { Env } from '../types/env';
import { logInfo, logWarn, logError } from '../utils/logger';
import { OrderRepository } from '../repositories/order.repository';
import { ProductRepository } from '../repositories/product.repository';
import { QueryBuilder } from '../repositories/query-builder';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { calculateShippingFee, generateId } from '../../shared/utils';
import type { CreateOrderRequest } from '../../shared/types';
import { tossCancelPayment } from '../utils/toss-payments';
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes';
import { createOrderSchema, getUserDbId, type AuthVariables } from './order-helpers';

export const orderCreateRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// POST /api/orders
orderCreateRouter.post('/', rateLimit({ action: 'create_order', max: 10, windowSec: 60 }), async (c) => {
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
          logWarn('orders.create.sellerQueryFailed', { error: 'seller query failed — using default shipping fee' });
        }
      }
    }

    // seller_id 없거나 ACTIVE 아닌 경우 기본값 사용 (주문 차단 대신 경고 로그)
    if (!seller) {
      logWarn('orders.create.sellerNotFound', { error: 'seller not found or inactive — using default shipping fee' });
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
      logError('orders.create.createOrderFailed', { error: (createErr as Error)?.message });
      const restoreStmts = orderItems.map(item => ({
        sql: `UPDATE products
              SET stock      = stock + ?,
                  updated_at = datetime('now')
              WHERE id = ?`,
        params: [item.quantity, item.product_id],
      }));
      await orderRepo['qb'].batch(restoreStmts).catch(e =>
        logError('orders.create.stockRestoreFailed', { error: (e as Error)?.message })
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
        ).catch((err: Error) => logError('orders.create.alimtalkFailed', { error: err?.message }));
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
            product_name: request.items?.[0]?.product_name,
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
    logError('orders.create.error', { error: errMsg });
    return c.json({ success: false, error: '주문 생성에 실패했습니다' }, 500);
  }
});

