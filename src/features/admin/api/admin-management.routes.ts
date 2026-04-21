/**
 * Admin Management API Routes
 *
 * Comprehensive endpoints for admin dashboard:
 * - GET  /sellers            - 모든 판매자 조회
 * - GET  /sellers/pending    - 승인 대기 중인 판매자 조회
 * - PATCH /sellers/:id/approve    - 판매자 승인
 * - PATCH /sellers/:id/reject     - 판매자 거부
 * - PATCH /sellers/:id/commission - 판매자 수수료율 변경
 * - PATCH /sellers/:id/permissions- 판매자 권한 변경
 * - GET  /orders             - 모든 주문 조회
 * - GET  /products           - 모든 상품 조회
 * - GET  /stats              - 대시보드 통계
 * - GET  /dashboard/stats    - 실시간 대시보드 통계
 * - GET  /settlement/stats   - 정산 통계
 * - GET  /settlement/records - 정산 기록
 * - DELETE /streams/:id      - 라이브 스트림 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { requireAdmin } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { sendAlimtalk, buildSampleApprovalMessage } from '../../alimtalk/aligo';
import { DEFAULT_COMMISSION_RATE } from '@/shared/constants';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

interface SellerRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  business_name: string | null;
  business_number: string | null;
  status: string;
  created_at: string;
  commission_rate?: number;
  can_manipulate_stats?: number;
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
  image_url: string | null;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  is_active: number;
  product_type: string | null;
  category: string | null;
  seller_id: number | null;
  created_at: string;
  seller_name: string | null;
}

interface CountRow {
  count: number;
}

interface SalesRow {
  total: number;
}

interface SettlementOverviewRow {
  total_orders: number;
  total_sales: number;
  total_commission: number;
  total_seller_amount: number;
}

interface SettlementSellerRow {
  seller_id: number;
  seller_name: string | null;
  business_name: string | null;
  commission_rate: number;
  order_count: number;
  total_sales: number;
  commission_amount: number;
  seller_amount: number;
}

interface SettlementRecordRow {
  id: number;
  order_number: string;
  seller_id: number | null;
  seller_name: string | null;
  business_name: string | null;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  seller_amount: number;
  settlement_status: string;
  settled_at: string | null;
  created_at: string;
  user_name: string | null;
}

interface IdRow {
  id: number;
  status?: string;
  commission_rate?: number;
}

export const adminManagementRoutes = new Hono<{ Bindings: Env }>();

// 모든 admin 관리 엔드포인트는 admin 권한 필수
adminManagementRoutes.use('*', requireAdmin());

// ─── 판매자 관리 ──────────────────────────────────────────────────────────────

adminManagementRoutes.get('/sellers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    let sellers;
    try {
      sellers = await executeQuery<SellerRow>(DB, `
        SELECT id, email, name, phone, business_name, business_number,
               status, created_at,
               COALESCE(commission_rate, 10) AS commission_rate,
               COALESCE(can_manipulate_stats, 0) AS can_manipulate_stats
        FROM sellers ORDER BY created_at DESC
      `);
    } catch {
      // fallback: commission_rate/can_manipulate_stats 컬럼 없을 수 있음
      sellers = await executeQuery<SellerRow>(DB, `
        SELECT id, email, name, phone, business_name, business_number,
               status, created_at
        FROM sellers ORDER BY created_at DESC
      `);
    }
    return c.json({ success: true, data: sellers });
  } catch (err) {
    console.error('[Admin] sellers error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/sellers/pending', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellers = await executeQuery<SellerRow>(DB, `
      SELECT s.id, s.email, s.name, s.phone, s.business_name, s.business_number,
             s.status, s.created_at,
             COALESCE(s.commission_rate, 10) AS commission_rate,
             s.linked_user_id, u.name AS linked_user_name
      FROM sellers s LEFT JOIN users u ON s.linked_user_id = u.id
      WHERE s.status = 'pending' ORDER BY s.created_at ASC
    `);
    return c.json({ success: true, data: sellers });
  } catch (err) {
    console.error('[Admin] pending sellers error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/sellers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');

    // base seller info (always safe columns)
    const seller = await DB.prepare(`
      SELECT s.id, s.email, s.name, s.phone, s.business_name, s.business_number,
             s.status, s.created_at,
             COALESCE(s.commission_rate, 10) AS commission_rate,
             COALESCE(s.can_manipulate_stats, 0) AS can_manipulate_stats
      FROM sellers s WHERE s.id = ?
    `).bind(sellerId).first().catch(() => null);

    if (!seller) {
      // fallback: query without potentially-missing columns
      const row2 = await DB.prepare(
        `SELECT id, email, name, phone, business_name, business_number, status, created_at FROM sellers WHERE id = ?`
      ).bind(sellerId).first();
      if (!row2) return c.json({ success: false, error: 'Not found' }, 404);
      return c.json({ success: true, data: { ...row2, commission_rate: 10, can_manipulate_stats: 0 } });
    }

    // business info (LEFT JOIN — safe even if table missing)
    let biz = null;
    try {
      biz = await DB.prepare(`
        SELECT business_number AS biz_number, business_name AS biz_name, ceo_name,
               business_type, business_category, postal_code,
               address, address_detail, phone AS biz_phone, email AS biz_email,
               is_verified AS biz_is_verified, verified_at AS biz_verified_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      // address_detail 컬럼 없을 수 있음 — fallback
      biz = await DB.prepare(`
        SELECT business_number AS biz_number, business_name AS biz_name, ceo_name,
               business_type, business_category, postal_code,
               address, '' AS address_detail, phone AS biz_phone, email AS biz_email,
               is_verified AS biz_is_verified, verified_at AS biz_verified_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first().catch(() => null);
    }

    return c.json({ success: true, data: { ...seller, ...(biz || {}) } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/sellers/:id/business-info/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const existing = await DB.prepare(
      `SELECT id, is_verified FROM seller_business_info WHERE seller_id = ?`
    ).bind(sellerId).first<{ id: number; is_verified: number }>();
    if (!existing) return c.json({ success: false, error: '사업자 정보가 없습니다' }, 404);
    if (existing.is_verified) return c.json({ success: false, error: '이미 승인된 사업자 정보입니다' }, 400);
    await DB.prepare(`
      UPDATE seller_business_info
      SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
      WHERE seller_id = ?
    `).bind(sellerId).run();
    await writeAuditLog(c, { action: 'approve_business_info', targetType: 'seller', targetId: sellerId, after: { is_verified: true } });
    return c.json({ success: true, message: '사업자 정보를 승인했습니다' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/sellers/:id/business-info/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { reason } = await c.req.json<{ reason?: string }>();
    const existing = await DB.prepare(
      `SELECT id FROM seller_business_info WHERE seller_id = ?`
    ).bind(sellerId).first();
    if (!existing) return c.json({ success: false, error: '사업자 정보가 없습니다' }, 404);
    await DB.prepare(`
      UPDATE seller_business_info
      SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
      WHERE seller_id = ?
    `).bind(sellerId).run();
    await writeAuditLog(c, { action: 'reject_business_info', targetType: 'seller', targetId: sellerId, after: { is_verified: false, reason } });
    return c.json({ success: true, message: '사업자 정보를 반려했습니다' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/sellers/:id/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    if (rows[0].status === 'approved') return c.json({ success: false, error: '이미 승인된 판매자입니다' }, 400);
    await executeQuery(DB, `UPDATE sellers SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    await writeAuditLog(c, { action: 'approve_seller', targetType: 'seller', targetId: sellerId, before: { status: rows[0].status }, after: { status: 'approved' } });
    // 8. 셀러 승인 → 셀러 알림
    createDashboardNotification(DB, 'seller', String(sellerId), 'seller_approved', '셀러 승인 완료', '판매를 시작할 수 있습니다', '/seller').catch(() => {});
    return c.json({ success: true, data: { id: sellerId, status: 'approved' } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/sellers/:id/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { reason } = await c.req.json();
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB, `UPDATE sellers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    await writeAuditLog(c, { action: 'reject_seller', targetType: 'seller', targetId: sellerId, after: { status: 'rejected', reason } });
    return c.json({ success: true, data: { id: sellerId, status: 'rejected', reason } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── DELETE /sellers/:id — 판매자 정지 (soft delete) ──────────────────────────
adminManagementRoutes.delete('/sellers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    if (rows[0].status === 'suspended') return c.json({ success: false, error: '이미 정지된 판매자입니다' }, 400);
    // Soft-delete: mark as suspended and deactivate
    try {
      await executeRun(DB, `UPDATE sellers SET is_active = 0, status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    } catch {
      // is_active column might not exist
      await executeRun(DB, `UPDATE sellers SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    }
    await writeAuditLog(c, { action: 'suspend_seller', targetType: 'seller', targetId: sellerId, before: { status: rows[0].status }, after: { status: 'suspended', is_active: 0 } });
    return c.json({ success: true, message: '판매자가 정지되었습니다', data: { id: sellerId, status: 'suspended' } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/sellers/:id/commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { commission_rate } = await c.req.json();
    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 100)
      return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, commission_rate FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB, `UPDATE sellers SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [commission_rate, sellerId]);
    await writeAuditLog(c, { action: 'change_commission', targetType: 'seller', targetId: sellerId, before: { commission_rate: rows[0].commission_rate }, after: { commission_rate } });
    return c.json({ success: true, data: { id: sellerId, commission_rate } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 후원 수수료율 변경 ────────────────────────────────────────────────────────
adminManagementRoutes.patch('/sellers/:id/donation-commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { donation_commission_rate } = await c.req.json();
    if (donation_commission_rate === undefined || donation_commission_rate < 0 || donation_commission_rate > 100) {
      return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
    }
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB,
      `UPDATE sellers SET donation_commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [donation_commission_rate, sellerId]
    );
    return c.json({ success: true, data: { id: sellerId, donation_commission_rate } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/sellers/:id/permissions', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const { can_manipulate_stats } = await c.req.json();
    if (![0, 1, true, false].includes(can_manipulate_stats))
      return c.json({ success: false, error: 'can_manipulate_stats는 0 또는 1이어야 합니다' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    const val = can_manipulate_stats ? 1 : 0;
    await executeQuery(DB, `UPDATE sellers SET can_manipulate_stats = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [val, sellerId]);
    return c.json({ success: true, data: { id: sellerId, can_manipulate_stats: val } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 주문 관리 ───────────────────────────────────────────────────────────────

adminManagementRoutes.get('/orders', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status');
    const sellerId = c.req.query('seller_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const buildWhere = (base: string) => {
      const params: (string | number | null)[] = [];
      let q = base;
      if (status) { q += ' AND COALESCE(o.status,\'pending\') = ?'; params.push(status); }
      if (sellerId) { q += ' AND o.seller_id = ?'; params.push(sellerId); }
      if (startDate) { q += ' AND DATE(o.created_at) >= ?'; params.push(startDate); }
      if (endDate) { q += ' AND DATE(o.created_at) <= ?'; params.push(endDate); }
      q += ' ORDER BY o.created_at DESC LIMIT 1000';
      return { q, params };
    };

    // Try with all columns first; fall back to minimal columns if any are missing
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
      console.warn('[Admin] orders primary query failed, trying fallback:', (primaryErr as Error).message);
      try {
        // Fallback: only core orders columns, no JOINs that might fail
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
        console.error('[Admin] orders fallback also failed:', (fallbackErr as Error).message);
        return c.json({ success: true, data: [] });
      }
    }

    // 목록에서는 items 생략 (N+1 쿼리 방지 → 성능 개선)
    // 상세 조회(/orders/:orderNumber)에서만 items 포함
    return c.json({ success: true, data: orders });
  } catch (err) {
    console.error('[Admin] orders error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 주문 엑셀 내보내기 ──────────────────────────────────────────────────────
// ⚠ /orders/export 는 /orders/:orderNumber 보다 위에 있어야 라우팅 충돌 없음
adminManagementRoutes.get('/orders/export', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status');
    const sellerId = c.req.query('seller_id');
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
    if (startDate) { q += ' AND DATE(o.created_at) >= ?'; params.push(startDate); }
    if (endDate) { q += ' AND DATE(o.created_at) <= ?'; params.push(endDate); }
    q += ' ORDER BY o.created_at DESC LIMIT 5000';

    const orders = await executeQuery<OrderRow>(DB, q, params);

    // CSV 생성 (엑셀 호환 UTF-8 BOM)
    const BOM = '\uFEFF';
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
    console.error('[Admin] orders export error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 주문 상세 조회 ──────────────────────────────────────────────────────────

adminManagementRoutes.get('/orders/:orderNumber', cors(), async (c) => {
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
      // Fallback: no JOINs
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
    console.error('[Admin] order detail error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 상품 관리 ───────────────────────────────────────────────────────────────

adminManagementRoutes.get('/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const products = await executeQuery<ProductRow>(DB, `
      SELECT p.id, p.name, p.description, p.price, p.stock,
             p.image_url, p.is_active, p.product_type, p.category,
             COALESCE(p.supply_price, 0) AS supply_price,
             COALESCE(p.is_supply_product, 0) AS is_supply_product,
             p.seller_id, p.created_at, s.business_name as seller_name
      FROM products p LEFT JOIN sellers s ON p.seller_id = s.id
      ORDER BY p.created_at DESC LIMIT 1000
    `);
    return c.json({ success: true, data: products });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── DELETE /api/admin/products/:id ─────────────────────────────────────────
// 소프트 삭제: 주문 내역 보존을 위해 is_active=0으로 비활성화
adminManagementRoutes.delete('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    // 주문이 있는 상품은 소프트 삭제 (주문 내역 보존)
    const hasOrders = await executeQuery<IdRow>(DB, 'SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [productId]);
    if (hasOrders.length > 0) {
      await executeRun(DB, "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [productId]);
      return c.json({ success: true, data: { id: productId, soft_deleted: true } });
    }

    // 주문 없는 상품만 하드 삭제
    await executeRun(DB, 'DELETE FROM products WHERE id = ?', [productId]);

    return c.json({ success: true, data: { id: productId } });
  } catch (err) {
    console.error('[Admin] delete product error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── POST /api/admin/products ───────────────────────────────────────────────
adminManagementRoutes.post('/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json();
    const { name, description, long_description, price, compare_at_price, supply_price, stock, image_url, detail_images, category, product_type, is_supply_product } = body;

    if (!name || !price) {
      return c.json({ success: false, error: '상품명과 가격은 필수입니다' }, 400);
    }

    // 풀 스키마 시도 (long_description, compare_at_price, detail_images, supply_price, is_supply_product)
    let result: any;
    try {
      result = await executeRun(DB, `
        INSERT INTO products (
          name, description, long_description, price, compare_at_price, supply_price,
          stock, image_url, detail_images, category, product_type,
          is_supply_product, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `, [
        name, description || '', long_description || null, price,
        compare_at_price || null, supply_price || 0,
        stock || 0, image_url || '',
        detail_images || null,
        category || 'lifestyle', product_type || 'featured',
        is_supply_product ? 1 : 0,
      ]);
    } catch {
      // 구버전 스키마 폴백 (extra 컬럼 없음)
      result = await executeRun(DB, `
        INSERT INTO products (
          name, description, price, stock, image_url,
          category, product_type, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `, [
        name, description || '', price,
        stock || 0, image_url || '',
        category || 'lifestyle', product_type || 'featured',
      ]);
    }

    return c.json({ success: true, data: { id: result.meta.last_row_id, name, price } });
  } catch (err) {
    console.error('[Admin] create product error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── PUT /api/admin/products/:id ────────────────────────────────────────────
adminManagementRoutes.put('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const { name, description, long_description, price, compare_at_price, supply_price, stock, image_url, detail_images, category, product_type, is_supply_product } = body;

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    // 풀 스키마 시도
    try {
      await executeRun(DB, `
        UPDATE products
        SET name = ?, description = ?, long_description = ?, price = ?,
            compare_at_price = ?, supply_price = ?,
            stock = ?, image_url = ?, detail_images = ?,
            category = ?, product_type = ?,
            is_supply_product = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [
        name, description || '', long_description || null, price,
        compare_at_price || null, supply_price || 0,
        stock || 0, image_url || '',
        detail_images || null,
        category || 'lifestyle', product_type || 'featured',
        is_supply_product ? 1 : 0,
        productId,
      ]);
    } catch {
      // 구버전 스키마 폴백
      await executeRun(DB, `
        UPDATE products
        SET name = ?, description = ?, price = ?,
            stock = ?, image_url = ?,
            category = ?, product_type = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [
        name, description || '', price,
        stock || 0, image_url || '',
        category || 'lifestyle', product_type || 'featured',
        productId,
      ]);
    }

    return c.json({ success: true, data: { id: productId, name } });
  } catch (err) {
    console.error('[Admin] update product error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── PATCH /api/admin/products/:id ──────────────────────────────────────────
adminManagementRoutes.patch('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    const body = await c.req.json();
    const { is_active, sold_count } = body;

    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (sold_count !== undefined) { updates.push('sold_count = ?'); params.push(Number(sold_count)); }

    params.push(productId);
    await executeRun(DB, `UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    return c.json({ success: true, data: { id: productId, ...(is_active !== undefined ? { is_active: is_active ? 1 : 0 } : {}), ...(sold_count !== undefined ? { sold_count: Number(sold_count) } : {}) } });
  } catch (err) {
    console.error('[Admin] patch product error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 공급 상품: supply_price / is_supply_product 필드 포함 수정 ───────────────
// POST /api/admin/products 및 PUT /api/admin/products/:id에 supply_price 추가는
// 기존 핸들러를 body에서 읽도록 수정 (아래 통계 위에 삽입)

// ─── 샘플 신청 관리 (Sample Requests) ────────────────────────────────────────

// GET /api/admin/sample-requests  - 전체 샘플 신청 목록
adminManagementRoutes.get('/sample-requests', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status') || '';
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params: (string | number)[] = [];
    if (status) { where += ' AND sr.status = ?'; params.push(status); }

    // supply_price 컬럼이 없는 구버전 스키마를 위해 COALESCE 사용
    // sample_requests 테이블이 없으면(마이그레이션 미실행) 빈 배열 반환
    let rows: { results: any[] } = { results: [] };
    let total: { count: number } | null = { count: 0 };
    try {
      rows = await DB.prepare(`
        SELECT
          sr.id,
          sr.seller_id,
          sr.product_id,
          sr.status,
          sr.seller_memo,
          sr.admin_memo,
          sr.created_at,
          sr.approved_at,
          s.name        AS seller_name,
          COALESCE(s.business_name, s.name) AS business_name,
          COALESCE(s.email, '') AS seller_email,
          p.name        AS product_name,
          p.price       AS retail_price,
          COALESCE(p.supply_price, 0) AS supply_price,
          p.image_url   AS product_image
        FROM sample_requests sr
        JOIN sellers  s ON sr.seller_id  = s.id
        JOIN products p ON sr.product_id = p.id
        WHERE ${where}
        ORDER BY sr.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();

      total = await DB.prepare(
        `SELECT COUNT(*) as count FROM sample_requests sr WHERE ${where}`
      ).bind(...params).first<{ count: number }>();
    } catch (tableErr) {
      // 테이블 또는 컬럼 미존재 (마이그레이션 0120 미실행) → 빈 목록 반환
      console.warn('[Admin] sample_requests table not ready:', (tableErr as Error).message);
    }

    return c.json({
      success: true,
      data: {
        items: rows.results ?? [],
        total: total?.count ?? 0,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error('[Admin] GET /sample-requests error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// PATCH /api/admin/sample-requests/:id  - 승인/거부
adminManagementRoutes.patch('/sample-requests/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const reqId = c.req.param('id');
    const body = await c.req.json<{ action: 'approve' | 'reject'; admin_memo?: string }>();

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 approve 또는 reject이어야 합니다' }, 400);
    }

    const existing = await DB.prepare(
      'SELECT id, status FROM sample_requests WHERE id = ?'
    ).bind(reqId).first<{ id: number; status: string }>();

    if (!existing) return c.json({ success: false, error: '신청을 찾을 수 없습니다' }, 404);
    if (existing.status !== 'PENDING') {
      return c.json({ success: false, error: `이미 처리된 신청입니다 (${existing.status})` }, 409);
    }

    const newStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED';
    const approvedAt = body.action === 'approve' ? `datetime('now')` : 'NULL';

    // 알림톡 발송용: 셀러 전화번호 + 상품명 조회
    const reqInfo = await DB.prepare(`
      SELECT sr.seller_id, s.phone AS seller_phone, s.name AS seller_name, p.name AS product_name
      FROM sample_requests sr
      JOIN sellers s ON sr.seller_id = s.id
      JOIN products p ON sr.product_id = p.id
      WHERE sr.id = ?
    `).bind(reqId).first<{ seller_id: number; seller_phone: string | null; seller_name: string; product_name: string }>()
      .catch(() => null);

    await DB.prepare(`
      UPDATE sample_requests
      SET status = ?, admin_memo = ?, updated_at = datetime('now'),
          approved_at = ${approvedAt}
      WHERE id = ?
    `).bind(newStatus, body.admin_memo || null, reqId).run();

    // ── 셀러에게 알림톡 (플랫폼 발신, fire-and-forget) ──
    if (reqInfo?.seller_phone && c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID && c.env.ALIGO_SENDER_PHONE) {
      const { subject, message } = buildSampleApprovalMessage({
        sellerName: reqInfo.seller_name,
        productName: reqInfo.product_name,
        approved: body.action === 'approve',
        adminMemo: body.admin_memo,
      });
      sendAlimtalk({
        apikey: c.env.ALIGO_API_KEY,
        userid: c.env.ALIGO_USER_ID,
        senderkey: c.env.ALIGO_SENDER_KEY ?? '',
        tpl_code: c.env.ALIGO_TPL_SAMPLE_APPROVED ?? 'TBD',
        sender: c.env.ALIGO_SENDER_PHONE,
        receiver_1: reqInfo.seller_phone.replace(/-/g, ''),
        recvname_1: reqInfo.seller_name,
        subject_1: subject,
        message_1: message,
      }).catch(e => console.warn('[Alimtalk] 샘플 승인 알림 실패:', e));
    }

    // 4. 공급 상품 승인/거부 → 셀러 알림
    if (reqInfo?.seller_id) {
      const notifType = body.action === 'approve' ? 'supply_approved' : 'supply_rejected';
      const notifTitle = body.action === 'approve' ? '공급 상품 승인' : '공급 상품 거부';
      createDashboardNotification(DB, 'seller', String(reqInfo.seller_id), notifType, notifTitle, `상품: ${reqInfo.product_name}`, '/seller/supply').catch(() => {});
    }

    return c.json({
      success: true,
      data: { id: reqId, status: newStatus },
      message: body.action === 'approve' ? '샘플 신청이 승인되었습니다.' : '샘플 신청이 거부되었습니다.',
    });
  } catch (err) {
    console.error('[Admin] PATCH /sample-requests/:id error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 통계 ────────────────────────────────────────────────────────────────────

// GET /api/admin/supply/sales - 공급 상품 셀러별 판매 현황 + 정산 데이터
adminManagementRoutes.get('/supply/sales', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const supplyProductId = c.req.query('product_id') || '';  // 특정 공급 상품 필터
    const sellerId = c.req.query('seller_id') || '';

    // supply_source_id 컬럼 존재 여부 확인
    const hasCol = await DB.prepare(
      "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='supply_source_id'"
    ).first<{ c: number }>().catch(() => null);

    if (!hasCol || hasCol.c === 0) {
      return c.json({ success: true, data: { rows: [], summary: { total_orders: 0, total_qty: 0, total_revenue: 0, total_supply_cost: 0 } } });
    }

    let where = "sp.supply_source_id IS NOT NULL AND o.status IN ('DONE','PAID','DELIVERED')";
    const params: (string | number)[] = [];
    if (supplyProductId) { where += ' AND sp.supply_source_id = ?'; params.push(supplyProductId); }
    if (sellerId) { where += ' AND sp.seller_id = ?'; params.push(sellerId); }

    const rows = await DB.prepare(`
      SELECT
        src.id            AS supply_product_id,
        src.name          AS supply_product_name,
        COALESCE(src.supply_price, 0) AS supply_price,
        sp.id             AS seller_product_id,
        sp.name           AS seller_product_name,
        sp.price          AS seller_price,
        sp.seller_id,
        s.name            AS seller_name,
        COALESCE(s.business_name, s.name) AS business_name,
        COUNT(DISTINCT o.id)      AS order_count,
        COALESCE(SUM(oi.quantity), 0) AS total_qty,
        COALESCE(SUM(oi.quantity * oi.price), 0)               AS total_revenue,
        COALESCE(SUM(oi.quantity * src.supply_price), 0)       AS total_supply_cost,
        COALESCE(SUM(oi.quantity * (oi.price - COALESCE(src.supply_price,0))), 0) AS seller_margin
      FROM products sp
      JOIN products src ON sp.supply_source_id = src.id
      JOIN sellers  s   ON sp.seller_id = s.id
      JOIN order_items oi ON oi.product_id = sp.id
      JOIN orders o      ON oi.order_id = o.id
      WHERE ${where}
      GROUP BY sp.supply_source_id, sp.seller_id
      ORDER BY total_supply_cost DESC
    `).bind(...params).all<{
      supply_product_id: number;
      supply_product_name: string;
      supply_price: number;
      seller_product_id: number;
      seller_product_name: string;
      seller_price: number;
      seller_id: number;
      seller_name: string;
      business_name: string;
      order_count: number;
      total_qty: number;
      total_revenue: number;
      total_supply_cost: number;
      seller_margin: number;
    }>();

    const items = rows.results ?? [];
    const summary = {
      total_orders: items.reduce((s, r) => s + r.order_count, 0),
      total_qty:    items.reduce((s, r) => s + r.total_qty, 0),
      total_revenue: items.reduce((s, r) => s + r.total_revenue, 0),
      total_supply_cost: items.reduce((s, r) => s + r.total_supply_cost, 0),
    };

    return c.json({ success: true, data: { rows: items, summary } });
  } catch (err) {
    console.error('[Admin] GET /supply/sales error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const safe = async <T>(q: string): Promise<T[]> => {
      try { return await executeQuery<T>(DB, q); } catch { return []; }
    };
    const [ts, as_, tst, ast] = await Promise.all([
      safe<CountRow>('SELECT COUNT(*) as count FROM sellers'),
      safe<CountRow>("SELECT COUNT(*) as count FROM sellers WHERE status = 'approved'"),
      safe<CountRow>('SELECT COUNT(*) as count FROM live_streams'),
      safe<CountRow>("SELECT COUNT(*) as count FROM live_streams WHERE status = 'live'"),
    ]);
    return c.json({ success: true, data: {
      totalSellers: ts[0]?.count || 0,
      activeSellers: as_[0]?.count || 0,
      totalStreams: tst[0]?.count || 0,
      activeStreams: ast[0]?.count || 0,
    }});
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/dashboard/stats', cors(), async (c) => {
  const { DB } = c.env;
  const today = new Date().toISOString().split('T')[0];

  const safe = async <T>(q: string, p: unknown[] = []): Promise<T[]> => {
    try { return await executeQuery<T>(DB, q, p); } catch { return []; }
  };

  const [sales, orders, live] = await Promise.all([
    safe<SalesRow>(`SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at)=? AND status IN ('DONE','PAID','DELIVERED')`, [today]),
    safe<CountRow>('SELECT COUNT(*) as count FROM orders WHERE DATE(created_at)=?', [today]),
    safe<CountRow>("SELECT COUNT(*) as count FROM live_streams WHERE status='live'"),
  ]);

  return c.json({ success: true, data: {
    todaySales: (sales[0] as SalesRow)?.total || 0,
    todayOrders: (orders[0] as CountRow)?.count || 0,
    currentVisitors: 0,
    liveStreams: (live[0] as CountRow)?.count || 0,
  }});
});

// ─── 정산 관리 ───────────────────────────────────────────────────────────────

adminManagementRoutes.get('/settlement/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    let df = '';
    if (period === 'today') df = `AND DATE(o.created_at) = '${new Date().toISOString().split('T')[0]}'`;
    else if (period === 'week') df = "AND DATE(o.created_at) >= DATE('now','-7 days')";
    else if (period === 'month') df = "AND DATE(o.created_at) >= DATE('now','-30 days')";

    const safeFull = async <T>(q: string): Promise<T[] | null> => {
      try { return await executeQuery<T>(DB, q); } catch { return null; }
    };
    const safeFallback = async <T>(q: string): Promise<T[]> => {
      try { return await executeQuery<T>(DB, q); } catch { return []; }
    };

    // Try full query (with commission_rate and payment_status); fall back if columns missing
    let overview: SettlementOverviewRow[];
    const fullOverview = await safeFull<SettlementOverviewRow>(`
      SELECT COUNT(*) as total_orders,
             COALESCE(SUM(o.total_amount),0) as total_sales,
             COALESCE(SUM(o.total_amount*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100),0) as total_commission,
             COALESCE(SUM(o.total_amount*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)),0) as total_seller_amount
      FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
      WHERE o.status IN ('DONE','PAID','DELIVERED') ${df}`);
    if (fullOverview !== null) {
      overview = fullOverview;
    } else {
      overview = await safeFallback<SettlementOverviewRow>(`
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*${DEFAULT_COMMISSION_RATE}/100),0) as total_commission,
               COALESCE(SUM(o.total_amount*(1-${DEFAULT_COMMISSION_RATE}/100)),0) as total_seller_amount
        FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
        WHERE 1=1 ${df}`);
    }

    let sellers: SettlementSellerRow[];
    const fullSellers = await safeFull<SettlementSellerRow>(`
      SELECT s.id as seller_id, s.name as seller_name, s.business_name,
             COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
             COUNT(o.id) as order_count,
             COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)),0) as total_sales,
             COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100),0) as commission_amount,
             COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)),0) as seller_amount,
             COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='pending' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) ELSE 0 END),0) as pending_amount,
             COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='completed' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) ELSE 0 END),0) as settled_amount
      FROM sellers s LEFT JOIN orders o ON s.id=o.seller_id AND o.status IN ('DONE','PAID','DELIVERED') ${df}
      GROUP BY s.id ORDER BY total_sales DESC`);
    if (fullSellers !== null) {
      sellers = fullSellers;
    } else {
      sellers = await safeFallback<SettlementSellerRow>(`
        SELECT s.id as seller_id, s.name as seller_name, s.business_name,
               ${DEFAULT_COMMISSION_RATE} as commission_rate,
               COUNT(o.id) as order_count,
               COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)),0) as total_sales,
               COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*${DEFAULT_COMMISSION_RATE}/100),0) as commission_amount,
               COALESCE(SUM(COALESCE(o.total_amount, o.total_price, 0)*(1-${DEFAULT_COMMISSION_RATE}/100)),0) as seller_amount,
               COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='pending' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-${DEFAULT_COMMISSION_RATE}/100) ELSE 0 END),0) as pending_amount,
               COALESCE(SUM(CASE WHEN COALESCE(o.settlement_status,'pending')='completed' THEN COALESCE(o.total_amount, o.total_price, 0)*(1-${DEFAULT_COMMISSION_RATE}/100) ELSE 0 END),0) as settled_amount
        FROM sellers s LEFT JOIN orders o ON s.id=o.seller_id
        WHERE 1=1 ${df}
        GROUP BY s.id ORDER BY total_sales DESC`);
    }

    const defaultOverview = { total_orders: 0, total_sales: 0, total_commission: 0, total_seller_amount: 0 };
    return c.json({ success: true, data: { overview: overview[0] || defaultOverview, sellers } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/settlement/records', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    const sellerId = c.req.query('seller_id');
    const status = c.req.query('status');

    const safe = async <T>(q: string, p: (string|number|null)[] = []): Promise<T[]> => {
      try { return await executeQuery<T>(DB, q, p); } catch { return []; }
    };

    const buildQuery = (withNewCols: boolean) => {
      let q = withNewCols
        ? `SELECT o.id, o.order_number, o.seller_id, COALESCE(s.name,'') as seller_name, COALESCE(s.business_name,'') as business_name,
                  o.total_amount as total_amount,
                  COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
                  o.total_amount*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100 as commission_amount,
                  o.total_amount*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) as seller_amount,
                  COALESCE(o.settlement_status,'pending') as settlement_status,
                  o.settled_at, o.created_at, COALESCE(u.name,'') as user_name
           FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id LEFT JOIN users u ON o.user_id=u.id
           WHERE o.status IN ('DONE','PAID','DELIVERED')`
        : `SELECT o.id, o.order_number, o.seller_id, COALESCE(s.name,'') as seller_name, COALESCE(s.business_name,'') as business_name,
                  o.total_amount as total_amount,
                  ${DEFAULT_COMMISSION_RATE} as commission_rate,
                  o.total_amount*${DEFAULT_COMMISSION_RATE}/100 as commission_amount,
                  o.total_amount*(1-${DEFAULT_COMMISSION_RATE}/100) as seller_amount,
                  'pending' as settlement_status,
                  NULL as settled_at, o.created_at, COALESCE(u.name,'') as user_name
           FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id LEFT JOIN users u ON o.user_id=u.id
           WHERE 1=1`;
      const params: (string|number|null)[] = [];
      if (period === 'today') { q += ' AND DATE(o.created_at)=?'; params.push(new Date().toISOString().split('T')[0]); }
      else if (period === 'week') q += " AND DATE(o.created_at)>=DATE('now','-7 days')";
      else if (period === 'month') q += " AND DATE(o.created_at)>=DATE('now','-30 days')";
      if (sellerId) { q += ' AND o.seller_id=?'; params.push(sellerId); }
      if (withNewCols && status && status !== 'all') { q += " AND COALESCE(o.settlement_status,'pending')=?"; params.push(status); }
      q += ' ORDER BY o.created_at DESC LIMIT 1000';
      return { q, params };
    };

    let records: SettlementRecordRow[];
    try {
      const { q, params } = buildQuery(true);
      records = await executeQuery<SettlementRecordRow>(DB, q, params);
    } catch {
      const { q, params } = buildQuery(false);
      records = await safe<SettlementRecordRow>(q, params);
    }
    return c.json({ success: true, data: records });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 정산 상태 변경 ───────────────────────────────────────────────────────────

adminManagementRoutes.patch('/settlement/:id/status', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const orderId = c.req.param('id');
    const { status } = await c.req.json<{ status: string }>();
    if (!['pending', 'completed'].includes(status))
      return c.json({ success: false, error: '유효하지 않은 상태입니다' }, 400);
    const settled_at = status === 'completed' ? new Date().toISOString() : null;
    await executeRun(DB,
      `UPDATE orders SET settlement_status = ?, settled_at = ? WHERE id = ?`,
      [status, settled_at, orderId]);
    return c.json({ success: true, data: { id: orderId, settlement_status: status } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 정산 일괄 완료 ───────────────────────────────────────────────────────────

adminManagementRoutes.post('/settlement/batch-complete', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const { order_ids } = await c.req.json<{ order_ids: number[] }>();
    if (!Array.isArray(order_ids) || order_ids.length === 0)
      return c.json({ success: false, error: '주문 ID 목록이 필요합니다' }, 400);
    const settled_at = new Date().toISOString();
    const placeholders = order_ids.map(() => '?').join(',');
    await executeRun(DB,
      `UPDATE orders SET settlement_status = 'completed', settled_at = ? WHERE id IN (${placeholders})`,
      [settled_at, ...order_ids]);
    return c.json({ success: true, data: { updated: order_ids.length } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 정산 자동 실행 (Auto-settlement execution) ──────────────────────────────

adminManagementRoutes.post('/settlement/execute', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json<{ period_start?: string; period_end?: string }>().catch(() => ({} as { period_start?: string; period_end?: string }));
    const { calculateAutoSettlement, executeSettlement } = await import('@/lib/settlement-automation');

    // Preview mode: if dry_run query param is set, only calculate without executing
    const dryRun = c.req.query('dry_run') === 'true';

    if (dryRun) {
      const preview = await calculateAutoSettlement(
        DB, body.period_start, body.period_end, DEFAULT_COMMISSION_RATE
      );
      const totalSales = preview.reduce((s, r) => s + r.total_sales, 0);
      const totalCommission = preview.reduce((s, r) => s + r.commission_amount, 0);
      const totalSettlement = preview.reduce((s, r) => s + r.settlement_amount, 0);
      const totalOrders = preview.reduce((s, r) => s + r.total_orders, 0);
      return c.json({
        success: true,
        data: {
          dry_run: true,
          sellers: preview,
          total_orders: totalOrders,
          total_sales: totalSales,
          total_commission: totalCommission,
          total_settlement: totalSettlement,
        },
      });
    }

    const result = await executeSettlement(
      DB, body.period_start, body.period_end, DEFAULT_COMMISSION_RATE
    );

    // 2. 정산 완료 → 셀러 알림
    for (const seller of result.sellers) {
      createDashboardNotification(DB, 'seller', String(seller.seller_id), 'settlement_completed', '정산 완료', `정산 금액: ${seller.settlement_amount}원`, '/seller/settlements').catch(() => {});
    }

    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 정산 CSV 내보내기 ────────────────────────────────────────────────────────

adminManagementRoutes.get('/settlement/export-csv', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    const sellerId = c.req.query('seller_id');

    let query = `
      SELECT o.order_number, s.name as seller_name, s.business_name,
             o.total_amount,
             COALESCE(s.commission_rate, ${DEFAULT_COMMISSION_RATE}) as commission_rate,
             ROUND(o.total_amount * COALESCE(s.commission_rate, ${DEFAULT_COMMISSION_RATE}) / 100) as commission_amount,
             ROUND(o.total_amount * (1 - COALESCE(s.commission_rate, ${DEFAULT_COMMISSION_RATE}) / 100)) as seller_amount,
             COALESCE(o.settlement_status, 'pending') as settlement_status,
             o.settled_at, o.created_at, u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status IN ('DONE', 'PAID', 'DELIVERED')
    `;
    const params: (string | number | null)[] = [];
    if (period === 'today') { query += ' AND DATE(o.created_at) = ?'; params.push(new Date().toISOString().split('T')[0]); }
    else if (period === 'week') query += " AND DATE(o.created_at) >= DATE('now','-7 days')";
    else if (period === 'month') query += " AND DATE(o.created_at) >= DATE('now','-30 days')";
    if (sellerId) { query += ' AND o.seller_id = ?'; params.push(sellerId); }
    query += ' ORDER BY o.created_at DESC';

    const records = await executeQuery<SettlementRecordRow>(DB, query, params);

    const headers = ['주문번호', '판매자명', '사업자명', '구매자명', '주문금액', '수수료율', '수수료', '정산액', '정산상태', '정산일시', '주문일시'];
    const rows = records.map(r => [
      r.order_number,
      r.seller_name || '',
      r.business_name || '',
      r.user_name || '',
      r.total_amount,
      `${r.commission_rate}%`,
      r.commission_amount,
      r.seller_amount,
      r.settlement_status === 'completed' ? '완료' : '대기',
      r.settled_at ? new Date(r.settled_at).toLocaleString('ko-KR') : '-',
      new Date(r.created_at).toLocaleString('ko-KR'),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const bom = '\uFEFF';
    return new Response(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement_${period}_${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 어드민 주문 상태 변경 ─────────────────────────────────────────────────────

// PATCH /orders/:orderNumber/status — 주문 상태 변경
adminManagementRoutes.patch('/orders/:orderNumber/status', cors(), async (c) => {
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
      updates.push('cancel_reason = ?', 'cancelled_at = datetime(\'now\')');
      params.push(cancel_reason);
    }
    if (status === 'DELIVERED') {
      updates.push('delivered_at = datetime(\'now\')');
    }

    // ✅ CONCURRENCY: state-machine CAS so admin cannot corrupt order flow
    // (e.g. DELIVERED → PENDING) or race with webhooks/seller updates.
    const { statusesThatCanReach } = await import('@/worker/utils/state-machine');
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

    // 11. 배송 완료 → 어드민 + 셀러 알림
    if (status === 'DELIVERED') {
      createDashboardNotification(DB, 'admin', null, 'order_delivered', '배송 완료', `주문: ${orderNumber}`, '/admin/orders').catch(() => {});
      const orderForNotif = await executeQuery<{ seller_id: number | null }>(DB, 'SELECT seller_id FROM orders WHERE order_number = ?', [orderNumber]);
      if (orderForNotif.length > 0 && orderForNotif[0].seller_id) {
        createDashboardNotification(DB, 'seller', String(orderForNotif[0].seller_id), 'order_delivered', '배송 완료', `주문: ${orderNumber}`, '/seller/orders').catch(() => {});
      }
    }

    // 취소 시 재고 복구 — order_items.status != 'CANCELLED'인 항목만 복구 후
    // 모든 항목을 CANCELLED로 마킹해 이중 복구를 차단한다.
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

    return c.json({ success: true, data: { orderNumber, status } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// PUT /orders/:orderNumber/tracking — 운송장 등록
adminManagementRoutes.put('/orders/:orderNumber/tracking', cors(), async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// PATCH /orders/bulk-status — 일괄 상태 변경
adminManagementRoutes.patch('/orders/bulk-status', cors(), async (c) => {
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
    // ✅ CONCURRENCY: enforce state machine — skip rows whose current state
    // cannot legally transition to `status`. This prevents bulk ops from
    // regressing e.g. DELIVERED → SHIPPING.
    const { statusesThatCanReach } = await import('@/worker/utils/state-machine');
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
      data: {
        updated,
        skipped: order_numbers.length - updated,
        status,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 라이브 스트림 관리 ──────────────────────────────────────────────────────

// POST /api/admin/streams/replay — 다시보기 영상 생성
adminManagementRoutes.post('/streams/replay', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const { seller_id, title, description, youtube_url, product_ids } = await c.req.json<{
      seller_id: number; title: string; description?: string; youtube_url: string; product_ids?: number[];
    }>();

    if (!seller_id || !title || !youtube_url) {
      return c.json({ success: false, error: '셀러, 제목, YouTube URL은 필수입니다' }, 400);
    }

    // YouTube URL → video ID 추출
    let videoId = youtube_url;
    const urlMatch = youtube_url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) videoId = urlMatch[1];

    // 셀러 확인
    const seller = await DB.prepare('SELECT id, name FROM sellers WHERE id = ?').bind(seller_id).first();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);

    // 스트림 생성 (status: ended = 다시보기)
    const result = await DB.prepare(`
      INSERT INTO live_streams (seller_id, title, description, youtube_video_id, status, ended_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ended', datetime('now'), datetime('now'), datetime('now'))
    `).bind(seller_id, title, description || null, videoId).run();

    const streamId = result.meta.last_row_id;

    // 상품 연결
    if (product_ids && product_ids.length > 0) {
      try {
        await DB.prepare(`CREATE TABLE IF NOT EXISTS stream_products (id INTEGER PRIMARY KEY AUTOINCREMENT, stream_id INTEGER NOT NULL, product_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(stream_id, product_id))`).run();
      } catch {}

      for (const pid of product_ids) {
        await DB.prepare('INSERT OR IGNORE INTO stream_products (stream_id, product_id) VALUES (?, ?)').bind(streamId, pid).run();
      }
    }

    return c.json({ success: true, data: { id: streamId, youtube_video_id: videoId } }, 201);
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// GET /api/admin/streams — 전체 스트림 목록 (어드민용)
adminManagementRoutes.get('/streams', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const status = c.req.query('status') || '';
    let sql = `SELECT ls.*, s.name AS seller_name FROM live_streams ls LEFT JOIN sellers s ON s.id = ls.seller_id`;
    const params: unknown[] = [];
    if (status) { sql += ' WHERE ls.status = ?'; params.push(status); }
    sql += ' ORDER BY ls.created_at DESC LIMIT 100';
    const { results } = await DB.prepare(sql).bind(...params).all();
    return c.json({ success: true, data: results || [] });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// PUT /api/admin/streams/:id — 스트림 수정 (어드민)
adminManagementRoutes.put('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    const body = await c.req.json<{ title?: string; description?: string; youtube_video_id?: string; status?: string; product_ids?: number[] }>();

    const updates: string[] = [];
    const vals: unknown[] = [];
    if (body.title) { updates.push('title = ?'); vals.push(body.title); }
    if (body.description !== undefined) { updates.push('description = ?'); vals.push(body.description); }
    if (body.youtube_video_id) { updates.push('youtube_video_id = ?'); vals.push(body.youtube_video_id); }
    if (body.status) { updates.push('status = ?'); vals.push(body.status); if (body.status === 'ended') updates.push("ended_at = datetime('now')"); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      vals.push(id);
      await DB.prepare(`UPDATE live_streams SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
    }

    // 상품 업데이트
    if (body.product_ids) {
      await DB.prepare('DELETE FROM stream_products WHERE stream_id = ?').bind(id).run();
      for (const pid of body.product_ids) {
        await DB.prepare('INSERT OR IGNORE INTO stream_products (stream_id, product_id) VALUES (?, ?)').bind(id, pid).run();
      }
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.delete('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const streamId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM live_streams WHERE id=?', [streamId]);
    if (rows.length === 0) return c.json({ success: false, error: '라이브 스트림을 찾을 수 없습니다' }, 404);
    await executeQuery(DB, 'DELETE FROM live_streams WHERE id=?', [streamId]);
    return c.json({ success: true, data: { id: streamId } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

export default adminManagementRoutes;

// ─── Alimtalk 관리 ────────────────────────────────────────────────────────────

// Auto-create alimtalk_packages table if it doesn't exist
async function ensureAlimtalkPackagesTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS alimtalk_packages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT    NOT NULL,
        credits    INTEGER NOT NULL,
        price      INTEGER NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    // Seed default data if empty
    const count = await DB.prepare('SELECT COUNT(*) as c FROM alimtalk_packages').first<{ c: number }>();
    if (!count || count.c === 0) {
      await DB.prepare(`
        INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order) VALUES
          ('100건',   100,   900,   1, 1),
          ('500건',   500,   4500,  1, 2),
          ('1,000건', 1000,  9000,  1, 3),
          ('3,000건', 3000,  27000, 1, 4),
          ('5,000건', 5000,  45000, 1, 5)
      `).run();
    }
  } catch {
    // Table might already exist, ignore errors
  }
}

// GET /alimtalk/pricing — 패키지 목록
adminManagementRoutes.get('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureAlimtalkPackagesTable(DB);
    const { results } = await DB.prepare(
      `SELECT id, label, credits, price, is_active, sort_order, created_at, updated_at
       FROM alimtalk_packages ORDER BY sort_order ASC`
    ).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// PUT /alimtalk/pricing/:id — 패키지 수정
adminManagementRoutes.put('/alimtalk/pricing/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    const body = await c.req.json<{
      label?: string; credits?: number; price?: number;
      is_active?: boolean; sort_order?: number;
    }>();
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (body.label !== undefined)      { fields.push('label = ?');      values.push(body.label); }
    if (body.credits !== undefined)    { fields.push('credits = ?');    values.push(body.credits); }
    if (body.price !== undefined)      { fields.push('price = ?');      values.push(body.price); }
    if (body.is_active !== undefined)  { fields.push('is_active = ?');  values.push(body.is_active ? 1 : 0); }
    if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }
    if (fields.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    fields.push("updated_at = datetime('now')");
    values.push(parseInt(id));
    await DB.prepare(
      `UPDATE alimtalk_packages SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    return c.json({ success: true, message: '패키지가 업데이트되었습니다' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// POST /alimtalk/pricing — 새 패키지 추가
adminManagementRoutes.post('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const body = await c.req.json<{ label: string; credits: number; price: number; sort_order?: number }>();
    if (!body.label || !body.credits || !body.price) {
      return c.json({ success: false, error: '필수 항목 누락 (label, credits, price)' }, 400);
    }
    const result = await DB.prepare(
      `INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order)
       VALUES (?, ?, ?, 1, ?)`
    ).bind(body.label, body.credits, body.price, body.sort_order ?? 99).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// GET /alimtalk/accounts — 셀러별 크레딧 잔액 현황
adminManagementRoutes.get('/alimtalk/accounts', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const { results } = await DB.prepare(`
      SELECT s.id, s.name AS seller_name, s.email,
             COALESCE(sc.balance, 0) AS balance,
             sc.updated_at
      FROM sellers s
      LEFT JOIN seller_credits sc ON sc.seller_id = s.id
      WHERE s.status = 'approved'
      ORDER BY sc.balance DESC, s.name ASC
    `).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// GET /alimtalk/statistics — 실제 통계
adminManagementRoutes.get('/alimtalk/statistics', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const [totalSent, totalBalance, activeAccounts] = await Promise.all([
      DB.prepare('SELECT COUNT(*) AS cnt FROM alimtalk_logs WHERE success = 1')
        .first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
      DB.prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM seller_credits')
        .first<{ total: number }>().catch(() => ({ total: 0 })),
      DB.prepare('SELECT COUNT(*) AS cnt FROM seller_credits WHERE balance > 0')
        .first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
    ]);
    return c.json({
      success: true,
      data: {
        total_sent: totalSent?.cnt ?? 0,
        total_cost: (totalSent?.cnt ?? 0) * 9,
        active_accounts: activeAccounts?.cnt ?? 0,
        total_balance: totalBalance?.total ?? 0,
      },
    });
  } catch {
    return c.json({ success: true, data: { total_sent: 0, total_cost: 0, active_accounts: 0, total_balance: 0 } });
  }
});


// ─── 후원 정산 관리 ───────────────────────────────────────────────────────────

// GET /api/admin/donations/settlements - 전체 정산 신청 목록
adminManagementRoutes.get('/donations/settlements', cors(), async (c) => {
  const { DB } = c.env;
  const status = c.req.query('status') || '';
  try {
    let query = `
      SELECT ds.id, ds.seller_id, s.name AS seller_name, s.business_name,
             ds.total_amount, ds.commission_amount, ds.settlement_amount,
             ds.donation_count, ds.status, ds.requested_at, ds.settled_at,
             ds.admin_memo, ds.bank_info, ds.created_at
      FROM donation_settlements ds
      JOIN sellers s ON ds.seller_id = s.id
    `;
    const params: (string | number)[] = [];
    if (status) { query += ' WHERE ds.status = ?'; params.push(status); }
    query += ' ORDER BY ds.created_at DESC LIMIT 200';

    const { results } = await DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// GET /api/admin/donations/stats - 후원 통계
adminManagementRoutes.get('/donations/stats', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const [totalDonations, pendingSettlements, totalCommission] = await Promise.all([
      DB.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total FROM donations WHERE status='DONE'`)
        .first<{ cnt: number; total: number }>().catch(() => ({ cnt: 0, total: 0 })),
      DB.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(settlement_amount),0) AS total FROM donation_settlements WHERE status='REQUESTED'`)
        .first<{ cnt: number; total: number }>().catch(() => ({ cnt: 0, total: 0 })),
      DB.prepare(`SELECT COALESCE(SUM(commission_amount),0) AS total FROM donations WHERE status='DONE'`)
        .first<{ total: number }>().catch(() => ({ total: 0 })),
    ]);
    return c.json({
      success: true,
      data: {
        total_donations: totalDonations?.cnt ?? 0,
        total_amount: totalDonations?.total ?? 0,
        pending_settlements: pendingSettlements?.cnt ?? 0,
        pending_settlement_amount: pendingSettlements?.total ?? 0,
        total_commission: totalCommission?.total ?? 0,
      },
    });
  } catch {
    return c.json({ success: true, data: { total_donations: 0, total_amount: 0, pending_settlements: 0, pending_settlement_amount: 0, total_commission: 0 } });
  }
});

// ─── 사이드 배너 관리 (PC Side Banner, Cookat 스타일) ─────────────────────────

// Auto-create side_banners table if it doesn't exist
async function ensureSideBannersTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS side_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch {
    // Table might already exist, ignore errors
  }
}

// GET /api/admin/side-banners — 사이드 배너 목록
adminManagementRoutes.get('/side-banners', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureSideBannersTable(DB);
    const { results } = await DB.prepare(
      `SELECT id, title, image_url, link_url, is_active, sort_order, created_at
       FROM side_banners ORDER BY sort_order ASC, created_at DESC`
    ).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// POST /api/admin/side-banners — 사이드 배너 생성
adminManagementRoutes.post('/side-banners', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureSideBannersTable(DB);
    const body = await c.req.json<{ title: string; image_url: string; link_url?: string; is_active?: boolean; sort_order?: number }>();
    if (!body.title || !body.image_url) {
      return c.json({ success: false, error: '제목과 이미지 URL은 필수입니다.' }, 400);
    }
    const result = await DB.prepare(
      `INSERT INTO side_banners (title, image_url, link_url, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      body.title,
      body.image_url,
      body.link_url || null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      body.sort_order ?? 0
    ).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id, title: body.title } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// PUT /api/admin/side-banners/:id — 사이드 배너 수정
adminManagementRoutes.put('/side-banners/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    await ensureSideBannersTable(DB);
    const existing = await DB.prepare('SELECT id FROM side_banners WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: '사이드 배너를 찾을 수 없습니다' }, 404);

    const body = await c.req.json<{ title?: string; image_url?: string; link_url?: string; is_active?: boolean; sort_order?: number }>();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.title !== undefined)     { fields.push('title = ?');     values.push(body.title); }
    if (body.image_url !== undefined) { fields.push('image_url = ?'); values.push(body.image_url); }
    if (body.link_url !== undefined)  { fields.push('link_url = ?');  values.push(body.link_url || null); }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
    if (body.sort_order !== undefined){ fields.push('sort_order = ?');values.push(body.sort_order); }
    if (fields.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    values.push(parseInt(id));
    await DB.prepare(
      `UPDATE side_banners SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    return c.json({ success: true, data: { id } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// DELETE /api/admin/side-banners/:id — 사이드 배너 삭제
adminManagementRoutes.delete('/side-banners/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    await ensureSideBannersTable(DB);
    const existing = await DB.prepare('SELECT id FROM side_banners WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: '사이드 배너를 찾을 수 없습니다' }, 404);
    await DB.prepare('DELETE FROM side_banners WHERE id = ?').bind(id).run();
    return c.json({ success: true, data: { id } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// PATCH /api/admin/donations/settlements/:id - 정산 완료/거부
adminManagementRoutes.patch('/donations/settlements/:id', cors(), async (c) => {
  const { DB } = c.env;
  const settleId = c.req.param('id');
  try {
    const body = await c.req.json<{ action: 'done' | 'reject'; admin_memo?: string }>();
    if (!['done', 'reject'].includes(body.action)) {
      return c.json({ success: false, error: 'action은 done 또는 reject이어야 합니다' }, 400);
    }
    const existing = await DB.prepare(
      `SELECT id, status FROM donation_settlements WHERE id = ?`
    ).bind(settleId).first<{ id: number; status: string }>();
    if (!existing) return c.json({ success: false, error: '정산 신청을 찾을 수 없습니다' }, 404);
    if (existing.status !== 'REQUESTED') {
      return c.json({ success: false, error: `이미 처리된 정산입니다 (${existing.status})` }, 409);
    }
    const newStatus = body.action === 'done' ? 'DONE' : 'REJECTED';
    const settledAt = body.action === 'done' ? `datetime('now')` : 'NULL';
    await DB.prepare(`
      UPDATE donation_settlements
      SET status = ?, admin_memo = ?, settled_at = ${settledAt}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(newStatus, body.admin_memo || null, settleId).run();
    return c.json({
      success: true,
      data: { id: settleId, status: newStatus },
      message: body.action === 'done' ? '정산이 완료 처리되었습니다.' : '정산이 거부되었습니다.',
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// 딜 충전 모니터링 API
// ══════════════════════════════════════════════════════════════════

// GET /api/admin/deals/stats - 딜 충전 통계 요약
adminManagementRoutes.get('/deals/stats', async (c) => {
  const { DB } = c.env;
  try {
    const totals = await DB.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_charged_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(points_amount), 0) as total_points_issued,
        COUNT(DISTINCT user_id) as unique_users
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
    `).first();

    const today = await DB.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount,
        COALESCE(SUM(commission_amount), 0) as commission
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
        AND created_at >= date('now')
    `).first();

    const thisMonth = await DB.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount,
        COALESCE(SUM(commission_amount), 0) as commission
      FROM point_transactions
      WHERE type = 'charge' AND payment_key IS NOT NULL
        AND created_at >= date('now', 'start of month')
    `).first();

    const donations = await DB.prepare(`
      SELECT
        COUNT(*) as total_donations,
        COALESCE(SUM(amount), 0) as total_donated
      FROM point_transactions
      WHERE type = 'donate'
    `).first();

    return c.json({
      success: true,
      data: {
        totals: totals ?? {},
        today: today ?? {},
        thisMonth: thisMonth ?? {},
        donations: donations ?? {},
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// GET /api/admin/deals/charges - 딜 충전 내역 (페이지네이션)
adminManagementRoutes.get('/deals/charges', async (c) => {
  const { DB } = c.env;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const search = c.req.query('search') || '';

  try {
    let whereClause = "WHERE pt.type = 'charge' AND pt.payment_key IS NOT NULL";
    const binds: any[] = [];

    if (search) {
      whereClause += ' AND (pt.user_id LIKE ? OR pt.order_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      binds.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await DB.prepare(
      `SELECT COUNT(*) as total FROM point_transactions pt LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT) ${whereClause}`
    ).bind(...binds).first<{ total: number }>();

    const { results } = await DB.prepare(`
      SELECT
        pt.id, pt.user_id, pt.amount, pt.commission_amount,
        pt.points_amount, pt.balance_after, pt.description,
        pt.payment_key, pt.order_id, pt.created_at,
        up.balance as current_balance,
        up.total_charged as user_total_charged,
        up.total_donated as user_total_donated,
        u.name as user_name,
        u.email as user_email,
        u.profile_image as user_profile_image
      FROM point_transactions pt
      LEFT JOIN user_points up ON pt.user_id = up.user_id
      LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT)
      ${whereClause}
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all();

    return c.json({
      success: true,
      data: results ?? [],
      pagination: {
        page,
        limit,
        total: countResult?.total ?? 0,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// GET /api/admin/deals/users - 딜 사용자별 요약
adminManagementRoutes.get('/deals/users', async (c) => {
  const { DB } = c.env;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(10, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const sort = c.req.query('sort') || 'total_charged';
  const allowedSorts = ['total_charged', 'total_donated', 'balance', 'last_charged'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'total_charged';

  try {
    const countResult = await DB.prepare(
      'SELECT COUNT(*) as total FROM user_points WHERE total_charged > 0'
    ).first<{ total: number }>();

    const { results } = await DB.prepare(`
      SELECT
        up.user_id,
        up.balance,
        up.total_charged,
        up.total_donated,
        up.created_at as first_charge_date,
        up.updated_at as last_activity,
        (SELECT COUNT(*) FROM point_transactions WHERE user_id = up.user_id AND type = 'charge' AND payment_key IS NOT NULL) as charge_count,
        (SELECT MAX(created_at) FROM point_transactions WHERE user_id = up.user_id AND type = 'charge' AND payment_key IS NOT NULL) as last_charged,
        u.name as user_name,
        u.email as user_email,
        u.profile_image as user_profile_image
      FROM user_points up
      LEFT JOIN users u ON CAST(up.user_id AS TEXT) = CAST(u.id AS TEXT)
      WHERE up.total_charged > 0
      ORDER BY ${sortCol} DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return c.json({
      success: true,
      data: results ?? [],
      pagination: {
        page,
        limit,
        total: countResult?.total ?? 0,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 플랫폼 수수료 설정 ──────────────────────────────────────────────

adminManagementRoutes.get('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_default', '5', '라이브 판매 수수료율 (%)')`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_donation', '15', '후원 수수료율 (%)')`).run();
      await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES ('commission_rate_meal_voucher', '5', '식사권 수수료율 (%)')`).run();
      // 기존 description 업데이트
      await DB.prepare(`UPDATE platform_settings SET description = '라이브 판매 수수료율 (%)', value = '5' WHERE key = 'commission_rate_default' AND (description LIKE '%후원%' OR description LIKE '%상품%' OR CAST(value AS INTEGER) = 15)`).run();
      await DB.prepare(`UPDATE platform_settings SET value = '5' WHERE key = 'commission_rate_meal_voucher' AND value = '10'`).run();
    } catch { /* exists */ }

    const { results } = await DB.prepare("SELECT * FROM platform_settings WHERE key LIKE 'commission_%' ORDER BY key").all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.put('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { key, value } = await c.req.json<{ key: string; value: string }>();

    if (!key || value === undefined) return c.json({ success: false, error: '키와 값이 필요합니다' }, 400);
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);

    await DB.prepare("UPDATE platform_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?").bind(value, key).run();
    return c.json({ success: true, message: `수수료율이 ${value}%로 변경되었습니다` });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 리뷰 자동 생성 (어드민 전용) ──────────────────────────────────────
