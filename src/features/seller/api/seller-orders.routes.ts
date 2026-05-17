/**
 * Seller Orders & Products API Routes
 *
 * Endpoints:
 * - GET  /api/seller/orders                   - 셀러 주문 목록 조회
 * - PUT  /api/seller/orders/:id/status        - 주문 상태 업데이트
 * - PATCH /api/seller/orders/:id/status       - 주문 상태 업데이트 (alias)
 * - PUT  /api/seller/orders/:id/tracking      - 송장번호 등록
 * - GET  /api/seller/products                 - 셀러 상품 목록 조회
 * - POST /api/seller/products                 - 셀러 상품 등록
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { sendSellerAlimtalk } from '../../alimtalk/send';
import { buildShippingMessage, buildCancellationMessage } from '../../alimtalk/aligo';
import { swallow } from '@/worker/utils/swallow';
import { VOUCHER_CATEGORY_SET } from '@/shared/constants/voucher-categories';
import { invalidateGroupBuyProductsCache } from '../../group-buy/api/cache-keys';
type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
  ALIGO_SENDER_KEY?: string;
  ALIGO_SENDER_PHONE?: string;
  ALIGO_TPL_SHIPPING_START?: string;
  ALIGO_TPL_ORDER_CANCEL?: string;
};

export const sellerOrdersRoutes = new Hono<{ Bindings: Bindings }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<string | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number | string };
    return payload.seller_id ? String(payload.seller_id) : null;
  } catch {
    return null;
  }
}

/**
 * ✅ BUG #33 FIX: Authorize only approved + active sellers.
 * `getSellerIdFromToken` only proves the JWT was signed by us.  A seller whose
 * account was suspended, rejected, or soft-deleted still holds a valid token
 * and could otherwise keep calling these endpoints.  This helper does the JWT
 * check + a DB status check in one shot.
 */
async function getActiveSellerId(
  DB: D1Database,
  authorization: string | undefined,
  jwtSecret: string
): Promise<string | null> {
  const id = await getSellerIdFromToken(authorization, jwtSecret);
  if (!id) return null;
  // 🛡️ 2026-05-07: status 표준 분기 — 'active' 와 'approved' 모두 인정 (코드베이스 혼용 사고 방지).
  //   admin 라우트는 'active' 사용, 일부 구 코드는 'approved'. 둘 다 활성 상태로 처리.
  const seller = await DB.prepare(
    "SELECT id FROM sellers WHERE id = ? AND status IN ('approved', 'active') AND is_active = 1"
  ).bind(id).first();
  return seller ? id : null;
}

