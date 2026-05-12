/**
 * Admin Orders Routes — 주문 관리
 *
 * 🛡️ 2026-04-22 배치 149 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /orders                     — 주문 목록
 * - GET    /orders/export              — CSV 내보내기
 * - GET    /orders/:orderNumber        — 주문 상세
 * - PATCH  /orders/:orderNumber/status — 상태 변경 (state machine + CAS)
 * - PUT    /orders/:orderNumber/tracking — 운송장 등록
 * - PATCH  /orders/bulk-status         — 일괄 상태 변경
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { logAudit } from '../../../lib/audit-log';

export const adminOrdersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface OrderRow {
  id: number;
  order_number: string;
  user_id: string;
  seller_id: number | null;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_address_detail: string | null;
  shipping_zipcode: string | null;
  courier: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  seller_name: string | null;
  items?: OrderItemRow[];
}

interface OrderItemRow {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

adminOrdersRoutes.get('/orders', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status');
    const sellerId = c.req.query('seller_id');
    if (sellerId && !/^\d+$/.test(sellerId)) return c.json({ success: false, error: 'Invalid seller_id' }, 400);
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const buildWhere = (base: string) => {
      const params: (string | number | null)[] = [];
      let q = base;
      if (status) { q += ' AND COALESCE(o.status,\'pending\') = ?'; params.push(status); }
      if (sellerId) { q += ' AND o.seller_id = ?'; params.push(sellerId); }
      if (startDate) { q += " AND DATE(o.created_at, '+9 hours') >= ?"; params.push(startDate); }
      if (endDate) { q += " AND DATE(o.created_at, '+9 hours') <= ?"; params.push(endDate); }
      q += ' ORDER BY o.created_at DESC LIMIT 1000';
      return { q, params };
    };

    let orders: OrderRow[];
    try {
      const { q, params } = buildWhere(`
        SELECT o.id, o.order_number, o.user_id, o.seller_id,
               o.total_amount as total_amount,
               COALESCE(o.status,'pending') as status,
               COALESCE(o.payment_status,'pending') as payment_status,
               COALESCE(o.payment_method,'') as payment_method,
               COALESCE(o.shipping_name,'') as shipping_name,
               COALESCE(o.shipping_phone,'') as shipping_phone,
               COALESCE(o.shipping_address,'') as shipping_address,
               COALESCE(o.shipping_address_detail,'') as shipping_address_detail,
               COALESCE(o.shipping_zipcode, o.shipping_postal_code, '') as shipping_zipcode,
               COALESCE(o.courier, o.tracking_company, '') as courier,
               COALESCE(o.tracking_number,'') as tracking_number,
               o.created_at, o.updated_at,
               COALESCE(u.name, '') as user_name,
               COALESCE(u.email, '') as user_email,
               COALESCE(s.business_name, s.name, '') as seller_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN sellers s ON o.seller_id = s.id
        WHERE 1=1`);
      orders = await executeQuery<OrderRow>(DB, q, params);
    } catch (primaryErr) {
      if (import.meta.env.DEV) console.warn('[Admin] orders primary query failed, trying fallback:', (primaryErr as Error).message);
      try {
        const { q, params } = buildWhere(`
          SELECT o.id, o.order_number, o.user_id, o.seller_id,
                 COALESCE(o.total_amount, 0) as total_amount,
                 COALESCE(o.status,'pending') as status,
                 'pending' as payment_status, '' as payment_method,
                 '' as shipping_name, '' as shipping_phone,
                 '' as shipping_address, '' as shipping_address_detail,
                 '' as shipping_zipcode, '' as courier, '' as tracking_number,
                 o.created_at, o.updated_at,
                 '' as user_name, '' as user_email, '' as seller_name
          FROM orders o
          WHERE 1=1`);
        orders = await executeQuery<OrderRow>(DB, q, params);
      } catch (fallbackErr) {
        if (import.meta.env.DEV) console.error('[Admin] orders fallback also failed:', (fallbackErr as Error).message);
        return c.json({ success: true, data: [] });
      }
    }

    return c.json({ success: true, data: orders });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] orders error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// /orders/export 는 /orders/:orderNumber 보다 위에 있어야 라우팅 충돌 없음
adminOrdersRoutes.get('/orders/export', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status');
    const sellerId = c.req.query('seller_id');
    if (sellerId && !/^\d+$/.test(sellerId)) return c.json({ success: false, error: 'Invalid seller_id' }, 400);
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    let q = `
      SELECT o.id, o.order_number, o.user_id, o.seller_id,
             COALESCE(o.total_amount, 0) as total_amount,
             COALESCE(o.status,'pending') as status,
             COALESCE(o.shipping_name,'') as shipping_name,
             COALESCE(o.shipping_phone,'') as shipping_phone,
             COALESCE(o.shipping_address,'') as shipping_address,
             COALESCE(o.tracking_number,'') as tracking_number,
             o.created_at
      FROM orders o WHERE 1=1`;
    const params: (string | number)[] = [];
    if (status) { q += ' AND o.status = ?'; params.push(status); }
    if (sellerId) { q += ' AND o.seller_id = ?'; params.push(sellerId); }
    if (startDate) { q += " AND DATE(o.created_at, '+9 hours') >= ?"; params.push(startDate); }
    if (endDate) { q += " AND DATE(o.created_at, '+9 hours') <= ?"; params.push(endDate); }
    q += ' ORDER BY o.created_at DESC LIMIT 5000';

    const orders = await executeQuery<OrderRow>(DB, q, params);

    const BOM = '﻿';
    const header = '주문번호,주문일시,주문상태,고객명,연락처,주소,운송장번호,결제금액';
    const rows = orders.map(o =>
      [o.order_number, o.created_at, o.status, o.shipping_name, o.shipping_phone, `"${o.shipping_address}"`, o.tracking_number, o.total_amount].join(',')
    );
    const csv = BOM + header + '\n' + rows.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] orders export error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminOrdersRoutes.get('/orders/:orderNumber', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const orderNumber = c.req.param('orderNumber');

    let orders;
    try {
      orders = await executeQuery<OrderRow>(DB, `
        SELECT o.id, o.order_number, o.user_id, o.seller_id,
               COALESCE(o.total_amount, 0) as total_amount,
               COALESCE(o.status, 'pending') as status,
               COALESCE(o.payment_status, 'pending') as payment_status,
               COALESCE(o.payment_method, '') as payment_method,
               COALESCE(o.shipping_name, '') as shipping_name,
               COALESCE(o.shipping_phone, '') as shipping_phone,
               COALESCE(o.shipping_address, '') as shipping_address,
               COALESCE(o.shipping_address_detail, '') as shipping_address_detail,
               COALESCE(o.shipping_zipcode, o.shipping_postal_code, '') as shipping_zipcode,
               COALESCE(o.courier, o.tracking_company, '') as courier,
               COALESCE(o.tracking_number, '') as tracking_number,
               o.created_at, o.updated_at,
               COALESCE(u.name, '') as user_name,
               COALESCE(u.email, '') as user_email,
               COALESCE(s.business_name, s.name, '') as seller_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN sellers s ON o.seller_id = s.id
        WHERE o.order_number = ?`, [orderNumber]);
    } catch {
      orders = await executeQuery<OrderRow>(DB, `
        SELECT o.id, o.order_number, o.user_id, o.seller_id,
               COALESCE(o.total_amount, 0) as total_amount,
               COALESCE(o.status, 'pending') as status,
               'pending' as payment_status, '' as payment_method,
               '' as shipping_name, '' as shipping_phone,
               '' as shipping_address, '' as shipping_address_detail,
               '' as shipping_zipcode, '' as courier, '' as tracking_number,
               o.created_at, o.updated_at,
               '' as user_name, '' as user_email, '' as seller_name
        FROM orders o WHERE o.order_number = ?`, [orderNumber]);
    }

    if (orders.length === 0) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);

    const order = orders[0];
    try {
      order.items = await executeQuery<OrderItemRow>(DB, `
        SELECT oi.id, oi.product_id, oi.product_name, oi.quantity,
               COALESCE(oi.unit_price, oi.price, 0) as price,
               '' as image_url
        FROM order_items oi
        WHERE oi.order_id = ?`, [order.id]);
    } catch { order.items = []; }

    return c.json({ success: true, data: order });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] order detail error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 주문 상태 변경 ─────────────────────────────────────────────

adminOrdersRoutes.patch('/orders/:orderNumber/status', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const orderNumber = c.req.param('orderNumber');
    const { status, cancel_reason } = await c.req.json<{ status: string; cancel_reason?: string }>();

    const validStatuses = ['PENDING', 'PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      return c.json({ success: false, error: `유효하지 않은 상태: ${status}` }, 400);
    }

    const orders = await executeQuery<{ id: number; status: string }>(
      DB, 'SELECT id, status FROM orders WHERE order_number = ?', [orderNumber]
    );
    if (orders.length === 0) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);

    const updates: string[] = ['status = ?', 'updated_at = datetime(\'now\')'];
    const params: (string | null)[] = [status];

    if (status === 'CANCELLED' && cancel_reason) {
      const safeCancelReason = typeof cancel_reason === 'string' ? cancel_reason.slice(0, 500) : null;
      updates.push('cancel_reason = ?', 'cancelled_at = datetime(\'now\')');
      params.push(safeCancelReason);
    }
    if (status === 'DELIVERED') {
      updates.push('delivered_at = datetime(\'now\')');
    }

    const { statusesThatCanReach } = await import('../../../worker/utils/state-machine');
    const allowedPrev = statusesThatCanReach(status);
    if (allowedPrev.length === 0) {
      return c.json({ success: false, error: `상태 전환 불가: ${status}` }, 400);
    }
    const prevPh = allowedPrev.map(() => '?').join(',');
    params.push(orderNumber);
    const adminStatusRes = await DB.prepare(
      `UPDATE orders SET ${updates.join(', ')}
       WHERE order_number = ? AND UPPER(status) IN (${prevPh})`
    ).bind(...params, ...allowedPrev).run();

    if ((adminStatusRes.meta?.changes ?? 0) === 0) {
      return c.json({
        success: false,
        error: `현재 상태(${orders[0].status})에서 ${status}로 전환할 수 없습니다`,
        code: 'INVALID_STATUS_TRANSITION',
      }, 409);
    }

    if (status === 'DELIVERED') {
      createDashboardNotification(DB, 'admin', null, 'order_delivered', '배송 완료', `주문: ${orderNumber}`, '/admin/orders').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });
      const orderForNotif = await executeQuery<{ seller_id: number | null }>(DB, 'SELECT seller_id FROM orders WHERE order_number = ?', [orderNumber]);
      if (orderForNotif.length > 0 && orderForNotif[0].seller_id) {
        createDashboardNotification(DB, 'seller', String(orderForNotif[0].seller_id), 'order_delivered', '배송 완료', `주문: ${orderNumber}`, '/seller/orders').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });
      }
    }

    if (status === 'CANCELLED') {
      const items = await executeQuery<{ product_id: number; quantity: number }>(
        DB,
        "SELECT product_id, quantity FROM order_items WHERE order_id = ? AND (status IS NULL OR status != 'CANCELLED')",
        [String(orders[0].id)],
      );
      for (const item of items) {
        await executeQuery(DB, 'UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
      if (items.length > 0) {
        await executeQuery(DB, "UPDATE order_items SET status = 'CANCELLED' WHERE order_id = ?", [String(orders[0].id)]);
      }
    }

    const actor = (c as unknown as { get: (k: string) => { id?: string | number; email?: string } }).get('user');
    void logAudit(c.env.DB, {
      actor_id: String(actor?.id ?? 'unknown'),
      actor_email: actor?.email,
      action: status === 'CANCELLED' ? 'order_cancel' : status === 'REFUNDED' ? 'order_refund' : 'order_status',
      resource_type: 'order',
      resource_id: orderNumber,
      old_value: JSON.stringify({ status: orders[0].status }),
      new_value: JSON.stringify({ status, cancel_reason: cancel_reason ?? undefined }),
      ip: c.req.header('CF-Connecting-IP') ?? undefined,
    });
    return c.json({ success: true, data: { orderNumber, status } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminOrdersRoutes.put('/orders/:orderNumber/tracking', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const orderNumber = c.req.param('orderNumber');
    const { tracking_number, shipping_company } = await c.req.json<{
      tracking_number: string;
      shipping_company: string;
    }>();

    if (!tracking_number || !shipping_company) {
      return c.json({ success: false, error: '운송장 번호와 택배사를 입력해주세요' }, 400);
    }

    const orders = await executeQuery<{ id: number }>(
      DB, 'SELECT id FROM orders WHERE order_number = ?', [orderNumber]
    );
    if (orders.length === 0) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);

    await executeQuery(DB,
      `UPDATE orders SET tracking_number = ?, shipping_company = ?, status = 'SHIPPING',
       shipped_at = datetime('now'), updated_at = datetime('now')
       WHERE order_number = ?`,
      [tracking_number, shipping_company, orderNumber]
    );

    return c.json({ success: true, data: { orderNumber, tracking_number, shipping_company, status: 'SHIPPING' } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminOrdersRoutes.patch('/orders/bulk-status', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const { order_numbers, status } = await c.req.json<{ order_numbers: string[]; status: string }>();

    if (!order_numbers?.length || order_numbers.length > 100) {
      return c.json({ success: false, error: '1~100개 주문을 선택해주세요' }, 400);
    }

    const validStatuses = ['PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return c.json({ success: false, error: `일괄 변경 가능 상태: ${validStatuses.join(', ')}` }, 400);
    }

    const placeholders = order_numbers.map(() => '?').join(',');
    const { statusesThatCanReach } = await import('../../../worker/utils/state-machine');
    const allowedPrev = statusesThatCanReach(status);
    if (allowedPrev.length === 0) {
      return c.json({ success: false, error: `잘못된 상태 값: ${status}` }, 400);
    }
    const prevPh = allowedPrev.map(() => '?').join(',');
    const updateRes = await DB.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now')
       WHERE order_number IN (${placeholders})
         AND UPPER(status) IN (${prevPh})`
    ).bind(status, ...order_numbers, ...allowedPrev).run();
    const updated = Number(updateRes.meta?.changes ?? 0);

    return c.json({
      success: true,
      data: { updated, skipped: order_numbers.length - updated, status },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminOrdersRoutes;
