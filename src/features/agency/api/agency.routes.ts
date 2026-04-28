/**
 * Agency API Routes
 *
 * Agency = 에이전시 (여러 셀러를 관리하는 대행사)
 *
 * Auth:
 *   POST /api/agency/login
 *   POST /api/agency/register
 *
 * Protected (requires agency JWT):
 *   GET  /api/agency/profile
 *   GET  /api/agency/sellers            - 소속 셀러 목록
 *   GET  /api/agency/sellers/:id/stats  - 특정 셀러 통계
 *   GET  /api/agency/stats              - 전체 집계 통계
 *   GET  /api/agency/stats/batch        - 셀러별 일괄 통계
 *   GET  /api/agency/orders             - 소속 셀러 주문 목록
 *   GET  /api/agency/streams            - 소속 셀러 라이브 현황
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Context, Next } from 'hono'
import { verifyPassword, hashPassword, validatePasswordComplexity } from '@/lib/password'
import { sendEmail } from '@/services/email'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout'

import { swallow } from '@/worker/utils/swallow';
type AgencyVars = { agency: { id: number; email: string } }
type AgencyCtx = Context<{ Bindings: Env; Variables: AgencyVars }>

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

// ── 테이블 자동 생성 ──────────────────────────────────────────
let _agencyTablesEnsured = false;
async function ensureAgencyTables(DB: D1Database) {
  if (_agencyTablesEnsured) return;
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      commission_rate REAL DEFAULT 2.0,
      status TEXT DEFAULT 'active',
      linked_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('agency:api:agency'))

  // 기존 DB 에 빠진 컬럼 ensure
  await DB.prepare("ALTER TABLE agencies ADD COLUMN commission_rate REAL DEFAULT 2.0").run().catch(swallow('agency:api:agency'))
  // 🛡️ 카카오 유저 → 에이전시 확장 연결용 (users.id FK, 수동 체크)
  await DB.prepare("ALTER TABLE agencies ADD COLUMN linked_user_id INTEGER").run().catch(swallow('agency:api:agency'))
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_agencies_linked_user ON agencies(linked_user_id)").run().catch(swallow('agency:api:agency'))

  // 🛡️ 2026-04-27: 정산 계좌 컬럼 — agency.routes.ts:544 의 GET /profile 가 SELECT 하지만 컬럼 없으면 D1_ERROR.
  await DB.prepare("ALTER TABLE agencies ADD COLUMN bank_name TEXT").run().catch(swallow('agency:api:agency'))
  await DB.prepare("ALTER TABLE agencies ADD COLUMN bank_account TEXT").run().catch(swallow('agency:api:agency'))
  await DB.prepare("ALTER TABLE agencies ADD COLUMN account_holder TEXT").run().catch(swallow('agency:api:agency'))

  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )
  `).run().catch(swallow('agency:api:agency'))
  _agencyTablesEnsured = true;
}

// ── 비밀번호 재설정 토큰 테이블 보장 ─────────────────────────
async function ensurePasswordResetTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow('agency:api:agency'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)'
  ).run().catch(swallow('agency:api:agency'))
}

/** 32자 hex 토큰 생성 (Web Crypto) */
function generateResetToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 비밀번호 재설정 이메일 HTML */
function getPasswordResetEmailHTML(resetUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d1d1f;">
      <h2 style="font-size:20px;margin:0 0 16px;">유어딜 비밀번호 재설정</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        아래 링크를 클릭하여 새 비밀번호를 설정하세요. (1시간 유효)
      </p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          비밀번호 재설정하기
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6;margin-top:24px;">
        요청하지 않았다면 이 이메일을 무시하세요.<br>
        링크가 동작하지 않을 경우 아래 URL을 복사해 주소창에 붙여넣으세요:<br>
        <span style="word-break:break-all;color:#2563eb;">${resetUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;">
      <p style="font-size:11px;color:#999;line-height:1.5;text-align:center;">
        본 메일은 비밀번호 재설정 요청에 의한 발송입니다.<br>
        <strong>리스터코퍼레이션</strong> | 사업자등록번호: 783-87-03224<br>
        문의: <a href="mailto:contact@ur-team.com" style="color:#666;">contact@ur-team.com</a><br>
        <a href="https://live.ur-team.com/account/notifications" style="color:#666;">알림 설정 변경</a>
      </p>
    </div>
  `
}

// ── JWT 헬퍼 ─────────────────────────────────────────────────
//
// 🛡️ 2026-04-26 R1: 토큰 페이로드에 member_role + member_id 추가.
// 기존 토큰 (member_role 없음) 은 verifyAgencyToken 이 'owner' 로 fallback — 하위 호환.
async function signAgencyToken(
  secret: string,
  agencyId: number,
  email: string,
  options?: { memberRole?: string; memberId?: number }
) {
  return sign(
    {
      sub: String(agencyId),
      email,
      type: 'agency',
      member_role: options?.memberRole,        // 'owner' | 'manager' | 'agent' | 'analyst'
      member_id: options?.memberId,            // agency_members.id
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
    secret
  )
}

async function verifyAgencyToken(secret: string, token: string): Promise<{
  id: number;
  email: string;
  member_role?: string;
  member_id?: number;
} | null> {
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return {
      id: Number(payload.sub),
      email: String(payload.email),
      member_role: typeof payload.member_role === 'string' ? payload.member_role : undefined,
      member_id: typeof payload.member_id === 'number' ? payload.member_id : undefined,
    }
  } catch {
    return null
  }
}

function getToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

// ── 미들웨어: agency 인증 ──────────────────────────────────────
// 🛡️ 2026-04-22 배치 147: Phase 2A cookie fallback 추가 (이전: Bearer 전용).
//   Admin/Seller 와 일관성 확보 — Bearer 토큰 없어도 ur_agency_session 쿠키로 인증 가능.
const requireAgency = async (c: AgencyCtx, next: Next) => {
  // 1) Bearer 토큰 우선
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getToken(c.req.header('Authorization')) ?? '')

  // 2) Bearer 실패 시 cookie fallback
  if (!payload) {
    try {
      const { parseSessionCookie } = await import('../../../worker/utils/session')
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) {
        payload = { id: Number(sess.userId), email: sess.email || '' }
      }
    } catch { /* cookie parse failure — fall through to 401 */ }
  }

  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

// ── POST /register (공개) ─────────────────────────────────────
// 🛡️ 2026-04-22 배치 147: rate limit 추가 (spam registration 차단 버그 fix)
app.post('/register', cors(), rateLimit({ action: 'agency_register', max: 3, windowSec: 3600 }), async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { name, contact_name, email, password, phone } = await c.req.json<{
    name: string; contact_name: string; email: string; password: string; phone?: string
  }>()

  if (!name || !contact_name || !email || !password) {
    return c.json({ success: false, error: '에이전시명, 담당자명, 이메일, 비밀번호는 필수입니다.' }, 400)
  }
  // 🛡️ 입력 길이 검증
  if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
    return c.json({ success: false, error: '에이전시명은 1~100자여야 합니다.' }, 400)
  }
  if (typeof contact_name !== 'string' || contact_name.length < 1 || contact_name.length > 50) {
    return c.json({ success: false, error: '담당자명은 1~50자여야 합니다.' }, 400)
  }
  if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ success: false, error: '유효한 이메일을 입력해주세요.' }, 400)
  }
  const pwCheck = validatePasswordComplexity(password)
  if (!pwCheck.ok) {
    return c.json({ success: false, error: pwCheck.error }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM agencies WHERE email = ?').bind(email).first()
  if (existing) return c.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, 409)

  const hash = await hashPassword(password)
  await c.env.DB.prepare(`
    INSERT INTO agencies (name, contact_name, email, password_hash, phone, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).bind(name, contact_name, email, hash, phone || null).run()

  return c.json({ success: true, message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.' }, 201)
})

// ── POST /register-from-user (카카오 유저 → 에이전시 확장) ────
// 🛡️ 카카오 로그인된 유저가 같은 계정에 에이전시 role 추가.
// 별도 이메일/비밀번호 없이 세션 쿠키 + 비즈니스 정보만 입력.
app.post('/register-from-user', cors(), rateLimit({ action: 'agency_register_from_user', max: 3, windowSec: 3600 }), async (c) => {
  try {
    await ensureAgencyTables(c.env.DB)
    const db = c.env.DB
    const jwtSecret = c.env.JWT_SECRET

    const { parseSessionCookie } = await import('../../../worker/utils/session')
    const cookieHeader = c.req.header('Cookie')
    // 🛡️ 카카오 user 세션 전용
    const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret, ['user'])
    if (!sessionUser) {
      return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    }
    const userId = sessionUser.userId

    // 이미 연결된 에이전시가 있으면 중복 차단
    const existing = await db.prepare(
      'SELECT id, status FROM agencies WHERE linked_user_id = ?'
    ).bind(userId).first<{ id: number; status: string }>()
    if (existing) {
      return c.json({
        success: false,
        error: existing.status === 'pending' ? '이미 에이전시 가입 신청 중입니다. 관리자 승인을 기다려주세요.' : '이미 에이전시 계정이 존재합니다.',
        agency_id: existing.id,
        status: existing.status,
      }, 409)
    }

    const { name, contact_name, phone } = await c.req.json<{
      name: string; contact_name: string; phone?: string
    }>()

    if (!name || !contact_name) {
      return c.json({ success: false, error: '에이전시명과 담당자명은 필수입니다.' }, 400)
    }
    if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return c.json({ success: false, error: '에이전시명은 1~100자여야 합니다.' }, 400)
    }
    if (typeof contact_name !== 'string' || contact_name.length < 1 || contact_name.length > 50) {
      return c.json({ success: false, error: '담당자명은 1~50자여야 합니다.' }, 400)
    }

    // 유저 이메일 확인 (agencies.email UNIQUE 제약 처리)
    const user = await db.prepare('SELECT name, email FROM users WHERE id = ?').bind(userId).first<{ name: string; email: string }>()
    let email = user?.email || sessionUser.email || ''
    if (email) {
      const emailDup = await db.prepare('SELECT id FROM agencies WHERE email = ?').bind(email).first()
      if (emailDup) email = `agency_${userId}@ur-team.com`
    } else {
      email = `agency_${userId}@ur-team.com`
    }

    // 임시 비밀번호 (카카오 로그인만 쓸 거지만 password_hash NOT NULL 충족용)
    const tempBytes = crypto.getRandomValues(new Uint8Array(16))
    const tempPassword = Array.from(tempBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const passwordHash = await hashPassword(tempPassword)

    await db.prepare(`
      INSERT INTO agencies (name, contact_name, email, password_hash, phone, status, linked_user_id)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).bind(name, contact_name, email, passwordHash, phone || null, userId).run()

    return c.json({
      success: true,
      message: '에이전시 가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
    }, 201)
  } catch (error) {
    console.error('Agency register-from-user error:', error)
    return c.json({ success: false, error: '에이전시 가입 신청 중 오류가 발생했습니다' }, 500)
  }
})

// ── GET /my-agency-status — 카카오 유저의 에이전시 전환 상태 ──
app.get('/my-agency-status', async (c) => {
  try {
    await ensureAgencyTables(c.env.DB)
    const { parseSessionCookie } = await import('../../../worker/utils/session')
    // 🛡️ 카카오 user 세션 전용
    const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user'])
    if (!sessionUser) return c.json({ success: true, data: { linked: false } })
    const linked = await c.env.DB.prepare(
      'SELECT id, status FROM agencies WHERE linked_user_id = ?'
    ).bind(sessionUser.userId).first<{ id: number; status: string }>()
    return c.json({ success: true, data: linked ? { linked: true, agency: linked } : { linked: false } })
  } catch {
    return c.json({ success: true, data: { linked: false } })
  }
})

// ── POST /login ───────────────────────────────────────────────
app.post('/login', cors(), rateLimit({ action: 'agency_login', max: 10, windowSec: 300 }), async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  if (!email || !password) return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400)

  const agency = await c.env.DB.prepare(
    'SELECT id, name, contact_name, email, password_hash, status FROM agencies WHERE email = ?'
  ).bind(email).first<{ id: number; name: string; contact_name: string; email: string; password_hash: string; status: string }>()

  if (!agency) {
    // 🛡️ 2026-04-22: 타이밍 공격 방어 — 존재하지 않는 계정에도 verifyPassword 실행
    await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(swallow('agency:api:agency'))
    // 또한 메시지는 generic — "등록되지 않은 이메일" 은 user enumeration 노출 → 수정
    return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
  }
  if (agency.status === 'pending') return c.json({ success: false, error: '관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.' }, 403)
  if (agency.status === 'rejected') return c.json({ success: false, error: '가입이 거절된 계정입니다. 관리자에게 문의해주세요.' }, 403)
  if (agency.status !== 'active' && agency.status !== 'approved') return c.json({ success: false, error: `비활성화된 계정입니다. (상태: ${agency.status})` }, 403)

  // 🛡️ 2026-04-22: 계정 잠금 확인
  const lockStatus = await checkLockout(c.env.DB, 'agency', String(agency.id))
  if (lockStatus.locked) {
    return c.json({
      success: false,
      error: lockStatus.reason || '계정이 일시 잠금되었습니다.',
      code: 'ACCOUNT_LOCKED',
    }, 423)
  }

  const { valid } = await verifyPassword(password, agency.password_hash)
  if (!valid) {
    await recordFailure(c.env.DB, 'agency', String(agency.id))
    return c.json({ success: false, error: '비밀번호가 올바르지 않습니다.' }, 401)
  }

  await clearFailures(c.env.DB, 'agency', String(agency.id))

  // 🛡️ 2026-04-26 R1: 멤버 role 조회 → JWT 페이로드에 포함
  // agency.email = owner email (기존 가정 유지). agency_members 미적용 시 'owner' fallback.
  let memberRole: string = 'owner'
  let memberId: number | undefined
  try {
    const m = await c.env.DB.prepare(
      "SELECT id, role FROM agency_members WHERE agency_id = ? AND email = ? AND status = 'active' LIMIT 1"
    ).bind(agency.id, agency.email).first<{ id: number; role: string }>()
    if (m) {
      memberRole = m.role
      memberId = m.id
      // last_active_at 갱신 (best-effort)
      await c.env.DB.prepare(
        "UPDATE agency_members SET last_active_at = datetime('now') WHERE id = ?"
      ).bind(m.id).run().catch(swallow('agency:api:agency'))
    }
  } catch { /* migration 0217 미적용 — owner fallback */ }

  const token = await signAgencyToken(c.env.JWT_SECRET, agency.id, agency.email, {
    memberRole, memberId,
  })

  // 🛡️ 2026-04-22 Phase 1: httpOnly 쿠키 추가 (Bearer 병행)
  let agencyCookie = ''
  try {
    const { createSessionCookie } = await import('../../../worker/utils/session')
    agencyCookie = await createSessionCookie(
      agency.id, agency.name || '', agency.email, null, c.env.JWT_SECRET, 'agency',
    )
  } catch {}

  const res = c.json({
    success: true,
    token,
    agency: { id: agency.id, name: agency.name, contact_name: agency.contact_name, email: agency.email },
  })
  if (agencyCookie) res.headers.append('Set-Cookie', agencyCookie)
  return res
})

// ── POST /forgot-password (공개) ──────────────────────────────
app.post('/forgot-password', cors(), rateLimit({ action: 'agency_forgot_password', max: 2, windowSec: 3600 }), async (c) => {
  const { DB, RESEND_API_KEY, RESEND_FROM, FRONTEND_URL } = c.env

  try {
    const body = await c.req.json<{ email: string }>()
    const email = (body?.email || '').trim()
    if (!email) return c.json({ success: false, error: '이메일을 입력해주세요.' }, 400)

    await ensureAgencyTables(DB)
    await ensurePasswordResetTable(DB)

    const agency = await DB.prepare('SELECT id, email, name FROM agencies WHERE email = ?')
      .bind(email).first<{ id: number; email: string; name: string }>()

    if (agency) {
      const token = generateResetToken()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      await DB.prepare(`
        INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at)
        VALUES ('agency', ?, ?, ?)
      `).bind(agency.id, token, expiresAt).run()

      const baseUrl = FRONTEND_URL || 'https://live.ur-team.com'
      // 🛡️ token URL-encode + trailing slash 정리
      const resetUrl = `${baseUrl.replace(/\/+$/, '')}/agency/reset-password?token=${encodeURIComponent(token)}`

      if (RESEND_API_KEY) {
        await sendEmail(
          {
            to: agency.email,
            subject: '[유어딜] 에이전시 비밀번호 재설정 안내',
            html: getPasswordResetEmailHTML(resetUrl),
          },
          RESEND_API_KEY,
          RESEND_FROM
        ).catch((e) => console.error('[Agency ForgotPassword] Email send failed:', e))
      } else {
        console.warn('[Agency ForgotPassword] RESEND_API_KEY not configured; skipping email. resetUrl=', resetUrl)
      }
    } else {
      console.info('[Agency ForgotPassword] Unknown email (silent):', email)
    }

    return c.json({
      success: true,
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    })
  } catch (error) {
    console.error('[Agency ForgotPassword] Error:', error)
    return c.json({
      success: true,
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    })
  }
})

// ── POST /reset-password (공개) ───────────────────────────────
app.post('/reset-password', cors(), rateLimit({ action: 'agency_reset_password', max: 10, windowSec: 600 }), async (c) => {
  const { DB } = c.env

  try {
    const body = await c.req.json<{ token: string; newPassword: string }>()
    const token = (body?.token || '').trim()
    const newPassword = body?.newPassword || ''

    if (!token || !newPassword) return c.json({ success: false, error: '토큰과 새 비밀번호를 입력해주세요.' }, 400)
    if (newPassword.length < 8) return c.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, 400)

    await ensurePasswordResetTable(DB)

    const row = await DB.prepare(`
      SELECT id, user_id, expires_at
      FROM password_reset_tokens
      WHERE token = ? AND user_type = 'agency'
    `).bind(token).first<{ id: number; user_id: number; expires_at: string }>()

    if (!row) {
      return c.json({
        success: false,
        error: '유효하지 않은 토큰입니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'INVALID_RESET_TOKEN'
      }, 400)
    }

    const expiresAt = new Date(row.expires_at).getTime()
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(swallow('agency:api:agency'))
      return c.json({
        success: false,
        error: '토큰이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'EXPIRED_RESET_TOKEN'
      }, 400)
    }

    // 🛡️ 2026-04-22 배치 161: 토큰 원자적 소비 (CAS) — 재사용 공격 차단.
    //   이전: UPDATE password → DELETE token. 두 요청이 동시 도착 시 둘 다 password reset 성공.
    //   개선: DELETE 먼저 (rowsAffected==1 확인) → 통과한 요청만 UPDATE. 한 번만 reset 가능.
    const del = await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run()
    if ((del.meta?.changes ?? 0) === 0) {
      return c.json({
        success: false,
        error: '토큰이 이미 사용되었습니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'USED_RESET_TOKEN'
      }, 400)
    }

    const hash = await hashPassword(newPassword)
    await DB.prepare(`
      UPDATE agencies SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(hash, row.user_id).run()

    // 🛡️ 2026-04-22: 비번 변경 시 기존 refresh token 전부 revoke
    await DB.prepare(
      "DELETE FROM auth_refresh_tokens WHERE user_type = 'agency' AND user_id = ?"
    ).bind(row.user_id).run().catch(swallow('agency:api:agency'))

    return c.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    })
  } catch (error) {
    console.error('[Agency ResetPassword] Error:', error)
    return c.json({ success: false, error: '비밀번호 재설정 중 오류가 발생했습니다.' }, 500)
  }
})

