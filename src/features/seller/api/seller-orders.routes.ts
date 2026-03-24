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
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const sellerOrdersRoutes = new Hono<{ Bindings: Bindings }>();

sellerOrdersRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

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

/** DB status 값과 프론트엔드 status 값 매핑 */
const STATUS_MAP: Record<string, string> = {
  PAY_COMPLETE: 'DONE',   // 프론트 → DB
  PAID: 'DONE',
};
const VALID_STATUSES = ['PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'DONE', 'PAID', 'PENDING'];

// ─── GET /api/seller/orders ────────────────────────────────────────────────
sellerOrdersRoutes.get('/orders', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
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
        o.tracking_company  AS courier,
        o.payment_method,
        o.created_at,
        o.updated_at,
        u.username          AS user_name,
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
async function handleStatusUpdate(c: any) {
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

    // order_number 또는 id 로 조회 (프론트가 order_number 를 id 자리에 넣는 경우 대비)
    const order = await db.prepare(
      `SELECT id, seller_id FROM orders WHERE (id = ? OR order_number = ?) LIMIT 1`
    ).bind(orderId, orderId).first<{ id: string; seller_id: string }>();

    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (String(order.seller_id) !== sellerId) return c.json({ success: false, error: 'Forbidden' }, 403);

    await db.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(dbStatus, order.id).run();

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

    const order = await db.prepare(
      `SELECT id, seller_id FROM orders WHERE (id = ? OR order_number = ?) LIMIT 1`
    ).bind(orderId, orderId).first<{ id: string; seller_id: string }>();

    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
    if (String(order.seller_id) !== sellerId) return c.json({ success: false, error: 'Forbidden' }, 403);

    await db.prepare(
      `UPDATE orders
       SET tracking_number = ?, tracking_company = ?, status = 'SHIPPING', updated_at = datetime('now')
       WHERE id = ?`
    ).bind(tracking_number, courier || null, order.id).run();

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
        COALESCE(p.thumbnail_url, p.image_url, p.image)           AS image_url,
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
        AND COALESCE(p.status, 'ACTIVE') != 'DELETED'
    `;
    const params: unknown[] = [sellerId];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at ${sort} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const products = await db.prepare(query).bind(...params).all();

    let countQuery = `SELECT COUNT(*) as total FROM products WHERE seller_id = ? AND COALESCE(status, 'ACTIVE') != 'DELETED'`;
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
    }>();

    const { name, description, price, stock, image_url, category } = body;
    if (!name || price === undefined) {
      return c.json({ success: false, error: '상품명과 가격은 필수입니다.' }, 400);
    }

    // slug 생성: 이름 기반 + 타임스탬프 suffix (중복 방지)
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'product';
    const slug = `${baseSlug}-${Date.now()}`;

    const db = c.env.DB;

    // 신규 스키마 우선, 구 스키마 fallback
    let result: D1Result;
    try {
      result = await db.prepare(`
        INSERT INTO products
          (seller_id, name, slug, description, price, stock_quantity, thumbnail_url, image_url, category, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'))
      `).bind(
        sellerId, name, slug, description || null, price,
        stock ?? 0, image_url || null, image_url || null, category || null
      ).run();
    } catch {
      // 구 스키마 (stock, image 컬럼): slug 컬럼 없을 경우
      result = await db.prepare(`
        INSERT INTO products
          (seller_id, name, description, price, stock, image, image_url, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        sellerId, name, description || null, price,
        stock ?? 0, image_url || null, image_url || null, category || null
      ).run();
    }

    if (!result.success) throw new Error('Failed to create product');

    const newProduct = await db.prepare(
      `SELECT id, seller_id, name, description, price,
              COALESCE(stock_quantity, stock, 0) AS stock,
              COALESCE(thumbnail_url, image_url, image) AS image_url,
              category, created_at, updated_at
       FROM products WHERE id = ?`
    ).bind(result.meta.last_row_id).first<Record<string, unknown>>();

    return c.json({ success: true, data: newProduct }, 201);
  } catch (error: unknown) {
    console.error('Create seller product error:', error);
    return c.json({ success: false, error: (error as Error).message || 'Failed to create product' }, 500);
  }
});
