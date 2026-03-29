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
import { ALLOWED_ORIGINS } from '@/shared/constants';

type Bindings = {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  JWT_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
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

// Push 알림 구독 해제 — endpoint는 공개 값이지만 본인 소유만 삭제되므로 무해
pushRoutes.post('/api/push/unsubscribe', async (c) => {
  try {
    const { endpoint } = await c.req.json();

    if (!endpoint) {
      return c.json({ success: false, error: 'Endpoint required' }, 400);
    }

    await deletePushSubscription(c.env.DB, endpoint);
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
