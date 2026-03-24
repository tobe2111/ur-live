/**
 * Admin Banners API Routes (old module - redirects to features/banners)
 *
 * NOTE: 새 모듈은 src/features/banners/api/banners.routes.ts 입니다.
 * 이 파일은 worker/index.ts의 기존 import 호환을 위해 유지합니다.
 *
 * Endpoints:
 * - GET    / - 모든 배너 조회
 * - POST   / - 배너 생성
 * - PUT    /:id - 배너 수정
 * - DELETE /:id - 배너 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { requireAdmin } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';

export const adminBannersRoutes = new Hono<{ Bindings: Env }>();

// 모든 배너 관리 엔드포인트는 admin 권한 필수
adminBannersRoutes.use('*', requireAdmin());

// 모든 배너 조회
adminBannersRoutes.get('/', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const banners = await executeQuery<any>(DB, `
      SELECT id, title, image_url, link_url, description,
             is_active, display_order, start_date, end_date,
             created_at, updated_at
      FROM banners ORDER BY display_order ASC, created_at DESC
    `);
    return c.json({ success: true, data: banners });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배너 생성
adminBannersRoutes.post('/', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const { title, image_url, link_url, description, is_active, display_order, start_date, end_date } = await c.req.json();
    if (!title || !image_url) return c.json({ success: false, error: '제목과 이미지 URL은 필수입니다.' }, 400);

    const result = await executeRun(DB,
      `INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [title, image_url, link_url || null, description || null,
       is_active !== undefined ? (is_active ? 1 : 0) : 1,
       display_order || 0, start_date || null, end_date || null]
    );
    return c.json({ success: true, data: { id: result.meta.last_row_id, title } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배너 수정
adminBannersRoutes.put('/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const bannerId = c.req.param('id');
    const { title, image_url, link_url, description, is_active, display_order, start_date, end_date } = await c.req.json();
    const rows = await executeQuery<any>(DB, 'SELECT id FROM banners WHERE id = ?', [bannerId]);
    if (rows.length === 0) return c.json({ success: false, error: '배너를 찾을 수 없습니다' }, 404);

    await executeRun(DB,
      `UPDATE banners SET title=?, image_url=?, link_url=?, description=?, is_active=?,
       display_order=?, start_date=?, end_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [title, image_url, link_url || null, description || null,
       is_active !== undefined ? (is_active ? 1 : 0) : 1,
       display_order || 0, start_date || null, end_date || null, bannerId]
    );
    return c.json({ success: true, data: { id: bannerId } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배너 삭제
adminBannersRoutes.delete('/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const bannerId = c.req.param('id');
    const rows = await executeQuery<any>(DB, 'SELECT id FROM banners WHERE id = ?', [bannerId]);
    if (rows.length === 0) return c.json({ success: false, error: '배너를 찾을 수 없습니다' }, 404);
    await executeRun(DB, 'DELETE FROM banners WHERE id = ?', [bannerId]);
    return c.json({ success: true, data: { id: bannerId } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

export default adminBannersRoutes;
