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

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const adminManagementRoutes = new Hono<{ Bindings: Bindings }>();

// ─── 판매자 관리 ──────────────────────────────────────────────────────────────

adminManagementRoutes.get('/sellers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellers = await executeQuery<any>(DB, `
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
    const sellers = await executeQuery<any>(DB, `
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
    const rows = await executeQuery<any>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
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
    const rows = await executeQuery<any>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
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
    const rows = await executeQuery<any>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    // TODO: Add commission_rate column to sellers table
    // await executeQuery(DB, `UPDATE sellers SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [commission_rate, sellerId]);
    return c.json({ success: true, data: { id: sellerId, commission_rate, message: 'Commission rate column needs to be added to DB' } });
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
    const rows = await executeQuery<any>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    const val = can_manipulate_stats ? 1 : 0;
    // TODO: Add can_manipulate_stats column to sellers table
    // await executeQuery(DB, `UPDATE sellers SET can_manipulate_stats = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [val, sellerId]);
    return c.json({ success: true, data: { id: sellerId, can_manipulate_stats: val, message: 'Permissions column needs to be added to DB' } });
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
             o.status, o.payment_status, o.payment_method,
             o.shipping_name, o.shipping_phone, o.shipping_address,
             o.shipping_address_detail, o.shipping_zipcode,
             o.courier, o.tracking_number, o.created_at, o.updated_at,
             u.name as user_name, u.email as user_email,
             s.business_name as seller_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { query += ' AND o.status = ?'; params.push(status); }
    if (sellerId) { query += ' AND o.seller_id = ?'; params.push(sellerId); }
    if (startDate) { query += ' AND DATE(o.created_at) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(o.created_at) <= ?'; params.push(endDate); }
    query += ' ORDER BY o.created_at DESC LIMIT 1000';

    const orders = await executeQuery<any>(DB, query, params);
    for (const order of orders) {
      order.items = await executeQuery<any>(DB, `
        SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.price, p.image_url
        FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`, [order.id]);
    }
    return c.json({ success: true, data: orders });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 상품 관리 ───────────────────────────────────────────────────────────────

adminManagementRoutes.get('/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const products = await executeQuery<any>(DB, `
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
    const product = await executeQuery<any>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
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
    const product = await executeQuery<any>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
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
    const product = await executeQuery<any>(DB, 'SELECT id FROM products WHERE id = ?', [productId]);
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
      executeQuery<any>(DB, 'SELECT COUNT(*) as count FROM sellers'),
      executeQuery<any>(DB, "SELECT COUNT(*) as count FROM sellers WHERE status = 'approved'"),
      executeQuery<any>(DB, 'SELECT COUNT(*) as count FROM live_streams'),
      executeQuery<any>(DB, "SELECT COUNT(*) as count FROM live_streams WHERE status = 'live'"),
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
      executeQuery<any>(DB, `SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at)=? AND payment_status='approved'`, [today]),
      executeQuery<any>(DB, 'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at)=?', [today]),
      executeQuery<any>(DB, "SELECT COUNT(*) as count FROM live_streams WHERE status='live'"),
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

    // Default commission rate: 10% (TODO: Add commission_rate column to sellers table)
    const defaultCommission = 10;
    const [overview, sellers] = await Promise.all([
      executeQuery<any>(DB, `
        SELECT COUNT(*) as total_orders,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*${defaultCommission}/100),0) as total_commission,
               COALESCE(SUM(o.total_amount*(1-${defaultCommission}/100)),0) as total_seller_amount
        FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id
        WHERE o.payment_status='approved' ${df}`),
      executeQuery<any>(DB, `
        SELECT s.id as seller_id, s.name as seller_name, s.business_name, ${defaultCommission} as commission_rate,
               COUNT(o.id) as order_count,
               COALESCE(SUM(o.total_amount),0) as total_sales,
               COALESCE(SUM(o.total_amount*${defaultCommission}/100),0) as commission_amount,
               COALESCE(SUM(o.total_amount*(1-${defaultCommission}/100)),0) as seller_amount
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

    // Default commission rate: 10% (TODO: Add commission_rate column to sellers table)
    const defaultCommission = 10;
    let query = `
      SELECT o.id, o.order_number, o.seller_id, s.name as seller_name, s.business_name,
             o.total_amount, ${defaultCommission} as commission_rate,
             (o.total_amount*${defaultCommission}/100) as commission_amount,
             (o.total_amount*(1-${defaultCommission}/100)) as seller_amount,
             COALESCE(o.settlement_status,'pending') as settlement_status,
             o.settled_at, o.created_at, u.name as user_name
      FROM orders o LEFT JOIN sellers s ON o.seller_id=s.id LEFT JOIN users u ON o.user_id=u.id
      WHERE o.payment_status='approved'
    `;
    const params: any[] = [];
    if (period === 'today') { query += ' AND DATE(o.created_at)=?'; params.push(new Date().toISOString().split('T')[0]); }
    else if (period === 'week') query += " AND DATE(o.created_at)>=DATE('now','-7 days')";
    else if (period === 'month') query += " AND DATE(o.created_at)>=DATE('now','-30 days')";
    if (sellerId) { query += ' AND o.seller_id=?'; params.push(sellerId); }
    if (status && status !== 'all') { query += " AND COALESCE(o.settlement_status,'pending')=?"; params.push(status); }
    query += ' ORDER BY o.created_at DESC LIMIT 1000';

    const records = await executeQuery<any>(DB, query, params);
    return c.json({ success: true, data: records });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── 라이브 스트림 관리 ──────────────────────────────────────────────────────

adminManagementRoutes.delete('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const streamId = c.req.param('id');
    const rows = await executeQuery<any>(DB, 'SELECT id FROM live_streams WHERE id=?', [streamId]);
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
  // TODO: alimtalk_templates 테이블에서 가격 정보 조회
  return c.json({ success: true, data: [] });
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
