/**
 * Live Start — Loyal/VIP Follower Notification
 *
 * 셀러가 라이브 시작 시 호출 → 충성도 4단계 시청자에게 in-app 알림 발송.
 *
 * 마운트: /api/seller/live-notify
 *
 * Endpoints:
 *   POST /          — 활성 라이브에 대한 알림 발송
 *
 * 정책:
 *   - VIP / loyal 시청자에게 우선 발송
 *   - 라이브 1회당 1번만 발송 가능 (남용 방지)
 *   - 최대 500명까지 (배치)
 *
 * 마이그레이션: dashboard_notifications 사용 (기존)
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';
import { computeViewerLoyalty } from '@/shared/utils/viewer-loyalty';

import { swallow } from '@/worker/utils/swallow';
type SellerCtx = { Bindings: Env; Variables: { seller: { id: number; email: string } } };
const app = new Hono<SellerCtx>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const requireSeller = async (c: any, next: Next) => {
  const token = getBearerToken(c.req.header('Authorization')) ?? '';
  if (!token) return c.json({ success: false, error: 'unauth' }, 401);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'seller' || !payload.sub) return c.json({ success: false, error: 'unauth' }, 401);
    c.set('seller', { id: Number(payload.sub), email: String(payload.email) });
    return next();
  } catch {
    return c.json({ success: false, error: 'unauth' }, 401);
  }
};

app.use('*', requireSeller);

const MAX_RECIPIENTS = 500;

// POST / — 본 셀러의 활성 라이브 시청자 (loyal+vip) 에게 알림 발송
app.post('/', async (c) => {
  const seller = c.get('seller');
  const body = await c.req.json<{ live_id: number; min_tier?: 'loyal' | 'vip' }>().catch(() => ({} as any));

  if (!body.live_id) return c.json({ success: false, error: 'live_id 필수' }, 400);

  // 라이브 본인 소유 + active 검증
  const ls = await c.env.DB.prepare(
    `SELECT id, seller_id, title, status FROM live_streams WHERE id = ?`
  ).bind(body.live_id).first<{ id: number; seller_id: number; title: string; status: string }>().catch(() => null);

  if (!ls) return c.json({ success: false, error: 'live not found' }, 404);
  if (Number(ls.seller_id) !== seller.id) return c.json({ success: false, error: 'not your live' }, 403);
  if (ls.status !== 'live' && ls.status !== 'active') {
    return c.json({ success: false, error: 'live must be active' }, 409);
  }

  // 멱등 — 라이브 1회당 1번만 (live_notify_log 기록 기반)
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS live_notify_log (
        live_stream_id INTEGER PRIMARY KEY,
        seller_id INTEGER NOT NULL,
        notified_count INTEGER DEFAULT 0,
        notified_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(swallow('seller:api:live-notify-followers'));

    const existed = await c.env.DB.prepare(
      `SELECT live_stream_id FROM live_notify_log WHERE live_stream_id = ?`
    ).bind(body.live_id).first().catch(() => null);
    if (existed) {
      return c.json({ success: false, error: '이번 라이브는 이미 알림 발송됨', code: 'ALREADY_NOTIFIED' }, 409);
    }
  } catch { /* skip */ }

  // 본 셀러에게 시청 + 결제 기록 있는 user_id 조회
  // (visits + payments + spent 합산 → loyalty 계산)
  const visitorRows = await c.env.DB.prepare(`
    SELECT DISTINCT user_id FROM (
      SELECT lc.user_id FROM live_chat lc
      JOIN live_streams ls ON ls.id = lc.live_stream_id
      WHERE ls.seller_id = ?
      UNION
      SELECT user_id FROM orders WHERE seller_id = ? AND payment_status = 'approved'
    ) WHERE user_id IS NOT NULL
    LIMIT 5000
  `).bind(seller.id, seller.id).all<{ user_id: number }>().catch(() => ({ results: [] as any[] }));

  const minTier = body.min_tier || 'loyal';
  const tierRank: Record<string, number> = { newbie: 0, regular: 1, loyal: 2, vip: 3 };
  const minRank = tierRank[minTier];

  let sent = 0;

  for (const v of visitorRows.results || []) {
    if (sent >= MAX_RECIPIENTS) break;
    if (!v.user_id) continue;

    try {
      // 시청자 통계 조회 → 충성도 계산
      const stats = await c.env.DB.prepare(`
        SELECT
          (SELECT COUNT(DISTINCT ls.id) FROM live_chat lc
            JOIN live_streams ls ON ls.id = lc.live_stream_id
            WHERE lc.user_id = ? AND ls.seller_id = ?) AS visits,
          (SELECT COUNT(*) FROM orders
            WHERE user_id = ? AND seller_id = ? AND payment_status = 'approved') AS payments,
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders
            WHERE user_id = ? AND seller_id = ? AND payment_status = 'approved') AS spent
      `).bind(v.user_id, seller.id, v.user_id, seller.id, v.user_id, seller.id)
        .first<{ visits: number; payments: number; spent: number }>().catch(() => null);

      if (!stats) continue;

      const loyalty = computeViewerLoyalty({
        visits: stats.visits,
        payments: stats.payments,
        totalSpent: stats.spent,
      });

      if (tierRank[loyalty] < minRank) continue;

      // dashboard_notifications 발송 (인앱 알림)
      await c.env.DB.prepare(`
        INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
        VALUES ('user', ?, 'live_started', ?, ?, ?, datetime('now'))
      `).bind(
        String(v.user_id),
        `🔴 ${ls.title}`,
        `좋아하시는 셀러가 지금 라이브 중! 응원하러 가볼까요?`,
        `/live/${body.live_id}`,
      ).run();

      sent++;
    } catch { /* skip individual failures */ }
  }

  // 발송 로그
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO live_notify_log (live_stream_id, seller_id, notified_count)
    VALUES (?, ?, ?)
  `).bind(body.live_id, seller.id, sent).run().catch(swallow('seller:api:live-notify-followers'));

  return c.json({
    success: true,
    data: { sent, max: MAX_RECIPIENTS, min_tier: minTier },
  });
});

export { app as liveNotifyFollowersRoutes };