/** DB status 값과 프론트엔드 status 값 매핑 */
const STATUS_MAP: Record<string, string> = {
  PAY_COMPLETE: 'DONE',   // 프론트 → DB
  PAID: 'DONE',
};
const VALID_STATUSES = ['PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'DONE', 'PAID', 'PENDING'];

// ─── GET /api/seller/orders ────────────────────────────────────────────────
sellerOrdersRoutes.get('/orders', async (c) => {
  try {
    // ✅ BUG #33 FIX: Require approved + active seller (not just a signed JWT).
    const sellerId = await getActiveSellerId(c.env.DB, c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    const status = c.req.query('status');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = c.req.query('sort') === 'asc' ? 'ASC' : 'DESC';

    let query = `
      SELECT
        o.id,
        o.order_number,
        o.user_id,
        o.total_amount,
        o.status,
        o.shipping_name,
        o.shipping_phone,
        o.shipping_address,
        o.tracking_number,
        o.courier,
        NULL AS payment_method,
        o.created_at,
        o.updated_at,
        COALESCE(u.name, u.email) AS user_name,
        u.email             AS user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.seller_id = ?
    `;
    const params: unknown[] = [sellerId];

    if (status) {
      const dbStatus = STATUS_MAP[status] ?? status;
      // PAY_COMPLETE 는 DB에서 PAID 또는 DONE 으로 저장될 수 있음
      if (status === 'PAY_COMPLETE') {
        query += ` AND o.status IN ('PAID', 'DONE')`;
      } else {
        query += ` AND o.status = ?`;
        params.push(dbStatus);
      }
    }

    query += ` ORDER BY o.created_at ${sort} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const orders = await db.prepare(query).bind(...params).all();

    let countQuery = `SELECT COUNT(*) as total FROM orders o WHERE o.seller_id = ?`;
    const countParams: unknown[] = [sellerId];
    if (status) {
      if (status === 'PAY_COMPLETE') {
        countQuery += ` AND o.status IN ('PAID', 'DONE')`;
      } else {
        countQuery += ` AND o.status = ?`;
        countParams.push(STATUS_MAP[status] ?? status);
      }
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      data: orders.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total || 0) > (offset + limit),
      },
    });
  } catch (error: unknown) {
    console.error('Get seller orders error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to get orders' }, 500);
  }
});

// ─── PUT /api/seller/orders/:id/status ────────────────────────────────────
async function handleStatusUpdate(c: Context<{ Bindings: Bindings }>) {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const orderId = c.req.param('id');
    const body = await c.req.json<{ status: string }>();
    const rawStatus = body.status?.toUpperCase();
    const dbStatus = STATUS_MAP[rawStatus] ?? rawStatus;

    if (!VALID_STATUSES.includes(dbStatus)) {
      return c.json({
        success: false,
        error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
      }, 400);
    }

    const db = c.env.DB;

    // ✅ CONCURRENCY: enforce state machine so a seller cannot regress
    // a DELIVERED order back to PREPARING (or skip steps like PAID → DELIVERED).
    const { statusesThatCanReach } = await import('../../../worker/utils/state-machine');
    const allowedPrev = statusesThatCanReach(dbStatus);
    if (allowedPrev.length === 0) {
      return c.json({ success: false, error: `Invalid status transition to ${dbStatus}` }, 400);
    }
    const prevPh = allowedPrev.map(() => '?').join(',');

    // 소유권 확인 + 상태 변경 + 전이 검증을 원자적으로 처리
    const result = await db.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now')
       WHERE (id = ? OR order_number = ?) AND seller_id = ?
         AND UPPER(status) IN (${prevPh})`
    ).bind(dbStatus, orderId, orderId, sellerId, ...allowedPrev).run();

    // ── 유저에게 인앱 알림 발송 ──
    if (result.meta.changes) {
      try {
        const orderInfo = await db.prepare(
          `SELECT user_id, order_number FROM orders WHERE (id = ? OR order_number = ?) AND seller_id = ? LIMIT 1`
        ).bind(orderId, orderId, sellerId).first<{ user_id: string; order_number: string }>();
        if (orderInfo?.user_id) {
          const statusMessages: Record<string, string> = {
            'CONFIRMED': '주문이 확인되었습니다',
            'SHIPPING': '\u{1F4E6} 주문하신 상품이 발송되었습니다!',
            'DELIVERED': '\u2705 배송이 완료되었습니다. 상품을 확인해주세요!',
            'CANCELLED': '\u274C 주문이 취소되었습니다.',
          };
          const msg = statusMessages[dbStatus] || `주문 상태: ${dbStatus}`;
          const { notifyUser } = await import('../../../lib/notifications');
          await notifyUser(db, orderInfo.user_id, 'order_status', msg, `주문번호: ${orderInfo.order_number}`, '/my-orders');
        }
      } catch {} // fire and forget
    }

    if (!result.meta.changes) {
      // 주문이 없거나, 다른 셀러의 주문이거나, 상태 전환 불가
      const current = await db.prepare(
        `SELECT seller_id, status FROM orders WHERE (id = ? OR order_number = ?) LIMIT 1`
      ).bind(orderId, orderId).first<{ seller_id: number; status: string }>();
      if (!current) return c.json({ success: false, error: 'Order not found' }, 404);
      if (String(current.seller_id) !== String(sellerId)) {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
      return c.json({
        success: false,
        error: `상태 전환 불가: ${current.status} → ${dbStatus}`,
        code: 'INVALID_STATUS_TRANSITION',
      }, 409);
    }

    // ── 주문 취소 알림톡 (fire-and-forget) ──
    if (dbStatus === 'CANCELLED' && c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID) {
      const order = await db.prepare(
        `SELECT order_number, shipping_phone, shipping_name, seller_id, total_amount,
                (SELECT name FROM order_items oi JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = o.id LIMIT 1) AS product_name
         FROM orders o WHERE (id = ? OR order_number = ?) AND seller_id = ? LIMIT 1`
      ).bind(orderId, orderId, sellerId).first<{
        order_number: string; shipping_phone: string | null; shipping_name: string | null;
        seller_id: number; total_amount: number; product_name: string | null;
      }>().catch(() => null);

      if (order?.shipping_phone && order.seller_id) {
        const { subject, message } = buildCancellationMessage({
          orderId: order.order_number,
          buyerName: order.shipping_name ?? '고객',
          buyerPhone: order.shipping_phone,
          productName: order.product_name ?? '상품',
          totalAmount: order.total_amount,
        });
        sendSellerAlimtalk({
          DB: db,
          aligoApiKey: c.env.ALIGO_API_KEY,
          aligoUserId: c.env.ALIGO_USER_ID,
          aligoSenderKey: c.env.ALIGO_SENDER_KEY ?? '',
          senderPhone: c.env.ALIGO_SENDER_PHONE,
          sellerId: order.seller_id,
          receiver: order.shipping_phone,
          receiverName: order.shipping_name ?? '고객',
          templateCode: c.env.ALIGO_TPL_ORDER_CANCEL ?? 'TBD',
          subject,
          message,
          orderId: order.order_number,
        }).catch(e => console.warn('[Alimtalk] 주문취소 발송 실패:', e));
      }
    }

    return c.json({ success: true, message: '주문 상태가 업데이트되었습니다.' });
  } catch (error: unknown) {
    console.error('Update order status error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to update status' }, 500);
  }
}

sellerOrdersRoutes.put('/orders/:id/status', handleStatusUpdate);
sellerOrdersRoutes.patch('/orders/:id/status', handleStatusUpdate);

// ─── PUT /api/seller/orders/:id/tracking ──────────────────────────────────
sellerOrdersRoutes.put('/orders/:id/tracking', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const orderId = c.req.param('id');
    const body = await c.req.json<{ courier: string; tracking_number: string }>();
    const { courier, tracking_number } = body;

    if (!tracking_number) {
      return c.json({ success: false, error: '송장번호를 입력해주세요.' }, 400);
    }

    const db = c.env.DB;

    const result = await db.prepare(
      `UPDATE orders
       SET tracking_number = ?, courier = ?, status = 'SHIPPING', updated_at = datetime('now')
       WHERE (id = ? OR order_number = ?) AND seller_id = ?`
    ).bind(tracking_number, courier || null, orderId, orderId, sellerId).run();

    if (!result.meta.changes) {
      const exists = await db.prepare(
        `SELECT 1 FROM orders WHERE id = ? OR order_number = ? LIMIT 1`
      ).bind(orderId, orderId).first();
      return exists
        ? c.json({ success: false, error: 'Forbidden' }, 403)
        : c.json({ success: false, error: 'Order not found' }, 404);
    }

    // ── 유저에게 인앱 알림 발송 (배송 시작) ──
    try {
      const orderForNotif = await db.prepare(
        `SELECT user_id, order_number FROM orders WHERE (id = ? OR order_number = ?) AND seller_id = ? LIMIT 1`
      ).bind(orderId, orderId, sellerId).first<{ user_id: string; order_number: string }>();
      if (orderForNotif?.user_id) {
        const { notifyUser } = await import('../../../lib/notifications');
        await notifyUser(db, orderForNotif.user_id, 'order_status', '\u{1F4E6} 주문하신 상품이 발송되었습니다!', `주문번호: ${orderForNotif.order_number}`, '/my-orders');
      }
    } catch {} // fire and forget

    // ── 배송 시작 알림톡 (fire-and-forget) ──
    if (c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID) {
      const order = await db.prepare(
        `SELECT order_number, shipping_phone, shipping_name, seller_id,
                (SELECT name FROM order_items oi JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = o.id LIMIT 1) AS product_name
         FROM orders o WHERE (id = ? OR order_number = ?) AND seller_id = ? LIMIT 1`
      ).bind(orderId, orderId, sellerId).first<{
        order_number: string; shipping_phone: string | null;
        shipping_name: string | null; seller_id: number; product_name: string | null;
      }>().catch(() => null);

      if (order?.shipping_phone && order.seller_id) {
        const { subject, message } = buildShippingMessage({
          orderId: order.order_number,
          buyerName: order.shipping_name ?? '고객',
          buyerPhone: order.shipping_phone,
          productName: order.product_name ?? '상품',
          courier: courier || '택배사',
          trackingNumber: tracking_number,
        });
        sendSellerAlimtalk({
          DB: db,
          aligoApiKey: c.env.ALIGO_API_KEY,
          aligoUserId: c.env.ALIGO_USER_ID,
          aligoSenderKey: c.env.ALIGO_SENDER_KEY ?? '',
          senderPhone: c.env.ALIGO_SENDER_PHONE,
          sellerId: order.seller_id,
          receiver: order.shipping_phone,
          receiverName: order.shipping_name ?? '고객',
          templateCode: c.env.ALIGO_TPL_SHIPPING_START ?? 'TBD',
          subject,
          message,
          orderId: order.order_number,
        }).catch(e => console.warn('[Alimtalk] 배송시작 발송 실패:', e));
      }
    }

    return c.json({ success: true, message: '송장번호가 등록되었습니다.' });
  } catch (error: unknown) {
    console.error('Update tracking error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to update tracking' }, 500);
  }
});

