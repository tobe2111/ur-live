/**
 * Wishlists API Routes
 *
 * app.route('/api/wishlists', wishlistRoutes) 에 등록됨.
 * 이 파일 내부 경로는 절대 /api/wishlists 를 포함하지 말 것 (더블 prefix 방지).
 *
 * Endpoints:
 * - GET    /api/wishlists                           - 내 위시리스트 (토큰 기반, useWishlist hook)
 * - POST   /api/wishlists                           - 찜하기 추가
 * - POST   /api/wishlists/toggle                    - 찜 토글 (useToggleWishlist hook)
 * - DELETE /api/wishlists                           - 전체 비우기 (useClearWishlist hook)
 * - DELETE /api/wishlists/:id                       - 찜하기 삭제 (wishlist ID)
 * - DELETE /api/wishlists/product/:productId        - 찜하기 삭제 (product ID)
 * - GET    /api/wishlists/:userId                   - 사용자별 위시리스트 조회 (userId)
 * - GET    /api/wishlists/check/:userId/:productId  - 찜 여부 확인
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { AuthUser } from '@/worker/middleware/auth';
import { ALLOWED_ORIGINS } from '@/shared/constants';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type Variables = {
  user: AuthUser;
};

export const wishlistRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

wishlistRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// ── 테이블 자동 생성 (마이그레이션 미적용 시 fallback) ────────────────
async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(user_id, product_id)
      )
    `).run();
  } catch { /* 이미 존재 */ }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlists(user_id)`).run();
  } catch { /* 이미 존재 */ }
}

// ── GET /api/wishlists  (인증 기반 내 위시리스트 - useWishlist hook) ───────────
wishlistRoutes.get('/', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const { results } = await DB.prepare(`
      SELECT w.id, w.user_id, w.product_id, w.created_at,
             p.name as product_name, p.price, p.original_price,
             p.discount_rate, p.image_url, p.stock, p.category,
             s.display_name as seller_name
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
    const countResult = await DB.prepare('SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?')
      .bind(userId).first<{ count: number }>();
    return c.json({ success: true, data: { items: results, total: countResult?.count || 0 } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── POST /api/wishlists/toggle  (useToggleWishlist hook) ──────────────────────
wishlistRoutes.post('/toggle', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);

    const { product_id } = await c.req.json<{ product_id: string | number }>();
    if (!product_id) return c.json({ success: false, error: 'product_id가 필요합니다.' }, 400);

    const existing = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, product_id).first();

    if (existing) {
      await DB.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
        .bind(userId, product_id).run();
      return c.json({ success: true, action: 'removed', data: { isWishlisted: false } });
    } else {
      const result = await DB.prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)')
        .bind(userId, product_id).run();
      return c.json({ success: true, action: 'added', data: { isWishlisted: true, id: result.meta.last_row_id } });
    }
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ── DELETE /api/wishlists  (useClearWishlist hook - 전체 비우기) ──────────────
wishlistRoutes.delete('/', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);
    await DB.prepare('DELETE FROM wishlists WHERE user_id = ?').bind(userId).run();
    return c.json({ success: true, message: '위시리스트를 모두 비웠습니다.' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 찜하기 추가
wishlistRoutes.post('/', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);

    const { productId } = await c.req.json();

    if (!productId) {
      return c.json({ success: false, error: '상품 ID가 필요합니다.' }, 400);
    }

    const product = await DB.prepare('SELECT id, name FROM products WHERE id = ? AND is_active = 1')
      .bind(productId)
      .first<{ id: number; name: string }>();

    if (!product) {
      return c.json({ success: false, error: '존재하지 않는 상품이거나 판매가 중단된 상품입니다.' }, 404);
    }

    const existing = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .first();

    if (existing) {
      return c.json({ success: false, error: '이미 찜한 상품입니다.' }, 409);
    }

    const result = await DB.prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)')
      .bind(userId, productId)
      .run();

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, userId, productId, productName: product.name },
    });
  } catch (err) {
    console.error('[Wishlist] Add error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 찜하기 삭제 (wishlist ID)
wishlistRoutes.delete('/:id', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const id = c.req.param('id');
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);

    const wishlist = await DB.prepare('SELECT id FROM wishlists WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first();

    if (!wishlist) {
      return c.json({ success: false, error: '찜 목록에서 찾을 수 없습니다.' }, 404);
    }

    await DB.prepare('DELETE FROM wishlists WHERE id = ? AND user_id = ?').bind(id, userId).run();

    return c.json({ success: true, message: '찜 목록에서 삭제되었습니다.' });
  } catch (err) {
    console.error('[Wishlist] Delete error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 찜하기 삭제 (상품 ID)
wishlistRoutes.delete('/product/:productId', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const productId = c.req.param('productId');
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);

    const result = await DB.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: '찜 목록에서 찾을 수 없습니다.' }, 404);
    }

    return c.json({ success: true, message: '찜 목록에서 삭제되었습니다.' });
  } catch (err) {
    console.error('[Wishlist] Delete by product error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 사용자별 위시리스트 조회
wishlistRoutes.get('/:userId', async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const userId = c.req.param('userId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const { results } = await DB.prepare(`
      SELECT
        w.id, w.user_id, w.product_id, w.created_at,
        p.name as product_name, p.price, p.original_price,
        p.discount_rate, p.image_url, p.stock, p.category, p.is_active,
        s.display_name as seller_name, s.id as seller_id
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const countResult = await DB.prepare('SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?')
      .bind(userId)
      .first<{ count: number }>();

    return c.json({
      success: true,
      data: { items: results, total: countResult?.count || 0, limit, offset },
    });
  } catch (err) {
    console.error('[Wishlist] Get error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 찜 여부 확인
wishlistRoutes.get('/check/:userId/:productId', async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const userId = c.req.param('userId');
    const productId = c.req.param('productId');

    const wishlist = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .first<{ id: number }>();

    return c.json({
      success: true,
      data: { isWishlisted: !!wishlist, wishlistId: wishlist?.id || null },
    });
  } catch (err) {
    console.error('[Wishlist] Check error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