// ── 이하 인증 필요 ────────────────────────────────────────────
app.use('*', requireAgency as any)

// ── GET /profile ──────────────────────────────────────────────
app.get('/profile', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id } = c.get('agency') as { id: number; email: string }
  const agency = await c.env.DB.prepare(
    `SELECT id, name, contact_name, email, phone, status, commission_rate, created_at,
            bank_name, bank_account, account_holder
     FROM agencies WHERE id = ?`
  ).bind(id).first()
  if (!agency) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true, data: agency })
})

// ── GET /sellers ──────────────────────────────────────────────
app.get('/sellers', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const sellers = await c.env.DB.prepare(`
    SELECT
      s.id, s.name, s.email, s.business_name, s.phone,
      s.status, s.commission_rate, s.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id) AS total_orders,
      (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE')) AS total_revenue,
      (SELECT COUNT(*) FROM live_streams ls WHERE ls.seller_id = s.id AND ls.status = 'live') AS active_streams
    FROM sellers s
    INNER JOIN agency_sellers ag ON ag.seller_id = s.id
    WHERE ag.agency_id = ?
    ORDER BY s.created_at DESC
  `).bind(agencyId).all()

  return c.json({ success: true, data: sellers.results })
})

// ── GET /sellers/:id/stats ────────────────────────────────────
app.get('/sellers/:id/stats', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  // 소속 확인
  const belongs = await c.env.DB.prepare(
    'SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '접근 권한이 없습니다.' }, 403)

  const period = c.req.query('period') || '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const [seller, orderStats, streamStats] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, business_name, email, status, commission_rate FROM sellers WHERE id = ?')
      .bind(sellerId).first(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(SUM(seller_amount), 0) AS net_revenue
      FROM orders
      WHERE seller_id = ? AND status IN ('PAID','DONE') AND created_at >= ?
    `).bind(sellerId, since).first<{ order_count: number; revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS stream_count, COALESCE(SUM(current_viewers), 0) AS total_viewers
      FROM live_streams WHERE seller_id = ? AND created_at >= ?
    `).bind(sellerId, since).first<{ stream_count: number; total_viewers: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      seller,
      period,
      orders: orderStats,
      streams: streamStats,
    },
  })
})

