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
const dashboardNotificationsRoutes = new Hono<{ Bindings: Env }>();
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureTable(DB: D1Database) {
  try {
    // 🛡️ 2026-04-28: CHECK 제약에 'agency' 추가. 이전엔 'admin'/'seller' 만 허용해
    //   에이전시 측 알림 INSERT 가 실패 → 어드민이 에이전시 신청 알림 못 봄.
    await DB.prepare(`CREATE TABLE IF NOT EXISTS dashboard_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'seller', 'agency')),
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
 *
 * 🛡️ 2026-04-28: type 'agency' 추가. ensureTable 의 CHECK 제약과 동기화.
 *   기존 production DB 가 옛 CHECK ('admin','seller') 으로 만들어져 있으면
 *   agency INSERT 시 throw — try-catch 로 감싸 best-effort.
 */
export async function createDashboardNotification(
  DB: D1Database,
  recipientType: 'admin' | 'seller' | 'agency',
  recipientId: string | null,
  type: string,
  title: string,
  message?: string,
  link?: string
) {
  await ensureTable(DB);

  // 🛡️ 2026-04-28: dispatcher 채널 설정 조회 — dashboard 가 disabled 면 INSERT skip.
  //   기존 호출처 모두 자동으로 dispatcher 정책 따름 (코드 변경 0).
  //   ⚠️ 상대경로 필수 (Worker 런타임에 path alias '@/...' 미존재 — CLAUDE.md 참조).
  try {
    const { getChannelSettings } = await import('../../../lib/notification-dispatcher');
    const settings = await getChannelSettings(DB, type);
    if (!settings.dashboard) {
      // 어드민이 이 type 의 dashboard 채널 끔 → INSERT skip
      return;
    }
  } catch { /* settings 조회 실패 → 기본 동작 (INSERT 진행) */ }

  try {
    await DB.prepare(
      `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(recipientType, recipientId, type, title, message ?? null, link ?? null).run();
  } catch (err) {
    // 🛡️ 옛 CHECK 제약 (admin/seller 만) production DB 에서 agency INSERT 실패 시
    //   recipient_type='admin' fallback (어드민이라도 알림 받게).
    if (recipientType === 'agency') {
      try {
        await DB.prepare(
          `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
           VALUES ('admin', NULL, ?, ?, ?, ?)`
        ).bind(type, '[에이전시] ' + title, message ?? null, link ?? null).run();
      } catch { /* ignore */ }
    } else {
      throw err;
    }
  }
}

// GET / — 내 알림 목록
dashboardNotificationsRoutes.get('/', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const limit = Math.min(Number(c.req.query('limit') || '20'), 100);
  const unreadOnly = c.req.query('unread_only') === 'true';

  // 🛡️ 2026-04-28: agency 분기 추가. 이전엔 admin/seller 만 분기 → 에이전시는 자기 알림 못 봄.
  const recipientType = user.type === 'admin' ? 'admin' : user.type === 'agency' ? 'agency' : 'seller';
  const recipientId = String(user.id);

  let whereClause: string;
  let params: (string | number)[];

  if (recipientType === 'admin') {
    // Admins see notifications where recipient_type='admin' (recipient_id NULL = all admins)
    whereClause = `recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ?)`;
    params = [recipientId];
  } else if (recipientType === 'agency') {
    whereClause = `recipient_type = 'agency' AND recipient_id = ?`;
    params = [recipientId];
  } else {
    whereClause = `recipient_type = 'seller' AND recipient_id = ?`;
    params = [recipientId];
  }

  if (unreadOnly) {
    whereClause += ' AND is_read = 0';
  }

  // 명시적 컬럼 + 미읽음 수를 window function으로 한 번에 조회 (D1 read 50% 절감)
  const { results } = await DB.prepare(
    `SELECT id, recipient_type, recipient_id, type, title, message, link, is_read, created_at,
            SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) OVER () AS _unread_total
     FROM dashboard_notifications WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params, limit).all<{ _unread_total?: number; [k: string]: unknown }>();

  const unreadCount = (results && results.length > 0) ? (results[0]._unread_total ?? 0) : 0;
  // _unread_total 제거 후 반환 (내부 계산 컬럼)
  const notifications = (results ?? []).map(({ _unread_total: _, ...n }) => n);

  return c.json({
    success: true,
    notifications,
    unread_count: unreadCount,
  });
});

// PUT /read-all — 전체 읽음 처리
dashboardNotificationsRoutes.put('/read-all', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  const recipientType = user.type === 'admin' ? 'admin' : user.type === 'agency' ? 'agency' : 'seller';
  const recipientId = String(user.id);

  if (recipientType === 'admin') {
    await DB.prepare(
      `UPDATE dashboard_notifications SET is_read = 1 WHERE recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ?) AND is_read = 0`
    ).bind(recipientId).run();
  } else if (recipientType === 'agency') {
    await DB.prepare(
      `UPDATE dashboard_notifications SET is_read = 1 WHERE recipient_type = 'agency' AND recipient_id = ? AND is_read = 0`
    ).bind(recipientId).run();
  } else {
    await DB.prepare(
      `UPDATE dashboard_notifications SET is_read = 1 WHERE recipient_type = 'seller' AND recipient_id = ? AND is_read = 0`
    ).bind(recipientId).run();
  }

  return c.json({ success: true });
});

// PUT /:id/read — 개별 읽음 처리
// 🛡️ 2026-04-22: ownership check 추가 (이전: 누구나 임의 알림 읽음 처리 가능)
dashboardNotificationsRoutes.put('/:id/read', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  const id = c.req.param('id');

  // 본인 recipient_id 와 일치하는 알림만 읽음 처리
  // admin 은 recipient_id IS NULL (전체 브로드캐스트) 또는 자기 것만
  let whereClause: string;
  let params: unknown[];
  if (user.type === 'admin') {
    whereClause = 'id = ? AND recipient_type = ? AND (recipient_id IS NULL OR recipient_id = ?)';
    params = [id, 'admin', String(user.id)];
  } else if (user.type === 'seller') {
    whereClause = 'id = ? AND recipient_type = ? AND recipient_id = ?';
    params = [id, 'seller', String(user.id)];
  } else if (user.type === 'agency') {
    whereClause = 'id = ? AND recipient_type = ? AND recipient_id = ?';
    params = [id, 'agency', String(user.id)];
  } else {
    return c.json({ success: false, error: '접근 권한 없음' }, 403);
  }

  const result = await DB.prepare(
    `UPDATE dashboard_notifications SET is_read = 1 WHERE ${whereClause}`
  ).bind(...params).run();

  if (!result.meta?.changes) {
    return c.json({ success: false, error: '알림을 찾을 수 없거나 권한이 없습니다' }, 404);
  }

  return c.json({ success: true });
});

export { dashboardNotificationsRoutes };
