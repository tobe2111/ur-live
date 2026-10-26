/**
 * 🏢 에이전시 계정 — 가입 · 이메일 인증 · 로그인 · 비밀번호 찾기 · 내 정보.
 *   마운트: app.route('/api/agency-console', agencyConsoleRoutes)
 *
 * 대표 확정(2026-10-11, `docs/decisions/2026-10-11-agency-model-email-only.md`):
 *   에이전시 계정은 **이메일로만** 가입·로그인한다.
 * 🟡 2026-10-26 대표 보강 — *"카카오 로그인으로 해도 되고, 대신 카카오 로그인 시, 여러명이 함께 관리는
 *   힘들다고 해두면"*. 카카오로 만든 에이전시는 **혼자 쓰는 계정**이고, 이메일 계정으로 옮길 수 있다
 *   (`agency-kakao.routes.ts`). 이 파일의 이메일 가입·로그인은 그대로다.
 *
 * ## 계정이 있는지 없는지를 응답으로 알려 주지 않는다
 * 가입·비밀번호 찾기는 이메일이 이미 있든 없든 **같은 응답**을 준다. 차이는 메일 내용에만 있다
 * (이미 있는 계정이면 "이미 가입돼 있어요 — 로그인하세요" 메일). 응답이 다르면 남의 이메일이
 * 에이전시인지 알아낼 수 있다.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hashPassword, verifyPassword, hashToken, validatePasswordComplexity } from '@/lib/password'
import { buildSystemEmailHtml, sendSystemEmail } from '@/lib/system-email'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { checkLockout, recordFailure, clearFailures } from '@/worker/utils/account-lockout'
import { safeError } from '@/worker/utils/safe-error'
import { ntsCheckStatus } from '@/worker/utils/nts-business-verify'
import { swallow } from '@/worker/utils/swallow'
import { sensMailConfigured } from '@/lib/ncp-sens-mail'
import { isKakaoOnlyStaffEmail } from '@/shared/agency-kakao'
import {
  ensureAgencyConsoleTables, AGENCY_TOKEN_TTL_HOURS, AGENCY_NAME_MAX,
  type AgencyKind, type AgencyTokenKind,
} from './agency-schema'
import { issueAgencyStaffToken, requireAgencyStaff, newLinkToken, type AgencyStaffContext } from './agency-session'

type Bindings = {
  DB: D1Database; JWT_SECRET: string
  RESEND_API_KEY?: string; RESEND_FROM?: string; FRONTEND_URL?: string
  PUBLIC_DATA_SERVICE_KEY?: string; NTS_API_KEY?: string
}
type Vars = { agencyStaff: AgencyStaffContext }

export const agencyConsoleRoutes = new Hono<{ Bindings: Bindings; Variables: Vars }>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** hashPassword 와 같은 형식(salt$hash, PBKDF2)의 가짜 해시 — 없는 계정도 같은 시간이 걸리게. */
const DUMMY_PBKDF2_HASH = 'AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const GENERIC_SIGNUP_MSG = '인증 메일을 보냈어요. 메일의 링크를 누르면 에이전시가 만들어져요.'
const GENERIC_FORGOT_MSG = '가입된 이메일이면 비밀번호를 다시 정하는 메일을 보냈어요.'

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/** 사업자등록번호 10자리(하이픈 허용) → 숫자만. 형식이 아니면 null. */
export function normalizeBusinessNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/[^0-9]/g, '')
  return digits.length === 10 ? digits : null
}

export function frontendBase(env: { FRONTEND_URL?: string }): string {
  const base = (env.FRONTEND_URL || 'https://urdeal.kr').replace(/\/+$/, '')
  return /^https?:\/\//i.test(base) ? base : 'https://urdeal.kr'
}

