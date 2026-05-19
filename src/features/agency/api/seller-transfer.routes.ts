/**
 * Seller Transfer (Network Marketplace) — Phase 3-5
 *
 * 마운트: /api/agency/transfers
 *
 * 흐름:
 *   1) POST /         — A 가 신청 (from_agency 본인)
 *   2) POST /:id/respond  — B (to_agency) 가 수락/거절
 *   3) 셀러 본인이 /api/seller/transfers/:id/respond 로 직접 동의/거부
 *      → 매핑 변경 (sellerTransferRespondRoutes)
 *
 * 권한:
 *   - POST / : from_agency = 본인
 *   - POST /:id/respond : to_agency = 본인
 *   - 셀러 동의는 셀러 본인 토큰만 (별도 라우터)
 *
 * 🛡️ 2026-04-30 TD-016 CRITICAL 보안 사고 방지:
 *   기존 /:id/seller-approve 는 from_agency 가 셀러 동의를 대행하는
 *   위험 endpoint. agency 가 셀러 행세 가능 → 셀러 동의 없이 다른 에이전시로
 *   강제 이전 가능했음. 410 Gone 으로 차단. 셀러 본인은 /api/seller/transfers
 *   에서 직접 응답해야 함.
 *
 * Cooldown: 셀러 이전 후 30일 내 재이전 차단.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';

import { swallow } from '@/worker/utils/swallow';
import { createDashboardNotification } from '../../notifications/api/dashboard-notifications.routes';
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

const COOLDOWN_DAYS = 30;

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable) return
  _done_ensureTable = true
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS seller_transfer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      from_agency_id INTEGER NOT NULL,
      to_agency_id INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      to_response_at DATETIME,
      to_response TEXT,
      seller_response_at DATETIME,
      seller_response TEXT,
      completed_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('agency:api:seller-transfer'));
}

// POST / — 신청 (from = 본인 에이전시)
app.post('/', async (c) => {
  const agency = c.get('agency');
  const body = await c.req.json<{
    seller_id: number; to_agency_id: number; reason?: string;
  }>().catch(() => ({} as any));

  if (!body.seller_id || !body.to_agency_id || body.to_agency_id === agency.id) {
    return c.json({ success: false, error: 'invalid params' }, 400);
  }

  // 셀러가 본 에이전시 소속 확인
  const ms = await c.env.DB.prepare(
    `SELECT 1 FROM agency_sellers WHERE agency_id = ? AND seller_id = ?`
  ).bind(agency.id, body.seller_id).first().catch(() => null);
  if (!ms) {
    return c.json({ success: false, error: '본 에이전시 소속 셀러가 아닙니다.' }, 403);
  }

  // Cooldown 확인 — 30일 내 완료된 이전 있으면 차단
  const recent = await c.env.DB.prepare(`
    SELECT id FROM seller_transfer_requests
    WHERE seller_id = ? AND status = 'completed'
      AND completed_at > datetime('now', '-${COOLDOWN_DAYS} days')
    LIMIT 1
  `).bind(body.seller_id).first().catch(() => null);
  if (recent) {
    return c.json({ success: false, error: `최근 이전 후 ${COOLDOWN_DAYS}일 cooldown 중입니다.` }, 409);
  }

  await ensureTable(c.env.DB);

  const result = await c.env.DB.prepare(`
    INSERT INTO seller_transfer_requests
      (seller_id, from_agency_id, to_agency_id, reason)
    VALUES (?, ?, ?, ?)
  `).bind(body.seller_id, agency.id, body.to_agency_id, (body.reason || '').slice(0, 500)).run();

  // to_agency 에 알림
  await c.env.DB.prepare(`
    INSERT INTO agency_notifications (agency_id, type, title, message, link)
    VALUES (?, 'seller_transfer_request', ?, ?, ?)
  `).bind(
    body.to_agency_id,
    `🔄 셀러 이전 신청 도착`,
    `셀러 #${body.seller_id} 이전 신청이 들어왔습니다. 검토 후 응답해주세요.`,
    `/agency/transfers/${result.meta.last_row_id}`
  ).run().catch(swallow('agency:api:seller-transfer'));

  return c.json({ success: true, data: { id: result.meta.last_row_id, status: 'pending' } });
});

// GET / — 본 에이전시 관련 이전 신청 (보낸 + 받은)
app.get('/', async (c) => {
  const agency = c.get('agency');
  await ensureTable(c.env.DB);

  const rows = await c.env.DB.prepare(`
    SELECT t.*,
      sa.name AS from_agency_name, sb.name AS to_agency_name,
      s.business_name AS seller_name
    FROM seller_transfer_requests t
    LEFT JOIN agencies sa ON sa.id = t.from_agency_id
    LEFT JOIN agencies sb ON sb.id = t.to_agency_id
    LEFT JOIN sellers s ON s.id = t.seller_id
    WHERE t.from_agency_id = ? OR t.to_agency_id = ?
    ORDER BY t.created_at DESC
    LIMIT 100
  `).bind(agency.id, agency.id).all().catch(() => ({ results: [] as any[] }));

  return c.json({ success: true, data: rows.results || [] });
});

// POST /:id/respond — B 가 수락/거절
app.post('/:id/respond', async (c) => {
  const agency = c.get('agency');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ response: 'accept' | 'reject'; reason?: string }>().catch(() => ({} as any));

  if (body.response !== 'accept' && body.response !== 'reject') {
    return c.json({ success: false, error: 'response must be accept|reject' }, 400);
  }

  const t = await c.env.DB.prepare(
    `SELECT * FROM seller_transfer_requests WHERE id = ?`
  ).bind(id).first<{
    id: number; seller_id: number; from_agency_id: number; to_agency_id: number; status: string;
  }>().catch(() => null);

  if (!t) return c.json({ success: false, error: 'not found' }, 404);
  if (Number(t.to_agency_id) !== Number(agency.id)) {
    return c.json({ success: false, error: 'not your transfer' }, 403);
  }
  if (t.status !== 'pending') return c.json({ success: false, error: '이미 응답됨' }, 409);

  const newStatus = body.response === 'accept' ? 'accepted_by_to' : 'rejected';

  await c.env.DB.prepare(`
    UPDATE seller_transfer_requests
    SET status = ?, to_response = ?, to_response_at = datetime('now'),
        rejection_reason = ?
    WHERE id = ?
  `).bind(newStatus, body.response, body.response === 'reject' ? (body.reason || '') : null, id).run();

  // 🛡️ 2026-04-30 TD-016: 셀러 본인이 직접 동의해야 하므로, B 가 수락한 시점에
  //   셀러에게 알림 발송 — /seller/transfers 로 들어가 본인 응답하도록 유도.
  if (newStatus === 'accepted_by_to') {
    createDashboardNotification(
      c.env.DB, 'seller', String(t.seller_id),
      'seller_transfer_pending_approval',
      '🔄 에이전시 이전 요청 — 동의 필요',
      '다른 에이전시 소속으로 이전 요청이 들어왔습니다. 본인 동의가 필요합니다.',
      '/seller/transfers',
    ).catch(swallow('agency:api:seller-transfer:notify-seller'));
  }

  return c.json({ success: true, data: { status: newStatus } });
});

// 🛡️ 2026-04-30 TD-016 CRITICAL: 기존 from_agency 가 셀러 동의 대행하던 endpoint 차단.
//   셀러 본인은 /api/seller/transfers/:id/respond 에서 직접 응답해야 함.
app.post('/:id/seller-approve', async (c) => {
  return c.json({
    success: false,
    error: '보안 강화: 셀러 본인이 직접 /seller/transfers 에서 동의해야 합니다. 셀러에게 안내해 주세요.',
    code: 'DEPRECATED_AGENCY_PROXY',
  }, 410);
});

// POST /:id/cancel — from_agency 가 신청 취소 (응답 전만)
app.post('/:id/cancel', async (c) => {
  const agency = c.get('agency');
  const id = Number(c.req.param('id'));

  await c.env.DB.prepare(`
    UPDATE seller_transfer_requests
    SET status = 'cancelled'
    WHERE id = ? AND from_agency_id = ? AND status = 'pending'
  `).bind(id, agency.id).run().catch(swallow('agency:api:seller-transfer'));

  return c.json({ success: true });
});

export { app as sellerTransferRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
