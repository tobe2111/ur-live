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

  // 후보 user_id 수집 (중복 제거 + null 제외)
  const candidateIds = Array.from(new Set(
    (visitorRows.results || [])
      .map((v) => Number(v.user_id))
      .filter((id) => Number.isFinite(id) && id > 0)
  ));

  if (candidateIds.length > 0) {
    try {
      // 단일 GROUP BY 쿼리로 모든 후보의 visits/payments/spent 집계
      // (기존 N+1 → 1 read; 5000 명 기준 15000 → 1 reduction)
      const placeholders = candidateIds.map(() => '?').join(',');
      const aggregated = await c.env.DB.prepare(`
        SELECT user_id,
          SUM(visits) AS visits,
          SUM(payments) AS payments,
          SUM(spent) AS spent
        FROM (
          SELECT lc.user_id AS user_id,
            COUNT(DISTINCT ls.id) AS visits,
            0 AS payments,
            0 AS spent
          FROM live_chat lc
          JOIN live_streams ls ON ls.id = lc.live_stream_id
          WHERE ls.seller_id = ? AND lc.user_id IN (${placeholders})
          GROUP BY lc.user_id
          UNION ALL
          SELECT user_id AS user_id,
            0 AS visits,
            COUNT(*) AS payments,
            COALESCE(SUM(total_amount), 0) AS spent
          FROM orders
          WHERE seller_id = ? AND payment_status = 'approved' AND user_id IN (${placeholders})
          GROUP BY user_id
        )
        GROUP BY user_id
      `).bind(seller.id, ...candidateIds, seller.id, ...candidateIds)
        .all<{ user_id: number; visits: number; payments: number; spent: number }>()
        .catch(() => ({ results: [] as any[] }));

      // 자격 통과 user 만 INSERT 큐에 적재
      const inserts: D1PreparedStatement[] = [];
      for (const row of (aggregated.results || [])) {
        if (inserts.length >= MAX_RECIPIENTS) break;

        const loyalty = computeViewerLoyalty({
          visits: Number(row.visits) || 0,
          payments: Number(row.payments) || 0,
          totalSpent: Number(row.spent) || 0,
        });

        if (tierRank[loyalty] < minRank) continue;

        inserts.push(
          c.env.DB.prepare(`
            INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
            VALUES ('user', ?, 'live_started', ?, ?, ?, datetime('now'))
          `).bind(
            String(row.user_id),
            `🔴 ${ls.title}`,
            `좋아하시는 셀러가 지금 라이브 중! 응원하러 가볼까요?`,
            `/live/${body.live_id}`,
          )
        );
      }

      // 50개씩 배치 INSERT
      for (let i = 0; i < inserts.length; i += 50) {
        try {
          await c.env.DB.batch(inserts.slice(i, i + 50));
          sent += Math.min(50, inserts.length - i);
        } catch { /* batch 실패 시 다음 chunk 시도 */ }
      }
    } catch { /* aggregate / insert 실패 시 sent=0 으로 진행 */ }
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
