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
import { requireAuth } from '@/worker/middleware/auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const wishlistRoutes = new Hono<{ Bindings: Bindings }>();

// ── 공통 헬퍼: JWT에서 userId 추출 ────────────────────────────────────────────
async function getUserIdFromToken(authHeader: string | undefined): Promise<number | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    // Firebase ID 토큰(sub) 또는 자체 JWT(user_id/id)
    const uid = payload.sub || payload.user_id || payload.id;
    if (!uid) return null;
    return typeof uid === 'number' ? uid : null;
  } catch { return null; }
}

// ── GET /api/wishlists  (인증 기반 내 위시리스트 - useWishlist hook) ───────────
wishlistRoutes.get('/', cors(), requireAuth(), async (c) => {
  console.log('[Wishlist] GET / - User:', c.get('user')?.id);
  const { DB } = c.env;
  try {
    const userId = c.req.query('user_id') || c.req.query('userId');
    if (!userId) {
      return c.json({ success: false, error: 'user_id 파라미터가 필요합니다.' }, 400);
    }
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
wishlistRoutes.post('/toggle', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const { product_id, user_id } = await c.req.json<{ product_id: string | number; user_id?: string | number }>();
    if (!product_id) return c.json({ success: false, error: 'product_id가 필요합니다.' }, 400);

    // user_id를 body 또는 query에서 수신
    const userId = user_id || c.req.query('user_id');
    if (!userId) return c.json({ success: false, error: 'user_id가 필요합니다.' }, 400);

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
wishlistRoutes.delete('/', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const userId = c.req.query('user_id') || c.req.query('userId');
    if (!userId) return c.json({ success: false, error: 'user_id가 필요합니다.' }, 400);
    await DB.prepare('DELETE FROM wishlists WHERE user_id = ?').bind(userId).run();
    return c.json({ success: true, message: '위시리스트를 모두 비웠습니다.' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 찜하기 추가
wishlistRoutes.post('/', cors(), async (c) => {
  const { DB } = c.env;

  try {
    const { userId, productId } = await c.req.json();

    if (!userId || !productId) {
      return c.json({ success: false, error: '사용자 ID와 상품 ID가 필요합니다.' }, 400);
    }

    const user = await DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (!user) {
      return c.json({ success: false, error: '존재하지 않는 사용자입니다.' }, 404);
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
wishlistRoutes.delete('/:id', cors(), async (c) => {
  const { DB } = c.env;

  try {
    const id = c.req.param('id');
    const { userId } = c.req.query();

    if (!userId) {
      return c.json({ success: false, error: '사용자 ID가 필요합니다.' }, 400);
    }

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
wishlistRoutes.delete('/product/:productId', cors(), async (c) => {
  const { DB } = c.env;

  try {
    const productId = c.req.param('productId');
    const { userId } = c.req.query();

    if (!userId) {
      return c.json({ success: false, error: '사용자 ID가 필요합니다.' }, 400);
    }

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
wishlistRoutes.get('/:userId', cors(), async (c) => {
  const { DB } = c.env;

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
wishlistRoutes.get('/check/:userId/:productId', cors(), async (c) => {
  const { DB } = c.env;

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
