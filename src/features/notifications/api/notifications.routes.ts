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
import { safeError } from '@/worker/utils/safe-error';
import type { AuthUser } from '@/worker/middleware/auth';

type Bindings = { DB: D1Database; JWT_SECRET: string; FIREBASE_PROJECT_ID?: string };
type Variables = { user: AuthUser };

export const notificationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Auth Middleware ────────────────────────────────────────────────────────
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// 🛡️ 2026-04-23 배치 175: /unread-count 는 비로그인 시에도 호출되는 홈 bell polling 엔드포인트.
//   401 반환 대신 { count: 0 } 반환해서 Sentry 스팸 + 강제 로그아웃 방지.
notificationsRoutes.get('/unread-count', async (c) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ success: true, count: 0 });
  }
  try {
    const { verify } = await import('hono/jwt');
    const payload = await verify(auth.slice(7), c.env.JWT_SECRET, 'HS256') as { id?: string | number; type?: string };
    const userId = payload?.id?.toString() || '';
    const userType = payload?.type || 'user';
    if (!userId) return c.json({ success: true, count: 0 });

    const { DB } = c.env;
    let count = 0;
    try {
      const r1 = await DB.prepare(
        `SELECT COUNT(*) as c FROM user_notifications WHERE user_id = ? AND is_read = 0`
      ).bind(userId).first<{ c: number }>();
      count += r1?.c ?? 0;
    } catch {}
    try {
      const r2 = await DB.prepare(
        `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0`
      ).bind(userId, userType).first<{ c: number }>();
      count += r2?.c ?? 0;
    } catch {}
    return c.json({ success: true, count });
  } catch {
    // 토큰 무효 — 조용히 0 반환 (401 스팸 방지)
    return c.json({ success: true, count: 0 });
  }
});

notificationsRoutes.use('*', requireAuth());

// 🛡️ 2026-04-22: 두 테이블 (notifications + user_notifications) 모두 조회.
// 이전 버그: 라우트가 notifications 만 읽었으나 대부분 writer 가 user_notifications 에 작성 →
// 사용자에게 알림이 0개로 표시됨 (cron auto-settlement, admin coupon 만 보임).
// 수정: UNION ALL 로 두 테이블 합쳐서 반환. 양쪽에 접근 가능한 사용자 알림 모두 표시.
async function fetchUnifiedNotifications(DB: D1Database, userId: string, userType: string, opts: { limit: number; unreadOnly: boolean }) {
  const all: any[] = [];
  // user_notifications: user_type 컬럼 없음, user_id 만 매칭
  try {
    let q = `SELECT id, ('un_' || id) AS unified_id, 'user_notifications' AS source,
                    user_id, NULL AS user_type, type, title, message, link, is_read, created_at
             FROM user_notifications WHERE user_id = ?`;
    if (opts.unreadOnly) q += ` AND is_read = 0`;
    q += ` ORDER BY created_at DESC LIMIT ?`;
    const r = await DB.prepare(q).bind(userId, opts.limit).all();
    all.push(...(r.results || []));
  } catch { /* 테이블 없음 */ }
  // notifications: user_type 매칭
  try {
    let q = `SELECT id, ('n_' || id) AS unified_id, 'notifications' AS source,
                    user_id, user_type, type, title, message, link, is_read, created_at
             FROM notifications WHERE user_id = ? AND user_type = ?`;
    if (opts.unreadOnly) q += ` AND is_read = 0`;
    q += ` ORDER BY created_at DESC LIMIT ?`;
    const r = await DB.prepare(q).bind(userId, userType, opts.limit).all();
    all.push(...(r.results || []));
  } catch { /* 테이블 없음 */ }
  // created_at 기준 통합 정렬 + limit
  all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return all.slice(0, opts.limit);
}