/** 링크 토큰 발급 — 같은 직원·같은 종류의 미사용 토큰은 지운다(최신 링크 하나만 산다). */
export async function issueLinkToken(DB: D1Database, staffId: number, kind: AgencyTokenKind): Promise<string> {
  const raw = newLinkToken()
  const hash = await hashToken(raw)
  const expires = new Date(Date.now() + AGENCY_TOKEN_TTL_HOURS[kind] * 3600_000).toISOString()
  await DB.batch([
    DB.prepare('DELETE FROM agency_tokens WHERE staff_id = ? AND kind = ? AND used_at IS NULL').bind(staffId, kind),
    DB.prepare('INSERT INTO agency_tokens (staff_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(staffId, kind, hash, expires),
  ])
  return raw
}

/**
 * 링크 토큰 소비 — **원자적으로 한 번만**. `used_at IS NULL` 조건의 UPDATE 가 이긴 쪽만 통과한다
 * (같은 링크를 두 탭에서 동시에 눌러도 한 번만 처리된다).
 */
export async function consumeLinkToken(
  DB: D1Database, raw: string, kind: AgencyTokenKind,
): Promise<{ staffId: number } | { error: 'invalid' | 'expired' }> {
  if (typeof raw !== 'string' || !/^[0-9a-f]{64}$/.test(raw)) return { error: 'invalid' }
  const hash = await hashToken(raw)
  const row = await DB.prepare(
    'SELECT id, staff_id, expires_at, used_at FROM agency_tokens WHERE token_hash = ? AND kind = ? LIMIT 1',
  ).bind(hash, kind).first<{ id: number; staff_id: number; expires_at: string; used_at: string | null }>()
  if (!row || row.used_at) return { error: 'invalid' }
  if (Date.parse(row.expires_at) < Date.now()) return { error: 'expired' }
  const claim = await DB.prepare(
    "UPDATE agency_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL",
  ).bind(row.id).run()
  if ((claim.meta?.changes ?? 0) === 0) return { error: 'invalid' }
  return { staffId: row.staff_id }
}

async function mail(env: Bindings, to: string, subject: string, title: string, body: string, actionLabel?: string, actionUrl?: string) {
  await sendSystemEmail(env, to, {
    subject,
    html: buildSystemEmailHtml({ title, greeting: '안녕하세요.', body, actionLabel, actionUrl }),
  }, { ignorePreference: true }).catch(swallow('agency-console:mail'))
}

/**
 * 메일을 실제로 보낼 수 있는가. 에이전시 가입·초대·비밀번호 찾기는 **메일 링크가 유일한 문**이라,
 * 발송 설정이 없으면 "메일 보냈어요" 라고 답하는 순간 거짓말이 된다(메일은 조용히 건너뛰어진다).
 * 보낸 사람 주소(RESEND_FROM)가 없으면 Resend 기본 발신(onboarding@resend.dev)으로 가는데,
 * 그 주소는 Resend 계정 주인에게만 배달된다 — 그래서 둘 다 있어야 준비됨으로 본다.
 */
export function agencyMailReady(env: { RESEND_API_KEY?: string; RESEND_FROM?: string }): boolean {
  // 📮 2026-10-12: SENS 메일(발신 주소 NCP_MAIL_SENDER 가 우리 도메인)이 있으면 그걸로 충분하다.
  return (!!env.RESEND_API_KEY && !!env.RESEND_FROM) || sensMailConfigured(env as Record<string, unknown>)
}
/**
 * 🏛️ 에이전시 사업자번호 — 국세청 상태조회. 답이 오면 그대로 따르고, 답이 없으면(키 없음·장애) 'unverified'.
 *   b_stt 가 비어 오면 국세청에 없는 번호다(`/stores/verify-business` 와 같은 해석).
 */
export async function checkAgencyBusiness(
  env: { PUBLIC_DATA_SERVICE_KEY?: string; NTS_API_KEY?: string },
  businessNumber: string,
): Promise<{ status: string; reject?: string }> {
  const key = env.PUBLIC_DATA_SERVICE_KEY || env.NTS_API_KEY
  const rows = await ntsCheckStatus(key, [businessNumber]).catch(() => [])
  const row = rows.find((r) => r.b_no === businessNumber) ?? rows[0]
  if (!row) return { status: 'unverified' }
  if (!row.b_stt) return { status: 'unregistered', reject: '국세청에 등록되지 않은 사업자등록번호예요. 번호를 다시 확인해 주세요.' }
  if (row.b_stt.includes('폐업')) return { status: row.b_stt, reject: '폐업한 사업자등록번호로는 에이전시를 만들 수 없어요.' }
  return { status: row.b_stt }
}

export const AGENCY_MAIL_DOWN = {
  success: false,
  code: 'MAIL_NOT_CONFIGURED',
  error: '지금은 메일을 보낼 수 없어서 진행할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
} as const

/** 로그인 응답 — 이메일 로그인·인증·카카오 잇기·이메일로 옮기기가 **같은 모양**을 돌려준다. */
export async function loginPayload(env: { DB: D1Database; JWT_SECRET: string }, staffId: number) {
  const s = await env.DB.prepare(
    `SELECT s.id, s.agency_id, s.email, s.name, s.role, s.is_owner, a.name AS agency_name, a.kind AS agency_kind
       FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id WHERE s.id = ? LIMIT 1`,
  ).bind(staffId).first<{
    id: number; agency_id: number; email: string; name: string | null; role: string; is_owner: number
    agency_name: string; agency_kind: string
  }>()
  if (!s) return null
  const { token, expiresAt } = await issueAgencyStaffToken(env.JWT_SECRET, s)
  await env.DB.prepare("UPDATE agency_staff SET last_login_at = datetime('now') WHERE id = ?").bind(s.id).run().catch(swallow('agency-console:last-login'))
  return {
    token,
    expiresAt,
    staff: {
      id: s.id, email: s.email, name: s.name, role: s.role === 'admin' ? 'admin' : 'staff', isOwner: s.is_owner === 1,
      loginKind: isKakaoOnlyStaffEmail(s.email) ? 'kakao' : 'email',
    },
    agency: { id: s.agency_id, name: s.agency_name, kind: s.agency_kind === 'individual' ? 'individual' : 'business' },
  }
}

// ── 가입 ───────────────────────────────────────────────────────────────────
agencyConsoleRoutes.post('/signup', cors(), rateLimit({ action: 'agency_signup', max: 5, windowSec: 600 }), async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    const kind: AgencyKind = body.kind === 'individual' ? 'individual' : 'business'
    const name = typeof body.agency_name === 'string' ? body.agency_name.trim() : ''
    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    if (body.agree_terms !== true) return c.json({ success: false, error: '이용약관에 동의해 주세요.' }, 400)
    if (!name || name.length > AGENCY_NAME_MAX) return c.json({ success: false, error: `에이전시 이름을 ${AGENCY_NAME_MAX}자 안으로 적어 주세요.` }, 400)
    if (!EMAIL_RE.test(email) || email.length > 254) return c.json({ success: false, error: '이메일 형식을 확인해 주세요.' }, 400)
    let businessNumber: string | null = null
    if (kind === 'business') {
      businessNumber = normalizeBusinessNumber(body.business_number)
      if (!businessNumber) return c.json({ success: false, error: '사업자등록번호 10자리를 적어 주세요.' }, 400)
    }
    const pw = validatePasswordComplexity(password)
    if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)

    if (!agencyMailReady(c.env)) return c.json(AGENCY_MAIL_DOWN, 503)

    // 🏛️ 사업자면 국세청 상태를 본다 — 미등록·폐업 번호로는 에이전시를 못 만든다(남의 회사 이름으로 영업하는 것 차단).
    //   국세청이 답을 못 주면(키 없음·장애) 막지 않고 'unverified' 로 남긴다 → 어드민 에이전시 화면에 보인다.
    let businessStatus: string | null = null
    if (kind === 'business' && businessNumber) {
      const v = await checkAgencyBusiness(c.env, businessNumber)
      if (v.reject) return c.json({ success: false, code: 'BUSINESS_INVALID', error: v.reject }, 400)
      businessStatus = v.status
    }

    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const existing = await DB.prepare(
      'SELECT id, agency_id, status FROM agency_staff WHERE LOWER(email) = ? LIMIT 1',
    ).bind(email).first<{ id: number; agency_id: number; status: string }>()
    const base = frontendBase(c.env)

    if (existing && existing.status !== 'pending') {
      // 이미 쓰는 이메일 — 응답은 같게, 메일로만 알린다.
      await mail(c.env, email, '[유어딜] 이미 에이전시 계정이 있어요', '이미 가입된 이메일이에요',
        '이 이메일로 만든 에이전시 계정이 이미 있어요. 아래 버튼으로 로그인하거나, 비밀번호가 기억나지 않으면 비밀번호 찾기를 눌러 주세요.\n\n직접 가입을 시도하지 않으셨다면 이 메일은 무시하셔도 됩니다.',
        '에이전시 로그인', `${base}/agency/login`)
      return c.json({ success: true, message: GENERIC_SIGNUP_MSG })
    }

    const hash = await hashPassword(password)
    let staffId: number
    if (existing) {
      // 인증 전 가입을 다시 하는 경우 — 같은 행을 최신 입력으로 덮는다(인증 메일을 다시 보낸다).
      await DB.batch([
        DB.prepare("UPDATE agency_accounts SET name = ?, kind = ?, business_number = ?, business_status = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
          .bind(name, kind, businessNumber, businessStatus, existing.agency_id),
        DB.prepare("UPDATE agency_staff SET password_hash = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
          .bind(hash, existing.id),
      ])
      staffId = existing.id
    } else {
      const acc = await DB.prepare(
        "INSERT INTO agency_accounts (name, kind, business_number, business_status, status) VALUES (?, ?, ?, ?, 'pending')",
      ).bind(name, kind, businessNumber, businessStatus).run()
      const agencyId = Number(acc.meta?.last_row_id)
      const ins = await DB.prepare(
        "INSERT OR IGNORE INTO agency_staff (agency_id, email, password_hash, role, is_owner, status) VALUES (?, ?, ?, 'admin', 1, 'pending')",
      ).bind(agencyId, email, hash).run()
      if ((ins.meta?.changes ?? 0) === 0) {
        // 같은 이메일로 동시에 두 번 눌렀다 — 먼저 들어간 쪽이 이긴다. 고아 계정은 지운다.
        await DB.prepare("DELETE FROM agency_accounts WHERE id = ? AND status = 'pending'").bind(agencyId).run().catch(swallow('agency-console:orphan'))
        return c.json({ success: true, message: GENERIC_SIGNUP_MSG })
      }
      staffId = Number(ins.meta?.last_row_id)
    }

    const raw = await issueLinkToken(DB, staffId, 'verify')
    await mail(c.env, email, '[유어딜] 에이전시 이메일 인증', `${name} 에이전시 만들기`,
      '아래 버튼을 누르면 이메일 인증이 끝나고 에이전시가 만들어져요. 링크는 24시간 동안 쓸 수 있어요.',
      '이메일 인증하고 시작하기', `${base}/agency/verify?token=${raw}`)
    return c.json({ success: true, message: GENERIC_SIGNUP_MSG })
  } catch (err) {
    return safeError(c, err, '가입 처리 중 오류가 발생했어요', '[agency-console:signup]')
  }
})

