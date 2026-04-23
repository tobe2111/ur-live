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
import { KOREAN_NAMES, REVIEW_TEMPLATES } from './review-templates';

// v30 FIX: 에러 메시지 유출 방지. 프로덕션에서는 generic 메시지만 노출,
// 개발에서는 디버깅을 위해 원본 보존. SQL 오류/컬럼명이 클라이언트에 노출되던 문제 수정.
function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}
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
// 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-sellers.routes.ts 로 이관.

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
      if (startDate) { q += " AND DATE(o.created_at, '+9 hours') >= ?"; params.push(startDate); }
      if (endDate) { q += " AND DATE(o.created_at, '+9 hours') <= ?"; params.push(endDate); }
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
      if (import.meta.env.DEV) console.warn('[Admin] orders primary query failed, trying fallback:', (primaryErr as Error).message);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    if (startDate) { q += " AND DATE(o.created_at, '+9 hours') >= ?"; params.push(startDate); }
    if (endDate) { q += " AND DATE(o.created_at, '+9 hours') <= ?"; params.push(endDate); }
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── 상품 관리 ───────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-products.routes.ts 로 이관.
// (/products, /products/:id, /sample-requests 모두 포함)

// ─── 통계 ────────────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 144 (TD-006 부분): admin-stats.routes.ts 로 이관.

