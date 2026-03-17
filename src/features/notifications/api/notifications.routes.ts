/**
 * Notifications API Routes
 *
 * Endpoints:
 * - GET    /api/notifications              - 알림 목록 조회
 * - GET    /api/notifications/unread-count - 미읽음 수
 * - PUT    /api/notifications/:id/read     - 읽음 처리
 * - PUT    /api/notifications/read-all     - 전체 읽음 처리
 * - DELETE /api/notifications/:id          - 알림 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from '@/worker/middleware/auth';

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { userId: string; userType: string };

export const notificationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Auth Middleware ────────────────────────────────────────────────────────
notificationsRoutes.use('*', cors());
notificationsRoutes.use('*', requireAuth());

// ─── GET /api/notifications ─────────────────────────────────────────────────
notificationsRoutes.get('/', async (c) => {
  const { DB } = c.env;
  try {
    const userId = c.get('userId');
    const userType = c.get('userType');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const unreadOnly = c.req.query('unread_only') === 'true';

    let query = `SELECT * FROM notifications WHERE user_id = ? AND user_type = ?`;
    if (unreadOnly) query += ` AND is_read = 0`;
    query += ` ORDER BY created_at DESC LIMIT ?`;

    const result = await DB.prepare(query).bind(userId, userType, limit).all();
    return c.json({ success: true, data: result.results });
  } catch (err) {
    // If notifications table doesn't exist, return empty array
    if ((err as Error).message.includes('no such table')) {
      return c.json({ success: true, data: [] });
    }
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── GET /api/notifications/unread-count ────────────────────────────────────
notificationsRoutes.get('/unread-count', async (c) => {
  const { DB } = c.env;
  try {
    const userId = c.get('userId');
    const userType = c.get('userType');
    const result = await DB.prepare(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0`
    ).bind(userId, userType).first<{ count: number }>();
    return c.json({ success: true, count: result?.count ?? 0 });
  } catch (err) {
    // If notifications table doesn't exist, return 0
    if ((err as Error).message.includes('no such table')) {
      return c.json({ success: true, count: 0 });
    }
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── PUT /api/notifications/:id/read ───────────────────────────────────────
notificationsRoutes.put('/:id/read', async (c) => {
  const { DB } = c.env;
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const userType = c.get('userType');

    const notif = await DB.prepare(
      `SELECT id FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?`
    ).bind(id, userId, userType).first();
    if (!notif) return c.json({ success: false, error: 'Notification not found' }, 404);

    await DB.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── PUT /api/notifications/read-all ───────────────────────────────────────
notificationsRoutes.put('/read-all', async (c) => {
  const { DB } = c.env;
  try {
    const userId = c.get('userId');
    const userType = c.get('userType');
    await DB.prepare(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND user_type = ? AND is_read = 0`
    ).bind(userId, userType).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── DELETE /api/notifications/:id ─────────────────────────────────────────
notificationsRoutes.delete('/:id', async (c) => {
  const { DB } = c.env;
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const userType = c.get('userType');

    const notif = await DB.prepare(
      `SELECT id FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?`
    ).bind(id, userId, userType).first();
    if (!notif) return c.json({ success: false, error: 'Notification not found' }, 404);

    await DB.prepare(`DELETE FROM notifications WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
