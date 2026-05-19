/**
 * PK Battles Routes — Phase 2-7 (셀러 vs 셀러 매출 경쟁)
 *
 * 마운트:
 *   /api/agency/pk             — 에이전시 (매칭/관리)
 *   /api/pk-public             — 공개 (시청자 화면, 활성 PK 조회)
 *
 * 흐름:
 *   1) 에이전시 owner/manager 가 소속 셀러 2명 + 시간 입력 → POST /
 *   2) 셀러 둘 다 라이브 시작 → POST /:id/start
 *   3) 자동 ends_at 까지 매출 집계 (cron 또는 on-demand)
 *   4) ends_at 시점에 우승자 자동 결정 + 보상
 *
 * 마이그레이션 0228 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';

import { swallow } from '@/worker/utils/swallow';
type AgencyCtx = {
  Bindings: Env;
  Variables: { agency: { id: number; email?: string } };
};

const app = new Hono<AgencyCtx>();
const publicApp = new Hono<{ Bindings: Env }>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null;
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'agency' || !payload.sub) return null;
    return { id: Number(payload.sub), email: String(payload.email) };
  } catch { return null; }
}

const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '');
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency']);
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' };
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401);
  c.set('agency', payload);
  return next();
};

app.use('*', requireAgency);

const ALLOWED_DURATIONS = [15, 30, 60];

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable) return
  _done_ensureTable = true
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS pk_battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER,
      seller_a_id INTEGER NOT NULL,
      seller_b_id INTEGER NOT NULL,
      live_a_id INTEGER,
      live_b_id INTEGER,
      duration_minutes INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      ends_at DATETIME,
      revenue_a INTEGER DEFAULT 0,
      revenue_b INTEGER DEFAULT 0,
      winner_seller_id INTEGER,
      winner_reward_deal INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('agency:api:pk-battles'));
}

interface BattleRow {
  id: number;
  agency_id: number | null;
  seller_a_id: number;
  seller_b_id: number;
  live_a_id: number | null;
  live_b_id: number | null;
  duration_minutes: number;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  revenue_a: number;
  revenue_b: number;
  winner_seller_id: number | null;
  created_at: string;
}

// POST / — PK 매칭 생성 (에이전시)
app.post('/', async (c) => {
  const agency = c.get('agency');
  const body = await c.req.json<{
    seller_a_id: number; seller_b_id: number; duration_minutes: number;
  }>().catch(() => ({} as any));

  if (!body.seller_a_id || !body.seller_b_id || body.seller_a_id === body.seller_b_id) {
    return c.json({ success: false, error: 'invalid sellers' }, 400);
  }
  if (!ALLOWED_DURATIONS.includes(body.duration_minutes)) {
    return c.json({ success: false, error: 'duration must be 15/30/60' }, 400);
  }

  // 두 셀러가 본 에이전시 소속인지 검증
  const cnt = await c.env.DB.prepare(`
    SELECT COUNT(*) AS cnt FROM agency_sellers
    WHERE agency_id = ? AND seller_id IN (?, ?)
  `).bind(agency.id, body.seller_a_id, body.seller_b_id).first<{ cnt: number }>().catch(() => null);
  if ((cnt?.cnt ?? 0) !== 2) {
    return c.json({ success: false, error: '두 셀러 모두 본 에이전시 소속이어야 합니다.' }, 403);
  }

  await ensureTable(c.env.DB);

  const result = await c.env.DB.prepare(`
    INSERT INTO pk_battles (agency_id, seller_a_id, seller_b_id, duration_minutes)
    VALUES (?, ?, ?, ?)
  `).bind(agency.id, body.seller_a_id, body.seller_b_id, body.duration_minutes).run();

  return c.json({
    success: true,
    data: { id: result.meta.last_row_id, status: 'pending' },
  });
});

// GET / — 본 에이전시 PK 목록
app.get('/', async (c) => {
  const agency = c.get('agency');
  await ensureTable(c.env.DB);

  const rows = await c.env.DB.prepare(`
    SELECT pk.*,
      sa.business_name AS seller_a_name, sa.profile_image AS seller_a_image,
      sb.business_name AS seller_b_name, sb.profile_image AS seller_b_image
    FROM pk_battles pk
    LEFT JOIN sellers sa ON sa.id = pk.seller_a_id
    LEFT JOIN sellers sb ON sb.id = pk.seller_b_id
    WHERE pk.agency_id = ?
    ORDER BY pk.created_at DESC
    LIMIT 50
  `).bind(agency.id).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

// POST /:id/start — PK 시작 (두 셀러 라이브 모두 active 일 때)
app.post('/:id/start', async (c) => {
  const agency = c.get('agency');
  const id = Number(c.req.param('id'));

  const battle = await c.env.DB.prepare(
    `SELECT * FROM pk_battles WHERE id = ? AND agency_id = ?`
  ).bind(id, agency.id).first<BattleRow>().catch(() => null);
  if (!battle) return c.json({ success: false, error: 'not found' }, 404);
  if (battle.status !== 'pending') return c.json({ success: false, error: '이미 시작/종료됨' }, 409);

  // 셀러들의 활성 라이브 찾기
  const liveA = await c.env.DB.prepare(`
    SELECT id FROM live_streams WHERE seller_id = ? AND status IN ('live', 'active') ORDER BY created_at DESC LIMIT 1
  `).bind(battle.seller_a_id).first<{ id: number }>().catch(() => null);
  const liveB = await c.env.DB.prepare(`
    SELECT id FROM live_streams WHERE seller_id = ? AND status IN ('live', 'active') ORDER BY created_at DESC LIMIT 1
  `).bind(battle.seller_b_id).first<{ id: number }>().catch(() => null);

  if (!liveA || !liveB) {
    return c.json({ success: false, error: '두 셀러 모두 라이브 중이어야 합니다.' }, 409);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + battle.duration_minutes * 60 * 1000).toISOString();

  await c.env.DB.prepare(`
    UPDATE pk_battles
    SET status = 'live', live_a_id = ?, live_b_id = ?,
        started_at = datetime('now'), ends_at = ?
    WHERE id = ?
  `).bind(liveA.id, liveB.id, endsAt, id).run();

  return c.json({
    success: true,
    data: { id, ends_at: endsAt, live_a_id: liveA.id, live_b_id: liveB.id },
  });
});

// POST /:id/cancel — 취소
app.post('/:id/cancel', async (c) => {
  const agency = c.get('agency');
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare(`
    UPDATE pk_battles SET status = 'cancelled'
    WHERE id = ? AND agency_id = ? AND status IN ('pending', 'live')
  `).bind(id, agency.id).run().catch(swallow('agency:api:pk-battles'));
  return c.json({ success: true });
});

// 공개: GET /live/:live_id — 특정 라이브가 PK 중인지 + 현황
publicApp.get('/live/:live_id', async (c) => {
  const liveId = Number(c.req.param('live_id'));
  if (!Number.isFinite(liveId)) return c.json({ success: false, error: 'invalid id' }, 400);

  const row = await c.env.DB.prepare(`
    SELECT pk.id, pk.seller_a_id, pk.seller_b_id, pk.live_a_id, pk.live_b_id,
           pk.duration_minutes, pk.status, pk.started_at, pk.ends_at,
           pk.revenue_a, pk.revenue_b, pk.winner_seller_id,
           sa.business_name AS seller_a_name,
           sb.business_name AS seller_b_name
    FROM pk_battles pk
    LEFT JOIN sellers sa ON sa.id = pk.seller_a_id
    LEFT JOIN sellers sb ON sb.id = pk.seller_b_id
    WHERE (pk.live_a_id = ? OR pk.live_b_id = ?) AND pk.status IN ('live', 'ended')
    ORDER BY pk.started_at DESC LIMIT 1
  `).bind(liveId, liveId).first().catch(() => null);

  return c.json({ success: true, data: row || null });
});

/**
 * Cron 또는 후원/주문 hook 에서 호출 — PK 매출 실시간 업데이트.
 */
