/**
 * Banners API Routes
 *
 * Endpoints:
 * - GET    /api/banners              - 활성 배너 목록 (공개)
 * - GET    /api/admin/banners        - 전체 배너 목록 (관리자)
 * - POST   /api/admin/banners        - 배너 생성 (관리자)
 * - PUT    /api/admin/banners/:id    - 배너 수정 (관리자)
 * - DELETE /api/admin/banners/:id    - 배너 삭제 (관리자)
 */

import { Hono } from 'hono';
import { requireAuth } from '@/worker/middleware/auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const bannerRoutes = new Hono<{ Bindings: Bindings }>();

// 활성 배너 목록 (공개)
bannerRoutes.get('/api/banners', async (c) => {
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
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 전체 배너 목록 (관리자)
bannerRoutes.get('/api/admin/banners', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const userType = c.get('userType' as any);
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const banners = await DB.prepare(`
      SELECT * FROM banners ORDER BY display_order ASC, created_at DESC
    `).all();

    return c.json({ success: true, data: banners.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배너 생성 (관리자)
bannerRoutes.post('/api/admin/banners', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const userType = c.get('userType' as any);
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const { title, image_url, link_url, description, is_active, display_order, start_date, end_date } =
      await c.req.json();

    if (!title || !image_url) {
      return c.json({ success: false, error: '제목과 이미지는 필수입니다.' }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        title,
        image_url,
        link_url || null,
        description || null,
        is_active !== false ? 1 : 0,
        display_order || 0,
        start_date || null,
        end_date || null,
      )
      .run();

    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배너 수정 (관리자)
bannerRoutes.put('/api/admin/banners/:id', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const userType = c.get('userType' as any);
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const id = c.req.param('id');
    const { title, image_url, link_url, description, is_active, display_order, start_date, end_date } =
      await c.req.json();

    await DB.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(
        title,
        image_url,
        link_url || null,
        description || null,
        is_active ? 1 : 0,
        display_order || 0,
        start_date || null,
        end_date || null,
        id,
      )
      .run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배너 삭제 (관리자)
bannerRoutes.delete('/api/admin/banners/:id', requireAuth, async (c) => {
  const { DB } = c.env;

  try {
    const userType = c.get('userType' as any);
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const id = c.req.param('id');
    await DB.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
