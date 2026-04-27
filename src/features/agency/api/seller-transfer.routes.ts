/**
 * Seller Transfer (Network Marketplace) — Phase 3-5
 *
 * 마운트: /api/agency/transfers
 *
 * 흐름:
 *   1) POST /         — A 가 신청 (from_agency 자기 자신, to_agency_id + seller_id 지정)
 *   2) POST /:id/respond  — B 가 수락/거절 (인증 = to_agency 토큰)
 *   3) POST /:id/seller-approve — 셀러가 최종 동의/거부
 *   4) 모두 동의 → agency_sellers 매핑 변경
 *
 * 권한:
 *   - POST / : from_agency = 본인
 *   - POST /:id/respond : to_agency = 본인
 *   - POST /:id/seller-approve : seller = 본인 (별도 셀러 토큰 필요 — 이번 PR 단순화: from_agency 가 셀러 동의 대행)
 *
 * Cooldown: 셀러 이전 후 30일 내 재이전 차단.
 *
 * 마이그레이션 0229 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';

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
  `).run().catch(() => {});
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
  ).run().catch(() => {});

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
  ).bind(id).first<{ id: number; to_agency_id: number; status: string }>().catch(() => null);

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

  return c.json({ success: true, data: { status: newStatus } });
});

// POST /:id/seller-approve — 셀러 최종 동의 (간이: from_agency 가 대행, 별도 셀러 인증은 추후)
app.post('/:id/seller-approve', async (c) => {
  const agency = c.get('agency');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ approved: boolean; reason?: string }>().catch(() => ({} as any));

  const t = await c.env.DB.prepare(
    `SELECT * FROM seller_transfer_requests WHERE id = ?`
  ).bind(id).first<{
    id: number; seller_id: number; from_agency_id: number; to_agency_id: number; status: string;
  }>().catch(() => null);

  if (!t) return c.json({ success: false, error: 'not found' }, 404);
  if (Number(t.from_agency_id) !== Number(agency.id)) {
    return c.json({ success: false, error: 'only from_agency can submit seller approval' }, 403);
  }
  if (t.status !== 'accepted_by_to') {
    return c.json({ success: false, error: 'B 의 수락 후에만 가능합니다.' }, 409);
  }

  if (!body.approved) {
    await c.env.DB.prepare(`
      UPDATE seller_transfer_requests
      SET status = 'rejected', seller_response = 'reject',
          seller_response_at = datetime('now'),
          rejection_reason = ?
      WHERE id = ?
    `).bind(body.reason || '셀러 거부', id).run();
    return c.json({ success: true, data: { status: 'rejected' } });
  }

  // 모두 동의 → 매핑 변경 (트랜잭션 대신 batch)
  await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM agency_sellers WHERE agency_id = ? AND seller_id = ?`
    ).bind(t.from_agency_id, t.seller_id),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id) VALUES (?, ?)`
    ).bind(t.to_agency_id, t.seller_id),
    c.env.DB.prepare(`
      UPDATE seller_transfer_requests
      SET status = 'completed', seller_response = 'approve',
          seller_response_at = datetime('now'),
          completed_at = datetime('now')
      WHERE id = ?
    `).bind(id),
  ]);

  // 양 에이전시 알림
  await c.env.DB.prepare(`
    INSERT INTO agency_notifications (agency_id, type, title, message)
    VALUES (?, 'seller_transferred_out', ?, ?), (?, 'seller_transferred_in', ?, ?)
  `).bind(
    t.from_agency_id, `셀러 이전 완료`, `셀러 #${t.seller_id} 가 다른 에이전시로 이전됐습니다.`,
    t.to_agency_id, `셀러 영입 완료`, `셀러 #${t.seller_id} 가 본 에이전시에 합류했습니다.`,
  ).run().catch(() => {});

  return c.json({ success: true, data: { status: 'completed' } });
});

// POST /:id/cancel — from_agency 가 신청 취소 (응답 전만)
app.post('/:id/cancel', async (c) => {
  const agency = c.get('agency');
  const id = Number(c.req.param('id'));

  await c.env.DB.prepare(`
    UPDATE seller_transfer_requests
    SET status = 'cancelled'
    WHERE id = ? AND from_agency_id = ? AND status = 'pending'
  `).bind(id, agency.id).run().catch(() => {});

  return c.json({ success: true });
});

export { app as sellerTransferRoutes };
