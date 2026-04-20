/**
 * 상품 리뷰 API
 *
 * GET  /api/reviews/product/:productId  - 상품 리뷰 목록 (공개)
 * GET  /api/reviews/product/:productId/summary - 평점 요약
 * POST /api/reviews                     - 리뷰 작성 (인증)
 * PUT  /api/reviews/:id                 - 리뷰 수정 (본인만)
 * DELETE /api/reviews/:id               - 리뷰 삭제 (본인만)
 * GET  /api/reviews/my                  - 내 리뷰 목록
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

const reviewsRoutes = new Hono<{ Bindings: Env }>();

reviewsRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// 테이블 자동 생성
async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        order_id INTEGER,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        content TEXT,
        images TEXT DEFAULT '[]',
        is_visible INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `).run();
  } catch { /* 이미 존재 */ }
}

// GET /api/reviews/product/:productId — 상품 리뷰 목록
reviewsRoutes.get('/product/:productId', async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  const productId = c.req.param('productId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  const { results } = await DB.prepare(`
    SELECT r.id, r.rating, r.content, r.images, r.created_at,
           SUBSTR(r.user_id, 1, 3) || '***' AS user_name
    FROM product_reviews r
    WHERE r.product_id = ? AND r.is_visible = 1
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(productId, limit, offset).all();

  const total = await DB.prepare(
    'SELECT COUNT(*) as cnt FROM product_reviews WHERE product_id = ? AND is_visible = 1'
  ).bind(productId).first<{ cnt: number }>();

  return c.json({
    success: true,
    data: {
      reviews: (results ?? []).map((r) => ({
        ...r,
        images: JSON.parse((r as Record<string, unknown>).images as string || '[]'),
      })),
      total: total?.cnt ?? 0,
      page,
      limit,
    },
  });
});

// GET /api/reviews/product/:productId/summary — 평점 요약
reviewsRoutes.get('/product/:productId/summary', async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);
  const productId = c.req.param('productId');

  const summary = await DB.prepare(`
    SELECT
      COUNT(*) as total_count,
      ROUND(AVG(rating), 1) as avg_rating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as star_5,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as star_4,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as star_3,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as star_2,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as star_1
    FROM product_reviews
    WHERE product_id = ? AND is_visible = 1
  `).bind(productId).first();

  return c.json({ success: true, data: summary });
});

// POST /api/reviews — 리뷰 작성
reviewsRoutes.post('/', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const body = await c.req.json<{
    product_id: number;
    order_id?: number;
    rating: number;
    content?: string;
    images?: string[];
  }>();

  if (!body.product_id || !body.rating || body.rating < 1 || body.rating > 5) {
    return c.json({ success: false, error: '상품 ID와 평점(1-5)은 필수입니다' }, 400);
  }

  // 중복 리뷰 체크
  const existing = await DB.prepare(
    'SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?'
  ).bind(body.product_id, user.id).first();

  if (existing) {
    return c.json({ success: false, error: '이미 리뷰를 작성하셨습니다' }, 409);
  }

  // 구매 확인 (order_id가 있는 경우)
  if (body.order_id) {
    const order = await DB.prepare(
      'SELECT id FROM orders WHERE id = ? AND user_id = ? AND status IN (?, ?)'
    ).bind(body.order_id, user.id, 'DONE', 'DELIVERED').first();

    if (!order) {
      return c.json({ success: false, error: '구매 확인이 되지 않았습니다' }, 400);
    }
  }

  await DB.prepare(`
    INSERT INTO product_reviews (product_id, user_id, order_id, rating, content, images)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.product_id, user.id, body.order_id ?? null,
    body.rating, body.content ?? '', JSON.stringify(body.images ?? [])
  ).run();

  // 리뷰 등록 → 셀러 알림
  const productInfo = await DB.prepare('SELECT seller_id, name FROM products WHERE id = ?').bind(body.product_id).first<{seller_id: number|null, name: string}>();
  if (productInfo?.seller_id) {
    createDashboardNotification(DB, 'seller', String(productInfo.seller_id), 'new_review', '새 리뷰', `${productInfo.name}: ★${body.rating}`, '/seller/products').catch(() => {});
  }

  // ── 리뷰 리워드: 딜 포인트 지급 (platform_settings 기반) ──
  try {
    const hasImages = body.images && body.images.length > 0;
    const hasVideo = body.images?.some(img => /\.(mp4|webm|mov)$/i.test(img));

    // platform_settings에서 리뷰 보상 금액 조회
    const rewardKey = hasVideo ? 'review_reward_video' : hasImages ? 'review_reward_image' : 'review_reward_text';
    const defaultReward = hasVideo ? 500 : hasImages ? 300 : 100;
    const settingsRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = ?").bind(rewardKey).first<{ value: string }>().catch(() => null);
    const rewardAmount = settingsRow?.value ? parseInt(settingsRow.value) : defaultReward;

    const rewardDesc = hasVideo ? '[리뷰리워드] 영상 리뷰 작성' : hasImages ? '[리뷰리워드] 사진 리뷰 작성' : '[리뷰리워드] 텍스트 리뷰 작성';

    // user_points 테이블이 없으면 생성
    await DB.prepare(`CREATE TABLE IF NOT EXISTS user_points (user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, total_charged INTEGER NOT NULL DEFAULT 0, total_donated INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => {});
    await DB.prepare(`CREATE TABLE IF NOT EXISTS point_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, commission_amount INTEGER NOT NULL DEFAULT 0, points_amount INTEGER NOT NULL DEFAULT 0, balance_after INTEGER NOT NULL DEFAULT 0, description TEXT, payment_key TEXT, order_id TEXT, stream_id INTEGER, seller_id INTEGER, created_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => {});

    // 잔액 조회 또는 생성
    const pts = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(user.id).first<{ balance: number }>();
    const currentBalance = pts?.balance ?? 0;
    const newBalance = currentBalance + rewardAmount;

    if (pts) {
      await DB.prepare('UPDATE user_points SET balance = ?, total_charged = total_charged + ?, updated_at = datetime(\'now\') WHERE user_id = ?')
        .bind(newBalance, rewardAmount, user.id).run();
    } else {
      await DB.prepare('INSERT INTO user_points (user_id, balance, total_charged) VALUES (?, ?, ?)')
        .bind(user.id, rewardAmount, rewardAmount).run();
    }

    await DB.prepare('INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user.id, 'charge', rewardAmount, rewardAmount, newBalance, rewardDesc).run();

    // deal_balance도 동기화 (users 테이블)
    await DB.prepare('UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?')
      .bind(rewardAmount, user.id).run().catch(() => {});

    // 유저에게 알림 생성
    await DB.prepare(`CREATE TABLE IF NOT EXISTS user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => {});
    await DB.prepare(
      "INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      user.id,
      'review_reward',
      '리뷰 작성 보상',
      `🎁 리뷰 작성 보상으로 ${rewardAmount}딜이 지급되었습니다!`,
      '/user/profile'
    ).run().catch(() => {});
  } catch { /* 포인트 지급 실패해도 리뷰는 성공 */ }

  // 실제 유저 리뷰 → sold_count 2~3 증가
  try {
    const inc = 2 + Math.round(Math.random());
    await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(inc, body.product_id).run();
  } catch {}

  return c.json({ success: true, message: '리뷰가 등록되었습니다', reward: true }, 201);
});

