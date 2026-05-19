/**
 * Agency Self Events — 자사 매출 챌린지 (운영 안정 + 매출 임팩트)
 *
 * 마운트: /api/agency/self-events
 *
 * Endpoints:
 *   GET    /                — 본 에이전시 이벤트 목록 (active/ended)
 *   POST   /                — 새 이벤트 생성 (campaign 권한)
 *   POST   /:id/cancel      — 이벤트 취소 (campaign 권한)
 *   POST   /:id/join        — 셀러가 참여 (참여형 이벤트)
 *   GET    /:id/leaderboard — 참여자 순위 (current_value DESC)
 *
 * 메트릭:
 *   revenue     — 기간 내 매출 (딜)
 *   live_count  — 기간 내 라이브 횟수
 *   viewer_peak — 기간 내 피크 시청자 수
 *
 * 마이그레이션 0231 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';
import { requireAgencyPermission } from './agency-role-guard';

import { swallow } from '@/worker/utils/swallow';
type AgencyCtx = {
  Bindings: Env;
  Variables: { agency: { id: number; email?: string } };
};

const app = new Hono<AgencyCtx>();

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

const ALLOWED_METRICS = ['revenue', 'live_count', 'viewer_peak'] as const;
type Metric = (typeof ALLOWED_METRICS)[number];

async function ensureTables(DB: D1Database) {
  if (_done_ensureTables) return
  _done_ensureTables = true
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_self_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      metric TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      reward_deal INTEGER NOT NULL DEFAULT 0,
      max_winners INTEGER DEFAULT 100,
      status TEXT DEFAULT 'active',
      created_by_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('agency:api:agency-self-events'));
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_self_event_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      current_value INTEGER DEFAULT 0,
      achieved INTEGER DEFAULT 0,
      achieved_at DATETIME,
      reward_paid INTEGER DEFAULT 0,
      UNIQUE (event_id, seller_id)
    )
  `).run().catch(swallow('agency:api:agency-self-events'));
}

// GET / — 본 에이전시 이벤트 목록
app.get('/', async (c) => {
  const agencyId = c.get('agency').id;
  await ensureTables(c.env.DB);

  const rows = await c.env.DB.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM agency_self_event_participants WHERE event_id = e.id) AS participant_count,
      (SELECT COUNT(*) FROM agency_self_event_participants WHERE event_id = e.id AND achieved = 1) AS achieved_count
    FROM agency_self_events e
    WHERE e.agency_id = ?
    ORDER BY e.created_at DESC
    LIMIT 100
  `).bind(agencyId).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

// POST / — 새 이벤트 생성
app.post('/', requireAgencyPermission('campaign'), async (c) => {
  const agency = c.get('agency');
  const body = await c.req.json<{
    title: string; description?: string;
    start_date: string; end_date: string;
    metric: Metric; target_value: number;
    reward_deal: number; max_winners?: number;
  }>().catch(() => ({} as any));

  if (!body.title || !body.start_date || !body.end_date || !body.metric || !body.target_value) {
    return c.json({ success: false, error: 'title/start_date/end_date/metric/target_value 필수' }, 400);
  }
  if (!ALLOWED_METRICS.includes(body.metric)) {
    return c.json({ success: false, error: 'metric: revenue|live_count|viewer_peak' }, 400);
  }
  if (body.target_value <= 0 || body.target_value > 1_000_000_000) {
    return c.json({ success: false, error: 'target_value 범위 오류' }, 400);
  }
  if (body.start_date >= body.end_date) {
    return c.json({ success: false, error: 'end_date > start_date' }, 400);
  }

  await ensureTables(c.env.DB);

  const r = await c.env.DB.prepare(`
    INSERT INTO agency_self_events
      (agency_id, title, description, start_date, end_date, metric, target_value, reward_deal, max_winners, created_by_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    agency.id,
    body.title.slice(0, 200),
    (body.description || '').slice(0, 1000),
    body.start_date,
    body.end_date,
    body.metric,
    body.target_value,
    body.reward_deal || 0,
    body.max_winners || 100,
    agency.email || null,
  ).run();

  // 본 에이전시 소속 셀러에게 알림 (참여 가능)
  await c.env.DB.prepare(`
    INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
    SELECT 'seller', CAST(seller_id AS TEXT), 'agency_event', ?, ?, ?, datetime('now')
    FROM agency_sellers WHERE agency_id = ?
  `).bind(
    `🎯 새 이벤트: ${body.title}`,
    `${body.metric === 'revenue' ? '매출' : body.metric === 'live_count' ? '라이브 횟수' : '피크 시청자'} ${Number(body.target_value ?? 0).toLocaleString('ko-KR')} 달성 시 ${Number(body.reward_deal ?? 0).toLocaleString('ko-KR')}딜 지급. 참여하시려면 에이전시에 문의.`,
    `/seller`,
    agency.id,
  ).run().catch(swallow('agency:api:agency-self-events'));

  return c.json({ success: true, data: { id: r.meta.last_row_id } });
});

// POST /:id/cancel
app.post('/:id/cancel', requireAgencyPermission('campaign'), async (c) => {
  const agencyId = c.get('agency').id;
  const id = Number(c.req.param('id'));

  await c.env.DB.prepare(`
    UPDATE agency_self_events SET status = 'cancelled'
    WHERE id = ? AND agency_id = ? AND status = 'active'
  `).bind(id, agencyId).run().catch(swallow('agency:api:agency-self-events'));

  return c.json({ success: true });
});

// POST /:id/join — 셀러가 참여 (셀러 토큰 또는 에이전시가 대행)
app.post('/:id/join', async (c) => {
  const agencyId = c.get('agency').id;
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ seller_id: number }>().catch(() => ({} as any));

  if (!body.seller_id) return c.json({ success: false, error: 'seller_id 필수' }, 400);

  // 본 에이전시 소속 셀러인지 확인
  const ms = await c.env.DB.prepare(
    `SELECT 1 FROM agency_sellers WHERE agency_id = ? AND seller_id = ?`
  ).bind(agencyId, body.seller_id).first().catch(() => null);
  if (!ms) return c.json({ success: false, error: '본 에이전시 소속 셀러가 아닙니다.' }, 403);

  // 이벤트 검증
  const ev = await c.env.DB.prepare(
    `SELECT id, agency_id, status, end_date FROM agency_self_events WHERE id = ?`
  ).bind(id).first<{ id: number; agency_id: number; status: string; end_date: string }>()
    .catch(() => null);
  if (!ev || ev.agency_id !== agencyId) return c.json({ success: false, error: 'not found' }, 404);
  if (ev.status !== 'active') return c.json({ success: false, error: '진행 중 이벤트만 참여 가능' }, 409);

  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO agency_self_event_participants (event_id, seller_id)
    VALUES (?, ?)
  `).bind(id, body.seller_id).run().catch(swallow('agency:api:agency-self-events'));

  return c.json({ success: true });
});

// GET /:id/leaderboard
app.get('/:id/leaderboard', async (c) => {
  const agencyId = c.get('agency').id;
  const id = Number(c.req.param('id'));

  const ev = await c.env.DB.prepare(
    `SELECT id, agency_id FROM agency_self_events WHERE id = ?`
  ).bind(id).first<{ id: number; agency_id: number }>().catch(() => null);
  if (!ev || ev.agency_id !== agencyId) return c.json({ success: false, error: 'not found' }, 404);

  const rows = await c.env.DB.prepare(`
    SELECT p.seller_id, s.business_name, p.current_value, p.achieved, p.achieved_at, p.reward_paid
    FROM agency_self_event_participants p
    LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE p.event_id = ?
    ORDER BY p.current_value DESC, p.joined_at ASC
    LIMIT 100
  `).bind(id).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

export { app as agencySelfEventsRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTables = false
