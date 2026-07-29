/**
 * Agency Members Routes (Multi-role) — M4
 *
 * 마운트: /api/agency/members
 * 마이그레이션: 0217_agency_members.sql
 *
 * Endpoints:
 *   GET    /                          — 본인 에이전시 멤버 목록
 *   POST   /invite                    — 멤버 초대 (owner/manager만)
 *   PATCH  /:id                       — 역할/권한 변경 (owner만)
 *   POST   /:id/suspend               — 일시 정지 (owner만)
 *   POST   /:id/reactivate            — 재활성화 (owner만)
 *   DELETE /:id                       — 제거 (owner만, 자기 자신 X)
 *   POST   /accept                    — 초대 수락 (invite_token 으로, 가입 후)
 *
 * Phase 1 범위 (이 PR):
 *   - 멤버 데이터 모델 + CRUD
 *   - 권한 헬퍼 (hasPermission)
 *   - owner 자동 등록 (마이그레이션에서 처리됨)
 *
 * Phase 2 (별도 PR):
 *   - JWT 페이로드에 role/permissions 포함
 *   - requireAgencyRole(role) 미들웨어로 기존 routes 보호
 *   - 멤버별 audit log
 *
 * 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (E)
 */

import { Hono, type Next } from 'hono'
import { verify } from 'hono/jwt'
import { parseSessionCookie } from '@/worker/utils/session'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'

type AgencyCtx = {
  Bindings: Env
  Variables: { agency: { id: number; email?: string } }
}

const app = new Hono<AgencyCtx>()

// ── auth (sub-app 부모 미들웨어 미상속) ──
function getBearerToken(h?: string | null): string | null {
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch { return null }
}

const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '')
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' }
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

app.use('*', requireAgency)

// ── 권한 디폴트 ──────────────────────────────────────
type Role = 'owner' | 'manager' | 'agent' | 'analyst'

interface Permissions {
  invite: boolean       // 셀러 영입 (invite-seller, message templates)
  settle: boolean       // 정산 신청
  campaign: boolean     // 캠페인 생성/수정
  message: boolean      // 메시지 발송
  coupon: boolean       // 쿠폰 배포
  contract: boolean     // 계약 생성/수정
  members: boolean      // 멤버 관리
  view: boolean         // 조회 (모든 role 항상 true)
}

const ROLE_DEFAULTS: Record<Role, Permissions> = {
  owner:   { invite: true,  settle: true,  campaign: true,  message: true,  coupon: true,  contract: true,  members: true,  view: true },
  manager: { invite: true,  settle: true,  campaign: true,  message: true,  coupon: true,  contract: false, members: false, view: true },
  agent:   { invite: true,  settle: false, campaign: false, message: true,  coupon: true,  contract: false, members: false, view: true },
  analyst: { invite: false, settle: false, campaign: false, message: false, coupon: false, contract: false, members: false, view: true },
}

function effectivePermissions(role: Role, override?: string | null): Permissions {
  const base = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.analyst
  if (!override) return base
  try {
    const parsed = JSON.parse(override) as Partial<Permissions>
    return { ...base, ...parsed }
  } catch { return base }
}

// ── 본인이 owner 인지 확인 (현재 인증된 에이전시 = agencies.email 매칭) ──
async function isOwner(DB: D1Database, agencyId: number, email: string): Promise<boolean> {
  try {
    const row = await DB.prepare(
      "SELECT id FROM agency_members WHERE agency_id = ? AND email = ? AND role = 'owner' AND status = 'active' LIMIT 1"
    ).bind(agencyId, email).first()
    return !!row
  } catch {
    // 마이그레이션 0217 미적용 시: agencies.email 매칭으로 fallback
    const row = await DB.prepare("SELECT id FROM agencies WHERE id = ? AND email = ? LIMIT 1")
      .bind(agencyId, email).first()
    return !!row
  }
}

interface MemberRow {
  id: number
  agency_id: number
  email: string
  user_id: number | null
  role: Role
  permissions: string | null
  status: 'invited' | 'active' | 'suspended' | 'removed'
  invite_token: string | null
  invited_at: string
  invited_by: number | null
  joined_at: string | null
  last_active_at: string | null
}

