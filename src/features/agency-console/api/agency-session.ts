/**
 * 🏢 에이전시 직원 로그인 토큰 + 인증 미들웨어.
 *
 * ## 🔴 서명 열쇠를 소비자·셀러와 갈라 둔다 (가장 중요한 줄)
 * 공용 `requireAuth()` 는 `JWT_SECRET` 으로 서명된 토큰이면 **종류를 가리지 않고** 받아서
 * `sub` 를 사용자 id 로 쓴다. 에이전시 직원 토큰을 같은 열쇠로 서명하면, 직원 번호 3 이 소비자
 * 엔드포인트에서 **users.id = 3** 으로 통한다 — 남의 계정으로 행동하는 구멍이다.
 * 그래서 이 토큰은 `JWT_SECRET` 에서 파생한 **별도 열쇠**로만 서명한다. 공용 미들웨어는 이 토큰을
 * 검증하지 못해 그냥 401 이 된다. `sub` 도 쓰지 않는다(aid/sid).
 *
 * ## 매 요청 DB 를 본다
 * 내보낸 직원·정지된 에이전시·비밀번호를 바꾼 뒤의 옛 토큰은 **그 순간부터** 막혀야 한다.
 * 토큰 서명만 보면 7일 동안 살아 있으므로, 직원 행의 상태와 `tokens_valid_after` 를 매번 대조한다.
 */
import type { Context, Next } from 'hono'
import { sign, verify } from 'hono/jwt'
import { ensureAgencyConsoleTables, type StaffRole } from './agency-schema'

export const AGENCY_TOKEN_TYPE = 'agency_staff'
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60

export interface AgencyStaffContext {
  staffId: number
  agencyId: number
  role: StaffRole
  isOwner: boolean
  email: string
}

interface AgencyClaims {
  typ: string
  aid: number
  sid: number
  iat: number
  exp: number
}

/** `JWT_SECRET` 에서 파생한 에이전시 전용 열쇠 — 공용 열쇠로는 이 토큰을 검증할 수 없다. */
export function agencySigningKey(jwtSecret: string): string {
  return `${jwtSecret}::agency-console:v1`
}

export async function issueAgencyStaffToken(
  jwtSecret: string,
  staff: { id: number; agency_id: number },
): Promise<{ token: string; expiresAt: number }> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + TOKEN_TTL_SEC
  const claims: AgencyClaims = { typ: AGENCY_TOKEN_TYPE, aid: staff.agency_id, sid: staff.id, iat, exp }
  const token = await sign(claims as unknown as Record<string, unknown>, agencySigningKey(jwtSecret))
  return { token, expiresAt: exp }
}

export async function readAgencyClaims(token: string, jwtSecret: string): Promise<AgencyClaims | null> {
  try {
    const p = await verify(token, agencySigningKey(jwtSecret), 'HS256') as unknown as AgencyClaims
    if (p?.typ !== AGENCY_TOKEN_TYPE) return null
    if (!Number.isInteger(p.aid) || !Number.isInteger(p.sid) || p.aid <= 0 || p.sid <= 0) return null
    return p
  } catch {
    return null
  }
}

type Bindings = { DB: D1Database; JWT_SECRET: string }

/** 에이전시 직원만 — 살아 있는 직원 + 살아 있는 에이전시 + 비밀번호 변경 이후 발급된 토큰. */
export function requireAgencyStaff(opts: { adminOnly?: boolean } = {}) {
  return async (c: Context<{ Bindings: Bindings; Variables: { agencyStaff: AgencyStaffContext } }>, next: Next) => {
    const auth = c.req.header('Authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!token || !c.env.JWT_SECRET) {
      return c.json({ success: false, error: '에이전시 로그인이 필요합니다.', code: 'AGENCY_AUTH_REQUIRED' }, 401)
    }
    const claims = await readAgencyClaims(token, c.env.JWT_SECRET)
    if (!claims) {
      return c.json({ success: false, error: '로그인이 만료됐어요. 다시 로그인해 주세요.', code: 'AGENCY_AUTH_REQUIRED' }, 401)
    }
    await ensureAgencyConsoleTables(c.env.DB)
    const row = await c.env.DB.prepare(
      `SELECT s.id, s.agency_id, s.role, s.is_owner, s.status, s.email, s.tokens_valid_after, a.status AS agency_status
         FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id
        WHERE s.id = ? AND s.agency_id = ? LIMIT 1`,
    ).bind(claims.sid, claims.aid).first<{
      id: number; agency_id: number; role: string; is_owner: number; status: string; email: string
      tokens_valid_after: number; agency_status: string
    }>()
    if (!row || row.status !== 'active' || row.agency_status !== 'active' || claims.iat < Number(row.tokens_valid_after || 0)) {
      return c.json({ success: false, error: '이 계정으로는 더 이상 들어올 수 없어요. 관리자에게 문의해 주세요.', code: 'AGENCY_STAFF_INACTIVE' }, 401)
    }
    const role: StaffRole = row.role === 'admin' ? 'admin' : 'staff'
    if (opts.adminOnly && role !== 'admin') {
      return c.json({ success: false, error: '관리자만 할 수 있어요.', code: 'AGENCY_ADMIN_ONLY' }, 403)
    }
    c.set('agencyStaff', { staffId: row.id, agencyId: row.agency_id, role, isOwner: row.is_owner === 1, email: row.email })
    await next()
  }
}

/** 한 번 쓰는 링크 토큰 — 원문은 메일로만 나가고 DB 에는 해시만 남는다. */
export function newLinkToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