// 🛡️ 2026-04-28 TD-006 (split): /stats* 5개 엔드포인트 →
//   src/features/agency/api/agency-stats.routes.ts (worker/index.ts 에서 별도 mount)

// ── GET /orders ───────────────────────────────────────────────
app.get('/orders', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(Math.max(1, Number(c.req.query('limit') || 20)), 100)
  const offset = (page - 1) * limit
  const sellerId = c.req.query('seller_id')

  const sellerFilter = sellerId ? 'AND o.seller_id = ?' : ''
  const params: unknown[] = sellerId ? [agencyId, Number(sellerId), limit, offset] : [agencyId, limit, offset]

  const [orders, total] = await Promise.all([
    c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.payment_status, o.status,
             o.created_at, o.shipping_name, o.seller_id,
             s.business_name AS seller_business_name
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? ${sellerFilter}
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `).bind(...params).all(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? ${sellerFilter}
    `).bind(...(sellerId ? [agencyId, Number(sellerId)] : [agencyId])).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: orders.results,
    meta: { total: total?.cnt ?? 0, page, limit },
  })
})

// ── GET /streams ──────────────────────────────────────────────
app.get('/streams', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const streams = await c.env.DB.prepare(`
    SELECT ls.id, ls.title, ls.status, ls.current_viewers, ls.scheduled_at, ls.created_at, ls.seller_id,
           s.business_name AS seller_business_name, s.name AS seller_name
    FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    LEFT JOIN sellers s ON s.id = ls.seller_id
    WHERE ag.agency_id = ?
    ORDER BY ls.created_at DESC LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: streams.results })
})

// ── GET /settlements — 소속 셀러 정산 통합 (에이전시 수수료 포함) ──
app.get('/settlements', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    // 에이전시 수수료율 조회
    const agency = await c.env.DB.prepare('SELECT commission_rate FROM agencies WHERE id = ?')
      .bind(agencyId).first<{ commission_rate: number }>()
    const agencyRate = agency?.commission_rate ?? 2.0

    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.seller_id,
             s.name AS seller_name, s.business_name,
             COALESCE(s.commission_rate, 5) AS seller_commission_rate,
             COALESCE(o.settlement_status, 'pending') AS settlement_status,
             o.created_at
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('delivered', 'DONE')
      ORDER BY o.created_at DESC LIMIT 100
    `).bind(agencyId).all()

    // 에이전시 수수료 계산
    const enriched = (results || []).map((r: any) => ({
      ...r,
      agency_commission_rate: agencyRate,
      total_commission_rate: (r.seller_commission_rate || 5) + agencyRate,
      agency_commission: Math.round((r.total_amount || 0) * agencyRate / 100),
      seller_amount: Math.round((r.total_amount || 0) * (100 - (r.seller_commission_rate || 5) - agencyRate) / 100),
    }))

    const totalAgencyCommission = enriched.reduce((s: number, r: any) => s + (r.agency_commission || 0), 0)

    const summary = {
      total: enriched.length,
      pending: enriched.filter((r: any) => r.settlement_status === 'pending').length,
      confirmed: enriched.filter((r: any) => r.settlement_status === 'confirmed').length,
      completed: enriched.filter((r: any) => r.settlement_status === 'completed').length,
      total_amount: enriched.reduce((s: number, r: any) => s + (r.total_amount || 0), 0),
      agency_commission_rate: agencyRate,
      total_agency_commission: totalAgencyCommission,
    }

    return c.json({ success: true, data: enriched, summary })
  } catch {
    return c.json({ success: true, data: [], summary: { total: 0, pending: 0, confirmed: 0, completed: 0, total_amount: 0, agency_commission_rate: 2, total_agency_commission: 0 } })
  }
})