// PUT /api/reviews/:id — 리뷰 수정
reviewsRoutes.put('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const reviewId = c.req.param('id');
  const body = await c.req.json<{ rating?: number; content?: string; images?: string[] }>();

  const review = await DB.prepare(
    'SELECT id, user_id FROM product_reviews WHERE id = ?'
  ).bind(reviewId).first<{ id: number; user_id: string }>();

  if (!review) return c.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, 404);
  if (review.user_id !== user.id) return c.json({ success: false, error: '본인의 리뷰만 수정할 수 있습니다' }, 403);

  const updates: string[] = ['updated_at = datetime(\'now\')'];
  const params: (string | number)[] = [];

  if (body.rating && body.rating >= 1 && body.rating <= 5) { updates.push('rating = ?'); params.push(body.rating); }
  if (body.content !== undefined) { updates.push('content = ?'); params.push(body.content); }
  if (body.images) { updates.push('images = ?'); params.push(JSON.stringify(body.images)); }

  params.push(reviewId!);
  await DB.prepare(`UPDATE product_reviews SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return c.json({ success: true, message: '리뷰가 수정되었습니다' });
});

// DELETE /api/reviews/:id — 리뷰 삭제
reviewsRoutes.delete('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const reviewId = c.req.param('id');

  const review = await DB.prepare(
    'SELECT id, user_id FROM product_reviews WHERE id = ?'
  ).bind(reviewId).first<{ id: number; user_id: string }>();

  if (!review) return c.json({ success: false, error: '리뷰를 찾을 수 없습니다' }, 404);
  if (review.user_id !== user.id) return c.json({ success: false, error: '본인의 리뷰만 삭제할 수 있습니다' }, 403);

  await DB.prepare('DELETE FROM product_reviews WHERE id = ?').bind(reviewId).run();

  return c.json({ success: true, message: '리뷰가 삭제되었습니다' });
});

// GET /api/reviews/my — 내 리뷰 목록
reviewsRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const { results } = await DB.prepare(`
    SELECT r.id, r.product_id, r.rating, r.content, r.images, r.created_at,
           p.name as product_name, p.image_url as product_image
    FROM product_reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).bind(user.id).all();

  return c.json({
    success: true,
    data: (results ?? []).map((r) => ({
      ...r,
      images: JSON.parse((r as Record<string, unknown>).images as string || '[]'),
    })),
  });
});

export { reviewsRoutes };
