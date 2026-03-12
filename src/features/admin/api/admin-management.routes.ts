/**
 * Admin Management API Routes
 * 
 * Comprehensive endpoints for admin dashboard:
 * - GET /sellers - 모든 판매자 조회
 * - GET /sellers/pending - 승인 대기 중인 판매자 조회
 * - PATCH /sellers/:id/approve - 판매자 승인
 * - PATCH /sellers/:id/reject - 판매자 거부
 * - PATCH /sellers/:id/commission - 판매자 수수료율 변경
 * - PATCH /sellers/:id/permissions - 판매자 권한 변경
 * - GET /orders - 모든 주문 조회
 * - GET /products - 모든 상품 조회
 * - GET /stats - 대시보드 통계
 * - GET /dashboard/stats - 실시간 대시보드 통계
 * - GET /settlement/stats - 정산 통계
 * - GET /settlement/records - 정산 기록
 * - DELETE /streams/:id - 라이브 스트림 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyAdminToken } from '@/worker/middleware/auth';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { executeQuery } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const adminManagementRoutes = new Hono<{ Bindings: Bindings }>();

// =================================
// 판매자 관리 (Seller Management)
// =================================

/**
 * GET /api/admin/sellers
 * 모든 판매자 조회
 */
adminManagementRoutes.get('/sellers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    console.log('[Admin] 📋 Fetching all sellers');
    
    const sellers = await executeQuery<any>(
      DB,
      `SELECT 
        id, email, username, name, phone, business_name, business_number, 
        company_name, status, commission_rate, can_manipulate_stats, created_at
      FROM sellers
      ORDER BY created_at DESC`
    );
    
    console.log(`[Admin] ✅ Found ${sellers.length} sellers`);
    
    return successResponse(c, sellers, 'Sellers retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to fetch sellers:', error);
    return internalServerErrorResponse(c, '판매자 목록 조회 실패');
  }
});

/**
 * GET /api/admin/sellers/pending
 * 승인 대기 중인 판매자 조회
 */
adminManagementRoutes.get('/sellers/pending', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    console.log('[Admin] ⏳ Fetching pending sellers');
    
    const pendingSellers = await executeQuery<any>(
      DB,
      `SELECT 
        id, email, username, name, phone, business_name, business_number,
        company_name, status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC`
    );
    
    console.log(`[Admin] ✅ Found ${pendingSellers.length} pending sellers`);
    
    return successResponse(c, pendingSellers, 'Pending sellers retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to fetch pending sellers:', error);
    return internalServerErrorResponse(c, '대기 중인 판매자 조회 실패');
  }
});

/**
 * PATCH /api/admin/sellers/:id/approve
 * 판매자 승인
 */
adminManagementRoutes.patch('/sellers/:id/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    
    console.log('[Admin] ✅ Approving seller:', sellerId);
    
    // Check if seller exists
    const sellers = await executeQuery<any>(
      DB,
      'SELECT id, email, status FROM sellers WHERE id = ?',
      [sellerId]
    );
    
    if (sellers.length === 0) {
      return notFoundResponse(c, '판매자를 찾을 수 없습니다');
    }
    
    const seller = sellers[0];
    
    if (seller.status === 'approved') {
      return badRequestResponse(c, '이미 승인된 판매자입니다');
    }
    
    // Update seller status
    await executeQuery(
      DB,
      'UPDATE sellers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', sellerId]
    );
    
    console.log('[Admin] ✅ Seller approved:', sellerId);
    
    // TODO: Send approval email to seller
    
    return successResponse(c, { id: sellerId, status: 'approved' }, '판매자가 승인되었습니다');
  } catch (error) {
    console.error('[Admin] ❌ Failed to approve seller:', error);
    return internalServerErrorResponse(c, '판매자 승인 실패');
  }
});

/**
 * PATCH /api/admin/sellers/:id/reject
 * 판매자 거부
 */
adminManagementRoutes.patch('/sellers/:id/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const body = await c.req.json();
    const { reason } = body;
    
    console.log('[Admin] ❌ Rejecting seller:', sellerId, 'Reason:', reason);
    
    // Check if seller exists
    const sellers = await executeQuery<any>(
      DB,
      'SELECT id, email, status FROM sellers WHERE id = ?',
      [sellerId]
    );
    
    if (sellers.length === 0) {
      return notFoundResponse(c, '판매자를 찾을 수 없습니다');
    }
    
    // Update seller status
    await executeQuery(
      DB,
      'UPDATE sellers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['rejected', sellerId]
    );
    
    console.log('[Admin] ✅ Seller rejected:', sellerId);
    
    // TODO: Send rejection email with reason
    
    return successResponse(c, { id: sellerId, status: 'rejected' }, '판매자 승인이 거부되었습니다');
  } catch (error) {
    console.error('[Admin] ❌ Failed to reject seller:', error);
    return internalServerErrorResponse(c, '판매자 거부 실패');
  }
});