export async function tickPkBattles(DB: D1Database): Promise<void> {
  try {
    const active = await DB.prepare(`
      SELECT id, seller_a_id, seller_b_id, started_at, ends_at, status
      FROM pk_battles WHERE status = 'live'
    `).all<{ id: number; seller_a_id: number; seller_b_id: number; started_at: string; ends_at: string; status: string }>()
      .catch(() => ({ results: [] as any[] }));

    const now = new Date();
    for (const b of active.results || []) {
      // 매출 집계 — orders + donations during PK window
      const revA = await DB.prepare(`
        SELECT
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ? AND created_at <= ?) +
          (SELECT COALESCE(SUM(deal_amount), 0) FROM donations WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ? AND created_at <= ?) AS rev
      `).bind(b.seller_a_id, b.started_at, b.ends_at, b.seller_a_id, b.started_at, b.ends_at)
        .first<{ rev: number }>().catch(() => null);
      const revB = await DB.prepare(`
        SELECT
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ? AND created_at <= ?) +
          (SELECT COALESCE(SUM(deal_amount), 0) FROM donations WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ? AND created_at <= ?) AS rev
      `).bind(b.seller_b_id, b.started_at, b.ends_at, b.seller_b_id, b.started_at, b.ends_at)
        .first<{ rev: number }>().catch(() => null);

      const revenueA = revA?.rev ?? 0;
      const revenueB = revB?.rev ?? 0;

      // 종료 시점 도달 → 우승자 결정
      if (now.toISOString() >= b.ends_at) {
        const winnerId = revenueA > revenueB ? b.seller_a_id
          : revenueB > revenueA ? b.seller_b_id : null;
        await DB.prepare(`
          UPDATE pk_battles
          SET status = 'ended', revenue_a = ?, revenue_b = ?, winner_seller_id = ?
          WHERE id = ?
        `).bind(revenueA, revenueB, winnerId, b.id).run().catch(swallow('agency:api:pk-battles'));
      } else {
        await DB.prepare(`
          UPDATE pk_battles SET revenue_a = ?, revenue_b = ? WHERE id = ?
        `).bind(revenueA, revenueB, b.id).run().catch(swallow('agency:api:pk-battles'));
      }
    }
  } catch (err) {
    console.error('[pk-battles] tick failed:', err);
  }
}

export { app as pkBattlesRoutes, publicApp as pkBattlesPublicRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