// ── GET / — 멤버 목록 ─────────────────────────────────
app.get('/', async (c) => {
  const agencyId = c.get('agency').id
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, agency_id, email, user_id, role, permissions, status,
              invited_at, joined_at, last_active_at
         FROM agency_members
        WHERE agency_id = ? AND status != 'removed'
        ORDER BY
          CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'agent' THEN 2 ELSE 3 END,
          joined_at DESC NULLS LAST`
    ).bind(agencyId).all<MemberRow>()
    const enriched = (results || []).map(m => ({
      ...m,
      effective_permissions: effectivePermissions(m.role, m.permissions),
    }))
    return c.json({ success: true, data: enriched })
  } catch {
    return c.json({ success: false, error: 'agency_members 미존재 — migration 0217 필요', data: [] })
  }
})

// ── POST /invite — 멤버 초대 ──────────────────────────
app.post('/invite', async (c) => {
  const agency = c.get('agency')
  const body = await c.req.json<{
    email: string;
    role: Role;
    permissions?: Partial<Permissions>;
  }>().catch(() => null)

  if (!body || !body.email || !body.role) {
    return c.json({ success: false, error: 'email, role 필수' }, 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ success: false, error: '유효한 이메일' }, 400)
  }
  if (!(['owner', 'manager', 'agent', 'analyst'] as Role[]).includes(body.role)) {
    return c.json({ success: false, error: 'role 은 owner/manager/agent/analyst' }, 400)
  }

  // owner 만 멤버 초대 가능 (Phase 1 — 추후 manager 도 invite 가능하게 확장 가능)
  const owner = await isOwner(c.env.DB, agency.id, agency.email || '')
  if (!owner) {
    return c.json({ success: false, error: 'owner 권한 필요' }, 403)
  }

  // owner 는 본인이 이미 있으므로 추가 owner 등록 차단
  if (body.role === 'owner') {
    return c.json({ success: false, error: 'owner 는 1명만 — 이전이 필요하면 별도 절차' }, 400)
  }

  // invite_token (32 chars hex) — 이메일 링크에 포함
  const inviteToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const permJson = body.permissions ? JSON.stringify(body.permissions) : null

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO agency_members (agency_id, email, role, permissions, status, invite_token, invited_at)
      VALUES (?, ?, ?, ?, 'invited', ?, datetime('now'))
      ON CONFLICT (agency_id, email) DO UPDATE SET
        role = excluded.role,
        permissions = excluded.permissions,
        status = CASE WHEN agency_members.status = 'removed' THEN 'invited' ELSE agency_members.status END,
        invite_token = excluded.invite_token,
        invited_at = excluded.invited_at,
        updated_at = datetime('now')
    `).bind(agency.id, body.email.toLowerCase(), body.role, permJson, inviteToken).run()

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        invite_token: inviteToken,
        // 프론트엔드에서 https://live.ur-team.com/agency/accept-invite?token=... URL 생성
      },
    }, 201)
  } catch (e) {
    return c.json({ success: false, error: 'agency_members 미존재 — migration 0217 필요' }, 500)
  }
})

// ── PATCH /:id — 역할/권한 변경 ──────────────────────
app.patch('/:id', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  const owner = await isOwner(c.env.DB, agency.id, agency.email || '')
  if (!owner) return c.json({ success: false, error: 'owner 권한 필요' }, 403)

  const body = await c.req.json<{ role?: Role; permissions?: Partial<Permissions> }>().catch(() => ({} as { role?: Role; permissions?: Partial<Permissions> }))

  // 자기 자신 (owner) 의 role 변경 차단
  const target = await c.env.DB.prepare(
    'SELECT email, role FROM agency_members WHERE id = ? AND agency_id = ?'
  ).bind(id, agency.id).first<{ email: string; role: string }>()
  if (!target) return c.json({ success: false, error: 'not found' }, 404)
  if (target.email === agency.email && body.role && body.role !== 'owner') {
    return c.json({ success: false, error: '본인 role 강등 불가 — owner 이전 절차 필요' }, 400)
  }

  const sets: string[] = []
  const binds: unknown[] = []
  if (body.role !== undefined) {
    if (!(['owner', 'manager', 'agent', 'analyst'] as Role[]).includes(body.role)) {
      return c.json({ success: false, error: 'invalid role' }, 400)
    }
    if (body.role === 'owner' && target.role !== 'owner') {
      return c.json({ success: false, error: 'owner 는 1명만 — 이전 절차 필요' }, 400)
    }
    sets.push('role = ?'); binds.push(body.role)
  }
  if (body.permissions !== undefined) {
    sets.push('permissions = ?'); binds.push(JSON.stringify(body.permissions))
  }
  if (sets.length === 0) return c.json({ success: false, error: '변경 사항 없음' }, 400)
  sets.push("updated_at = datetime('now')")
  binds.push(id, agency.id)

  await c.env.DB.prepare(
    `UPDATE agency_members SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`
  ).bind(...binds).run()
  return c.json({ success: true })
})