// ── GET /settlement-invoices — 발행된 송장 목록 (M6) ──
//
// 매월 자동 발행되는 송장. cron 이 매월 1일 01:00 UTC 실행.
// 참조: src/worker/cron/agency-monthly-invoices.ts
app.get('/settlement-invoices', async (c) => {
  const agencyId = c.get('agency').id
  const limit = Math.min(parseInt(c.req.query('limit') || '24'), 60)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, month, invoice_number, total_orders, total_amount,
             commission_rate, commission_amount, tax_amount, net_amount,
             status, paid_at, generated_by, created_at
      FROM agency_settlement_invoices
      WHERE agency_id = ?
      ORDER BY month DESC
      LIMIT ?
    `).bind(agencyId, limit).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: true, data: [], _note: 'migration 0219 not applied' })
  }
})

// ── GET /settlement-invoices/:id — 송장 HTML 다운로드 ──
//
// HTML 본문 그대로 반환 (브라우저에서 inline 표시 또는 PDF 인쇄).
app.get('/settlement-invoices/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  try {
    const row = await c.env.DB.prepare(
      'SELECT html_content, invoice_number FROM agency_settlement_invoices WHERE id = ? AND agency_id = ?'
    ).bind(id, agencyId).first<{ html_content: string; invoice_number: string }>()

    if (!row) return c.json({ success: false, error: 'not found' }, 404)

    // HTML 직접 응답
    return new Response(row.html_content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${row.invoice_number}.html"`,
      },
    })
  } catch {
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

// ── POST /settlements/request — 에이전시 정산 신청 ──
app.post('/settlements/request', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  // 🛡️ 민감 액션 — 최근 15분 내 에이전시 PIN 인증 필수
  const { isAgencyPinVerified } = await import('./agency-pin.routes')
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) {
    return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)
  }

  try {
    const agency = await c.env.DB.prepare('SELECT id, name, commission_rate, bank_name, bank_account, account_holder FROM agencies WHERE id = ?')
      .bind(agencyId).first<Record<string, any>>()
    if (!agency) return c.json({ success: false, error: '에이전시 정보를 찾을 수 없습니다' }, 404)

    // 정산 가능 금액 계산: 확정(confirmed) 주문 중 아직 에이전시 정산 안 된 것
    try { await c.env.DB.prepare("ALTER TABLE orders ADD COLUMN agency_settled INTEGER DEFAULT 0").run() } catch {}

    const { results: eligibleOrders } = await c.env.DB.prepare(`
      SELECT o.id, o.total_amount, o.seller_id
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('delivered', 'DONE')
        AND COALESCE(o.settlement_status, 'pending') = 'confirmed'
        AND COALESCE(o.agency_settled, 0) = 0
    `).bind(agencyId).all<{ id: number; total_amount: number; seller_id: number }>()

    if (!eligibleOrders?.length) {
      return c.json({ success: false, error: '정산 가능한 주문이 없습니다' }, 400)
    }

    const rate = agency.commission_rate ?? 2.0
    const totalAmount = eligibleOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
    const commissionAmount = Math.round(totalAmount * rate / 100)

    // 정산 레코드 생성
    try {
      await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS agency_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        total_orders INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        commission_rate REAL NOT NULL,
        commission_amount INTEGER NOT NULL,
        bank_name TEXT, bank_account TEXT, account_holder TEXT,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settled_at DATETIME
      )`).run()
    } catch {}

    const result = await c.env.DB.prepare(`
      INSERT INTO agency_settlements (agency_id, total_orders, total_amount, commission_rate, commission_amount, bank_name, bank_account, account_holder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agencyId, eligibleOrders.length, totalAmount, rate, commissionAmount,
      agency.bank_name || null, agency.bank_account || null, agency.account_holder || null
    ).run()

    // 정산 신청된 주문들 마킹
    const orderIds = eligibleOrders.map(o => o.id)
    for (const oid of orderIds) {
      await c.env.DB.prepare('UPDATE orders SET agency_settled = 1 WHERE id = ?').bind(oid).run()
    }

    // 어드민 알림
    try {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      createDashboardNotification(c.env.DB, 'admin', null, 'agency_settlement', '에이전시 정산 신청', `${agency.name}: ${commissionAmount.toLocaleString()}원 (${eligibleOrders.length}건)`, '/admin/settlements').catch(swallow('agency:api:agency'))
    } catch {}

    return c.json({
      success: true,
      data: {
        orders: eligibleOrders.length,
        total_amount: totalAmount,
        commission_rate: rate,
        commission_amount: commissionAmount,
      },
    })
  } catch (e) {
    console.error('[Agency] Settlement request error:', e)
    return c.json({ success: false, error: '정산 신청에 실패했습니다' }, 500)
  }
})