// ─── GET /api/notifications ─────────────────────────────────────────────────
notificationsRoutes.get('/', async (c) => {
  const { DB } = c.env;
  try {
    const user = c.get('user') as AuthUser;
    const userId = user?.id?.toString() || '';
    const userType = user?.type || 'user';
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const unreadOnly = c.req.query('unread_only') === 'true';
    const data = await fetchUnifiedNotifications(DB, userId, userType, { limit, unreadOnly });
    return c.json({ success: true, data });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[notifications]');
  }
});

// /unread-count 는 위 (requireAuth 이전) 에 선언됨 — 비로그인 시 0 반환

// 🛡️ 2026-04-22: id prefix (un_/n_) 로 source 테이블 식별
// 클라이언트가 보낸 id 가 unified_id 형식이면 prefix 로 라우팅, 아니면 양쪽 모두 시도.
function parseUnifiedId(rawId: string): { table: 'user_notifications' | 'notifications' | 'auto'; numericId: string } {
  if (rawId.startsWith('un_')) return { table: 'user_notifications', numericId: rawId.slice(3) };
  if (rawId.startsWith('n_')) return { table: 'notifications', numericId: rawId.slice(2) };
  return { table: 'auto', numericId: rawId };
}

// ─── PUT /api/notifications/:id/read ───────────────────────────────────────
notificationsRoutes.put('/:id/read', async (c) => {
  const { DB } = c.env;
  try {
    const rawId = c.req.param('id');
    const user = c.get('user') as AuthUser;
    const userId = user?.id?.toString() || '';
    const userType = user?.type || 'user';
    const { table, numericId } = parseUnifiedId(rawId);

    let updated = 0;
    if (table === 'user_notifications' || table === 'auto') {
      try {
        const r = await DB.prepare(
          `UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND is_read = 0`
        ).bind(numericId, userId).run();
        updated += r.meta?.changes ?? 0;
      } catch {}
    }
    if (table === 'notifications' || (table === 'auto' && updated === 0)) {
      try {
        const r = await DB.prepare(
          `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND user_type = ? AND is_read = 0`
        ).bind(numericId, userId, userType).run();
        updated += r.meta?.changes ?? 0;
      } catch {}
    }
    if (updated === 0) return c.json({ success: false, error: 'Notification not found' }, 404);
    return c.json({ success: true });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[notifications]');
  }
});

// ─── PUT /api/notifications/read-all ───────────────────────────────────────
notificationsRoutes.put('/read-all', async (c) => {
  const { DB } = c.env;
  try {
    const user = c.get('user') as AuthUser;
    const userId = user?.id?.toString() || '';
    const userType = user?.type || 'user';
    // 양쪽 테이블 모두 처리
    try {
      await DB.prepare(`UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`).bind(userId).run();
    } catch {}
    try {
      await DB.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND user_type = ? AND is_read = 0`).bind(userId, userType).run();
    } catch {}
    return c.json({ success: true });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[notifications]');
  }
});

// ─── DELETE /api/notifications/:id ─────────────────────────────────────────
notificationsRoutes.delete('/:id', async (c) => {
  const { DB } = c.env;
  try {
    const rawId = c.req.param('id');
    const user = c.get('user') as AuthUser;
    const userId = user?.id?.toString() || '';
    const userType = user?.type || 'user';
    const { table, numericId } = parseUnifiedId(rawId);

    let deleted = 0;
    if (table === 'user_notifications' || table === 'auto') {
      try {
        const r = await DB.prepare(`DELETE FROM user_notifications WHERE id = ? AND user_id = ?`).bind(numericId, userId).run();
        deleted += r.meta?.changes ?? 0;
      } catch {}
    }
    if (table === 'notifications' || (table === 'auto' && deleted === 0)) {
      try {
        const r = await DB.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?`).bind(numericId, userId, userType).run();
        deleted += r.meta?.changes ?? 0;
      } catch {}
    }
    if (deleted === 0) return c.json({ success: false, error: 'Notification not found' }, 404);
    return c.json({ success: true });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[notifications]');
  }
});