// ─── GET /api/seller/products ──────────────────────────────────────────────
sellerOrdersRoutes.get('/products', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = c.req.query('sort') === 'asc' ? 'ASC' : 'DESC';
    const search = c.req.query('search') || '';

    // COALESCE로 신/구 컬럼 모두 대응 (image_url, thumbnail_url, image 순으로 fallback)
    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        COALESCE(p.stock_quantity, p.stock, 0)                    AS stock,
        COALESCE(p.thumbnail_url, p.image_url)                    AS image_url,
        COALESCE(p.status, 'ACTIVE')                              AS status,
        p.category,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT oi.id)                                      AS order_count,
        COALESCE(SUM(
          CASE WHEN o.status NOT IN ('CANCELLED', 'FAILED', 'REFUNDED')
               THEN oi.quantity ELSE 0 END
        ), 0)                                                      AS total_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
        AND COALESCE(p.is_active, 1) = 1
        AND COALESCE(p.is_supply_product, 0) = 0
    `;
    const params: unknown[] = [sellerId];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at ${sort} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const products = await db.prepare(query).bind(...params).all();

    let countQuery = `SELECT COUNT(*) as total FROM products WHERE seller_id = ? AND COALESCE(is_active, 1) = 1`;
    const countParams: unknown[] = [sellerId];
    if (search) {
      countQuery += ` AND (name LIKE ? OR description LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      data: products.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total || 0) > (offset + limit),
      },
    });
  } catch (error: unknown) {
    console.error('Get seller products error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to get products' }, 500);
  }
});