/**
 * PATCH /api/admin/sellers/:id/commission
 * 판매자 수수료율 변경
 */
adminManagementRoutes.patch('/sellers/:id/commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const body = await c.req.json();
    const { commission_rate } = body;
    
    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 100) {
      return badRequestResponse(c, '수수료율은 0~100 사이의 값이어야 합니다');
    }
    
    console.log('[Admin] 💰 Updating commission rate for seller:', sellerId, 'to', commission_rate);
    
    // Check if seller exists
    const sellers = await executeQuery<any>(
      DB,
      'SELECT id FROM sellers WHERE id = ?',
      [sellerId]
    );
    
    if (sellers.length === 0) {
      return notFoundResponse(c, '판매자를 찾을 수 없습니다');
    }
    
    // Update commission rate
    await executeQuery(
      DB,
      'UPDATE sellers SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [commission_rate, sellerId]
    );
    
    console.log('[Admin] ✅ Commission rate updated');
    
    return successResponse(
      c,
      { id: sellerId, commission_rate },
      `수수료율이 ${commission_rate}%로 변경되었습니다`
    );
  } catch (error) {
    console.error('[Admin] ❌ Failed to update commission rate:', error);
    return internalServerErrorResponse(c, '수수료율 변경 실패');
  }
});

/**
 * PATCH /api/admin/sellers/:id/permissions
 * 판매자 특수 권한 변경 (시청자 수 조작, 가짜 알림 등)
 */
adminManagementRoutes.patch('/sellers/:id/permissions', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    const body = await c.req.json();
    const { can_manipulate_stats } = body;
    
    if (can_manipulate_stats === undefined || ![0, 1].includes(can_manipulate_stats)) {
      return badRequestResponse(c, 'can_manipulate_stats는 0 또는 1이어야 합니다');
    }
    
    console.log('[Admin] 🎭 Updating permissions for seller:', sellerId, 'can_manipulate_stats:', can_manipulate_stats);
    
    // Check if seller exists
    const sellers = await executeQuery<any>(
      DB,
      'SELECT id FROM sellers WHERE id = ?',
      [sellerId]
    );
    
    if (sellers.length === 0) {
      return notFoundResponse(c, '판매자를 찾을 수 없습니다');
    }
    
    // Update permissions
    await executeQuery(
      DB,
      'UPDATE sellers SET can_manipulate_stats = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [can_manipulate_stats, sellerId]
    );
    
    console.log('[Admin] ✅ Permissions updated');
    
    return successResponse(
      c,
      { id: sellerId, can_manipulate_stats },
      `권한이 ${can_manipulate_stats ? '승인' : '해제'}되었습니다`
    );
  } catch (error) {
    console.error('[Admin] ❌ Failed to update permissions:', error);
    return internalServerErrorResponse(c, '권한 변경 실패');
  }
});

// =================================
// 주문 관리 (Order Management)
// =================================

/**
 * GET /api/admin/orders
 * 모든 주문 조회
 */
adminManagementRoutes.get('/orders', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    // Query parameters for filtering
    const status = c.req.query('status');
    const sellerId = c.req.query('seller_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    
    console.log('[Admin] 📦 Fetching orders with filters:', { status, sellerId, startDate, endDate });
    
    let query = `
      SELECT 
        o.id, o.order_number, o.user_id, o.seller_id, o.total_amount,
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
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    if (sellerId) {
      query += ' AND o.seller_id = ?';
      params.push(sellerId);
    }
    
    if (startDate) {
      query += ' AND DATE(o.created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(o.created_at) <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT 1000';
    
    const orders = await executeQuery<any>(DB, query, params);
    
    // Get order items for each order
    for (const order of orders) {
      const items = await executeQuery<any>(
        DB,
        `SELECT 
          oi.id, oi.product_id, oi.product_name, oi.quantity, oi.price,
          p.image_url
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }
    
    console.log(`[Admin] ✅ Found ${orders.length} orders`);
    
    return successResponse(c, orders, 'Orders retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to fetch orders:', error);
    return internalServerErrorResponse(c, '주문 목록 조회 실패');
  }
});

// =================================
// 상품 관리 (Product Management)
// =================================

/**
 * GET /api/admin/products
 * 모든 상품 조회
 */