const KOREAN_NAMES = [
  '김민수','이서연','박지훈','최유진','정도윤','강하은','조현우','윤서현','장민준','임지아',
  '한서진','오재원','신다은','류태윤','송소율','홍지호','문채원','배승현','권나윤','백정우',
  '김서윤','이도현','박하린','최준서','정수아','강민재','조아인','윤재민','장하율','임시우',
  '한예린','오건우','신유나','류지원','송현서','홍채은','문준혁','배소연','권태양','백서영',
  '김지후','이하은','박건우','최서아','정민서','강유준','조서연','윤하진','장도영','임예진',
  '한지우','오서현','신지민','류하윤','송태민','홍서준','문다인','배시현','권서윤','백하은',
  '김태현','이지안','박서윤','최은우','정지호','강서영','조민준','윤다은','장서현','임건호',
  '한수민','오채원','신도현','류서아','송하은','홍지민','문건우','배예린','권시우','백민서',
  '김하율','이현서','박시은','최다인','정서준','강지안','조하은','윤예진','장태민','임채은',
  '한도윤','오시우','신하린','류민재','송서영','홍건우','문지안','배도현','권하은','백서준',
  '김예은','이시현','박다율','최하진','정유나','강민서','조태양','윤건우','장지민','임서윤',
  '한시은','오지후','신서현','류예진','송도영','홍다은','문태현','배하진','권채원','백유나',
  '김도윤','이하율','박민재','최서영','정건우','강시우','조지안','윤다인','장하은','임도현',
  '한채은','오건호','신서아','류지민','송유나','홍서영','문시현','배건우','권다은','백태현',
  '김서영','이다인','박유준','최하율','정예진','강건호','조서아','윤민재','장채은','임하진',
  '한유나','오도현','신태민','류서영','송건우','홍하은','문다율','배서현','권지후','백서아',
  '김채원','이건우','박하은','최시현','정서영','강다은','조도현','윤서아','장건우','임서영',
  '한건호','오하율','신유나','류하은','송지민','홍태현','문서윤','배시우','권건우','백하율',
  '김지민','이서영','박태현','최건우','정하은','강서아','조유나','윤지후','장서영','임태양',
  '한다인','오서윤','신건호','류다은','송서아','홍시현','문하은','배지민','권서영','백도현',
];
const REVIEW_TEMPLATES = [
  '품질이 정말 좋아요! 다음에도 구매할게요.',
  '배송이 빠르고 포장도 깔끔했어요.',
  '가격 대비 만족스러워요. 추천합니다!',
  '색상이 사진과 동일해요. 맘에 들어요.',
  '사이즈가 딱 맞아요. 재구매 의사 있어요.',
  '선물용으로 구매했는데 반응이 좋았어요.',
  '라이브에서 보고 바로 구매했는데 만족해요!',
  '생각보다 더 좋은 품질이에요.',
  '가성비 최고! 친구한테도 추천했어요.',
  '재질이 좋고 마감이 깔끔해요.',
  '이 가격에 이 퀄리티면 대박이에요.',
  '빠른 배송 감사합니다. 잘 쓸게요!',
  '두 번째 구매인데 역시 만족스러워요.',
  '디자인이 예쁘고 실용적이에요.',
  '기대 이상으로 좋아요!',
  '맛있어요~ 또 주문할게요!',
  '양이 넉넉하고 맛도 좋아요.',
  '포장이 꼼꼼해서 좋았어요.',
  '가격이 착해요. 재구매 확정!',
  '부모님께 보내드렸는데 좋아하세요.',
  '신선하고 품질 좋아요!',
  '다른 곳보다 훨씬 저렴해요.',
  '퀄리티 대비 가격이 미쳤어요.',
  '매장보다 맛있는 느낌이에요.',
  '리뷰 보고 샀는데 만족합니다!',
  '친구 추천으로 샀는데 대만족이에요.',
  '포장 상태 완벽했어요.',
  '집에서 편하게 즐길 수 있어서 좋아요.',
  '라이브 때 할인 받아서 득템했어요!',
  '아이들도 맛있다고 잘 먹어요.',
  '', // 별점만 (텍스트 없음)
  '', '', '', '', '', // 별점만 비율 높이기
];

