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
import { safeError } from '@/worker/utils/safe-error';
import type { AuthUser } from '@/worker/middleware/auth';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { seedWishlistBaseline, clearWishlistBaseline, ensureWishlistBaselineTables } from '@/worker/cron/wishlist-notify';
import { intParam } from '@/shared/pagination'

// v31 FIX: wishlist mutation rate limit (per-IP, 분당 20회)
const wishlistRateLimit = rateLimit({ action: 'wishlist_mutation', max: 20, windowSec: 60 });

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type Variables = {
  user: AuthUser;
};

export const wishlistRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// ── 테이블 자동 생성 (마이그레이션 미적용 시 fallback) ────────────────
// 🛡️ 2026-05-19: per-worker 메모이제이션.
let _ensureTableDone = false
async function ensureTable(DB: D1Database) {
  if (_done_ensureTable.has(DB)) return
  _done_ensureTable.add(DB)
  if (_ensureTableDone) return
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
  _ensureTableDone = true
}

// products.dominant_color 존재 여부 모듈 캐시 (null=미확인 / true=있음 / false=없음 — isolate 수명)
let _wishlistDominantCol: boolean | null = null;
// 💗 2026-09-03: 찜 시점 가격(`wishlist_price_notifications.base_price`) 존재 여부 — 위와 같은 규약.
let _wishlistBaseCol: boolean | null = null;

// ── GET /api/wishlists  (인증 기반 내 위시리스트 - useWishlist hook) ───────────
wishlistRoutes.get('/', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);
    const limit = intParam(c.req.query('limit'), 50);
    const offset = intParam(c.req.query('offset'), 0);
    // 🎨 2026-06-10: dominant_color 포함(카드 그라데이션). 컬럼 미적용 DB 는 1회 실패 후 제외 재시도
    //   (ProductRepository `_dominantColorCol` 모듈캐시 패턴 — 매 요청 2쿼리 방지).
    /**
     * 💗 2026-09-03 (대표 확정 — 위시리스트 안 B "지금 사야 할 것부터"):
     *   찜 목록이 **언제 사야 하는지**를 말하려면 세 가지가 더 필요하다.
     *     · `expires_at`(= `group_buy_deadline`) — 마감 임박 표시·정렬
     *     · `group_buy_status`     — 마감된 것을 임박으로 세지 않기 위해
     *     · `base_price`           — 찜한 그 순간의 가격("N원 내렸어요"의 기준)
     *   덤으로 `restaurant_name`(카드 머천트 줄)·`seller_id`(응답 타입엔 있었는데 이 쿼리만 빠져 있었다)
     *   ·`is_active`(형제 라우트와 대칭)를 맞춘다.
     *
     *   ⚠️ 열·테이블이 없는 DB 도 **깨지지 않고 기능만 빠져야 한다** — 아래 재시도가 그 역할이다.
     *   기존 dominant_color 폴백과 같은 규약이되, 어느 쪽이 원인이든 ≤3회 안에 수렴한다.
     */
    const listSql = (withColor: boolean, withBase: boolean) => `
      SELECT w.id, w.user_id, w.product_id, w.created_at,
             p.name as product_name, p.price, p.original_price,
             p.discount_rate, p.image_url, p.stock, p.category, p.deal_only,
             p.is_active, p.restaurant_name,
             p.group_buy_deadline AS expires_at, p.group_buy_status,
             ${withColor ? 'p.dominant_color,' : ''}
             ${withBase ? 'n.base_price,' : ''}
             s.name as seller_name, s.id as seller_id
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      ${withBase ? 'LEFT JOIN wishlist_price_notifications n ON n.user_id = w.user_id AND n.product_id = w.product_id' : ''}
      WHERE w.user_id = ? AND p.is_active = 1
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `;
    if (_wishlistBaseCol !== false) await ensureWishlistBaselineTables(DB).catch(() => {});
    let results: Record<string, unknown>[] = [];
    for (;;) {
      try {
        results = (await DB.prepare(listSql(_wishlistDominantCol !== false, _wishlistBaseCol !== false))
          .bind(userId, limit, offset).all()).results as Record<string, unknown>[];
        break;
      } catch (e) {
        const msg = String(e);
        if (!msg.includes('no such column') && !msg.includes('no such table')) throw e;
        // 원인이 둘 중 어느 쪽이든 하나씩 끄면 반드시 수렴한다(최대 3회).
        if (_wishlistBaseCol !== false) { _wishlistBaseCol = false; continue; }
        if (_wishlistDominantCol !== false) { _wishlistDominantCol = false; continue; }
        throw e;
      }
    }
    const countResult = await DB.prepare('SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?')
      .bind(userId).first<{ count: number }>();
    return c.json({ success: true, data: { items: results, total: countResult?.count || 0 } });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// ── POST /api/wishlists/toggle  (useToggleWishlist hook) ──────────────────────
