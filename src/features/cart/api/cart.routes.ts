/**
 * Cart API Routes
 *
 * DB 테이블: cart_items (migrations/0001_initial_schema.sql)
 * 컬럼: id, user_id, product_id, option_id, quantity, price_snapshot, live_stream_id, added_at
 *
 * Endpoints:
 * - GET  /api/cart         - 장바구니 조회
 * - POST /api/cart         - 장바구니 추가
 * - PUT  /api/cart/:id     - 장바구니 수정
 * - DELETE /api/cart/:id   - 장바구니 아이템 삭제
 * - POST /api/cart/clear   - 장바구니 비우기
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  requireAuth,
  getCurrentUser,
} from '@/worker/middleware/auth';
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalServerErrorResponse,
} from '@/worker/utils/response';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
};

export const cartRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
cartRoutes.use(
  '*',
  cors({
    origin: [
      'https://live.ur-team.com',
      'https://ur-live.pages.dev',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);

// ─── Helper: users 테이블에서 DB user_id 조회 ────────────────────────────────
async function getUserDbId(
  db: D1Database,
  firebaseUid: string
): Promise<number | null> {
  const row = await db
    .prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
    .bind(firebaseUid)
    .first<{ id: number }>();
  return row?.id ?? null;
}

// ─── Helper: 상품 정보 조회 ───────────────────────────────────────────────────
async function getProduct(
  db: D1Database,
  productId: number
): Promise<{
  id: number;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
  seller_id: number;
} | null> {
  return db
    .prepare(
      'SELECT id, name, price, stock, image_url, seller_id FROM products WHERE id = ? LIMIT 1'
    )
    .bind(productId)
    .first();
}

/**
 * GET /api/cart
 * 장바구니 조회
 */
cartRoutes.get('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json(unauthorizedResponse(), 401);

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));
    if (!userId) {
      // New user with no DB record yet — return empty cart instead of 404
      return c.json(successResponse({ items: [], summary: { total_items: 0, total_amount: 0 } }));
    }

    const rows = await db
      .prepare(
        `SELECT
           ci.id,
           ci.product_id,
           ci.quantity,
           ci.price_snapshot,
           ci.option_id,
           ci.live_stream_id,
           ci.added_at,
           p.name        AS product_name,
           p.description AS product_description,
           p.price       AS product_price,
           p.image_url   AS product_image,
           p.stock       AS product_stock,
           p.seller_id,
           s.business_name AS seller_name,
           COALESCE(s.shipping_fee, 3000)        AS shipping_fee,
           COALESCE(s.free_shipping_threshold, 0) AS free_shipping_threshold
         FROM cart_items ci
         JOIN products p  ON ci.product_id = p.id
         LEFT JOIN sellers s ON p.seller_id = s.id
         WHERE ci.user_id = ?
         ORDER BY ci.added_at DESC`
      )
      .bind(userId)
      .all<{
        id: number;
        product_id: number;
        quantity: number;
        price_snapshot: number;
        option_id: number | null;
        live_stream_id: number | null;
        added_at: string;
        product_name: string;
        product_description: string;
        product_price: number;
        product_image: string | null;
        product_stock: number;
        seller_id: number;
        seller_name: string | null;
        shipping_fee: number;
        free_shipping_threshold: number;
      }>();

    const items = (rows.results ?? []).map((item) => ({
      ...item,
      // CheckoutPage / CartPage 에서 사용하는 필드 모두 포함
      price: item.price_snapshot ?? item.product_price,
      item_total: (item.price_snapshot ?? item.product_price) * item.quantity,
    }));

    const summary = items.reduce(
      (acc, item) => ({
        total_items: acc.total_items + item.quantity,
        total_amount: acc.total_amount + item.item_total,
      }),
      { total_items: 0, total_amount: 0 }
    );

    return c.json(successResponse({ items, summary }));
  } catch (error: any) {
    console.error('[Cart] GET /api/cart error:', error);
    return c.json(internalServerErrorResponse('Failed to get cart'), 500);
  }
});

/**
 * POST /api/cart
 * 장바구니 추가
 * Body: { product_id, quantity, price_snapshot?, option_id?, live_stream_id?, options? }
 * LivePageV2 호환: productId, liveStreamId, priceSnapshot 도 허용
 */