// ─── GET /api/seller/products/:id ─────────────────────────────────────────
// 🛡️ 2026-05-17: SellerProductEditPage 가 호출하던 endpoint — 부재로 404.
sellerOrdersRoutes.get('/products/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const db = c.env.DB;

    const product = await db.prepare(
      `SELECT
         p.id, p.name, p.description, p.price, p.original_price,
         COALESCE(p.stock_quantity, p.stock, 0)                AS stock,
         COALESCE(p.thumbnail_url, p.image_url, p.image)       AS image_url,
         p.detail_images,
         p.category, p.product_type,
         p.live_stream_id, p.live_only_price, p.live_price_enabled,
         COALESCE(p.status, 'ACTIVE')                          AS status,
         COALESCE(p.is_active, 1)                              AS is_active,
         p.restaurant_name, p.restaurant_address, p.restaurant_phone,
         p.voucher_terms, p.voucher_expiry,
         p.group_buy_target, p.group_buy_deadline,
         p.store_verify_pin,
         p.created_at, p.updated_at
       FROM products p
       WHERE p.id = ? AND p.seller_id = ?`
    ).bind(productId, sellerId).first<Record<string, unknown>>();

    if (!product) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    // options 함께 반환 (있으면)
    let options: unknown[] = [];
    try {
      const optRes = await db.prepare(
        `SELECT id, name, price, stock, sort_order
           FROM product_options
          WHERE product_id = ?
          ORDER BY sort_order ASC, id ASC`
      ).bind(productId).all();
      options = optRes.results || [];
    } catch {
      // product_options 테이블 미존재 시 무시
    }

    return c.json({ success: true, data: { ...product, options } });
  } catch (error: unknown) {
    console.error('Get seller product detail error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to get product' }, 500);
  }
});

// ─── PATCH /api/seller/orders/bulk-status ─────────────────────────────────
// 주문 일괄 상태변경: { order_ids: number[], status: string }
sellerOrdersRoutes.patch('/orders/bulk-status', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{ order_ids: number[]; status: string }>();
    const { order_ids, status } = body;

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return c.json({ success: false, error: '주문 ID 목록이 필요합니다.' }, 400);
    }
    if (order_ids.length > 100) {
      return c.json({ success: false, error: '한 번에 최대 100건까지 처리 가능합니다.' }, 400);
    }

    const rawStatus = (status || '').toUpperCase();
    const dbStatus = STATUS_MAP[rawStatus] ?? rawStatus;
    if (!VALID_STATUSES.includes(dbStatus)) {
      return c.json({ success: false, error: `유효하지 않은 상태입니다. 가능: ${VALID_STATUSES.join(', ')}` }, 400);
    }

    const db = c.env.DB;
    const placeholders = order_ids.map(() => '?').join(',');

    // 셀러 소유 확인 + 일괄 업데이트 (atomic)
    const result = await db.prepare(
      `UPDATE orders
         SET status = ?, updated_at = datetime('now')
       WHERE id IN (${placeholders}) AND seller_id = ?`
    ).bind(dbStatus, ...order_ids, sellerId).run();

    // ── 유저에게 인앱 알림 일괄 발송 ──
    if (result.meta.changes) {
      try {
        const statusMessages: Record<string, string> = {
          'SHIPPING': '\u{1F4E6} 주문하신 상품이 발송되었습니다!',
          'DELIVERED': '\u2705 배송이 완료되었습니다. 상품을 확인해주세요!',
          'CANCELLED': '\u274C 주문이 취소되었습니다.',
        };
        const msg = statusMessages[dbStatus];
        if (msg) {
          const { notifyUser } = await import('../../../lib/notifications');
          const { results: affectedOrders } = await db.prepare(
            `SELECT user_id, order_number FROM orders WHERE id IN (${placeholders}) AND seller_id = ?`
          ).bind(...order_ids, sellerId).all<{ user_id: string; order_number: string }>();
          for (const o of affectedOrders || []) {
            if (o.user_id) {
              notifyUser(db, o.user_id, 'order_status', msg, `주문번호: ${o.order_number}`, '/my-orders').catch(swallow('seller:api:seller-orders'));
            }
          }
        }
      } catch {} // fire and forget
    }

    return c.json({
      success: true,
      updated: result.meta.changes || 0,
      message: `${result.meta.changes || 0}건의 주문 상태가 변경되었습니다.`,
    });
  } catch (error: unknown) {
    console.error('Bulk status update error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to bulk update' }, 500);
  }
});

