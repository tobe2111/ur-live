/**
 * 방송 알림 구독 시스템 API
 *
 * POST /api/broadcast-notify/subscribe/:streamId   - 알림 구독
 * DELETE /api/broadcast-notify/subscribe/:streamId  - 알림 구독 취소
 * GET  /api/broadcast-notify/subscribe/:streamId    - 구독 상태 확인
 * GET  /api/broadcast-notify/subscribers/:streamId  - 구독자 수 (공개)
 * POST /api/broadcast-notify/send/:streamId         - 알림 발송 (셀러/내부)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser, optionalAuth } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const broadcastNotifyRoutes = new Hono<{ Bindings: Env }>();

broadcastNotifyRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS broadcast_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_phone TEXT,
        notify_alimtalk INTEGER DEFAULT 0,
        notify_inapp INTEGER DEFAULT 1,
        notified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(stream_id, user_id)
      )
    `).run();
  } catch {}
}

// POST /subscribe/:streamId — 알림 구독
broadcastNotifyRoutes.post('/subscribe/:streamId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');
  const body = await c.req.json<{ phone?: string }>().catch(() => ({} as { phone?: string }));

  // 스트림 존재 확인
  const stream = await DB.prepare('SELECT id, title, scheduled_at FROM live_streams WHERE id = ?')
    .bind(streamId).first();
  if (!stream) return c.json({ success: false, error: '방송을 찾을 수 없습니다' }, 404);

  const phone = (body.phone ?? '').replace(/-/g, '');
  const notifyAlimtalk = phone ? 1 : 0;

  try {
    await DB.prepare(`
      INSERT INTO broadcast_subscriptions (stream_id, user_id, user_name, user_phone, notify_alimtalk, notify_inapp)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(streamId, user.id, user.name || '익명', phone, notifyAlimtalk).run();
  } catch {
    // UNIQUE conflict → already subscribed, update phone
    await DB.prepare(`
      UPDATE broadcast_subscriptions SET user_phone = ?, notify_alimtalk = ?, user_name = ?
      WHERE stream_id = ? AND user_id = ?
    `).bind(phone, notifyAlimtalk, user.name || '익명', streamId, user.id).run();
  }

  const countRow = await DB.prepare('SELECT COUNT(*) as cnt FROM broadcast_subscriptions WHERE stream_id = ?')
    .bind(streamId).first<{ cnt: number }>();

  return c.json({ success: true, data: { subscribed: true, count: countRow?.cnt || 0 } });
});

// DELETE /subscribe/:streamId — 구독 취소
broadcastNotifyRoutes.delete('/subscribe/:streamId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  await DB.prepare('DELETE FROM broadcast_subscriptions WHERE stream_id = ? AND user_id = ?')
    .bind(c.req.param('streamId'), user.id).run();

  return c.json({ success: true, data: { subscribed: false } });
});

// GET /subscribe/:streamId — 내 구독 상태
broadcastNotifyRoutes.get('/subscribe/:streamId', optionalAuth(), async (c) => {
  const user = getCurrentUser(c);
  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');
  const countRow = await DB.prepare('SELECT COUNT(*) as cnt FROM broadcast_subscriptions WHERE stream_id = ?')
    .bind(streamId).first<{ cnt: number }>();

  let subscribed = false;
  if (user) {
    const sub = await DB.prepare('SELECT id FROM broadcast_subscriptions WHERE stream_id = ? AND user_id = ?')
      .bind(streamId, user.id).first();
    subscribed = !!sub;
  }

  return c.json({ success: true, data: { subscribed, count: countRow?.cnt || 0 } });
});

// GET /subscribers/:streamId — 구독자 수 (공개)
broadcastNotifyRoutes.get('/subscribers/:streamId', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);
  const cnt = await DB.prepare('SELECT COUNT(*) as cnt FROM broadcast_subscriptions WHERE stream_id = ?')
    .bind(c.req.param('streamId')).first<{ cnt: number }>();
  return c.json({ success: true, data: { count: cnt?.cnt || 0 } });
});

// POST /send/:streamId — 방송 시작 알림 발송 (내부 호출용)
broadcastNotifyRoutes.post('/send/:streamId', requireAuth(), async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const streamId = c.req.param('streamId');

  // 방송 정보
  const stream = await DB.prepare('SELECT id, title, seller_id FROM live_streams WHERE id = ?')
    .bind(streamId).first<{ id: number; title: string; seller_id: number }>();
  if (!stream) return c.json({ success: false, error: '방송 없음' }, 404);

  const seller = await DB.prepare('SELECT name FROM sellers WHERE id = ?')
    .bind(stream.seller_id).first<{ name: string }>();

  // 미발송 구독자 조회
  const { results: subs } = await DB.prepare(
    'SELECT * FROM broadcast_subscriptions WHERE stream_id = ? AND notified = 0'
  ).bind(streamId).all<any>();

  if (!subs || subs.length === 0) return c.json({ success: true, data: { sent: 0 } });

  let sentCount = 0;

  for (const sub of subs) {
    // 1. 인앱 알림 (user_notifications 테이블)
    if (sub.notify_inapp) {
      try {
        await DB.prepare(`
          CREATE TABLE IF NOT EXISTS user_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL,
            title TEXT NOT NULL, message TEXT, link TEXT, is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run().catch(() => {});

        await DB.prepare(`
          INSERT INTO user_notifications (user_id, type, title, message, link)
          VALUES (?, 'broadcast_start', ?, ?, ?)
        `).bind(
          sub.user_id,
          `🔴 ${seller?.name || '셀러'} 라이브 시작!`,
          stream.title,
          `/live/${stream.id}`
        ).run();
      } catch {}
    }

    // 2. 알림톡 (전화번호 있는 경우)
    if (sub.notify_alimtalk && sub.user_phone) {
      try {
        const { sendAlimtalk } = await import('../../../features/alimtalk/aligo');
        const aligoApiKey = c.env.ALIGO_API_KEY;
        const aligoUserId = c.env.ALIGO_USER_ID;
        const aligoSenderKey = c.env.ALIGO_SENDER_KEY;

        if (aligoApiKey && aligoUserId && aligoSenderKey) {
          await sendAlimtalk({
            apikey: aligoApiKey,
            userid: aligoUserId,
            senderkey: aligoSenderKey,
            tpl_code: c.env.ALIMTALK_BROADCAST_TPL || 'TBD',
            sender: c.env.ALIGO_SENDER_PHONE || '',
            receiver_1: sub.user_phone,
            recvname_1: sub.user_name || '고객',
            subject_1: '라이브 방송 시작 알림',
            message_1: `${seller?.name || '셀러'}님의 라이브 방송이 시작되었습니다!\n\n📺 ${stream.title}\n\n👉 지금 바로 시청하기\nhttps://live.ur-team.com/live/${stream.id}`,
          }).catch(() => {});
        }
      } catch {}
    }

    // 발송 완료 마킹
    await DB.prepare('UPDATE broadcast_subscriptions SET notified = 1 WHERE id = ?').bind(sub.id).run();
    sentCount++;
  }

  return c.json({ success: true, data: { sent: sentCount, total: subs.length } });
});

export { broadcastNotifyRoutes };
