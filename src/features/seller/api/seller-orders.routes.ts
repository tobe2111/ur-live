/**
 * Seller Orders API Routes
 * 
 * Endpoints:
 * - GET /api/seller/orders - 셀러 주문 목록 조회
 * - PUT /api/seller/orders/:id/status - 주문 상태 업데이트 (배송 상태)
 * - GET /api/seller/products - 셀러 상품 목록 조회
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const sellerOrdersRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
sellerOrdersRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

/**
 * JWT 토큰에서 셀러 ID 추출
 */
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number };
    return payload.seller_id || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * GET /api/seller/orders
 * 셀러 주문 목록 조회
 */
sellerOrdersRoutes.get('/orders', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;
    
    // 쿼리 파라미터
    const status = c.req.query('status'); // pending, confirmed, shipped, delivered, cancelled
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = c.req.query('sort') || 'desc'; // desc, asc

    let query = `
      SELECT 
        o.id,
        o.user_id,
        o.product_id,
        o.quantity,
        o.total_price,
        o.status,
        o.shipping_address,
        o.tracking_number,
        o.created_at,
        o.updated_at,
        p.name as product_name,
        p.image as product_image,
        p.price as product_price,
        u.username as user_name,
        u.email as user_email
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE p.seller_id = ?
    `;

    const params: any[] = [sellerId];

    // 상태 필터
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    // 정렬
    query += ` ORDER BY o.created_at ${sort.toUpperCase()}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const orders = await db.prepare(query).bind(...params).all();

    // 전체 개수 조회
    let countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ?
    `;
    const countParams: any[] = [sellerId];
    if (status) {
      countQuery += ' AND o.status = ?';
      countParams.push(status);
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      orders: orders.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total || 0) > (offset + limit)
      }
    });

  } catch (error: any) {
    console.error('Get seller orders error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get seller orders'
    }, 500);
  }
});

/**
 * PUT /api/seller/orders/:id/status
 * 주문 상태 업데이트
 */
sellerOrdersRoutes.put('/orders/:id/status', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const orderId = parseInt(c.req.param('id'));
    const body = await c.req.json<{ status: string; tracking_number?: string }>();
    const { status, tracking_number } = body;

    // 상태 검증
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return c.json({
        success: false,
        error: 'Invalid status. Must be one of: pending, confirmed, shipped, delivered, cancelled'
      }, 400);
    }

    const db = c.env.DB;

    // 주문이 해당 셀러의 상품인지 확인
    const order = await db.prepare(`
      SELECT o.*, p.seller_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).bind(orderId).first<Record<string, any>>();

    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found'
      }, 404);
    }

    if (order.seller_id !== sellerId) {
      return c.json({
        success: false,
        error: 'Forbidden: This order does not belong to you'
      }, 403);
    }

    // 주문 상태 업데이트
    let updateQuery = `
      UPDATE orders
      SET status = ?, updated_at = datetime('now')
    `;
    const params: any[] = [status];

    // 배송 번호가 있으면 함께 업데이트
    if (tracking_number) {
      updateQuery += ', tracking_number = ?';
      params.push(tracking_number);
    }

    updateQuery += ' WHERE id = ?';
    params.push(orderId);

    const result = await db.prepare(updateQuery).bind(...params).run();

    if (!result.success) {
      throw new Error('Failed to update order status');
    }

    // 업데이트된 주문 정보 조회
    const updatedOrder = await db.prepare(`
      SELECT 
        o.id,
        o.user_id,
        o.product_id,
        o.quantity,
        o.total_price,
        o.status,
        o.shipping_address,
        o.tracking_number,
        o.created_at,
        o.updated_at,
        p.name as product_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).bind(orderId).first<{ total: number }>();

    return c.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });

  } catch (error: any) {
    console.error('Update order status error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to update order status'
    }, 500);
  }
});

/**
 * GET /api/seller/products
 * 셀러 상품 목록 조회
 */
sellerOrdersRoutes.get('/products', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;
    
    // 쿼리 파라미터
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    const sort = c.req.query('sort') || 'desc'; // desc, asc
    const search = c.req.query('search') || '';

    let query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image,
        p.category,
        p.created_at,
        p.updated_at,
        COUNT(o.id) as order_count,
        SUM(CASE WHEN o.status != 'cancelled' THEN o.quantity ELSE 0 END) as total_sold
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      WHERE p.seller_id = ?
    `;

    const params: any[] = [sellerId];

    // 검색
    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY p.id, p.name, p.description, p.price, p.stock, p.image, p.category, p.created_at, p.updated_at`;
    query += ` ORDER BY p.created_at ${sort.toUpperCase()}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const products = await db.prepare(query).bind(...params).all();

    // 전체 개수 조회
    let countQuery = `
      SELECT COUNT(*) as total
      FROM products
      WHERE seller_id = ?
    `;
    const countParams: any[] = [sellerId];
    if (search) {
      countQuery += ' AND (name LIKE ? OR description LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();

    return c.json({
      success: true,
      products: products.results || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total || 0) > (offset + limit)
      }
    });

  } catch (error: any) {
    console.error('Get seller products error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get seller products'
    }, 500);
  }
});