// ── 이메일 인증 → 에이전시 활성 + 바로 로그인 ─────────────────────────────────
agencyConsoleRoutes.post('/verify', cors(), rateLimit({ action: 'agency_verify', max: 20, windowSec: 600 }), async (c) => {
  try {
    const { token } = await c.req.json<{ token?: string }>().catch(() => ({ token: '' }))
    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const r = await consumeLinkToken(DB, token || '', 'verify')
    if ('error' in r) {
      return c.json({
        success: false,
        code: r.error === 'expired' ? 'LINK_EXPIRED' : 'LINK_INVALID',
        error: r.error === 'expired' ? '링크가 만료됐어요. 다시 가입하면 새 링크를 보내 드려요.' : '이미 쓴 링크이거나 잘못된 링크예요.',
      }, 400)
    }
    const s = await DB.prepare('SELECT agency_id FROM agency_staff WHERE id = ? LIMIT 1').bind(r.staffId).first<{ agency_id: number }>()
    if (!s) return c.json({ success: false, code: 'LINK_INVALID', error: '이미 쓴 링크이거나 잘못된 링크예요.' }, 400)
    await DB.batch([
      DB.prepare("UPDATE agency_staff SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").bind(r.staffId),
      DB.prepare("UPDATE agency_accounts SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").bind(s.agency_id),
    ])
    const payload = await loginPayload(c.env, r.staffId)
    if (!payload) return c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
    return c.json({ success: true, ...payload })
  } catch (err) {
    return safeError(c, err, '인증 처리 중 오류가 발생했어요', '[agency-console:verify]')
  }
})