// ─── 정산 관리 ──────────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 143 (TD-006 부분): admin-settlements.routes.ts 로 이관.
// worker/index.ts 에서 adminApp.route('/', adminSettlementsRoutes) 으로 마운트됨.

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
      // 🛡️ 길이 제한 (DB bloat 방지)
      const safeCancelReason = typeof cancel_reason === 'string' ? cancel_reason.slice(0, 500) : null;
      updates.push('cancel_reason = ?', 'cancelled_at = datetime(\'now\')');
      params.push(safeCancelReason);
    }
    if (status === 'DELIVERED') {
      updates.push('delivered_at = datetime(\'now\')');
    }

    // ✅ CONCURRENCY: state-machine CAS so admin cannot corrupt order flow
    // (e.g. DELIVERED → PENDING) or race with webhooks/seller updates.
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
      data: {
        updated,
        skipped: order_numbers.length - updated,
        status,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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

// ─── 사이드 배너 관리 ──────────────────────────────────────────────────────────
// 🛡️ 2026-04-22 배치 141 (TD-006 부분): admin-side-banners.routes.ts 로 이관.
// worker/index.ts 에서 adminApp.route('/', adminSideBannersRoutes) 으로 마운트됨.

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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminManagementRoutes.put('/settings/commission', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { key, value } = await c.req.json<{ key: string; value: string }>();

    if (!key || value === undefined) return c.json({ success: false, error: '키와 값이 필요합니다' }, 400);
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);

    // 🛡️ 2026-04-22: key 화이트리스트 검증 + 이전 값 기록 (audit)
    // commission_rate_live 추가 (라이브 판매 5% 분기용)
    const ALLOWED_KEYS = ['commission_rate_default', 'commission_rate_donation', 'commission_rate_meal_voucher',
      'commission_rate_live',
      'review_reward_text', 'review_reward_image', 'review_reward_video',
      'affiliate_commission_rate'];
    if (!ALLOWED_KEYS.includes(key)) {
      return c.json({ success: false, error: `변경 불가능한 key: ${key}` }, 400);
    }

    const prevRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(key).first<{ value: string }>();
    const prevValue = prevRow?.value ?? null;

    await DB.prepare("UPDATE platform_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?").bind(value, key).run();

    // 감사 로그 — 어드민 대시보드에서 누가 언제 수수료/보상을 변경했는지 추적
    await writeAuditLog(c, {
      action: 'platform_settings.update',
      targetType: 'platform_setting',
      targetId: key,
      before: { value: prevValue },
      after: { value }
    });

    return c.json({ success: true, message: `${key} 값이 ${value}로 변경되었습니다` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 리뷰 자동 생성 (어드민 전용) ──────────────────────────────────────
// 🛡️ 2026-04-22 배치 122 (TD-006 부분): KOREAN_NAMES / REVIEW_TEMPLATES 는
//   ./review-templates 파일로 분리 (이 파일 3571 → 3344 줄).

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

    // 🛡️ 2026-04-22: 가짜 리뷰 생성은 중대한 관리 행위 → 감사 로그 필수
    await writeAuditLog(c, {
      action: 'generate_fake_reviews',
      targetType: 'product',
      targetId: String(product_id),
      after: { count, avg_rating: avg_rating ?? 4.5, mode: mode ?? 'template' },
    });

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
            // 🛡️ 2026-04-22: 30s timeout — LLM 응답 느릴 때 worker hang 방어
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          const data: any = await res.json();
          const text = data?.content?.[0]?.text || '[]';

          // JSON 파싱 (```json 블록 제거) + 스키마 검증
          const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed: unknown = JSON.parse(jsonStr);
          if (!Array.isArray(parsed)) {
            throw new Error('Expected array response from Claude');
          }
          for (const r of parsed) {
            if (
              typeof r !== 'object' || r === null ||
              typeof (r as any).rating !== 'number' ||
              typeof (r as any).content !== 'string'
            ) {
              throw new Error('Invalid review schema');
            }
          }
          const reviews = parsed as { content: string; rating: number }[];

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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 리뷰 삭제 ──
// 🛡️ 2026-04-22 배치 140 BUG FIX: 이전 핸들러는 product_reviews 테이블 (존재 안 함) 을
//   삭제하는 잘못된 코드였고, 올바른 reviews 테이블 삭제 핸들러 (line ~3058) 를 shadow
//   했음. 제거 → 올바른 핸들러가 실행되도록.

// ── 리뷰 목록 (상품별) ──
adminManagementRoutes.get('/reviews/product/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const { results } = await DB.prepare('SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 100').bind(productId).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ── 쿠폰 관리 ──
// 🛡️ 2026-04-22 배치 138 (TD-006 부분): admin-coupons.routes.ts 로 이관.
// 라우트는 worker/index.ts 에서 adminApp.route('/', adminCouponsRoutes) 으로 마운트됨.

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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
      `SELECT DATE(created_at, '+9 hours') as date,
              SUM(total_amount) as revenue,
              COUNT(*) as order_count
       FROM orders
       WHERE status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(created_at, '+9 hours')
       ORDER BY date ASC`,
      [days]
    );

    const totalRows = await executeQuery<{ total_revenue: number; total_orders: number }>(DB,
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
              COUNT(*) as total_orders
       FROM orders
       WHERE status IN ('PAID','DONE','SHIPPING','DELIVERED')
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
       WHERE o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
       GROUP BY p.category
       ORDER BY revenue DESC`
    );

    return c.json({ success: true, data: categories });
  } catch (err) {
    console.error('[Admin] analytics/category error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
       WHERE o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
         AND o.seller_id IS NOT NULL
       GROUP BY o.seller_id
       ORDER BY revenue DESC
       LIMIT ?`,
      [limit]
    );

    return c.json({ success: true, data: topSellers });
  } catch (err) {
    console.error('[Admin] analytics/top-sellers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
       WHERE o.status IN ('PAID','DONE','SHIPPING','DELIVERED')
       GROUP BY oi.product_id
       ORDER BY sales_count DESC
       LIMIT ?`,
      [limit]
    );

    return c.json({ success: true, data: topProducts });
  } catch (err) {
    console.error('[Admin] analytics/top-products error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Admin Account Management
// ═══════════════════════════════════════════════════════════════════════════════

import { hashPassword, validatePasswordComplexity } from '@/lib/password';

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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminManagementRoutes.post('/admins', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    // SECURITY: only super_admin can create admins
    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const { email, password, name, role, username } = await c.req.json<{
      email: string; password: string; name: string; role: string; username?: string;
    }>();

    if (!email || !password || !name || !role) {
      return c.json({ success: false, error: '필수 항목이 누락되었습니다 (email, password, name, role)' }, 400);
    }
    if (!['super_admin', 'admin', 'viewer'].includes(role)) {
      return c.json({ success: false, error: '유효하지 않은 역할입니다. super_admin, admin, viewer 중 선택하세요' }, 400);
    }

    // 🛡️ 2026-04-22: admin 비밀번호 복잡도 검증 (user 와 동일 규칙)
    const complexity = validatePasswordComplexity(password);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminManagementRoutes.patch('/admins/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    // SECURITY: only super_admin can modify admins
    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminManagementRoutes.delete('/admins/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    // SECURITY: only super_admin can delete admins
    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminManagementRoutes.post('/admins/:id/reset-password', cors(), async (c) => {
  try {
    const DB = c.env.DB;

    // SECURITY: only super_admin can reset admin passwords
    {
      const jwtPayload = c.get('jwtPayload' as never) as { sub?: string; id?: number } | undefined;
      const currentAdminId = jwtPayload?.id || jwtPayload?.sub;
      const currentAdmin = await DB.prepare(
        'SELECT role FROM admins WHERE id = ?'
      ).bind(currentAdminId).first<{ role: string }>();
      if (!currentAdmin || currentAdmin.role !== 'super_admin') {
        return c.json({ success: false, error: 'super_admin 권한이 필요합니다' }, 403);
      }
    }

    const adminId = c.req.param('id');
    const { newPassword } = await c.req.json<{ newPassword: string }>();

    // 🛡️ 2026-04-22: admin 비밀번호도 user 와 동일한 복잡도 규칙 적용
    const complexity = validatePasswordComplexity(newPassword ?? '');
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
    }

    const rows = await executeQuery<{ id: number }>(DB,
      `SELECT id FROM admins WHERE id = ?`, [adminId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '관리자를 찾을 수 없습니다' }, 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await executeRun(DB, `UPDATE admins SET password_hash = ? WHERE id = ?`, [passwordHash, adminId]);

    // 🛡️ 2026-04-22: 비번 변경 시 기존 refresh token 전부 revoke
    await DB.prepare(
      "DELETE FROM auth_refresh_tokens WHERE user_type = 'admin' AND user_id = ?"
    ).bind(Number(adminId)).run().catch(() => {});

    await writeAuditLog(c, {
      action: 'reset_admin_password',
      targetType: 'admin',
      targetId: adminId,
      after: { password_reset: true }
    });

    return c.json({ success: true, message: '비밀번호가 재설정되었습니다' });
  } catch (err) {
    console.error('[Admin] reset password error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
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
       FROM orders WHERE user_id = ? AND status IN ('PAID','DONE','SHIPPING','DELIVERED')`,
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
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});
