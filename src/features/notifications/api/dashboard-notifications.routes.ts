/**
 * Dashboard Notifications API
 *
 * GET  /api/dashboard-notifications            - 내 알림 목록
 * PUT  /api/dashboard-notifications/read-all   - 전체 읽음 처리
 * PUT  /api/dashboard-notifications/:id/read   - 개별 읽음 처리
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const dashboardNotificationsRoutes = new Hono<{ Bindings: Env }>();
dashboardNotificationsRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS dashboard_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'seller')),
      recipient_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run();
    await DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_dash_notif_recipient ON dashboard_notifications(recipient_type, recipient_id, is_read)`
    ).run();
  } catch { /* already exists */ }
}

/**
 * Helper: create a dashboard notification.
 * For admin notifications, recipientId can be null (all admins see it).
 */
export async function createDashboardNotification(
  DB: D1Database,
  recipientType: 'admin' | 'seller',
  recipientId: string | null,
  type: string,
  title: string,
  message?: string,
  link?: string
) {
  await ensureTable(DB);
  await DB.prepare(
    `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(recipientType, recipientId, type, title, message ?? null, link ?? null).run();
}

// GET / — 내 알림 목록
dashboardNotificationsRoutes.get('/', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const limit = Math.min(Number(c.req.query('limit') || '20'), 100);
  const unreadOnly = c.req.query('unread_only') === 'true';

  const recipientType = user.type === 'admin' ? 'admin' : 'seller';
  const recipientId = String(user.id);

  let whereClause: string;
  let params: (string | number)[];

  if (recipientType === 'admin') {
    // Admins see notifications where recipient_type='admin' (recipient_id NULL = all admins)
    whereClause = `recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ?)`;
    params = [recipientId];
  } else {
    whereClause = `recipient_type = 'seller' AND recipient_id = ?`;
    params = [recipientId];
  }

  if (unreadOnly) {
    whereClause += ' AND is_read = 0';
  }

  const { results } = await DB.prepare(
    `SELECT * FROM dashboard_notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params, limit).all();

  // Unread count
  const countRow = await DB.prepare(
    `SELECT COUNT(*) as cnt FROM dashboard_notifications WHERE ${whereClause} AND is_read = 0`
  ).bind(...params).first<{ cnt: number }>();

  return c.json({
    success: true,
    notifications: results ?? [],
    unread_count: countRow?.cnt ?? 0,
  });
});

// PUT /read-all — 전체 읽음 처리
dashboardNotificationsRoutes.put('/read-all', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const recipientType = user.type === 'admin' ? 'admin' : 'seller';
  const recipientId = String(user.id);

  if (recipientType === 'admin') {
    await DB.prepare(
      `UPDATE dashboard_notifications SET is_read = 1 WHERE recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ?) AND is_read = 0`
    ).bind(recipientId).run();
  } else {
    await DB.prepare(
      `UPDATE dashboard_notifications SET is_read = 1 WHERE recipient_type = 'seller' AND recipient_id = ? AND is_read = 0`
    ).bind(recipientId).run();
  }

  return c.json({ success: true });
});

// PUT /:id/read — 개별 읽음 처리
dashboardNotificationsRoutes.put('/:id/read', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const id = c.req.param('id');

  await DB.prepare(
    `UPDATE dashboard_notifications SET is_read = 1 WHERE id = ?`
  ).bind(id).run();

  return c.json({ success: true });
});

export { dashboardNotificationsRoutes };