wishlistRoutes.post('/toggle', wishlistRateLimit, requireAuth(), async (c) => {
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
      await clearWishlistBaseline(DB, userId, product_id); // 재입고/가격 dedup 정리
      return c.json({ success: true, action: 'removed', data: { isWishlisted: false } });
    } else {
      const result = await DB.prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)')
        .bind(userId, product_id).run();
      await seedWishlistBaseline(DB, userId, product_id); // 재입고 오통지 방지 + 가격 baseline
      return c.json({ success: true, action: 'added', data: { isWishlisted: true, id: result.meta.last_row_id } });
    }
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// ── DELETE /api/wishlists  (useClearWishlist hook - 전체 비우기) ──────────────
wishlistRoutes.delete('/', wishlistRateLimit, requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);
    await DB.prepare('DELETE FROM wishlists WHERE user_id = ?').bind(userId).run();
    // 재입고/가격 dedup 도 전체 정리(누적 방지)
    await DB.prepare('DELETE FROM wishlist_stock_notifications WHERE user_id = ?').bind(userId).run().catch(() => {});
    await DB.prepare('DELETE FROM wishlist_price_notifications WHERE user_id = ?').bind(userId).run().catch(() => {});
    return c.json({ success: true, message: '위시리스트를 모두 비웠습니다.' });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// 찜하기 추가
wishlistRoutes.post('/', wishlistRateLimit, requireAuth(), async (c) => {
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

    await seedWishlistBaseline(DB, userId, productId); // 재입고 오통지 방지 + 가격 baseline

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, userId, productId, productName: product.name },
    });
  } catch (err) {
    console.error('[Wishlist] Add error:', err);
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// 찜하기 삭제 (wishlist ID)
wishlistRoutes.delete('/:id', wishlistRateLimit, requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const id = c.req.param('id');
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const userId = String(authUser.id);

    const wishlist = await DB.prepare('SELECT id, product_id FROM wishlists WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first<{ id: number; product_id: number }>();

    if (!wishlist) {
      return c.json({ success: false, error: '찜 목록에서 찾을 수 없습니다.' }, 404);
    }

    await DB.prepare('DELETE FROM wishlists WHERE id = ? AND user_id = ?').bind(id, userId).run();
    await clearWishlistBaseline(DB, userId, wishlist.product_id); // 재입고/가격 dedup 정리

    return c.json({ success: true, message: '찜 목록에서 삭제되었습니다.' });
  } catch (err) {
    console.error('[Wishlist] Delete error:', err);
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// 찜하기 삭제 (상품 ID)
wishlistRoutes.delete('/product/:productId', wishlistRateLimit, requireAuth(), async (c) => {
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

    await clearWishlistBaseline(DB, userId, productId); // 재입고/가격 dedup 정리

    return c.json({ success: true, message: '찜 목록에서 삭제되었습니다.' });
  } catch (err) {
    console.error('[Wishlist] Delete by product error:', err);
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// 사용자별 위시리스트 조회
wishlistRoutes.get('/:userId', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const userId = c.req.param('userId');
    // ✅ IDOR FIX: Only allow self-access unless admin
    if (userId !== String(authUser.id) && authUser.type !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const limit = intParam(c.req.query('limit'), 20);
    const offset = intParam(c.req.query('offset'), 0);

    const { results } = await DB.prepare(`
      SELECT
        w.id, w.user_id, w.product_id, w.created_at,
        p.name as product_name, p.price, p.original_price,
        p.discount_rate, p.image_url, p.stock, p.category, p.is_active, p.deal_only,
        s.name as seller_name, s.id as seller_id
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE w.user_id = ? AND p.is_active = 1
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});

// 찜 여부 확인
// 🛡️ 2026-04-22: 본인만 조회 가능 (다른 유저 wishlist membership 누출 방지)
wishlistRoutes.get('/check/:userId/:productId', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  try {
    const authUser = getCurrentUser(c);
    const userId = c.req.param('userId');
    const productId = c.req.param('productId');

    // 본인 user_id 와 경로 userId 일치 확인 (admin 은 예외적으로 모두 조회 가능)
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
    if (userId !== String(authUser.id) && authUser.type !== 'admin') {
      return c.json({ success: false, error: 'Forbidden — 본인 wishlist 만 조회 가능' }, 403);
    }

    const wishlist = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .first<{ id: number }>();

    return c.json({
      success: true,
      data: { isWishlisted: !!wishlist, wishlistId: wishlist?.id || null },
    });
  } catch (err) {
    console.error('[Wishlist] Check error:', err);
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[wishlists]');
  }
});


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTable = new WeakSet<object>()