// ─── POST /api/seller/products ─────────────────────────────────────────────
sellerOrdersRoutes.post('/products', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{
      name: string;
      description?: string;
      price: number;
      stock?: number;
      image_url?: string;
      category?: string;
      live_stream_id?: number | null;
      // 식사권 (meal_voucher) 전용 필드 — category=meal_voucher 일 때만 사용
      restaurant_name?: string;
      restaurant_address?: string;
      restaurant_phone?: string;
      voucher_terms?: string;
      voucher_expiry?: string;
      group_buy_target?: number;
      group_buy_deadline?: string;
      store_verify_pin?: string;
      // 🛡️ 2026-05-15: 티어 할인 — JSON 문자열로 받음
      group_buy_tiers?: string | null;
      // 🛡️ 2026-05-05: 디지털 상품 필드
      product_kind?: string;
      delivery_type?: string;
      content_url?: string | null;
      content_format?: string | null;
      access_duration_days?: number | null;
      preview_url?: string | null;
    }>();

    const { name, description, price, stock, image_url, category } = body;
    if (!name || price === undefined) {
      return c.json({ success: false, error: '상품명과 가격은 필수입니다.' }, 400);
    }

    // 🛡️ 2026-04-29 보안 audit CRITICAL: 입력 검증 — 음수/NaN/Infinity/거대값 차단.
    // 이전: Number.isFinite() / 범위 체크 0 → financial fraud 위험.
    if (typeof name !== 'string' || name.length === 0 || name.length > 200) {
      return c.json({ success: false, error: '상품명은 1~200자여야 합니다.' }, 400);
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 10000)) {
      return c.json({ success: false, error: '상품 설명은 10000자 이내여야 합니다.' }, 400);
    }
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) {
      return c.json({ success: false, error: '가격은 0 ~ 1억 범위여야 합니다.' }, 400);
    }
    if (stock !== undefined && stock !== null && (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000)) {
      return c.json({ success: false, error: '재고는 0 ~ 100만 범위여야 합니다.' }, 400);
    }

    const db = c.env.DB;

    // 🛡️ 2026-04-30 TD-005: canonical 'stock' 만 INSERT (legacy stock_quantity 분기 제거).
    //   migration 0233 적용 후 stock_quantity 컬럼 drop 되어도 동작 유지.
    //   기존엔 신규(slug+stock_quantity) → 프로덕션(stock) → 최소 3-tier fallback 이었지만
    //   실제 production 은 0001 base 라 첫 시도는 항상 실패해 wasteful.
    let result: D1Result;
    try {
      result = await db.prepare(`
        INSERT INTO products
          (seller_id, name, description, price, stock, image_url, category, product_type, status, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'live', 'ACTIVE', 1, datetime('now'), datetime('now'))
      `).bind(
        sellerId, name, description || null, price,
        stock ?? 0, image_url || null, category || null
      ).run();
    } catch {
      // 최소 스키마 fallback: status 컬럼 없는 매우 옛 버전
      result = await db.prepare(`
        INSERT INTO products
          (seller_id, name, description, price, stock, image_url, category, product_type, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'live', 1, datetime('now'), datetime('now'))
      `).bind(
        sellerId, name, description || null, price,
        stock ?? 0, image_url || null, category || null
      ).run();
    }

    if (!result.success) throw new Error('Failed to create product');

    // 식사권/공동구매 필드 저장 (별도 UPDATE — INSERT fallback 구조 유지)
    const productId = result.meta.last_row_id;

    // 🛡️ 2026-05-05: 디지털 상품 필드 저장 (UPDATE — migration 0243 후 컬럼 존재)
    if (body.product_kind && body.product_kind !== 'physical') {
      const digitalFields: Array<['product_kind' | 'delivery_type' | 'content_url' | 'content_format' | 'access_duration_days' | 'preview_url', unknown]> = [
        ['product_kind', body.product_kind],
        ['delivery_type', body.delivery_type || 'instant_url'],
        ['content_url', body.content_url || null],
        ['content_format', body.content_format || null],
        ['access_duration_days', body.access_duration_days ?? null],
        ['preview_url', body.preview_url || null],
      ];
      for (const [field, val] of digitalFields) {
        try { await db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).bind(val, productId).run() } catch { /* column may not exist */ }
      }
    }

    if (category === 'meal_voucher' || category === 'beauty_voucher' || category === 'health_voucher' || category === 'pet_voucher' || category === 'stay_voucher' || category === 'activity_voucher') {
      const mealFields = ['restaurant_name', 'restaurant_address', 'restaurant_phone', 'voucher_terms', 'voucher_expiry', 'group_buy_target', 'group_buy_deadline', 'store_verify_pin', 'group_buy_tiers'] as const;
      for (const field of mealFields) {
        const val = body[field];
        if (val !== undefined && val !== null && val !== '') {
          try { await db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).bind(val, productId).run() } catch { /* column may not exist */ }
        }
      }

      // 🛡️ 2026-04-27: Magic Link — 사장님 전용 영구 token 자동 생성 + 알림톡 발송.
      try {
        const { generateStoreOwnerToken, sendStoreOwnerAlimtalk } = await import('../../group-buy/api/group-buy.routes');
        const token = generateStoreOwnerToken();
        try { await db.prepare(`UPDATE products SET store_owner_token = ? WHERE id = ?`).bind(token, productId).run(); } catch { /* ignore */ }
        const phone = body.restaurant_phone;
        const restaurantName = body.restaurant_name;
        if (phone && restaurantName) {
          const statsUrl = `https://live.ur-team.com/store/stats/${productId}?t=${token}`;
          // fire-and-forget — 알림톡 실패해도 등록은 진행
          c.executionCtx.waitUntil(
            sendStoreOwnerAlimtalk(c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string }, phone, {
              restaurantName, productName: name, statsUrl,
            })
          );
        }
      } catch { /* graceful */ }
    }

    const newProduct = await db.prepare(
      `SELECT id, seller_id, name, description, price,
              COALESCE(stock_quantity, stock, 0) AS stock,
              COALESCE(thumbnail_url, image_url) AS image_url,
              category, created_at, updated_at
       FROM products WHERE id = ?`
    ).bind(result.meta.last_row_id).first<Record<string, unknown>>();

    // 팔로워에게 새 상품 알림 (인앱 + 카카오)
    if (newProduct) {
      const { notifyFollowers, sendKakaoToFollowers } = await import('../../../lib/notifications');
      const productName = (newProduct as any).name;
      const productId = (newProduct as any).id;
      notifyFollowers(db, Number(sellerId), 'new_product', `🛍️ 새 상품 등록!`, productName, `/products/${productId}`).catch(swallow('seller:api:seller-orders'));
      sendKakaoToFollowers(db, Number(sellerId), `🛍️ 새 상품이 등록되었어요!`, productName, `/products/${productId}`, '상품 보기').catch(swallow('seller:api:seller-orders'));
    }

    // 🛡️ 2026-05-16: voucher 카테고리 상품 등록 시 공구 목록 캐시 무효화
    if (category && VOUCHER_CATEGORY_SET.has(category)) {
      const kv = (c.env as Bindings).SESSION_KV;
      invalidateGroupBuyProductsCache(kv).catch(swallow('seller:cache-invalidate'));
    }

    return c.json({ success: true, data: newProduct }, 201);
  } catch (error: unknown) {
    console.error('Create seller product error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to create product' }, 500);
  }
});