cartRoutes.post('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json(unauthorizedResponse(), 401);

    const body = await c.req.json<Record<string, any>>();

    // ── 필드명 정규화 (camelCase / snake_case 모두 수용) ──────────────────────
    const product_id: number =
      Number(body.product_id ?? body.productId ?? 0);
    const quantity: number =
      Number(body.quantity ?? 1);
    const price_snapshot: number | null =
      body.price_snapshot != null
        ? Number(body.price_snapshot)
        : body.priceSnapshot != null
        ? Number(body.priceSnapshot)
        : null;
    const option_id: number | null =
      body.option_id != null
        ? Number(body.option_id)
        : body.optionId != null
        ? Number(body.optionId)
        : null;
    const live_stream_id: number | null =
      body.live_stream_id != null
        ? Number(body.live_stream_id)
        : body.liveStreamId != null
        ? Number(body.liveStreamId)
        : null;

    // ── 기본 Validation ───────────────────────────────────────────────────────
    if (!product_id || product_id < 1) {
      return c.json(badRequestResponse('product_id is required'), 400);
    }
    if (!quantity || quantity < 1) {
      return c.json(badRequestResponse('quantity must be at least 1'), 400);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));
    if (!userId) return c.json(notFoundResponse('User'), 404);

    // ── 상품 존재 및 재고 확인 ────────────────────────────────────────────────
    const product = await getProduct(db, product_id);
    if (!product) return c.json(notFoundResponse('Product'), 404);

    if (product.stock < quantity) {
      return c.json(badRequestResponse('Insufficient stock'), 400);
    }

    // ── 이미 장바구니에 있는지 확인 ──────────────────────────────────────────
    const existing = await db
      .prepare(
        'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1'
      )
      .bind(userId, product_id)
      .first<{ id: number; quantity: number }>();

    const snapshot = price_snapshot ?? product.price;

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (product.stock < newQty) {
        return c.json(badRequestResponse('Insufficient stock'), 400);
      }

      await db
        .prepare(
          'UPDATE cart_items SET quantity = ?, price_snapshot = ? WHERE id = ?'
        )
        .bind(newQty, snapshot, existing.id)
        .run();

      return c.json(
        successResponse(
          { id: existing.id, product_id, quantity: newQty, price_snapshot: snapshot },
          'Cart item updated'
        )
      );
    }

    // ── 새 아이템 추가 ────────────────────────────────────────────────────────
    const result = await db
      .prepare(
        `INSERT INTO cart_items (user_id, product_id, quantity, price_snapshot, option_id, live_stream_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, product_id, quantity, snapshot, option_id, live_stream_id)
      .run();

    return c.json(
      createdResponse(
        {
          id: result.meta.last_row_id,
          product_id,
          quantity,
          price_snapshot: snapshot,
        },
        'Item added to cart'
      ),
      201
    );
  } catch (error: any) {
    console.error('[Cart] POST /api/cart error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to add item to cart',
        message: error.message,
      },
      500
    );
  }
});

/**
 * PUT /api/cart/:id
 * 수량 변경
 */
cartRoutes.put('/:id', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json(unauthorizedResponse(), 401);

    const cartItemId = Number(c.req.param('id'));
    if (!cartItemId || cartItemId < 1)
      return c.json(badRequestResponse('Invalid cart item id'), 400);

    const body = await c.req.json<{ quantity?: number }>();
    const quantity = body.quantity != null ? Number(body.quantity) : undefined;

    if (quantity === undefined)
      return c.json(badRequestResponse('quantity is required'), 400);
    if (quantity < 1)
      return c.json(badRequestResponse('quantity must be at least 1'), 400);

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));
    if (!userId) return c.json(notFoundResponse('User'), 404);

    // 소유권 확인
    const item = await db
      .prepare(
        `SELECT ci.id, ci.product_id, p.stock
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
          WHERE ci.id = ? AND ci.user_id = ? LIMIT 1`
      )
      .bind(cartItemId, userId)
      .first<{ id: number; product_id: number; stock: number }>();

    if (!item) return c.json(notFoundResponse('Cart item'), 404);
    if (item.stock < quantity)
      return c.json(badRequestResponse('Insufficient stock'), 400);

    await db
      .prepare('UPDATE cart_items SET quantity = ? WHERE id = ?')
      .bind(quantity, cartItemId)
      .run();

    return c.json(successResponse({ id: cartItemId, quantity }, 'Cart item updated'));
  } catch (error: any) {
    console.error('[Cart] PUT /api/cart/:id error:', error);
    return c.json(internalServerErrorResponse('Failed to update cart item'), 500);
  }
});

/**
 * DELETE /api/cart/:id
 * 아이템 삭제
 */
cartRoutes.delete('/:id', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json(unauthorizedResponse(), 401);

    const cartItemId = Number(c.req.param('id'));
    if (!cartItemId || cartItemId < 1)
      return c.json(badRequestResponse('Invalid cart item id'), 400);

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));
    if (!userId) return c.json(notFoundResponse('User'), 404);

    const item = await db
      .prepare('SELECT id FROM cart_items WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(cartItemId, userId)
      .first<{ id: number }>();

    if (!item) return c.json(notFoundResponse('Cart item'), 404);

    await db
      .prepare('DELETE FROM cart_items WHERE id = ?')
      .bind(cartItemId)
      .run();

    return c.json(successResponse(null, 'Cart item deleted'));
  } catch (error: any) {
    console.error('[Cart] DELETE /api/cart/:id error:', error);
    return c.json(internalServerErrorResponse('Failed to delete cart item'), 500);
  }
});

/**
 * POST /api/cart/clear
 * 장바구니 비우기
 */
cartRoutes.post('/clear', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json(unauthorizedResponse(), 401);

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));
    if (!userId) return c.json(notFoundResponse('User'), 404);

    await db
      .prepare('DELETE FROM cart_items WHERE user_id = ?')
      .bind(userId)
      .run();

    return c.json(successResponse(null, 'Cart cleared'));
  } catch (error: any) {
    console.error('[Cart] POST /api/cart/clear error:', error);
    return c.json(internalServerErrorResponse('Failed to clear cart'), 500);
  }
});
