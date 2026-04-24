/**
 * Agency Auth Routes (공개 — 인증 불필요)
 *
 *   POST /api/agency/register
 *   POST /api/agency/register-from-user
 *   GET  /api/agency/my-agency-status
 *   POST /api/agency/login
 *   POST /api/agency/forgot-password
 *   POST /api/agency/reset-password
 */

import { cors } from 'hono/cors'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { verifyPassword, hashPassword, validatePasswordComplexity } from '@/lib/password'
import { sendEmail } from '@/services/email'
import { parseSessionCookie, createSessionCookie } from '@/worker/utils/session'
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout'
import {
  createAgencyApp,
  ensureAgencyTables,
  ensurePasswordResetTable,
  generateResetToken,
  getPasswordResetEmailHTML,
  signAgencyToken,
  verifyAgencyToken,
} from './agency-shared'

const app = createAgencyApp()

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
    await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(() => {})
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

  const token = await signAgencyToken(c.env.JWT_SECRET, agency.id, agency.email)

  // 🛡️ 2026-04-22 Phase 1: httpOnly 쿠키 추가 (Bearer 병행)
  let agencyCookie = ''
  try {
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
      await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(() => {})
      return c.json({
        success: false,
        error: '토큰이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'EXPIRED_RESET_TOKEN'
      }, 400)
    }

    // 🛡️ 2026-04-22 배치 161: 토큰 원자적 소비 (CAS) — 재사용 공격 차단.
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
    ).bind(row.user_id).run().catch(() => {})

    return c.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    })
  } catch (error) {
    console.error('[Agency ResetPassword] Error:', error)
    return c.json({ success: false, error: '비밀번호 재설정 중 오류가 발생했습니다.' }, 500)
  }
})

export { app as agencyAuthRoutes }
