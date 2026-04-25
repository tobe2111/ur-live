/**
 * Seller Orders Management API Routes
 *
 * Endpoints:
 * - GET    /api/seller/orders              - 셀러 주문 목록 조회
 * - PUT    /api/seller/orders/:id/status   - 주문 상태 업데이트
 * - PATCH  /api/seller/orders/:id/status   - 주문 상태 업데이트 (alias)
 * - PUT    /api/seller/orders/:id/tracking - 송장번호 등록
 * - PATCH  /api/seller/orders/bulk-status  - 주문 일괄 상태변경
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { sendSellerAlimtalk } from '../../alimtalk/send';
import { buildShippingMessage, buildCancellationMessage } from '../../alimtalk/aligo';
import type { Env } from '@/worker/types/env';
import { logInfo, logWarn, logError } from '@/worker/utils/logger';

export const sellerOrdersManagementRoutes = new Hono<{ Bindings: Env }>();

// ─── Auth helpers ──────────────────────────────────────────────────────────

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
  const seller = await DB.prepare(
    "SELECT id FROM sellers WHERE id = ? AND status = 'approved' AND is_active = 1"
  ).bind(id).first();
  return seller ? id : null;
}

/** DB status 값과 프론트엔드 status 값 매핑 */
const STATUS_MAP: Record<string, string> = {
  PAY_COMPLETE: 'DONE',   // 프론트 → DB
  PAID: 'DONE',
};
const VALID_STATUSES = ['PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'DONE', 'PAID', 'PENDING'];

// ─── GET /orders ───────────────────────────────────────────────────────────

sellerOrdersManagementRoutes.get('/orders', async (c) => {
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
    logError('seller.orders.getError', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to get orders' }, 500);
  }
});

// ─── PUT/PATCH /orders/:id/status ──────────────────────────────────────────

async function handleStatusUpdate(c: Context<{ Bindings: Env }>) {
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
            'DELIVERED': '✅ 배송이 완료되었습니다. 상품을 확인해주세요!',
            'CANCELLED': '❌ 주문이 취소되었습니다.',
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
        }).catch(e => logWarn('seller.orders.alimtalkCancelFailed', { error: (e as Error)?.message }));
      }
    }

    return c.json({ success: true, message: '주문 상태가 업데이트되었습니다.' });
  } catch (error: unknown) {
    logError('seller.orders.statusUpdateError', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to update status' }, 500);
  }
}

sellerOrdersManagementRoutes.put('/orders/:id/status', handleStatusUpdate);
sellerOrdersManagementRoutes.patch('/orders/:id/status', handleStatusUpdate);

// ─── PUT /orders/:id/tracking ──────────────────────────────────────────────

sellerOrdersManagementRoutes.put('/orders/:id/tracking', async (c) => {
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
        }).catch(e => logWarn('seller.orders.alimtalkShippingFailed', { error: (e as Error)?.message }));
      }
    }

    return c.json({ success: true, message: '송장번호가 등록되었습니다.' });
  } catch (error: unknown) {
    logError('seller.orders.trackingUpdateError', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to update tracking' }, 500);
  }
});

// ─── PATCH /orders/bulk-status ─────────────────────────────────────────────
// 주문 일괄 상태변경: { order_ids: number[], status: string }

sellerOrdersManagementRoutes.patch('/orders/bulk-status', async (c) => {
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
          'DELIVERED': '✅ 배송이 완료되었습니다. 상품을 확인해주세요!',
          'CANCELLED': '❌ 주문이 취소되었습니다.',
        };
        const msg = statusMessages[dbStatus];
        if (msg) {
          const { notifyUser } = await import('../../../lib/notifications');
          const { results: affectedOrders } = await db.prepare(
            `SELECT user_id, order_number FROM orders WHERE id IN (${placeholders}) AND seller_id = ?`
          ).bind(...order_ids, sellerId).all<{ user_id: string; order_number: string }>();
          for (const o of affectedOrders || []) {
            if (o.user_id) {
              notifyUser(db, o.user_id, 'order_status', msg, `주문번호: ${o.order_number}`, '/my-orders').catch(() => {});
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
    logError('seller.orders.bulkStatusError', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to bulk update' }, 500);
  }
});