// ─── PUT /api/seller/products/:id ──────────────────────────────────────────
sellerOrdersRoutes.put('/products/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      description?: string;
      price?: number;
      original_price?: number;
      stock?: number;
      image_url?: string;
      category?: string;
      live_only_price?: number | null;
      live_price_enabled?: boolean;
      status?: string;
      is_active?: boolean | number;
    }>();

    const db = c.env.DB;

    // 소유권 확인
    const existing = await db.prepare(
      `SELECT id FROM products WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).first();
    if (!existing) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    // 🛡️ 2026-04-29 보안 audit CRITICAL: 입력 검증 — 음수/NaN/Infinity/거대값/잘못된 status 차단.
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 200)) {
      return c.json({ success: false, error: '상품명은 1~200자여야 합니다.' }, 400);
    }
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 10000)) {
      return c.json({ success: false, error: '상품 설명은 10000자 이내여야 합니다.' }, 400);
    }
    if (body.price !== undefined && (!Number.isFinite(body.price) || body.price < 0 || body.price > 100_000_000)) {
      return c.json({ success: false, error: '가격은 0 ~ 1억 범위여야 합니다.' }, 400);
    }
    if (body.original_price !== undefined && body.original_price !== null && (!Number.isFinite(body.original_price) || body.original_price < 0 || body.original_price > 100_000_000)) {
      return c.json({ success: false, error: '정가는 0 ~ 1억 범위여야 합니다.' }, 400);
    }
    if (body.stock !== undefined && (!Number.isFinite(body.stock) || body.stock < 0 || body.stock > 1_000_000)) {
      return c.json({ success: false, error: '재고는 0 ~ 100만 범위여야 합니다.' }, 400);
    }
    if (body.live_only_price !== undefined && body.live_only_price !== null && (!Number.isFinite(body.live_only_price) || body.live_only_price < 0 || body.live_only_price > 100_000_000)) {
      return c.json({ success: false, error: '라이브 전용 가격은 0 ~ 1억 범위여야 합니다.' }, 400);
    }
    const ALLOWED_STATUS = new Set(['ACTIVE', 'SOLD_OUT', 'HIDDEN', 'DELETED']);
    if (body.status !== undefined && !ALLOWED_STATUS.has(body.status)) {
      return c.json({ success: false, error: '유효하지 않은 상태값입니다.' }, 400);
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    if (body.price !== undefined) { fields.push('price = ?'); values.push(body.price); }
    if (body.original_price !== undefined) { fields.push('original_price = ?'); values.push(body.original_price); }
    if (body.stock !== undefined) {
      // 🛡️ 2026-04-26 (W1/TD-005): stock_quantity 이중 쓰기 제거 — canonical 'stock' 만 사용.
      // 기존 row 의 stock_quantity 는 SELECT fallback (COALESCE) 로 보호됨.
      // 참조: docs/SCHEMA_DEDUP_PLAN.md
      fields.push('stock = ?');
      values.push(body.stock);
    }
    if (body.image_url !== undefined) {
      fields.push('image_url = ?', 'thumbnail_url = ?');
      values.push(body.image_url, body.image_url);
    }
    if (body.category !== undefined) { fields.push('category = ?'); values.push(body.category); }
    if (body.live_only_price !== undefined) { fields.push('live_only_price = ?'); values.push(body.live_only_price); }
    if (body.live_price_enabled !== undefined) { fields.push('live_price_enabled = ?'); values.push(body.live_price_enabled ? 1 : 0); }
    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) return c.json({ success: false, error: '수정할 내용이 없습니다.' }, 400);

    fields.push(`updated_at = datetime('now')`);
    values.push(productId, sellerId);

    await db.prepare(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND seller_id = ?`
    ).bind(...values).run();

    const updated = await db.prepare(
      `SELECT id, name, description, price, original_price,
              COALESCE(stock_quantity, stock, 0) AS stock,
              COALESCE(thumbnail_url, image_url, image) AS image_url,
              category, live_only_price, live_price_enabled,
              COALESCE(status, 'ACTIVE') AS status, updated_at
       FROM products WHERE id = ?`
    ).bind(productId).first<Record<string, unknown>>();

    // 🛡️ 2026-05-16: voucher 카테고리 상품 수정 시 공구 목록 캐시 무효화
    if (updated?.category && VOUCHER_CATEGORY_SET.has(String(updated.category))) {
      const kv = (c.env as Bindings).SESSION_KV;
      invalidateGroupBuyProductsCache(kv).catch(swallow('seller:cache-invalidate'));
    }

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('Update seller product error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to update product' }, 500);
  }
});