adminManagementRoutes.get('/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    console.log('[Admin] 🏷️ Fetching all products');
    
    const products = await executeQuery<any>(
      DB,
      `SELECT 
        p.id, p.name, p.description, p.price, p.stock,
        p.image_url, p.is_active, p.product_type, p.category,
        p.seller_id, p.created_at,
        s.business_name as seller_name
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 1000`
    );
    
    console.log(`[Admin] ✅ Found ${products.length} products`);
    
    return successResponse(c, products, 'Products retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to fetch products:', error);
    return internalServerErrorResponse(c, '상품 목록 조회 실패');
  }
});

// =================================
// 통계 (Statistics)
// =================================

/**
 * GET /api/admin/stats
 * 대시보드 통계
 */
adminManagementRoutes.get('/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    console.log('[Admin] 📊 Calculating dashboard statistics');
    
    // Total sellers
    const totalSellersResult = await executeQuery<any>(
      DB,
      'SELECT COUNT(*) as count FROM sellers'
    );
    const totalSellers = totalSellersResult[0]?.count || 0;
    
    // Active sellers (approved)
    const activeSellersResult = await executeQuery<any>(
      DB,
      "SELECT COUNT(*) as count FROM sellers WHERE status = 'approved'"
    );
    const activeSellers = activeSellersResult[0]?.count || 0;
    
    // Total streams
    const totalStreamsResult = await executeQuery<any>(
      DB,
      'SELECT COUNT(*) as count FROM live_streams'
    );
    const totalStreams = totalStreamsResult[0]?.count || 0;
    
    // Active streams (live)
    const activeStreamsResult = await executeQuery<any>(
      DB,
      "SELECT COUNT(*) as count FROM live_streams WHERE status = 'live'"
    );
    const activeStreams = activeStreamsResult[0]?.count || 0;
    
    const stats = {
      totalSellers,
      activeSellers,
      totalStreams,
      activeStreams
    };
    
    console.log('[Admin] ✅ Statistics calculated:', stats);
    
    return successResponse(c, stats, 'Statistics retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to calculate statistics:', error);
    return internalServerErrorResponse(c, '통계 조회 실패');
  }
});

/**
 * GET /api/admin/dashboard/stats
 * 실시간 대시보드 통계 (오늘 매출, 주문, 방문자, 라이브 등)
 */
