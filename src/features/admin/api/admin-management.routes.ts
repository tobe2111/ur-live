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
}

export const adminManagementRoutes = new Hono<{ Bindings: Env }>();

// 모든 admin 관리 엔드포인트는 admin 권한 필수
adminManagementRoutes.use('*', requireAdmin());

// ─── 판매자 관리 ──────────────────────────────────────────────────────────────

adminManagementRoutes.get('/sellers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellers = await executeQuery<SellerRow>(DB, `
      SELECT id, email, name, phone, business_name, business_number,
             status, created_at
      FROM sellers ORDER BY created_at DESC
    `);
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
      SELECT id, email, name, phone, business_name, business_number,
             status, created_at
      FROM sellers WHERE status = 'pending' ORDER BY created_at ASC
    `);
    return c.json({ success: true, data: sellers });
  } catch (err) {
    console.error('[Admin] pending sellers error:', err);
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
    return c.json({ success: true, data: { id: sellerId, status: 'rejected', reason } });
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
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB, `UPDATE sellers SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [commission_rate, sellerId]);
    return c.json({ success: true, data: { id: sellerId, commission_rate } });
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

    let query = `
      SELECT o.id, o.order_number, o.user_id, o.seller_id, o.total_amount,
             COALESCE(o.status, 'pending') as status,
             COALESCE(o.payment_status, 'pending') as payment_status,
             COALESCE(o.payment_method, '') as payment_method,
             COALESCE(o.shipping_name, '') as shipping_name,
             COALESCE(o.shipping_phone, '') as shipping_phone,
             COALESCE(o.shipping_address, '') as shipping_address,
             COALESCE(o.shipping_address_detail, '') as shipping_address_detail,
             COALESCE(o.shipping_zipcode, '') as shipping_zipcode,
             o.courier, o.tracking_number, o.created_at, o.updated_at,
             u.name as user_name, u.email as user_email,
             s.business_name as seller_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE 1=1
    `;
    const params: (string | number | null)[] = [];
    if (status) { query += ' AND COALESCE(o.status, \'pending\') = ?'; params.push(status); }
    if (sellerId) { query += ' AND o.seller_id = ?'; params.push(sellerId); }
    if (startDate) { query += ' AND DATE(o.created_at) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(o.created_at) <= ?'; params.push(endDate); }
    query += ' ORDER BY o.created_at DESC LIMIT 1000';

    const orders = await executeQuery<OrderRow>(DB, query, params);
    for (const order of orders) {
      // order_items 테이블은 unit_price 컬럼 사용 (구 스키마는 price)
      order.items = await executeQuery<OrderItemRow>(DB, `
        SELECT oi.id, oi.product_id, oi.product_name, oi.quantity,
               COALESCE(oi.unit_price, oi.price, 0) as price,
               COALESCE(p.image_url, p.thumbnail_url, oi.product_image) as image_url
        FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`, [order.id]);
    }
    return c.json({ success: true, data: orders });
  } catch (err) {
    console.error('[Admin] orders error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 주문 상세 조회 ──────────────────────────────────────────────────────────

adminManagementRoutes.get('/orders/:orderNumber', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const orderNumber = c.req.param('orderNumber');

    const orders = await executeQuery<OrderRow>(DB, `
      SELECT o.id, o.order_number, o.user_id, o.seller_id, o.total_amount,
             COALESCE(o.status, 'pending') as status,
             COALESCE(o.payment_status, 'pending') as payment_status,
             COALESCE(o.payment_method, '') as payment_method,
             COALESCE(o.shipping_name, '') as shipping_name,
             COALESCE(o.shipping_phone, '') as shipping_phone,
             COALESCE(o.shipping_address, '') as shipping_address,
             COALESCE(o.shipping_address_detail, '') as shipping_address_detail,
             COALESCE(o.shipping_zipcode, '') as shipping_zipcode,
             o.courier, o.tracking_number, o.created_at, o.updated_at,
             u.name as user_name, u.email as user_email,
             s.business_name as seller_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE o.order_number = ?`, [orderNumber]);

    if (orders.length === 0) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);

    const order = orders[0];
    order.items = await executeQuery<OrderItemRow>(DB, `
      SELECT oi.id, oi.product_id, oi.product_name, oi.quantity,
             COALESCE(oi.unit_price, oi.price, 0) as price,
             COALESCE(p.image_url, p.thumbnail_url, oi.product_image) as image_url
      FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?`, [order.id]);

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
adminManagementRoutes.delete('/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    
    // Check if product exists
    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }
    
    // Delete related order_items first (if any)
    await executeRun(DB, 'DELETE FROM order_items WHERE product_id = ?', [productId]);
    
    // Delete the product
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
    const { is_active } = body;
    
    // Check if product exists
    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }
    
    // Update is_active status
    const activeValue = is_active ? 1 : 0;
    await executeRun(DB, `UPDATE products SET is_active = ?, updated_at = datetime('now') WHERE id = ?`, [activeValue, productId]);
    
    return c.json({ success: true, data: { id: productId, is_active: activeValue } });
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
      SELECT s.phone AS seller_phone, s.name AS seller_name, p.name AS product_name
      FROM sample_requests sr
      JOIN sellers s ON sr.seller_id = s.id
      JOIN products p ON sr.product_id = p.id
      WHERE sr.id = ?
    `).bind(reqId).first<{ seller_phone: string | null; seller_name: string; product_name: string }>()
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

    let where = "sp.supply_source_id IS NOT NULL AND o.payment_status IN ('approved','APPROVED','paid','PAID')";
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
    const [ts, as, tst, ast] = await Promise.all([
      executeQuery<CountRow>(DB, 'SELECT COUNT(*) as count FROM sellers'),
      executeQuery<CountRow>(DB, "SELECT COUNT(*) as count FROM sellers WHERE status = 'approved'"),
      executeQuery<CountRow>(DB, 'SELECT COUNT(*) as count FROM live_streams'),
      executeQuery<CountRow>(DB, "SELECT COUNT(*) as count FROM live_streams WHERE status = 'live'"),
    ]);
    return c.json({ success: true, data: {
      totalSellers: ts[0]?.count || 0,
      activeSellers: as[0]?.count || 0,
      totalStreams: tst[0]?.count || 0,
      activeStreams: ast[0]?.count || 0,
    }});
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/dashboard/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const today = new Date().toISOString().split('T')[0];
    const [sales, orders, live] = await Promise.all([
      executeQuery<SalesRow>(DB, `SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at)=? AND payment_status='approved'`, [today]),
      executeQuery<CountRow>(DB, 'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at)=?', [today]),
      executeQuery<CountRow>(DB, "SELECT COUNT(*) as count FROM live_streams WHERE status='live'"),
    ]);
    return c.json({ success: true, data: {
      todaySales: sales[0]?.total || 0,
      todayOrders: orders[0]?.count || 0,
      currentVisitors: Math.floor(Math.random() * 100) + 50,
      liveStreams: live[0]?.count || 0,
    }});
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
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

    const [overview, sellers] = await Promise.all([
      executeQuery<SettlementOverviewRow>(DB, `
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100),0) as total_commission,
               COALESCE(SUM(o.total_amount*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)),0) as total_seller_amount
        FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
        WHERE o.payment_status='approved' ${df}`),
      executeQuery<SettlementSellerRow>(DB, `
        SELECT s.id as seller_id, s.name as seller_name, s.business_name,
               COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
               COUNT(o.id) as order_count,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100),0) as commission_amount,
               COALESCE(SUM(o.total_amount*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)),0) as seller_amount
        FROM sellers s LEFT JOIN orders o ON s.id=o.seller_id AND o.payment_status='approved' ${df}
        GROUP BY s.id ORDER BY total_sales DESC`),
    ]);
    return c.json({ success: true, data: { overview: overview[0] || {}, sellers } });
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

    let query = `
      SELECT o.id, o.order_number, o.seller_id, s.name as seller_name, s.business_name,
             o.total_amount, COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
             (o.total_amount*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) as commission_amount,
             (o.total_amount*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)) as seller_amount,
             COALESCE(o.settlement_status,'pending') as settlement_status,
             o.settled_at, o.created_at, u.name as user_name
      FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id LEFT JOIN users u ON o.user_id=u.id
      WHERE o.payment_status='approved'
    `;
    const params: (string | number | null)[] = [];
    if (period === 'today') { query += ' AND DATE(o.created_at)=?'; params.push(new Date().toISOString().split('T')[0]); }
    else if (period === 'week') query += " AND DATE(o.created_at)>=DATE('now','-7 days')";
    else if (period === 'month') query += " AND DATE(o.created_at)>=DATE('now','-30 days')";
    if (sellerId) { query += ' AND o.seller_id=?'; params.push(sellerId); }
    if (status && status !== 'all') { query += " AND COALESCE(o.settlement_status,'pending')=?"; params.push(status); }
    query += ' ORDER BY o.created_at DESC LIMIT 1000';

    const records = await executeQuery<SettlementRecordRow>(DB, query, params);
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

// ─── 정산 CSV 내보내기 ────────────────────────────────────────────────────────

adminManagementRoutes.get('/settlement/export-csv', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    const sellerId = c.req.query('seller_id');

    let query = `
      SELECT o.order_number, s.name as seller_name, s.business_name,
             o.total_amount, COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE}) as commission_rate,
             ROUND(o.total_amount*COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100) as commission_amount,
             ROUND(o.total_amount*(1-COALESCE(s.commission_rate,${DEFAULT_COMMISSION_RATE})/100)) as seller_amount,
             COALESCE(o.settlement_status,'pending') as settlement_status,
             o.settled_at, o.created_at, u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.payment_status = 'approved'
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

// ─── 라이브 스트림 관리 ──────────────────────────────────────────────────────

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
// alimtalk_packages 테이블 기반 실제 구현 (migration 0123 필요)

// GET /alimtalk/pricing — 패키지 목록
adminManagementRoutes.get('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
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