// ── GET /sellers/:id/products — 셀러 상품 조회 (대행 관리) ─────────
app.get('/sellers/:id/products', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare(
    'SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '접근 권한이 없습니다.' }, 403)

  const { results } = await c.env.DB.prepare(`
    SELECT id, name, price, original_price, stock, image_url, category, is_active, sold_count, created_at
    FROM products WHERE seller_id = ? ORDER BY created_at DESC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results })
})

// ── GET /sellers/:id/inventory — 셀러 재고 현황 ──────────────────
app.get('/sellers/:id/inventory', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare(
    'SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '접근 권한이 없습니다.' }, 403)

  const { results } = await c.env.DB.prepare(`
    SELECT id, name, COALESCE(stock, stock_quantity, 0) AS stock, price, image_url, is_active
    FROM products WHERE seller_id = ? AND is_active = 1
    ORDER BY stock ASC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results })
})

// ── GET /ranking — 셀러 성과 랭킹 ───────────────────────────────
app.get('/ranking', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const metric = c.req.query('metric') || 'revenue' // revenue, orders, reviews, followers

  try {
    let orderBy = 'total_revenue DESC'
    if (metric === 'orders') orderBy = 'total_orders DESC'

    const { results } = await c.env.DB.prepare(`
      SELECT s.id, s.name, s.business_name, s.profile_image,
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE')) AS total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE')) AS total_revenue,
        (SELECT COUNT(*) FROM product_reviews r JOIN products p ON r.product_id = p.id WHERE p.seller_id = s.id) AS total_reviews,
        (SELECT COUNT(*) FROM seller_follows f WHERE f.seller_id = s.id) AS total_followers,
        (SELECT COALESCE(AVG(r.rating), 0) FROM product_reviews r JOIN products p ON r.product_id = p.id WHERE p.seller_id = s.id) AS avg_rating
      FROM sellers s
      INNER JOIN agency_sellers ag ON ag.seller_id = s.id
      WHERE ag.agency_id = ?
      ORDER BY ${orderBy}
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /schedule — 소속 셀러 방송 스케줄 캘린더 ──────────────────
app.get('/schedule', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT ls.id, ls.title, ls.status, ls.scheduled_at, ls.youtube_video_id,
             ls.seller_id, s.name AS seller_name
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      LEFT JOIN sellers s ON s.id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.status IN ('scheduled', 'live')
      ORDER BY ls.scheduled_at ASC
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /returns — 소속 셀러 반품/CS 통합 ────────────────────────
app.get('/returns', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT r.id, r.order_number, r.status, r.reason, r.refund_amount,
             r.seller_id, s.name AS seller_name, r.created_at
      FROM returns r
      INNER JOIN agency_sellers ag ON ag.seller_id = r.seller_id
      LEFT JOIN sellers s ON s.id = r.seller_id
      WHERE ag.agency_id = ?
      ORDER BY r.created_at DESC LIMIT 50
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── PUT /profile — 에이전시 프로필 수정 ──────────────────────────
// 🛡️ 2026-04-22 배치 162: 은행 계좌 필드 추가 (정산 플로우 마비 P0 fix).
//   이전: bank_name/bank_account/account_holder 를 /settlements/request 가 조회만 하고
//   저장은 어디서도 안 해 정산이 불가능. 이 PUT 에서 저장 허용.
app.put('/profile', async (c) => {
  const { id } = c.get('agency') as { id: number }
  const body = await c.req.json<{
    name?: string; contact_name?: string; phone?: string;
    bank_name?: string; bank_account?: string; account_holder?: string;
  }>()

  // 입력 검증
  if (body.bank_account !== undefined && !/^[\d-]{5,30}$/.test(body.bank_account)) {
    return c.json({ success: false, error: '계좌번호는 숫자와 하이픈(-)만 허용됩니다' }, 400)
  }
  if (body.bank_name !== undefined && (body.bank_name.length < 1 || body.bank_name.length > 30)) {
    return c.json({ success: false, error: '은행명은 1~30자여야 합니다' }, 400)
  }
  if (body.account_holder !== undefined && (body.account_holder.length < 1 || body.account_holder.length > 30)) {
    return c.json({ success: false, error: '예금주는 1~30자여야 합니다' }, 400)
  }

  const updates: string[] = []
  const params: unknown[] = []
  if (body.name) { updates.push('name = ?'); params.push(body.name) }
  if (body.contact_name) { updates.push('contact_name = ?'); params.push(body.contact_name) }
  if (body.phone) { updates.push('phone = ?'); params.push(body.phone) }
  if (body.bank_name !== undefined) { updates.push('bank_name = ?'); params.push(body.bank_name) }
  if (body.bank_account !== undefined) { updates.push('bank_account = ?'); params.push(body.bank_account) }
  if (body.account_holder !== undefined) { updates.push('account_holder = ?'); params.push(body.account_holder) }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(id)
    await c.env.DB.prepare(`UPDATE agencies SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
  }

  return c.json({ success: true })
})

