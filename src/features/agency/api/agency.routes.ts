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
// 🛡️ 2026-04-28 TD-006 (split): /sellers, /sellers/:id/stats, /orders, /streams,
//   /sellers/:id/products, /sellers/:id/inventory, /ranking, /schedule, /returns →
//   src/features/agency/api/agency-sellers.routes.ts
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

// 🛡️ 2026-04-28 TD-006 (split): /notices*, /monthly-tasks, /targets, /settlements/csv,
//   /sellers/compare, /contracts* → src/features/agency/api/agency-ops.routes.ts

// 🛡️ 2026-04-28 TD-006 (split): /link-kakao /unlink-kakao /kakao-link-status →
//   src/features/agency/api/agency-kakao-link.routes.ts (worker/index.ts 에서 별도 mount)

export { app as agencyRoutes }