// ── POST /:id/suspend / reactivate ───────────────────
app.post('/:id/suspend', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  const owner = await isOwner(c.env.DB, agency.id, agency.email || '')
  if (!owner) return c.json({ success: false, error: 'owner 권한 필요' }, 403)

  const target = await c.env.DB.prepare(
    "SELECT email, role FROM agency_members WHERE id = ? AND agency_id = ?"
  ).bind(id, agency.id).first<{ email: string; role: string }>()
  if (!target) return c.json({ success: false, error: 'not found' }, 404)
  if (target.email === agency.email) return c.json({ success: false, error: '본인 정지 불가' }, 400)

  await c.env.DB.prepare(
    "UPDATE agency_members SET status = 'suspended', updated_at = datetime('now') WHERE id = ? AND agency_id = ?"
  ).bind(id, agency.id).run()
  return c.json({ success: true })
})

app.post('/:id/reactivate', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  const owner = await isOwner(c.env.DB, agency.id, agency.email || '')
  if (!owner) return c.json({ success: false, error: 'owner 권한 필요' }, 403)

  await c.env.DB.prepare(
    "UPDATE agency_members SET status = 'active', updated_at = datetime('now') WHERE id = ? AND agency_id = ? AND status = 'suspended'"
  ).bind(id, agency.id).run()
  return c.json({ success: true })
})

// ── DELETE /:id — 멤버 제거 (소프트) ──────────────────
app.delete('/:id', async (c) => {
  const agency = c.get('agency')
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  const owner = await isOwner(c.env.DB, agency.id, agency.email || '')
  if (!owner) return c.json({ success: false, error: 'owner 권한 필요' }, 403)

  const target = await c.env.DB.prepare(
    "SELECT email, role FROM agency_members WHERE id = ? AND agency_id = ?"
  ).bind(id, agency.id).first<{ email: string; role: string }>()
  if (!target) return c.json({ success: false, error: 'not found' }, 404)
  if (target.email === agency.email) return c.json({ success: false, error: '본인 제거 불가' }, 400)
  if (target.role === 'owner') return c.json({ success: false, error: 'owner 제거 불가 — 이전 절차 필요' }, 400)

  await c.env.DB.prepare(
    "UPDATE agency_members SET status = 'removed', invite_token = NULL, updated_at = datetime('now') WHERE id = ? AND agency_id = ?"
  ).bind(id, agency.id).run()
  return c.json({ success: true })
})

// ── POST /accept — 초대 수락 (가입 완료 후 토큰으로) ──
//
// body: { invite_token, user_id (선택) }
// 사용 시점: 초대받은 사람이 회원가입 후 token 으로 멤버십 활성화.
// 별도 인증 가드 — agency middleware 거치지만 본인 이메일과 invite 이메일 매칭 검증.
app.post('/accept', async (c) => {
  const body = await c.req.json<{ invite_token: string }>().catch(() => null)
  if (!body || !body.invite_token) {
    return c.json({ success: false, error: 'invite_token 필수' }, 400)
  }
  const agency = c.get('agency')

  const member = await c.env.DB.prepare(
    "SELECT id, agency_id, email, status FROM agency_members WHERE invite_token = ? AND status = 'invited'"
  ).bind(body.invite_token).first<{ id: number; agency_id: number; email: string; status: string }>()

  if (!member) return c.json({ success: false, error: '유효하지 않은 초대' }, 404)
  if (member.email !== (agency.email || '').toLowerCase()) {
    return c.json({ success: false, error: '초대 이메일과 인증 이메일 불일치' }, 403)
  }

  await c.env.DB.prepare(
    "UPDATE agency_members SET status = 'active', joined_at = datetime('now'), invite_token = NULL WHERE id = ?"
  ).bind(member.id).run().catch(swallow('agency:member-accept'))

  return c.json({ success: true, data: { agency_id: member.agency_id, member_id: member.id } })
})

export const agencyMembersRoutes = app
export { effectivePermissions, ROLE_DEFAULTS, type Role, type Permissions }
