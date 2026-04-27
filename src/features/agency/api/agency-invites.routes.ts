/**
 * Agency Invite Codes — QR/링크 영입 시스템 (Phase 1-3)
 *
 * 라우트:
 *   POST /api/agency/invites              — 새 코드 발급 (인증 필요)
 *   GET  /api/agency/invites              — 발급 내역 + 사용 통계
 *   DELETE /api/agency/invites/:code      — 비활성화 (soft)
 *   GET  /api/invite/:code                — 공개 (가입 폼에서 에이전시 정보 조회)
 *
 * 코드 정책: 8자 대문자 영숫자, 7일 유효, 기본 max_uses=100.
 * 셀러 register 라우트가 ?invite=<code> 받으면 agencySeller 자동 매핑.
 *
 * 마이그레이션 0223 미적용 시 graceful skip (try/catch + 빈 결과 반환).
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

// ── auth (sub-app 부모 미들웨어 미상속) ──
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

const CODE_LENGTH = 8;
const VALID_DAYS = 7;
const DEFAULT_MAX_USES = 100;

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 (0,O,1,I,L) 제외
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function ensureTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_invite_codes (
      code TEXT PRIMARY KEY,
      agency_id INTEGER NOT NULL,
      label TEXT,
      max_uses INTEGER DEFAULT 100,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
  `).run().catch(() => {});
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_invite_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
}

interface InviteCodeRow {
  code: string;
  agency_id: number;
  label: string | null;
  max_uses: number;
  used_count: number;
  is_active: number;
  created_at: string;
  expires_at: string;
}

// POST /api/agency/invites — 새 코드 발급
app.use('*', requireAgency);

app.post('/', async (c) => {
  const agency = c.get('agency');
  const body = await c.req.json<{ label?: string; max_uses?: number }>().catch(() => ({} as { label?: string; max_uses?: number }));

  await ensureTable(c.env.DB);

  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const exists = await c.env.DB.prepare('SELECT 1 FROM agency_invite_codes WHERE code = ?')
      .bind(code).first().catch(() => null);
    if (!exists) break;
  }

  const expiresAt = new Date(Date.now() + VALID_DAYS * 86400_000).toISOString();
  const maxUses = Number.isFinite(body.max_uses) && body.max_uses! > 0 && body.max_uses! <= 10000
    ? body.max_uses! : DEFAULT_MAX_USES;
  const label = body.label?.slice(0, 100) || null;

  await c.env.DB.prepare(`
    INSERT INTO agency_invite_codes (code, agency_id, label, max_uses, expires_at, created_by_email)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(code, agency.id, label, maxUses, expiresAt, agency.email || null).run();

  return c.json({
    success: true,
    data: {
      code,
      label,
      max_uses: maxUses,
      expires_at: expiresAt,
      invite_url: `/seller/register?invite=${code}`,
    },
  });
});

// GET /api/agency/invites — 발급 내역 + 사용 통계
app.get('/', async (c) => {
  const agency = c.get('agency');
  await ensureTable(c.env.DB);

  const rows = await c.env.DB.prepare(`
    SELECT code, label, max_uses, used_count, is_active, created_at, expires_at
    FROM agency_invite_codes
    WHERE agency_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(agency.id).all<InviteCodeRow>().catch(() => ({ results: [] as InviteCodeRow[] }));

  const now = new Date().toISOString();
  const items = (rows.results || []).map((r) => ({
    ...r,
    is_expired: r.expires_at < now,
    is_full: r.used_count >= r.max_uses,
  }));

  return c.json({ success: true, data: items });
});

// DELETE /api/agency/invites/:code — 비활성화 (soft)
app.delete('/:code', async (c) => {
  const agency = c.get('agency');
  const code = c.req.param('code');

  await c.env.DB.prepare(`
    UPDATE agency_invite_codes SET is_active = 0
    WHERE code = ? AND agency_id = ?
  `).bind(code, agency.id).run().catch(() => {});

  return c.json({ success: true });
});

// 공개 라우터 (별도 마운트 — /api/invite/:code, 인증 불필요)
const publicApp = new Hono<{ Bindings: Env }>();

// GET /api/invite/:code — 가입 폼에서 에이전시 정보 prefill
publicApp.get('/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) {
    return c.json({ success: false, error: 'invalid code format' }, 400);
  }

  const row = await c.env.DB.prepare(`
    SELECT
      ic.code, ic.agency_id, ic.label, ic.max_uses, ic.used_count, ic.is_active, ic.expires_at,
      a.name AS agency_name, a.contact_name AS agency_contact
    FROM agency_invite_codes ic
    JOIN agencies a ON a.id = ic.agency_id
    WHERE ic.code = ?
  `).bind(code).first<{
    code: string; agency_id: number; label: string | null;
    max_uses: number; used_count: number; is_active: number;
    expires_at: string; agency_name: string; agency_contact: string;
  }>().catch(() => null);

  if (!row) return c.json({ success: false, error: 'not_found' }, 404);

  const now = new Date().toISOString();
  if (!row.is_active) return c.json({ success: false, error: 'code_inactive' }, 410);
  if (row.expires_at < now) return c.json({ success: false, error: 'code_expired' }, 410);
  if (row.used_count >= row.max_uses) return c.json({ success: false, error: 'code_used_up' }, 410);

  return c.json({
    success: true,
    data: {
      code: row.code,
      agency_id: row.agency_id,
      agency_name: row.agency_name,
      agency_contact: row.agency_contact,
      label: row.label,
      remaining_uses: row.max_uses - row.used_count,
      expires_at: row.expires_at,
    },
  });
});

/**
 * 셀러 회원가입 시 호출 — 코드 검증 + 매핑 + used_count 증가.
 * 외부에서 호출 (seller-auth.routes.ts 의 register 핸들러).
 */
export async function consumeInviteCode(
  DB: D1Database,
  code: string,
  sellerId: number
): Promise<{ ok: boolean; agency_id?: number; reason?: string }> {
  await ensureTable(DB);
  const upper = code.toUpperCase();

  const row = await DB.prepare(`
    SELECT agency_id, max_uses, used_count, is_active, expires_at
    FROM agency_invite_codes WHERE code = ?
  `).bind(upper).first<{
    agency_id: number; max_uses: number; used_count: number;
    is_active: number; expires_at: string;
  }>().catch(() => null);

  if (!row) return { ok: false, reason: 'not_found' };

  const now = new Date().toISOString();
  if (!row.is_active) return { ok: false, reason: 'inactive' };
  if (row.expires_at < now) return { ok: false, reason: 'expired' };
  if (row.used_count >= row.max_uses) return { ok: false, reason: 'used_up' };

  // 매핑 (멱등 — UNIQUE 제약 있음)
  await DB.prepare(`
    INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id) VALUES (?, ?)
  `).bind(row.agency_id, sellerId).run().catch(() => {});

  // used_count 증가 + 사용 로그
  await DB.prepare(`UPDATE agency_invite_codes SET used_count = used_count + 1 WHERE code = ?`)
    .bind(upper).run().catch(() => {});
  await DB.prepare(`
    INSERT INTO agency_invite_usage (code, agency_id, seller_id) VALUES (?, ?, ?)
  `).bind(upper, row.agency_id, sellerId).run().catch(() => {});

  return { ok: true, agency_id: row.agency_id };
}

export { app as agencyInvitesRoutes, publicApp as inviteCodePublicRoutes };
