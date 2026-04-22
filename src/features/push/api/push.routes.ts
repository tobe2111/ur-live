/**
 * Push Notifications API Routes
 *
 * Endpoints:
 * - POST /api/push/subscribe         - Push 알림 구독 등록
 * - POST /api/push/unsubscribe       - Push 알림 구독 해제
 * - GET  /api/push/vapid-public-key  - VAPID 공개 키 조회
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { getFeatureFlags } from '@/worker/utils/feature-flags';
import type { KVNamespace } from '@cloudflare/workers-types';
import { ALLOWED_ORIGINS } from '@/shared/constants';

type Bindings = {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  JWT_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
  SESSION_KV?: KVNamespace;
};

// Push subscription helpers (inline to avoid circular imports)
async function savePushSubscription(
  db: D1Database,
  userId: number,
  userType: 'user' | 'seller' | 'admin',
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO push_subscriptions (user_id, user_type, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        user_type = excluded.user_type,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(userId, userType, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth)
    .run();
}

async function deletePushSubscription(db: D1Database, endpoint: string): Promise<void> {
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
}

export const pushRoutes = new Hono<{ Bindings: Bindings }>();
pushRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));

// Push 알림 구독 등록 — JWT 인증 필수 (X-User-ID 헤더는 스푸핑 가능하여 제거)
pushRoutes.post('/api/push/subscribe', requireAuth(), async (c) => {
  try {
    // Kill switch: skip enrolling new push subscriptions during overload.
    // We ACK success so the client doesn't retry-loop on 503.
    const flags = await getFeatureFlags(c.env.SESSION_KV, c.env.DB);
    if (!flags.enable_push_notifications) {
      return c.json({ success: true, skipped: true, reason: 'push_disabled' });
    }

    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const userId = parseInt(String(authUser.id), 10);
    const userType = authUser.type as 'user' | 'seller' | 'admin';
    const subscription = await c.req.json();
    await savePushSubscription(c.env.DB, userId, userType, subscription);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Push Subscribe] Error:', error.message);
    return c.json({ success: false, error: '구독 등록에 실패했습니다.' }, 500);
  }
});

// 네이티브 (Capacitor) 푸시 토큰 등록 — FCM/APNS 토큰
pushRoutes.post('/api/push/register', requireAuth(), async (c) => {
  try {
    const flags = await getFeatureFlags(c.env.SESSION_KV, c.env.DB);
    if (!flags.enable_push_notifications) {
      return c.json({ success: true, skipped: true, reason: 'push_disabled' });
    }

    const authUser = getCurrentUser(c);
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const { token, platform } = await c.req.json<{ token?: string; platform?: string }>();
    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 4096) {
      return c.json({ success: false, error: 'Invalid token' }, 400);
    }
    const plat = platform === 'ios' || platform === 'android' ? platform : 'unknown';

    try {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS native_push_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          user_type TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          platform TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT
        )
      `).run();
    } catch {}

    const userId = parseInt(String(authUser.id), 10);
    const userType = authUser.type as 'user' | 'seller' | 'admin';
    await c.env.DB.prepare(`
      INSERT INTO native_push_tokens (user_id, user_type, token, platform)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        user_id = excluded.user_id,
        user_type = excluded.user_type,
        platform = excluded.platform,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, userType, token, plat).run();

    return c.json({ success: true });
  } catch (error: any) {
    if (typeof console !== 'undefined') console.error('[Push Register] Error:', error?.message);
    return c.json({ success: false, error: '토큰 등록에 실패했습니다.' }, 500);
  }
});

// Push 알림 구독 해제
// 🛡️ 2026-04-22: 인증 필수. 이전엔 인증 없어서 누구나 타 유저 endpoint 로 구독 해제 가능 (DoS).
// 수정: requireAuth() + 본인 endpoint 만 삭제 가능.
pushRoutes.post('/api/push/unsubscribe', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const { endpoint } = await c.req.json();
    if (!endpoint) {
      return c.json({ success: false, error: 'Endpoint required' }, 400);
    }

    // 본인 user_id 에 속한 endpoint 인지 확인 후 삭제 (helper 가 이미 체크하지 않으면)
    await c.env.DB.prepare(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?'
    ).bind(endpoint, user.id).run();

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Push Unsubscribe] Error:', error.message);
    return c.json({ success: false, error: '구독 해제에 실패했습니다.' }, 500);
  }
});

// VAPID 공개 키 조회
pushRoutes.get('/api/push/vapid-public-key', cors(), async (c) => {
  try {
    const publicKey = c.env.VAPID_PUBLIC_KEY || '';
    return c.json({ success: true, publicKey });
  } catch (error: any) {
    console.error('[Push VAPID Key] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});