// ─── DELETE /api/seller/products/:id ───────────────────────────────────────
sellerOrdersRoutes.delete('/products/:id', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const db = c.env.DB;

    // 🛡️ 2026-05-15: 진행 중인 공구 상품은 삭제 차단 (참여자 보호)
    //   active 상태 + 참여자 1명 이상이면 거부. 강제 종료/환불 거치도록 안내.
    try {
      const gb = await db.prepare(
        `SELECT category, group_buy_status, group_buy_current FROM products WHERE id = ? AND seller_id = ?`
      ).bind(productId, sellerId).first<{ category: string; group_buy_status: string; group_buy_current: number }>();
      if (gb) {
        if (VOUCHER_CATEGORY_SET.has(gb.category) && gb.group_buy_status === 'active' && (gb.group_buy_current ?? 0) > 0) {
          return c.json({
            success: false,
            error: '진행 중인 공구는 삭제할 수 없습니다. 참여자 환불 후 삭제하세요.',
            code: 'GROUP_BUY_ACTIVE_WITH_PARTICIPANTS'
          }, 409);
        }
      }
    } catch { /* gating best-effort, fall through to soft delete */ }

    // soft delete (status = DELETED)
    const result = await db.prepare(
      `UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).run();

    if (!result.meta.changes) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    // 🛡️ 2026-05-16: 상품 삭제 시 공구 목록 캐시 무효화 (카테고리 모름 → 전체 nuke)
    const kv = (c.env as Bindings).SESSION_KV;
    invalidateGroupBuyProductsCache(kv).catch(swallow('seller:cache-invalidate'));

    return c.json({ success: true, message: '상품이 삭제되었습니다.' });
  } catch (error: unknown) {
    console.error('Delete seller product error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to delete product' }, 500);
  }
});

// ─── POST /api/seller/products/:id/link-to-stream ──────────────────────────
// body: { stream_id: number | null }  — null이면 연결 해제
sellerOrdersRoutes.post('/products/:id/link-to-stream', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const productId = c.req.param('id');
    const body = await c.req.json<{ stream_id: number | null }>();
    const streamId = body.stream_id ?? null;

    const db = c.env.DB;

    // 상품 소유권 확인
    const product = await db.prepare(
      `SELECT id FROM products WHERE id = ? AND seller_id = ?`
    ).bind(productId, sellerId).first();
    if (!product) return c.json({ success: false, error: 'Product not found or forbidden' }, 404);

    // 스트림 소유권 확인 (stream_id가 있는 경우)
    if (streamId !== null) {
      const stream = await db.prepare(
        `SELECT id FROM live_streams WHERE id = ? AND seller_id = ?`
      ).bind(streamId, sellerId).first();
      if (!stream) return c.json({ success: false, error: 'Stream not found or forbidden' }, 404);
    }

    await db.prepare(
      `UPDATE products SET live_stream_id = ?, updated_at = datetime('now') WHERE id = ? AND seller_id = ?`
    ).bind(streamId, productId, sellerId).run();

    return c.json({
      success: true,
      message: streamId ? `스트림 ${streamId}에 상품이 연결되었습니다.` : '스트림 연결이 해제되었습니다.',
    });
  } catch (error: unknown) {
    console.error('Link product to stream error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to link product' }, 500);
  }
});

// ─── PUT /api/seller/products/:id/pin — 바우처 인증 PIN 설정 ──────────────
sellerOrdersRoutes.put('/products/:id/pin', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401);

    const db = c.env.DB;
    const productId = c.req.param('id');
    const { pin } = await c.req.json<{ pin: string }>();

    if (!pin || pin.length < 4) return c.json({ success: false, error: 'PIN은 4자리 이상이어야 합니다' }, 400);

    // 소유권 확인
    const product = await db.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?').bind(productId, sellerId).first();
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);

    // store_verify_pin 컬럼 존재 보장
    try { await db.prepare("ALTER TABLE products ADD COLUMN store_verify_pin TEXT").run() } catch {}

    await db.prepare("UPDATE products SET store_verify_pin = ?, updated_at = datetime('now') WHERE id = ?").bind(pin, productId).run();

    return c.json({ success: true, message: `PIN이 설정되었습니다: ${pin}` });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// ─── POST /api/seller/products/:id/resend-store-link ──────────────────────
// 🛡️ 2026-04-27: Magic Link 재발송 — 사장님이 알림톡 분실/실수로 못 받았을 때.
// rotate=true 시 token 자체를 새로 발급 (이전 link 무효화).
sellerOrdersRoutes.post('/products/:id/resend-store-link', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401);

    const db = c.env.DB;
    const productId = c.req.param('id');
    const body = await c.req.json<{ rotate?: boolean }>().catch(() => ({} as { rotate?: boolean }));
    const rotate = body.rotate === true;

    // 소유권 확인 + 식사권 + 메타 조회
    const product = await db.prepare(
      "SELECT id, name, seller_id, restaurant_name, restaurant_phone, store_owner_token FROM products WHERE id = ? AND seller_id = ? AND category = 'meal_voucher'"
    ).bind(productId, sellerId).first<any>();
    if (!product) return c.json({ success: false, error: '식사권 상품을 찾을 수 없습니다' }, 404);
    if (!product.restaurant_phone) return c.json({ success: false, error: '식당 연락처가 등록되지 않았습니다' }, 400);

    const { generateStoreOwnerToken, sendStoreOwnerAlimtalk } = await import('../../group-buy/api/group-buy.routes');
    let token: string = product.store_owner_token;
    if (!token || rotate) {
      token = generateStoreOwnerToken();
      try { await db.prepare(`UPDATE products SET store_owner_token = ? WHERE id = ?`).bind(token, productId).run(); } catch { /* column may not exist */ }
    }

    const statsUrl = `https://live.ur-team.com/store/stats/${productId}?t=${token}`;
    await sendStoreOwnerAlimtalk(c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string }, product.restaurant_phone, {
      restaurantName: product.restaurant_name || '사장님',
      productName: product.name,
      statsUrl,
    });

    return c.json({ success: true, message: '사장님께 알림톡이 발송되었습니다', stats_url: statsUrl, rotated: rotate });
  } catch (error: unknown) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});
