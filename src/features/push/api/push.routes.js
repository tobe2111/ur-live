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
// Push subscription helpers (inline to avoid circular imports)
async function savePushSubscription(db, userId, userType, subscription) {
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
async function deletePushSubscription(db, endpoint) {
    await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
}
export const pushRoutes = new Hono();
// Push 알림 구독 등록
pushRoutes.post('/api/push/subscribe', cors(), async (c) => {
    try {
        const userId = c.req.header('X-User-ID');
        const userType = c.req.header('X-User-Type');
        if (!userId || !userType) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const subscription = await c.req.json();
        await savePushSubscription(c.env.DB, parseInt(userId), userType, subscription);
        return c.json({ success: true });
    }
    catch (error) {
        console.error('[Push Subscribe] Error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Push 알림 구독 해제
pushRoutes.post('/api/push/unsubscribe', cors(), async (c) => {
    try {
        const { endpoint } = await c.req.json();
        if (!endpoint) {
            return c.json({ success: false, error: 'Endpoint required' }, 400);
        }
        await deletePushSubscription(c.env.DB, endpoint);
        return c.json({ success: true });
    }
    catch (error) {
        console.error('[Push Unsubscribe] Error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
// VAPID 공개 키 조회
pushRoutes.get('/api/push/vapid-public-key', cors(), async (c) => {
    try {
        const publicKey = c.env.VAPID_PUBLIC_KEY || '';
        return c.json({ success: true, publicKey });
    }
    catch (error) {
        console.error('[Push VAPID Key] Error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
