/**
 * Donation Booster Routes — Phase 2-5
 *
 * 라이브 중 후원 N배 매칭 부스터 이벤트.
 *
 * 마운트: /api/donation-boosters
 *
 * Endpoints:
 *   POST /                       — 셀러: 부스터 시작 (라이브 중)
 *   GET  /live/:live_stream_id   — 공개: 현재 활성 부스터 조회 (시청자 화면 표시용)
 *   POST /:id/cancel             — 셀러: 부스터 조기 종료
 *
 * 정책:
 *   - 라이브 1회 당 최대 1회 부스터
 *   - 매칭 배수: 1.5 / 2.0 / 3.0
 *   - 지속 시간: 300 / 600 / 900초 (5/10/15분)
 *
 * 마이그레이션 0227 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';

type SellerCtx = {
  Bindings: Env;
  Variables: { seller: { id: number; email: string } };
};

const app = new Hono<SellerCtx>();
const publicApp = new Hono<{ Bindings: Env }>();

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

const ALLOWED_MULTIPLIERS = [1.5, 2.0, 3.0];
const ALLOWED_DURATIONS = [300, 600, 900];

async function ensureTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS donation_boosters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      live_stream_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      multiplier REAL NOT NULL DEFAULT 2.0,
      duration_seconds INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ends_at DATETIME NOT NULL,
      total_donation_amount INTEGER DEFAULT 0,
      total_matched_amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    )
  `).run().catch(() => {});
}

// POST / — 부스터 시작
app.post('/', async (c) => {
  const seller = c.get('seller');
  const body = await c.req.json<{
    live_stream_id: number; multiplier: number; duration_seconds: number;
  }>().catch(() => ({} as any));

  if (!body.live_stream_id || !ALLOWED_MULTIPLIERS.includes(body.multiplier) ||
      !ALLOWED_DURATIONS.includes(body.duration_seconds)) {
    return c.json({ success: false, error: 'invalid params' }, 400);
  }

  // 라이브 소유 셀러 확인
  const ls = await c.env.DB.prepare(
    `SELECT seller_id, status FROM live_streams WHERE id = ?`
  ).bind(body.live_stream_id).first<{ seller_id: number; status: string }>().catch(() => null);
  if (!ls) return c.json({ success: false, error: 'live not found' }, 404);
  if (Number(ls.seller_id) !== Number(seller.id)) {
    return c.json({ success: false, error: 'not your live' }, 403);
  }
  if (ls.status !== 'live' && ls.status !== 'active') {
    return c.json({ success: false, error: 'live must be active' }, 409);
  }

  await ensureTable(c.env.DB);

  // 1 라이브 1 부스터 — 이미 사용했는지 확인
  const existed = await c.env.DB.prepare(
    `SELECT id FROM donation_boosters WHERE live_stream_id = ? LIMIT 1`
  ).bind(body.live_stream_id).first().catch(() => null);
  if (existed) {
    return c.json({ success: false, error: 'booster already used for this live' }, 409);
  }

  const endsAt = new Date(Date.now() + body.duration_seconds * 1000).toISOString();
  const result = await c.env.DB.prepare(`
    INSERT INTO donation_boosters
      (live_stream_id, seller_id, multiplier, duration_seconds, ends_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(body.live_stream_id, seller.id, body.multiplier, body.duration_seconds, endsAt).run();

  return c.json({
    success: true,
    data: {
      id: result.meta.last_row_id,
      multiplier: body.multiplier,
      duration_seconds: body.duration_seconds,
      ends_at: endsAt,
    },
  });
});

// POST /:id/cancel — 조기 종료
app.post('/:id/cancel', async (c) => {
  const seller = c.get('seller');
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400);

  await c.env.DB.prepare(`
    UPDATE donation_boosters
    SET status = 'cancelled', ends_at = datetime('now')
    WHERE id = ? AND seller_id = ? AND status = 'active'
  `).bind(id, seller.id).run().catch(() => {});

  return c.json({ success: true });
});

// 공개: GET /live/:live_stream_id — 현재 활성 부스터
publicApp.get('/live/:live_stream_id', async (c) => {
  const liveId = Number(c.req.param('live_stream_id'));
  if (!Number.isFinite(liveId)) return c.json({ success: false, error: 'invalid id' }, 400);

  const row = await c.env.DB.prepare(`
    SELECT id, multiplier, duration_seconds, started_at, ends_at,
           total_donation_amount, total_matched_amount, status
    FROM donation_boosters
    WHERE live_stream_id = ? AND status = 'active' AND ends_at > datetime('now')
    ORDER BY started_at DESC LIMIT 1
  `).bind(liveId).first().catch(() => null);

  return c.json({ success: true, data: row || null });
});

/**
 * 후원 발생 시 호출 — 활성 부스터 있으면 매칭 금액 추가.
 * (donation 처리 코드가 호출 — 이번 PR 에서는 helper 만 export.)
 */
export async function applyDonationBooster(
  DB: D1Database,
  liveStreamId: number,
  donationAmount: number,
): Promise<{ matched: number }> {
  try {
    const row = await DB.prepare(`
      SELECT id, multiplier FROM donation_boosters
      WHERE live_stream_id = ? AND status = 'active' AND ends_at > datetime('now')
      LIMIT 1
    `).bind(liveStreamId).first<{ id: number; multiplier: number }>();
    if (!row) return { matched: 0 };

    const matched = Math.floor(donationAmount * (row.multiplier - 1));
    await DB.prepare(`
      UPDATE donation_boosters
      SET total_donation_amount = total_donation_amount + ?,
          total_matched_amount = total_matched_amount + ?
      WHERE id = ?
    `).bind(donationAmount, matched, row.id).run().catch(() => {});

    return { matched };
  } catch {
    return { matched: 0 };
  }
}

export { app as donationBoosterRoutes, publicApp as donationBoosterPublicRoutes };