// ── GET /notifications — 에이전시 알림 ────────────────────────────
app.get('/notifications', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(swallow('agency:api:agency'))

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM agency_notifications WHERE agency_id = ? ORDER BY created_at DESC LIMIT 30'
    ).bind(agencyId).all()

    const unread = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM agency_notifications WHERE agency_id = ? AND is_read = 0'
    ).bind(agencyId).first<{ cnt: number }>()

    return c.json({ success: true, data: results, unread_count: unread?.cnt || 0 })
  } catch {
    return c.json({ success: true, data: [], unread_count: 0 })
  }
})

// ── PUT /notifications/read-all ──────────────────────────────────
app.put('/notifications/read-all', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number }
  await c.env.DB.prepare('UPDATE agency_notifications SET is_read = 1 WHERE agency_id = ?').bind(agencyId).run().catch(swallow('agency:api:agency'))
  return c.json({ success: true })
})

// ── POST /sellers/:id/products — 셀러 대신 상품 등록 ──────────────
// 🛡️ 2026-04-22 배치 147: 입력 검증 강화 (음수/상한 체크 누락 버그 fix)
app.post('/sellers/:id/products', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare('SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?')
    .bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  const body = await c.req.json<{
    name: string; description?: string; price: number; original_price?: number;
    stock?: number; image_url?: string; category?: string;
  }>()

  if (!body.name || body.price === undefined) return c.json({ success: false, error: '상품명과 가격은 필수입니다.' }, 400)
  // 🛡️ 입력 검증 — 길이/범위 (타 엔드포인트와 일관된 정책)
  if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200) {
    return c.json({ success: false, error: '상품명은 1~200자여야 합니다.' }, 400)
  }
  const priceNum = Number(body.price)
  if (!Number.isFinite(priceNum) || priceNum < 0 || priceNum > 100_000_000) {
    return c.json({ success: false, error: '가격은 0~1억원 사이여야 합니다.' }, 400)
  }
  const originalPrice = body.original_price === undefined ? priceNum : Number(body.original_price)
  if (!Number.isFinite(originalPrice) || originalPrice < 0 || originalPrice > 100_000_000) {
    return c.json({ success: false, error: '정가는 0~1억원 사이여야 합니다.' }, 400)
  }
  const stockNum = body.stock === undefined ? 100 : Number(body.stock)
  if (!Number.isFinite(stockNum) || stockNum < 0 || stockNum > 1_000_000) {
    return c.json({ success: false, error: '재고는 0~100만 사이여야 합니다.' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO products (seller_id, name, description, price, original_price, stock, image_url, category, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).bind(sellerId, body.name, body.description || null, priceNum, originalPrice,
    stockNum, body.image_url || null, body.category || 'general').run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── PUT /sellers/:id/products/:productId — 셀러 대신 상품 수정 ────
app.put('/sellers/:id/products/:productId', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))
  const productId = Number(c.req.param('productId'))

  const belongs = await c.env.DB.prepare('SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?')
    .bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?')
    .bind(productId, sellerId).first()
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404)

  const body = await c.req.json<{
    name?: string; description?: string; price?: number; original_price?: number;
    stock?: number; image_url?: string; is_active?: boolean;
  }>()

  // 🛡️ 2026-04-22 배치 147: 입력 검증 추가
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200)) {
    return c.json({ success: false, error: '상품명은 1~200자여야 합니다.' }, 400)
  }
  if (body.price !== undefined) {
    const n = Number(body.price)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return c.json({ success: false, error: '가격은 0~1억원 사이여야 합니다.' }, 400)
  }
  if (body.original_price !== undefined) {
    const n = Number(body.original_price)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return c.json({ success: false, error: '정가는 0~1억원 사이여야 합니다.' }, 400)
  }
  if (body.stock !== undefined) {
    const n = Number(body.stock)
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return c.json({ success: false, error: '재고는 0~100만 사이여야 합니다.' }, 400)
  }

  const updates: string[] = ["updated_at = datetime('now')"]
  const params: unknown[] = []
  if (body.name) { updates.push('name = ?'); params.push(body.name) }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description) }
  if (body.price !== undefined) { updates.push('price = ?'); params.push(Number(body.price)) }
  if (body.original_price !== undefined) { updates.push('original_price = ?'); params.push(Number(body.original_price)) }
  if (body.stock !== undefined) { updates.push('stock = ?'); params.push(Number(body.stock)) }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); params.push(body.image_url) }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }

  params.push(productId)
  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

  return c.json({ success: true })
})