// ── 로그인 ─────────────────────────────────────────────────────────────────
agencyConsoleRoutes.post('/login', cors(), rateLimit({ action: 'agency_login', max: 10, windowSec: 300 }), async (c) => {
  const fail = () => c.json({ success: false, error: '이메일 또는 비밀번호가 맞지 않아요.' }, 401)
  try {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }))
    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) return c.json({ success: false, error: '이메일과 비밀번호를 적어 주세요.' }, 400)
    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const s = await DB.prepare(
      `SELECT s.id, s.status, s.password_hash, a.status AS agency_status
         FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id WHERE LOWER(s.email) = ? LIMIT 1`,
    ).bind(email).first<{ id: number; status: string; password_hash: string | null; agency_status: string }>()
    if (!s || !s.password_hash) {
      // 계정 유무가 응답 시간으로 새지 않게 같은 일을 한다.
      await verifyPassword(password, DUMMY_PBKDF2_HASH).catch(() => null)
      return fail()
    }
    const lockKey = `staff:${s.id}`
    const lock = await checkLockout(DB, 'agency', lockKey)
    if (lock.locked) return c.json({ success: false, error: '여러 번 틀려서 잠시 잠겼어요. 조금 뒤에 다시 시도해 주세요.', code: 'ACCOUNT_LOCKED' }, 429)
    const ok = await verifyPassword(password, s.password_hash)
    if (!ok.valid) {
      await recordFailure(DB, 'agency', lockKey).catch(swallow('agency-console:lockout'))
      return fail()
    }
    await clearFailures(DB, 'agency', lockKey)
    if (s.status === 'pending') return c.json({ success: false, code: 'EMAIL_NOT_VERIFIED', error: '이메일 인증을 아직 안 하셨어요. 받은 메일의 링크를 눌러 주세요.' }, 403)
    if (s.status !== 'active' || s.agency_status !== 'active') {
      return c.json({ success: false, code: 'AGENCY_STAFF_INACTIVE', error: '이 계정으로는 더 이상 들어올 수 없어요. 관리자에게 문의해 주세요.' }, 403)
    }
    const payload = await loginPayload(c.env, s.id)
    if (!payload) return fail()
    return c.json({ success: true, ...payload })
  } catch (err) {
    return safeError(c, err, '로그인 중 오류가 발생했어요', '[agency-console:login]')
  }
})

