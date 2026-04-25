/**
 * Banners API Routes (공개용)
 *
 * app.route('/api/banners', bannerRoutes) 에 등록됨.
 * ⚠️ 이 파일 내부 경로에 /api/banners 를 절대 포함하지 말 것 (더블 prefix 방지).
 *
 * Endpoints:
 * - GET /api/banners  - 활성 배너 목록 (공개)
 *
 * 관리자용 배너 CRUD (GET all / POST / PUT / DELETE) →
 *   adminBannersRoutes → app.route('/api/admin/banners', adminBannersRoutes)
 */

import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  SESSION_KV?: KVNamespace;
};

export const bannerRoutes = new Hono<{ Bindings: Bindings }>();

// GET /api/banners — 활성 배너 목록 (공개)
bannerRoutes.get('/', async (c) => {
  const { DB } = c.env;

  try {
    const kv = c.env.SESSION_KV;
    const cacheKey = 'cache:banners:active';
    if (kv) {
      const cached = await kv.get(cacheKey, 'text');
      if (cached) return c.json(JSON.parse(cached));
    }

    const now = new Date().toISOString();

    const banners = await DB.prepare(`
      SELECT id, title, image_url, link_url, description, is_active, display_order, start_date, end_date, created_at FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(now, now).all();

    const responseData = { success: true, data: banners.results };
    if (kv) {
      c.executionCtx.waitUntil(kv.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 120 }));
    }
    return c.json(responseData);
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