// ── POST /sellers/:id/streams — 셀러 대신 방송 예약 ───────────────
app.post('/sellers/:id/streams', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare('SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?')
    .bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  const { title, description, scheduled_at } = await c.req.json<{
    title: string; description?: string; scheduled_at?: string;
  }>()

  if (!title) return c.json({ success: false, error: '방송 제목은 필수입니다.' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO live_streams (seller_id, title, description, status, scheduled_at, created_at, updated_at)
    VALUES (?, ?, ?, 'scheduled', ?, datetime('now'), datetime('now'))
  `).bind(sellerId, title, description || null, scheduled_at || null).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── POST /invite-seller — 셀러 초대 (에이전시가 셀러 계정 생성) ─────
// 🛡️ 2026-04-22 배치 147: rate limit + 비밀번호 복잡도 검증 추가
app.post('/invite-seller', rateLimit({ action: 'agency_invite_seller', max: 20, windowSec: 3600 }), async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const { name, email, password, business_name, phone } = await c.req.json<{
    name: string; email: string; password: string; business_name?: string; phone?: string;
  }>()

  if (!name || !email || !password) return c.json({ success: false, error: '이름, 이메일, 비밀번호는 필수입니다.' }, 400)
  // 🛡️ 입력 검증
  if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
    return c.json({ success: false, error: '셀러명은 1~50자여야 합니다.' }, 400)
  }
  if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ success: false, error: '유효한 이메일을 입력해주세요.' }, 400)
  }
  const pwCheck = validatePasswordComplexity(password)
  if (!pwCheck.ok) {
    return c.json({ success: false, error: pwCheck.error }, 400)
  }

  // 이미 존재하는 이메일 확인
  const existing = await c.env.DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first()
  if (existing) return c.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, 409)

  const { hashPassword: hashPw } = await import('../../../lib/password')
  const hash = await hashPw(password)

  // 🛡️ 2026-04-26 (P0 #1): 에이전시 초대 셀러는 'pending' 으로 생성 → 어드민 심사 후 'approved'.
  // affiliated_agency_id 로 어드민 심사 페이지에서 출처 식별.
  // 하위 호환: affiliated_agency_id 컬럼 없으면 (구 schema) 그냥 생성 진행.
  let result;
  try {
    result = await c.env.DB.prepare(`
      INSERT INTO sellers (username, name, email, password_hash, business_name, phone, status, affiliated_agency_id, documents_submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'), datetime('now'))
    `).bind(email.split('@')[0], name, email, hash, business_name || null, phone || null, agencyId).run()
  } catch (err) {
    // affiliated_agency_id / documents_submitted_at 컬럼 미존재 시 (마이그레이션 0207 미적용)
    if (import.meta.env.DEV) console.warn('[agency:invite-seller] new columns missing, falling back:', err);
    result = await c.env.DB.prepare(`
      INSERT INTO sellers (username, name, email, password_hash, business_name, phone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).bind(email.split('@')[0], name, email, hash, business_name || null, phone || null).run()
  }

  const sellerId = result.meta.last_row_id

  // 에이전시에 소속
  await c.env.DB.prepare('INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id) VALUES (?, ?)')
    .bind(agencyId, sellerId).run()

  // 심사 큐에 등록 (어드민 페이지에서 승인/반려)
  try {
    await c.env.DB.prepare(`
      INSERT INTO agency_creator_approvals (seller_id, agency_id, status, created_at)
      VALUES (?, ?, 'pending', datetime('now'))
    `).bind(sellerId, agencyId).run()
  } catch (err) {
    // 테이블 미존재 시 (마이그레이션 0207 미적용) — 셀러는 생성됐고 status=pending 으로 어드민이 접근 가능
    if (import.meta.env.DEV) console.warn('[agency:invite-seller] approval queue not yet migrated:', err);
  }

  return c.json({
    success: true,
    data: { seller_id: sellerId, status: 'pending' },
    message: `${name} 셀러가 생성되었습니다. 어드민 승인 후 활성화됩니다.`
  }, 201)
})

// ── GET /api/agency/report/csv — 매출 리포트 CSV 다운로드 ──
app.get('/report/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const period = c.req.query('period') || '30'
  const days = parseInt(period)

  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END) * 0.07, 0) AS commission
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND o.created_at > datetime('now', '-' || ? || ' days')
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name, s.email
    ORDER BY revenue DESC
  `).bind(days, agencyId).all()

  const rows = results || []
  const csv = [
    '셀러명,이메일,주문수,매출(원),수수료(원)',
    ...rows.map((r: any) => `${r.seller_name},${r.email},${r.order_count},${r.revenue},${Math.round(r.commission)}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="agency-report-${days}d.csv"` },
  })
})

// ── POST /api/agency/notices — 셀러 공지사항 발송 ──
app.post('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { title, message } = await c.req.json<{ title: string; message: string }>()
  if (!title || !message) return c.json({ success: false, error: '제목과 내용을 입력해주세요' }, 400)

  const { results: sellers } = await c.env.DB.prepare(
    'SELECT seller_id FROM agency_sellers WHERE agency_id = ?'
  ).bind(agencyId).all<{ seller_id: number }>()

  if (!sellers?.length) return c.json({ success: false, error: '소속 셀러가 없습니다' })

  const stmts = sellers.map(s =>
    c.env.DB.prepare(`
      INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at)
      VALUES ('seller', ?, 'agency_notice', ?, ?, datetime('now'))
    `).bind(String(s.seller_id), title, message)
  )
  for (let i = 0; i < stmts.length; i += 50) {
    await c.env.DB.batch(stmts.slice(i, i + 50))
  }

  return c.json({ success: true, message: `${sellers.length}명의 셀러에게 공지를 발송했습니다.` })
})

// ── GET /api/agency/notices — 공지 이력 ──
app.get('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT dn.title, dn.message, dn.created_at
    FROM dashboard_notifications dn
    JOIN agency_sellers ag ON dn.recipient_id = CAST(ag.seller_id AS TEXT)
    WHERE ag.agency_id = ? AND dn.type = 'agency_notice'
    GROUP BY dn.title, dn.message, dn.created_at
    ORDER BY dn.created_at DESC
    LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

// ── GET /monthly-tasks — 의무 작업 진행 상황 (Q6) ──
//
// 응답: 이번 달 3종 의무 작업의 target/actual/status.
// row 가 없으면 cron 이 다음 실행 시 자동 생성. 빈 배열 반환.
//
// 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q6)
app.get('/monthly-tasks', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const now = new Date()
  const month = c.req.query('month') ||
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'month 형식: YYYY-MM' }, 400)
  }

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM agency_monthly_tasks WHERE agency_id = ? AND month = ? ORDER BY task_type`
    ).bind(agencyId, month).all<Record<string, unknown>>()
    return c.json({ success: true, data: results || [], month })
  } catch {
    // migration 0215 미적용
    return c.json({ success: true, data: [], month, _note: 'migration 0215 not applied yet' })
  }
})

// ── GET/PUT /api/agency/targets — 셀러 매출 목표 ──
app.get('/targets', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        target_amount INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agency_id, seller_id, month)
      )
    `).run()
  } catch {}

  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)

  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name,
      COALESCE(t.target_amount, 0) AS target_amount,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED')
        AND strftime('%Y-%m', o.created_at) = ? THEN o.total_amount END), 0) AS current_amount
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN agency_seller_targets t ON t.seller_id = s.id AND t.agency_id = ? AND t.month = ?
    LEFT JOIN orders o ON o.seller_id = s.id
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name, t.target_amount
    ORDER BY s.name
  `).bind(month, agencyId, month, agencyId).all()

  return c.json({ success: true, data: results || [], month })
})