adminManagementRoutes.post('/reviews/generate', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { product_id, product_name, product_price, product_category, count, avg_rating, options, mode } = await c.req.json<{
      product_id: number; product_name?: string; product_price?: number; product_category?: string;
      count: number; avg_rating: number; options?: string[]; mode?: 'template' | 'ai';
    }>();

    if (!product_id || !count || count < 1 || count > 20000) {
      return c.json({ success: false, error: '상품 ID와 개수(1-20000)가 필요합니다' }, 400);
    }

    // reviews 테이블 ensure
    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS product_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          user_id TEXT,
          user_name TEXT NOT NULL,
          rating INTEGER NOT NULL,
          content TEXT,
          selected_option TEXT,
          is_generated INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch { /* exists */ }

    let generated = 0;
    const targetRating = avg_rating || 4.5;
    const now = Date.now();
    const BATCH_SIZE = 50;

    // ── AI 모드: Claude API로 자연스러운 리뷰 생성 ──
    if (mode === 'ai') {
      const apiKey = (c.env as any).ANTHROPIC_API_KEY;
      if (!apiKey) return c.json({ success: false, error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. Cloudflare 환경변수에 추가해주세요.' }, 400);

      const aiCount = Math.min(count, 500); // AI는 최대 500개
      const batchSize = 50; // 한 번에 50개씩 생성 요청

      for (let batchStart = 0; batchStart < aiCount; batchStart += batchSize) {
        const batchCount = Math.min(batchSize, aiCount - batchStart);
        const ratingsForBatch = Array.from({ length: batchCount }, () =>
          Math.min(5, Math.max(1, Math.round(targetRating + (Math.random() - 0.5))))
        );

        try {
          const prompt = `한국 온라인 쇼핑몰의 상품 리뷰를 ${batchCount}개 작성해주세요.

상품 정보:
- 상품명: ${product_name || '상품'}
- 가격: ${product_price ? product_price.toLocaleString() + '원' : '미정'}
- 카테고리: ${product_category || '일반'}
${options?.length ? '- 옵션: ' + options.join(', ') : ''}

각 리뷰의 별점: ${ratingsForBatch.join(', ')}

규칙:
- 실제 구매자가 쓴 것처럼 자연스럽고 다양하게
- 1~3문장 길이, 구어체
- 별점 4-5점은 긍정, 3점은 보통, 1-2점은 부정
- 약 20%는 텍스트 없이 빈 문자열("")만 (별점만 매기는 사람)
- 이모지 가끔 사용 (30% 확률)
- 반복되는 표현 최소화

JSON 배열로만 응답. 각 항목: {"content": "리뷰 내용", "rating": 별점}
빈 리뷰는 {"content": "", "rating": 별점}`;

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          const data: any = await res.json();
          const text = data?.content?.[0]?.text || '[]';

          // JSON 파싱 (```json 블록 제거)
          const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const reviews: { content: string; rating: number }[] = JSON.parse(jsonStr);

          const stmts = reviews.map((r) => {
            const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
            const maskedName = name[0] + '*' + name[name.length - 1];
            const daysAgo = Math.floor(Math.random() * 90);
            const reviewDate = new Date(now - daysAgo * 86400000).toISOString();
            const option = options?.length ? options[Math.floor(Math.random() * options.length)] : null;

            return DB.prepare(
              'INSERT INTO product_reviews (product_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
            ).bind(product_id, maskedName, r.rating, r.content || null, option, reviewDate);
          });

          await DB.batch(stmts);
          generated += stmts.length;
        } catch (e) {
          console.error('[AI Review] Batch error:', e);
        }
      }

      // 리뷰 수에 비례하여 sold_count 증가 (리뷰 1개당 2~3명 구매)
      const soldIncrement = generated * (2 + Math.round(Math.random()));
      try { await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(soldIncrement, product_id).run() } catch {}

      return c.json({ success: true, data: { generated }, message: `AI로 ${generated}개 리뷰가 생성되었습니다` });
    }

    // ── 템플릿 모드 ──

    for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
      const stmts = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const rating = Math.min(5, Math.max(1, Math.round(targetRating + (Math.random() - 0.5))));
        const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
        const maskedName = name[0] + '*' + name[name.length - 1];
        const content = REVIEW_TEMPLATES[Math.floor(Math.random() * REVIEW_TEMPLATES.length)] || null;
        const option = options && options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
        const daysAgo = Math.floor(Math.random() * 90);
        const reviewDate = new Date(now - daysAgo * 86400000).toISOString();

        stmts.push(
          DB.prepare(`INSERT INTO product_reviews (product_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
            .bind(product_id, maskedName, rating, content, option, reviewDate)
        );
      }

      try {
        await DB.batch(stmts);
        generated += stmts.length;
      } catch { /* partial batch fail */ }
    }

    // 리뷰 수에 비례하여 sold_count 증가 (리뷰 1개당 2~3명 구매)
    const soldIncrement = generated * (2 + Math.round(Math.random()));
    try { await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(soldIncrement, product_id).run() } catch {}

    return c.json({ success: true, data: { generated, sold_increment: soldIncrement }, message: `${generated}개 리뷰 + ${soldIncrement}명 구매 수 반영` });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 리뷰 삭제 ──
adminManagementRoutes.delete('/reviews/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const id = c.req.param('id');
    await DB.prepare('DELETE FROM product_reviews WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: '리뷰가 삭제되었습니다' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 리뷰 목록 (상품별) ──
adminManagementRoutes.get('/reviews/product/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const { results } = await DB.prepare('SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 100').bind(productId).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 생성된 리뷰 일괄 삭제 ──
adminManagementRoutes.delete('/reviews/generated/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const result = await DB.prepare('DELETE FROM product_reviews WHERE product_id = ? AND is_generated = 1').bind(productId).run();
    return c.json({ success: true, message: `${result.meta.changes}개 생성 리뷰 삭제됨` });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── 쿠폰 관리 ──
adminManagementRoutes.get('/coupons', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    try { await DB.prepare(`CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL, min_order_amount INTEGER DEFAULT 0, max_discount INTEGER, total_count INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, seller_id INTEGER, is_active INTEGER DEFAULT 1, starts_at DATETIME, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run() } catch {}
    const { results } = await DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) { return c.json({ success: false, error: (err as Error).message }, 500); }
});

adminManagementRoutes.post('/coupons', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { code, name, type, value, min_order_amount, max_discount, total_count, expires_at } = await c.req.json();
    if (!code || !name || !type || !value) return c.json({ success: false, error: '필수 항목 누락' }, 400);
    await DB.prepare(`INSERT INTO coupons (code, name, type, value, min_order_amount, max_discount, total_count, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(code, name, type, value, min_order_amount || 0, max_discount || null, total_count || 0, expires_at || null).run();
    return c.json({ success: true, message: '쿠폰이 생성되었습니다' });
  } catch (err) { return c.json({ success: false, error: (err as Error).message }, 500); }
});

adminManagementRoutes.delete('/coupons/:id', cors(), async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ success: false, error: (err as Error).message }, 500); }
});

// ── 쿠폰 세그먼트 발송 ──
adminManagementRoutes.post('/coupons/:id/send-segment', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const couponId = c.req.param('id');
    const { segment } = await c.req.json<{ segment: 'all' | 'vip' | 'new' | 'dormant' | 'active' }>();

    if (!segment || !['all', 'vip', 'new', 'dormant', 'active'].includes(segment)) {
      return c.json({ success: false, error: '유효하지 않은 세그먼트' }, 400);
    }

    // 쿠폰 존재 확인
    const coupon = await DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(couponId).first<Record<string, unknown>>();
    if (!coupon) return c.json({ success: false, error: '쿠폰을 찾을 수 없습니다' }, 404);

    // user_coupons 테이블 생성
    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS user_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        coupon_id INTEGER NOT NULL,
        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, coupon_id)
      )`).run();
    } catch { /* already exists */ }

    // 세그먼트에 따라 유저 조회
    let userQuery = '';
    switch (segment) {
      case 'all':
        userQuery = "SELECT id FROM users";
        break;
      case 'vip':
        userQuery = "SELECT DISTINCT u.id FROM users u INNER JOIN user_tiers ut ON u.id = ut.user_id WHERE ut.tier IN ('gold', 'diamond')";
        break;
      case 'new':
        userQuery = "SELECT id FROM users WHERE created_at > datetime('now', '-7 days')";
        break;
      case 'dormant':
        userQuery = "SELECT u.id FROM users u WHERE u.id NOT IN (SELECT DISTINCT user_id FROM orders WHERE created_at > datetime('now', '-30 days'))";
        break;
      case 'active':
        userQuery = "SELECT DISTINCT user_id as id FROM orders WHERE created_at > datetime('now', '-7 days')";
        break;
    }

    const { results: users } = await DB.prepare(userQuery).all<{ id: string }>();
    if (!users || users.length === 0) {
      return c.json({ success: false, error: '해당 세그먼트에 유저가 없습니다' }, 404);
    }

    let sentCount = 0;
    // 배치로 user_coupons 레코드 생성 및 알림 발송
    for (const user of users) {
      try {
        await DB.prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)").bind(String(user.id), couponId).run();
        sentCount++;
      } catch { /* duplicate or error — skip */ }
    }

    // 알림 생성 (notifications 테이블이 있으면)
    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'user',
        type TEXT DEFAULT 'coupon',
        title TEXT NOT NULL,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
    } catch { /* already exists */ }

    const couponName = coupon.name as string || '쿠폰';
    const segmentLabels: Record<string, string> = {
      all: '전체', vip: 'VIP', new: '신규', dormant: '휴면', active: '활성'
    };

    for (const user of users) {
      try {
        // Production `notifications` table requires `user_type` column
        await DB.prepare(
          "INSERT INTO notifications (user_id, user_type, type, title, message, link) VALUES (?, 'user', 'coupon', ?, ?, '/cart')"
        ).bind(
          String(user.id),
          `쿠폰이 도착했어요!`,
          `[${couponName}] 쿠폰이 지급되었습니다. 지금 사용해보세요!`
        ).run();
      } catch { /* skip */ }
    }

    return c.json({
      success: true,
      message: `${segmentLabels[segment]} 유저 ${sentCount}명에게 쿠폰이 발송되었습니다`,
      data: { sent_count: sentCount, segment }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Audit Log Viewer
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditLogRow {
  id: number;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  before_value: string | null;
  after_value: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

adminManagementRoutes.get('/audit-logs', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const offset = (page - 1) * limit;
    const adminId = c.req.query('admin_id');
    const action = c.req.query('action');
    const targetType = c.req.query('target_type');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (adminId) { conditions.push('admin_id = ?'); params.push(adminId); }
    if (action) { conditions.push('action = ?'); params.push(action); }
    if (targetType) { conditions.push('target_type = ?'); params.push(targetType); }
    if (startDate) { conditions.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('created_at <= ?'); params.push(endDate); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM admin_audit_logs ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const logs = await executeQuery<AuditLogRow>(DB,
      `SELECT id, admin_id, admin_email, action, target_type, target_id,
              before_value, after_value, ip, user_agent, created_at
       FROM admin_audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Admin] audit-logs error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Revenue Analytics
// ═══════════════════════════════════════════════════════════════════════════════

interface RevenueRow {
  date: string;
  revenue: number;
  order_count: number;
}

interface CategoryRevenueRow {
  category: string;
  revenue: number;
  order_count: number;
}

interface TopSellerRow {
  seller_id: number;
  seller_name: string | null;
  business_name: string | null;
  revenue: number;
  order_count: number;
}

interface TopProductRow {
  product_id: number;
  product_name: string;
  sales_count: number;
  revenue: number;
  image_url: string | null;
}

adminManagementRoutes.get('/analytics/revenue', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const period = c.req.query('period') || '30d';

    let days: number;
    switch (period) {
      case '7d': days = 7; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
      default: days = 30;
    }

    const dailyRevenue = await executeQuery<RevenueRow>(DB,
      `SELECT DATE(created_at) as date,
              SUM(total_amount) as revenue,
              COUNT(*) as order_count
       FROM orders
       WHERE payment_status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );

    const totalRows = await executeQuery<{ total_revenue: number; total_orders: number }>(DB,
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
              COUNT(*) as total_orders
       FROM orders
       WHERE payment_status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND created_at >= datetime('now', '-' || ? || ' days')`,
      [days]
    );

    return c.json({
      success: true,
      data: {
        daily: dailyRevenue,
        totals: totalRows[0] || { total_revenue: 0, total_orders: 0 },
        period
      }
    });
  } catch (err) {
    console.error('[Admin] analytics/revenue error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/analytics/category', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    const categories = await executeQuery<CategoryRevenueRow>(DB,
      `SELECT COALESCE(p.category, 'uncategorized') as category,
              SUM(oi.price * oi.quantity) as revenue,
              COUNT(DISTINCT o.id) as order_count
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.payment_status IN ('PAID','DONE','SHIPPING','DELIVERED')
       GROUP BY p.category
       ORDER BY revenue DESC`
    );

    return c.json({ success: true, data: categories });
  } catch (err) {
    console.error('[Admin] analytics/category error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/analytics/top-sellers', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '10')));

    const topSellers = await executeQuery<TopSellerRow>(DB,
      `SELECT o.seller_id,
              s.name as seller_name,
              s.business_name,
              SUM(o.total_amount) as revenue,
              COUNT(*) as order_count
       FROM orders o
       LEFT JOIN sellers s ON s.id = o.seller_id
       WHERE o.payment_status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND o.seller_id IS NOT NULL
       GROUP BY o.seller_id
       ORDER BY revenue DESC
       LIMIT ?`,
      [limit]
    );

    return c.json({ success: true, data: topSellers });
  } catch (err) {
    console.error('[Admin] analytics/top-sellers error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/analytics/top-products', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '10')));

    const topProducts = await executeQuery<TopProductRow>(DB,
      `SELECT oi.product_id,
              COALESCE(p.name, oi.product_name) as product_name,
              SUM(oi.quantity) as sales_count,
              SUM(oi.price * oi.quantity) as revenue,
              p.image_url
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.payment_status IN ('PAID','DONE','SHIPPING','DELIVERED')
       GROUP BY oi.product_id
       ORDER BY sales_count DESC
       LIMIT ?`,
      [limit]
    );

    return c.json({ success: true, data: topProducts });
  } catch (err) {
    console.error('[Admin] analytics/top-products error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Admin Account Management
// ═══════════════════════════════════════════════════════════════════════════════

import { hashPassword } from '@/lib/password';

interface AdminRow {
  id: number;
  username: string | null;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
}

adminManagementRoutes.get('/admins', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const admins = await executeQuery<AdminRow>(DB,
      `SELECT id, username, email, name, role, created_at
       FROM admins
       ORDER BY created_at DESC`
    );
    return c.json({ success: true, data: admins });
  } catch (err) {
    console.error('[Admin] list admins error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.post('/admins', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { email, password, name, role, username } = await c.req.json<{
      email: string; password: string; name: string; role: string; username?: string;
    }>();

    if (!email || !password || !name || !role) {
      return c.json({ success: false, error: '필수 항목이 누락되었습니다 (email, password, name, role)' }, 400);
    }
    if (!['super_admin', 'admin', 'viewer'].includes(role)) {
      return c.json({ success: false, error: '유효하지 않은 역할입니다. super_admin, admin, viewer 중 선택하세요' }, 400);
    }

    // Check for duplicate email
    const existing = await executeQuery<{ id: number }>(DB,
      `SELECT id FROM admins WHERE email = ?`, [email]
    );
    if (existing.length > 0) {
      return c.json({ success: false, error: '이미 존재하는 이메일입니다' }, 409);
    }

    // username is NOT NULL — derive from email local part if not provided
    const resolvedUsername = (username && username.trim()) || email.split('@')[0];

    const passwordHash = await hashPassword(password);
    await executeRun(DB,
      `INSERT INTO admins (username, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [resolvedUsername, email, passwordHash, name, role]
    );

    await writeAuditLog(c, {
      action: 'create_admin',
      targetType: 'admin',
      targetId: email,
      after: { email, name, role }
    });

    return c.json({ success: true, message: '관리자가 생성되었습니다' });
  } catch (err) {
    console.error('[Admin] create admin error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/admins/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const adminId = c.req.param('id');
    const { name, role, email } = await c.req.json<{
      name?: string; role?: string; email?: string;
    }>();

    const rows = await executeQuery<AdminRow>(DB,
      `SELECT id, username, email, name, role, created_at FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    const current = rows[0];

    // Cannot change own role if super_admin (prevent lockout)
    if (role && role !== current.role) {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      if (String(currentAdminId) === String(adminId) && current.role === 'super_admin') {
        return c.json({ success: false, error: 'super_admin은 자신의 역할을 변경할 수 없습니다' }, 403);
      }
      if (!['super_admin', 'admin', 'viewer'].includes(role)) {
        return c.json({ success: false, error: '유효하지 않은 역할입니다' }, 400);
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (name !== undefined) { updates.push('name = ?'); params.push(name); before.name = current.name; after.name = name; }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); before.role = current.role; after.role = role; }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); before.email = current.email; after.email = email; }

    if (updates.length === 0) {
      return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    }

    params.push(adminId);
    await executeRun(DB, `UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, params);

    await writeAuditLog(c, {
      action: 'update_admin',
      targetType: 'admin',
      targetId: adminId,
      before, after
    });

    return c.json({ success: true, message: '관리자 정보가 업데이트되었습니다' });
  } catch (err) {
    console.error('[Admin] update admin error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.delete('/admins/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const adminId = c.req.param('id');

    // Cannot delete self
    const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
    const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
    if (String(currentAdminId) === String(adminId)) {
      return c.json({ success: false, error: '자기 자신을 삭제할 수 없습니다' }, 403);
    }

    const rows = await executeQuery<AdminRow>(DB,
      `SELECT id, username, email, name, role, created_at FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    // Cannot delete last super_admin
    if (rows[0].role === 'super_admin') {
      const superAdminCount = await executeQuery<CountRow>(DB,
        `SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'`
      );
      if ((superAdminCount[0]?.count || 0) <= 1) {
        return c.json({ success: false, error: '마지막 super_admin은 삭제할 수 없습니다' }, 403);
      }
    }

    await executeRun(DB, `DELETE FROM admins WHERE id = ?`, [adminId]);

    await writeAuditLog(c, {
      action: 'delete_admin',
      targetType: 'admin',
      targetId: adminId,
      before: { email: rows[0].email, name: rows[0].name, role: rows[0].role }
    });

    return c.json({ success: true, message: '관리자가 삭제되었습니다' });
  } catch (err) {
    console.error('[Admin] delete admin error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.post('/admins/:id/reset-password', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const adminId = c.req.param('id');
    const { newPassword } = await c.req.json<{ newPassword: string }>();

    if (!newPassword || newPassword.length < 6) {
      return c.json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' }, 400);
    }

    const rows = await executeQuery<{ id: number }>(DB,
      `SELECT id FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await executeRun(DB, `UPDATE admins SET password_hash = ? WHERE id = ?`, [passwordHash, adminId]);

    await writeAuditLog(c, {
      action: 'reset_admin_password',
      targetType: 'admin',
      targetId: adminId,
      after: { password_reset: true }
    });

    return c.json({ success: true, message: '비밀번호가 재설정되었습니다' });
  } catch (err) {
    console.error('[Admin] reset password error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Review Moderation
// ═══════════════════════════════════════════════════════════════════════════════

interface ReviewRow {
  id: number;
  product_id: number;
  user_id: string;
  user_name: string | null;
  rating: number;
  content: string | null;
  image_urls: string | null;
  is_visible: number;
  created_at: string;
  product_name?: string;
}

interface ReviewStatsRow {
  total: number;
  avg_rating: number;
  hidden_count: number;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
}

adminManagementRoutes.get('/reviews/list', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
    const offset = (page - 1) * limit;
    const status = c.req.query('status') || 'all';
    const productId = c.req.query('product_id');
    const rating = c.req.query('rating');
    const sort = c.req.query('sort') || 'newest';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status === 'visible') { conditions.push('r.is_visible = 1'); }
    else if (status === 'hidden') { conditions.push('r.is_visible = 0'); }

    if (productId) { conditions.push('r.product_id = ?'); params.push(productId); }
    if (rating) { conditions.push('r.rating = ?'); params.push(parseInt(rating)); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy: string;
    switch (sort) {
      case 'oldest': orderBy = 'r.created_at ASC'; break;
      case 'rating_high': orderBy = 'r.rating DESC, r.created_at DESC'; break;
      case 'rating_low': orderBy = 'r.rating ASC, r.created_at DESC'; break;
      default: orderBy = 'r.created_at DESC';
    }

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM reviews r ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const reviews = await executeQuery<ReviewRow>(DB,
      `SELECT r.id, r.product_id, r.user_id, r.user_name, r.rating, r.content,
              r.image_urls, r.is_visible, r.created_at,
              p.name as product_name
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: reviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Admin] reviews/list error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/reviews/:id/visibility', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const reviewId = c.req.param('id');
    const { is_visible } = await c.req.json<{ is_visible: 0 | 1 }>();

    if (![0, 1].includes(is_visible)) {
      return c.json({ success: false, error: 'is_visible must be 0 or 1' }, 400);
    }

    const rows = await executeQuery<{ id: number; is_visible: number }>(DB,
      `SELECT id, is_visible FROM reviews WHERE id = ?`, [reviewId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `UPDATE reviews SET is_visible = ? WHERE id = ?`, [is_visible, reviewId]);

    await writeAuditLog(c, {
      action: is_visible ? 'show_review' : 'hide_review',
      targetType: 'review',
      targetId: reviewId,
      before: { is_visible: rows[0].is_visible },
      after: { is_visible }
    });

    return c.json({ success: true, message: is_visible ? '리뷰가 표시되었습니다' : '리뷰가 숨겨졌습니다' });
  } catch (err) {
    console.error('[Admin] review visibility error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.delete('/reviews/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const reviewId = c.req.param('id');

    const rows = await executeQuery<ReviewRow>(DB,
      `SELECT id, product_id, user_id, user_name, rating, content, image_urls, is_visible, created_at
       FROM reviews WHERE id = ?`, [reviewId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `DELETE FROM reviews WHERE id = ?`, [reviewId]);

    await writeAuditLog(c, {
      action: 'delete_review',
      targetType: 'review',
      targetId: reviewId,
      before: { product_id: rows[0].product_id, user_id: rows[0].user_id, rating: rows[0].rating, content: rows[0].content }
    });

    return c.json({ success: true, message: '리뷰가 삭제되었습니다' });
  } catch (err) {
    console.error('[Admin] delete review error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/reviews/stats', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    const stats = await executeQuery<ReviewStatsRow>(DB,
      `SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating,
        SUM(CASE WHEN is_visible = 0 THEN 1 ELSE 0 END) as hidden_count,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
       FROM reviews`
    );

    return c.json({ success: true, data: stats[0] || { total: 0, avg_rating: 0, hidden_count: 0, rating_1: 0, rating_2: 0, rating_3: 0, rating_4: 0, rating_5: 0 } });
  } catch (err) {
    console.error('[Admin] reviews/stats error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Live Stream Monitor
// ═══════════════════════════════════════════════════════════════════════════════

interface LiveStreamRow {
  id: number;
  seller_id: number;
  seller_name: string | null;
  title: string | null;
  status: string;
  youtube_video_id: string | null;
  viewer_count: number;
  current_product_id: number | null;
  current_product_name: string | null;
  created_at: string;
}

interface StreamHistoryRow {
  id: number;
  seller_id: number;
  seller_name: string | null;
  title: string | null;
  status: string;
  youtube_video_id: string | null;
  viewer_count: number;
  peak_viewers: number | null;
  created_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
}

adminManagementRoutes.get('/live-monitor', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    const streams = await executeQuery<LiveStreamRow>(DB,
      `SELECT ls.id, ls.seller_id,
              s.name as seller_name,
              ls.title, ls.status,
              ls.youtube_video_id,
              COALESCE(ls.viewer_count, 0) as viewer_count,
              ls.current_product_id,
              p.name as current_product_name,
              ls.created_at
       FROM live_streams ls
       LEFT JOIN sellers s ON s.id = ls.seller_id
       LEFT JOIN products p ON p.id = ls.current_product_id
       WHERE ls.status = 'live'
       ORDER BY ls.created_at DESC`
    );

    return c.json({ success: true, data: streams });
  } catch (err) {
    console.error('[Admin] live-monitor error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/live-monitor/:id/end', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const streamId = c.req.param('id');

    const rows = await executeQuery<{ id: number; status: string; seller_id: number }>(DB,
      `SELECT id, status, seller_id FROM live_streams WHERE id = ?`, [streamId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '스트림을 찾을 수 없습니다' }, 404);
    }
    if (rows[0].status === 'ended') {
      return c.json({ success: false, error: '이미 종료된 스트림입니다' }, 400);
    }

    await executeRun(DB,
      `UPDATE live_streams SET status = 'ended', ended_at = datetime('now') WHERE id = ?`,
      [streamId]
    );

    await writeAuditLog(c, {
      action: 'force_end_stream',
      targetType: 'live_stream',
      targetId: streamId,
      before: { status: rows[0].status },
      after: { status: 'ended' }
    });

    return c.json({ success: true, message: '스트림이 강제 종료되었습니다' });
  } catch (err) {
    console.error('[Admin] live-monitor end error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/live-monitor/history', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') || '7')));

    const streams = await executeQuery<StreamHistoryRow>(DB,
      `SELECT ls.id, ls.seller_id,
              s.name as seller_name,
              ls.title, ls.status,
              ls.youtube_video_id,
              COALESCE(ls.viewer_count, 0) as viewer_count,
              ls.peak_viewers,
              ls.created_at,
              ls.ended_at,
              CASE
                WHEN ls.ended_at IS NOT NULL
                THEN CAST((julianday(ls.ended_at) - julianday(ls.created_at)) * 24 * 60 AS INTEGER)
                ELSE NULL
              END as duration_minutes
       FROM live_streams ls
       LEFT JOIN sellers s ON s.id = ls.seller_id
       WHERE ls.status = 'ended'
         AND ls.created_at >= datetime('now', '-' || ? || ' days')
       ORDER BY ls.created_at DESC`,
      [days]
    );

    return c.json({ success: true, data: streams });
  } catch (err) {
    console.error('[Admin] live-monitor/history error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. User Management
// ═══════════════════════════════════════════════════════════════════════════════

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  provider: string | null;
  status: string | null;
  created_at: string;
  deal_balance: number | null;
}

interface UserDetailRow extends UserRow {
  order_count: number;
  total_spent: number;
  review_count: number;
}

adminManagementRoutes.get('/users', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const offset = (page - 1) * limit;
    const search = c.req.query('search');
    const status = c.req.query('status');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM users u ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    const users = await executeQuery<UserRow>(DB,
      `SELECT u.id, u.name, u.email, u.phone, u.created_at
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[Admin] users list error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.patch('/users/:id/status', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');
    const { status } = await c.req.json<{ status: string }>();

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return c.json({ success: false, error: '유효하지 않은 상태입니다. active, suspended, banned 중 선택하세요' }, 400);
    }

    const rows = await executeQuery<{ id: string; status: string }>(DB,
      `SELECT id, status FROM users WHERE id = ?`, [userId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `UPDATE users SET status = ? WHERE id = ?`, [status, userId]);

    await writeAuditLog(c, {
      action: 'update_user_status',
      targetType: 'user',
      targetId: userId,
      before: { status: rows[0].status },
      after: { status }
    });

    return c.json({ success: true, message: '사용자 상태가 변경되었습니다', data: { id: userId, status } });
  } catch (err) {
    console.error('[Admin] user status error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/users/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');

    const users = await executeQuery<UserRow>(DB,
      `SELECT id, name, email, phone, created_at
       FROM users WHERE id = ?`, [userId]
    );
    if (users.length === 0) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }

    const orderStats = await executeQuery<{ order_count: number; total_spent: number }>(DB,
      `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_spent
       FROM orders WHERE user_id = ? AND payment_status IN ('PAID','DONE','SHIPPING','DELIVERED')`,
      [userId]
    );

    const reviewStats = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM reviews WHERE user_id = ?`, [userId]
    );

    const user = users[0];
    const detail: UserDetailRow = {
      ...user,
      order_count: orderStats[0]?.order_count || 0,
      total_spent: orderStats[0]?.total_spent || 0,
      review_count: reviewStats[0]?.count || 0
    };

    return c.json({ success: true, data: detail });
  } catch (err) {
    console.error('[Admin] user detail error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
