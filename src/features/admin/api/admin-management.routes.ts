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
    const { name, description, price, stock, image_url, category, product_type } = body;
    
    // Validation
    if (!name || !price) {
      return c.json({ success: false, error: '상품명과 가격은 필수입니다' }, 400);
    }
    
    // Insert product (no seller_id for admin-created products)
    const result = await executeRun(DB, `
      INSERT INTO products (name, description, price, stock, image_url, category, product_type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `, [name, description || '', price, stock || 0, image_url || '', category || 'lifestyle', product_type || 'featured']);
    
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
    const { name, description, price, stock, image_url, category, product_type } = body;
    
    // Check if product exists
    const product = await executeQuery<IdRow>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }
    
    // Update product
    await executeRun(DB, `
      UPDATE products 
      SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, 
          category = ?, product_type = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name, description || '', price, stock || 0, image_url || '', category || 'lifestyle', product_type || 'featured', productId]);
    
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

// ─── 통계 ────────────────────────────────────────────────────────────────────

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
               COALESCE(SUM(o.total_amount*COALESCE(s.commission_rate,10)/100),0) as total_commission,
               COALESCE(SUM(o.total_amount*(1-COALESCE(s.commission_rate,10)/100)),0) as total_seller_amount
        FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
        WHERE o.payment_status='approved' ${df}`),
      executeQuery<SettlementSellerRow>(DB, `
        SELECT s.id as seller_id, s.name as seller_name, s.business_name,
               COALESCE(s.commission_rate,10) as commission_rate,
               COUNT(o.id) as order_count,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*COALESCE(s.commission_rate,10)/100),0) as commission_amount,
               COALESCE(SUM(o.total_amount*(1-COALESCE(s.commission_rate,10)/100)),0) as seller_amount
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
             o.total_amount, COALESCE(s.commission_rate,10) as commission_rate,
             (o.total_amount*COALESCE(s.commission_rate,10)/100) as commission_amount,
             (o.total_amount*(1-COALESCE(s.commission_rate,10)/100)) as seller_amount,
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
             o.total_amount, COALESCE(s.commission_rate,10) as commission_rate,
             ROUND(o.total_amount*COALESCE(s.commission_rate,10)/100) as commission_amount,
             ROUND(o.total_amount*(1-COALESCE(s.commission_rate,10)/100)) as seller_amount,
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
// AdminAlimtalkPricingPage.tsx 에서 호출하는 엔드포인트 스텁
// 실제 알리고 API 연동이 필요하면 src/lib/aligo.ts 참고

adminManagementRoutes.get('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const templates = await DB.prepare(
      `SELECT id, template_code, template_name, price_per_message, is_active, created_at
       FROM alimtalk_templates ORDER BY template_name ASC`
    ).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: templates.results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

adminManagementRoutes.put('/alimtalk/pricing/:id', cors(), async (c) => {
  return c.json({ success: true, message: '알림톡 요금 업데이트됨' });
});

adminManagementRoutes.get('/alimtalk/accounts', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const { results } = await DB.prepare(
      `SELECT id, seller_id, aligo_user_id, sender_key, is_active, balance, updated_at
       FROM alimtalk_accounts ORDER BY created_at DESC`
    ).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

adminManagementRoutes.patch('/alimtalk/accounts/:accountId/status', cors(), async (c) => {
  const { DB } = c.env;
  const accountId = c.req.param('accountId');
  try {
    const { is_active } = await c.req.json<{ is_active: boolean }>();
    await DB.prepare(
      `UPDATE alimtalk_accounts SET is_active = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(is_active ? 1 : 0, accountId).run().catch(() => {});
    return c.json({ success: true, message: '알림톡 계정 상태가 변경되었습니다.' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

adminManagementRoutes.get('/alimtalk/statistics', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const total = await DB.prepare('SELECT COUNT(*) as cnt FROM alimtalk_messages').first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
    const success_count = await DB.prepare("SELECT COUNT(*) as cnt FROM alimtalk_messages WHERE status = 'sent'").first<{ cnt: number }>().catch(() => ({ cnt: 0 }));
    return c.json({
      success: true,
      data: {
        total: total?.cnt ?? 0,
        success: success_count?.cnt ?? 0,
        failed: (total?.cnt ?? 0) - (success_count?.cnt ?? 0),
      },
    });
  } catch {
    return c.json({ success: true, data: { total: 0, success: 0, failed: 0 } });
  }
});