adminManagementRoutes.get('/dashboard/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    console.log('[Admin] 📊 Calculating real-time dashboard statistics');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Today's sales
    const todaySalesResult = await executeQuery<any>(
      DB,
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM orders
       WHERE DATE(created_at) = ?
       AND payment_status = 'approved'`,
      [today]
    );
    const todaySales = todaySalesResult[0]?.total || 0;
    
    // Today's orders
    const todayOrdersResult = await executeQuery<any>(
      DB,
      `SELECT COUNT(*) as count
       FROM orders
       WHERE DATE(created_at) = ?`,
      [today]
    );
    const todayOrders = todayOrdersResult[0]?.count || 0;
    
    // Current visitors (mock - would need real analytics integration)
    const currentVisitors = Math.floor(Math.random() * 100) + 50;
    
    // Live streams
    const liveStreamsResult = await executeQuery<any>(
      DB,
      "SELECT COUNT(*) as count FROM live_streams WHERE status = 'live'"
    );
    const liveStreams = liveStreamsResult[0]?.count || 0;
    
    const stats = {
      todaySales,
      todayOrders,
      currentVisitors,
      liveStreams
    };
    
    console.log('[Admin] ✅ Real-time statistics calculated:', stats);
    
    return successResponse(c, { stats }, 'Dashboard statistics retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to calculate dashboard statistics:', error);
    return internalServerErrorResponse(c, '대시보드 통계 조회 실패');
  }
});

// =================================
// 정산 관리 (Settlement Management)
// =================================

/**
 * GET /api/admin/settlement/stats
 * 정산 통계
 */
adminManagementRoutes.get('/settlement/stats', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    
    console.log('[Admin] 💰 Calculating settlement statistics for period:', period);
    
    let dateFilter = '';
    if (period === 'today') {
      const today = new Date().toISOString().split('T')[0];
      dateFilter = `AND DATE(o.created_at) = '${today}'`;
    } else if (period === 'week') {
      dateFilter = `AND DATE(o.created_at) >= DATE('now', '-7 days')`;
    } else if (period === 'month') {
      dateFilter = `AND DATE(o.created_at) >= DATE('now', '-30 days')`;
    }
    
    // Overall statistics
    const overviewResult = await executeQuery<any>(
      DB,
      `SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(SUM(o.total_amount * s.commission_rate / 100), 0) as total_commission,
        COALESCE(SUM(o.total_amount * (1 - s.commission_rate / 100)), 0) as total_seller_amount
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      WHERE o.payment_status = 'approved' ${dateFilter}`
    );
    
    const overview = overviewResult[0] || {
      total_orders: 0,
      total_sales: 0,
      total_commission: 0,
      total_seller_amount: 0
    };
    
    // Per-seller statistics
    const sellers = await executeQuery<any>(
      DB,
      `SELECT
        s.id as seller_id,
        s.name as seller_name,
        s.business_name,
        s.commission_rate,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(SUM(o.total_amount * s.commission_rate / 100), 0) as commission_amount,
        COALESCE(SUM(o.total_amount * (1 - s.commission_rate / 100)), 0) as seller_amount,
        COALESCE(SUM(CASE WHEN o.settlement_status = 'pending' THEN o.total_amount * (1 - s.commission_rate / 100) ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN o.settlement_status = 'settled' THEN o.total_amount * (1 - s.commission_rate / 100) ELSE 0 END), 0) as settled_amount
      FROM sellers s
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'approved' ${dateFilter}
      GROUP BY s.id, s.name, s.business_name, s.commission_rate
      ORDER BY total_sales DESC`
    );
    
    console.log('[Admin] ✅ Settlement statistics calculated');
    
    return successResponse(c, { overview, sellers }, 'Settlement statistics retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to calculate settlement statistics:', error);
    return internalServerErrorResponse(c, '정산 통계 조회 실패');
  }
});

/**
 * GET /api/admin/settlement/records
 * 정산 기록
 */
adminManagementRoutes.get('/settlement/records', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const period = c.req.query('period') || 'all';
    const sellerId = c.req.query('seller_id');
    const status = c.req.query('status');
    
    console.log('[Admin] 📋 Fetching settlement records');
    
    let query = `
      SELECT
        o.id,
        o.order_number,
        o.seller_id,
        s.name as seller_name,
        s.business_name,
        o.total_amount,
        s.commission_rate,
        (o.total_amount * s.commission_rate / 100) as commission_amount,
        (o.total_amount * (1 - s.commission_rate / 100)) as seller_amount,
        COALESCE(o.settlement_status, 'pending') as settlement_status,
        o.settled_at,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.payment_status = 'approved'
    `;
    
    const params: any[] = [];
    
    if (period === 'today') {
      const today = new Date().toISOString().split('T')[0];
      query += ' AND DATE(o.created_at) = ?';
      params.push(today);
    } else if (period === 'week') {
      query += " AND DATE(o.created_at) >= DATE('now', '-7 days')";
    } else if (period === 'month') {
      query += " AND DATE(o.created_at) >= DATE('now', '-30 days')";
    }
    
    if (sellerId) {
      query += ' AND o.seller_id = ?';
      params.push(sellerId);
    }
    
    if (status && status !== 'all') {
      query += ' AND COALESCE(o.settlement_status, ?) = ?';
      params.push('pending', status);
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT 1000';
    
    const records = await executeQuery<any>(DB, query, params);
    
    console.log(`[Admin] ✅ Found ${records.length} settlement records`);
    
    return successResponse(c, records, 'Settlement records retrieved successfully');
  } catch (error) {
    console.error('[Admin] ❌ Failed to fetch settlement records:', error);
    return internalServerErrorResponse(c, '정산 기록 조회 실패');
  }
});

// =================================
// 라이브 스트림 관리 (Stream Management)
// =================================

/**
 * DELETE /api/admin/streams/:id
 * 라이브 스트림 삭제
 */
adminManagementRoutes.delete('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const streamId = c.req.param('id');
    
    console.log('[Admin] 🗑️ Deleting stream:', streamId);
    
    // Check if stream exists
    const streams = await executeQuery<any>(
      DB,
      'SELECT id FROM live_streams WHERE id = ?',
      [streamId]
    );
    
    if (streams.length === 0) {
      return notFoundResponse(c, '라이브 스트림을 찾을 수 없습니다');
    }
    
    // Delete stream
    await executeQuery(DB, 'DELETE FROM live_streams WHERE id = ?', [streamId]);
    
    console.log('[Admin] ✅ Stream deleted:', streamId);
    
    return successResponse(c, { id: streamId }, '라이브 스트림이 삭제되었습니다');
  } catch (error) {
    console.error('[Admin] ❌ Failed to delete stream:', error);
    return internalServerErrorResponse(c, '라이브 스트림 삭제 실패');
  }
});

export default adminManagementRoutes;
