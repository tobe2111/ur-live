/**
 * Wishlists API Routes
 *
 * Endpoints:
 * - POST   /api/wishlists                          - 찜하기 추가
 * - DELETE /api/wishlists/:id                      - 찜하기 삭제 (wishlist ID)
 * - DELETE /api/wishlists/product/:productId       - 찜하기 삭제 (product ID)
 * - GET    /api/wishlists/:userId                  - 사용자별 위시리스트 조회
 * - GET    /api/wishlists/check/:userId/:productId - 찜 여부 확인
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
export const wishlistRoutes = new Hono();
// 찜하기 추가
wishlistRoutes.post('/api/wishlists', cors(), async (c) => {
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
            .first();
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
    }
    catch (err) {
        console.error('[Wishlist] Add error:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});
// 찜하기 삭제 (wishlist ID)
wishlistRoutes.delete('/api/wishlists/:id', cors(), async (c) => {
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
    }
    catch (err) {
        console.error('[Wishlist] Delete error:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});
// 찜하기 삭제 (상품 ID)
wishlistRoutes.delete('/api/wishlists/product/:productId', cors(), async (c) => {
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
    }
    catch (err) {
        console.error('[Wishlist] Delete by product error:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});
// 사용자별 위시리스트 조회
wishlistRoutes.get('/api/wishlists/:userId', cors(), async (c) => {
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
            .first();
        return c.json({
            success: true,
            data: { items: results, total: countResult?.count || 0, limit, offset },
        });
    }
    catch (err) {
        console.error('[Wishlist] Get error:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});
// 찜 여부 확인
wishlistRoutes.get('/api/wishlists/check/:userId/:productId', cors(), async (c) => {
    const { DB } = c.env;
    try {
        const userId = c.req.param('userId');
        const productId = c.req.param('productId');
        const wishlist = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
            .bind(userId, productId)
            .first();
        return c.json({
            success: true,
            data: { isWishlisted: !!wishlist, wishlistId: wishlist?.id || null },
        });
    }
    catch (err) {
        console.error('[Wishlist] Check error:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});
