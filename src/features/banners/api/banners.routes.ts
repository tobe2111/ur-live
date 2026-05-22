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
import { safeError } from '../../../worker/utils/safe-error';

type Bindings = {
  DB: D1Database;
};

export const bannerRoutes = new Hono<{ Bindings: Bindings }>();

// GET /api/banners — 활성 배너 목록 (공개)
bannerRoutes.get('/', async (c) => {
  const { DB } = c.env;

  try {
    const now = new Date().toISOString();

    const banners = await DB.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(now, now).all();

    return c.json({ success: true, data: banners.results });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[banners]');
  }
});