// ── 비밀번호 찾기 / 다시 정하기 ───────────────────────────────────────────────
agencyConsoleRoutes.post('/forgot-password', cors(), rateLimit({ action: 'agency_forgot_password', max: 3, windowSec: 3600 }), async (c) => {
  try {
    const { email: raw } = await c.req.json<{ email?: string }>().catch(() => ({ email: '' }))
    const email = normalizeEmail(raw)
    if (!EMAIL_RE.test(email)) return c.json({ success: false, error: '이메일 형식을 확인해 주세요.' }, 400)
    // 메일이 안 나가면 모두에게 같은 답 — 이메일이 있는지는 여전히 안 드러난다.
    if (!agencyMailReady(c.env)) return c.json(AGENCY_MAIL_DOWN, 503)
    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const s = await DB.prepare("SELECT id FROM agency_staff WHERE LOWER(email) = ? AND status = 'active' LIMIT 1").bind(email).first<{ id: number }>()
    if (s) {
      const token = await issueLinkToken(DB, s.id, 'reset')
      await mail(c.env, email, '[유어딜] 에이전시 비밀번호 다시 정하기', '비밀번호를 다시 정해 주세요',
        '아래 버튼을 눌러 새 비밀번호를 정해 주세요. 링크는 1시간 동안 쓸 수 있어요.\n\n직접 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않아요.',
        '새 비밀번호 정하기', `${frontendBase(c.env)}/agency/reset?token=${token}`)
    }
    return c.json({ success: true, message: GENERIC_FORGOT_MSG })
  } catch {
    return c.json({ success: true, message: GENERIC_FORGOT_MSG })
  }
})