app.put('/targets', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { seller_id, month, target_amount } = await c.req.json<{ seller_id: number; month: string; target_amount: number }>()
  if (!seller_id || !month) return c.json({ success: false, error: '셀러와 월을 선택해주세요' }, 400)

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
        month TEXT NOT NULL, target_amount INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agency_id, seller_id, month)
      )
    `).run()
  } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_seller_targets (agency_id, seller_id, month, target_amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id, month) DO UPDATE SET target_amount = excluded.target_amount
  `).bind(agencyId, seller_id, month, target_amount || 0).run()

  return c.json({ success: true })
})

// ── GET /api/agency/settlements/csv — 정산 CSV 다운로드 ──
app.get('/settlements/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COUNT(DISTINCT o.id) AS settled_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(SUM(o.total_amount * 0.05), 0) AS seller_commission,
      COALESCE(SUM(o.total_amount * 0.02), 0) AS agency_commission
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND COALESCE(o.settlement_status, '') = 'settled'
    WHERE ag.agency_id = ?
    GROUP BY s.id ORDER BY total_amount DESC
  `).bind(agencyId).all()

  const rows = results || []
  const csv = [
    '셀러명,이메일,정산건수,총매출(원),셀러수수료5%(원),에이전시수수료2%(원)',
    ...rows.map((r: any) => `${r.seller_name},${r.email},${r.settled_orders},${r.total_amount},${Math.round(r.seller_commission)},${Math.round(r.agency_commission)}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="agency-settlements.csv"' },
  })
})

// ── GET /api/agency/sellers/compare — 셀러 성과 비교 ──
app.get('/sellers/compare', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const period = c.req.query('period') || '30'

  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.business_name,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue,
      COUNT(DISTINCT CASE WHEN ls.status = 'live' THEN ls.id END) AS live_count,
      COUNT(DISTINCT CASE WHEN ls.status = 'ended' THEN ls.id END) AS ended_streams
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND o.created_at > datetime('now', '-' || ? || ' days')
    LEFT JOIN live_streams ls ON ls.seller_id = s.id AND ls.created_at > datetime('now', '-' || ? || ' days')
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name ORDER BY revenue DESC
  `).bind(period, period, agencyId).all()

  // Fetch voucher usage stats per seller
  const { results: voucherStats } = await c.env.DB.prepare(`
    SELECT p.seller_id,
      COUNT(*) AS total_vouchers,
      SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used_vouchers
    FROM vouchers v
    JOIN products p ON v.product_id = p.id
    JOIN agency_sellers ag ON ag.seller_id = p.seller_id
    WHERE ag.agency_id = ?
    GROUP BY p.seller_id
  `).bind(agencyId).all<{ seller_id: number; total_vouchers: number; used_vouchers: number }>().catch(() => ({ results: [] as any[] }))

  // Fetch group buy participation per seller
  const { results: groupBuyStats } = await c.env.DB.prepare(`
    SELECT p.seller_id,
      COUNT(*) AS total_group_buys,
      SUM(CASE WHEN p.group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved_group_buys
    FROM products p
    JOIN agency_sellers ag ON ag.seller_id = p.seller_id
    WHERE ag.agency_id = ? AND p.category = 'meal_voucher' AND p.group_buy_status IS NOT NULL
    GROUP BY p.seller_id
  `).bind(agencyId).all<{ seller_id: number; total_group_buys: number; achieved_group_buys: number }>().catch(() => ({ results: [] as any[] }))

  const voucherMap: Record<number, { total_vouchers: number; used_vouchers: number }> = {}
  for (const v of (voucherStats || [])) voucherMap[v.seller_id] = v

  const groupBuyMap: Record<number, { total_group_buys: number; achieved_group_buys: number }> = {}
  for (const g of (groupBuyStats || [])) groupBuyMap[g.seller_id] = g

  const enriched = (results || []).map((r: any) => ({
    ...r,
    total_vouchers: voucherMap[r.id]?.total_vouchers ?? 0,
    used_vouchers: voucherMap[r.id]?.used_vouchers ?? 0,
    voucher_usage_rate: voucherMap[r.id]?.total_vouchers
      ? Math.round((voucherMap[r.id].used_vouchers / voucherMap[r.id].total_vouchers) * 100)
      : 0,
    total_group_buys: groupBuyMap[r.id]?.total_group_buys ?? 0,
    achieved_group_buys: groupBuyMap[r.id]?.achieved_group_buys ?? 0,
    group_buy_success_rate: groupBuyMap[r.id]?.total_group_buys
      ? Math.round((groupBuyMap[r.id].achieved_group_buys / groupBuyMap[r.id].total_group_buys) * 100)
      : 0,
  }))

  return c.json({ success: true, data: enriched })
})

// ── 셀러 계약 관리 ──
app.get('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  const { results } = await c.env.DB.prepare(`
    SELECT ac.*, s.name AS seller_name, s.email AS seller_email
    FROM agency_contracts ac JOIN sellers s ON ac.seller_id = s.id
    WHERE ac.agency_id = ? ORDER BY ac.end_date ASC
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

app.post('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id

  // 🛡️ 계약 생성 민감 액션 — PIN 인증 필수
  const { isAgencyPinVerified } = await import('./agency-pin.routes')
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)

  const { seller_id, start_date, end_date, terms } = await c.req.json<any>()
  if (!seller_id || !start_date || !end_date) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400)

  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_contracts (agency_id, seller_id, start_date, end_date, terms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date, terms = excluded.terms, status = 'active'
  `).bind(agencyId, seller_id, start_date, end_date, terms || null).run()

  return c.json({ success: true, message: '계약이 등록되었습니다' })
})

app.put('/contracts/:id', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id

  // 🛡️ 계약 수정 민감 액션 — PIN 인증 필수
  const { isAgencyPinVerified } = await import('./agency-pin.routes')
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)

  const id = c.req.param('id')
  const body = await c.req.json<any>()
  const sets: string[] = []; const vals: any[] = []
  if (body.end_date) { sets.push('end_date = ?'); vals.push(body.end_date) }
  if (body.terms !== undefined) { sets.push('terms = ?'); vals.push(body.terms) }
  if (body.status) { sets.push('status = ?'); vals.push(body.status) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  vals.push(id, agencyId)
  await c.env.DB.prepare(`UPDATE agency_contracts SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

// 🛡️ 2026-04-28 TD-006 (split): /link-kakao /unlink-kakao /kakao-link-status →
//   src/features/agency/api/agency-kakao-link.routes.ts (worker/index.ts 에서 별도 mount)

export { app as agencyRoutes }