agencyConsoleRoutes.post('/reset-password', cors(), rateLimit({ action: 'agency_reset_password', max: 10, windowSec: 600 }), async (c) => {
  try {
    const body = await c.req.json<{ token?: string; password?: string }>().catch(() => ({} as { token?: string; password?: string }))
    const pw = validatePasswordComplexity(body.password || '')
    if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)
    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const r = await consumeLinkToken(DB, body.token || '', 'reset')
    if ('error' in r) {
      return c.json({ success: false, code: r.error === 'expired' ? 'LINK_EXPIRED' : 'LINK_INVALID', error: '링크가 만료됐거나 이미 쓴 링크예요. 비밀번호 찾기를 다시 해 주세요.' }, 400)
    }
    const hash = await hashPassword(body.password as string)
    // 비밀번호를 바꾸면 그 전에 발급된 로그인은 전부 끊는다(다른 컴퓨터에 남은 로그인 포함).
    await DB.prepare(
      "UPDATE agency_staff SET password_hash = ?, tokens_valid_after = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'",
    ).bind(hash, Math.floor(Date.now() / 1000), r.staffId).run()
    await clearFailures(DB, 'agency', `staff:${r.staffId}`)
    return c.json({ success: true, message: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.' })
  } catch (err) {
    return safeError(c, err, '비밀번호 변경 중 오류가 발생했어요', '[agency-console:reset]')
  }
})

// ── 내 정보 ────────────────────────────────────────────────────────────────
agencyConsoleRoutes.get('/me', requireAgencyStaff(), async (c) => {
  const me = c.get('agencyStaff')
  const row = await c.env.DB.prepare(
    `SELECT s.id, s.email, s.name, s.role, s.is_owner, a.id AS agency_id, a.name AS agency_name, a.kind, a.business_number
       FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id WHERE s.id = ? LIMIT 1`,
  ).bind(me.staffId).first<{
    id: number; email: string; name: string | null; role: string; is_owner: number
    agency_id: number; agency_name: string; kind: string; business_number: string | null
  }>()
  if (!row) return c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
  return c.json({
    success: true,
    staff: {
      id: row.id, email: row.email, name: row.name, role: me.role, isOwner: row.is_owner === 1,
      loginKind: isKakaoOnlyStaffEmail(row.email) ? 'kakao' : 'email',
    },
    agency: {
      id: row.agency_id, name: row.agency_name, kind: row.kind === 'individual' ? 'individual' : 'business',
      businessNumber: me.role === 'admin' ? row.business_number : null,
    },
  })
})
