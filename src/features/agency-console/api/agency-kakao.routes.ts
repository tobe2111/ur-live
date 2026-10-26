/**
 * 🟡 카카오로 만든 에이전시 — 만들기 · 잇기 · 이메일 계정으로 옮기기 (2026-10-26 대표 확정)
 *   마운트: `agency-staff.routes.ts` 가 `/` 로 끼운다(`/api/agency-console/kakao/*` · `/move-to-email` · `/verify-move`).
 *
 * 대표: *"아무튼 에이전시 계정은 이메일로만 로그인 되긴 해야해. 카카오 로그인으로 해도 되고, 대신 카카오
 *   로그인 시, 여러명이 함께 관리는 힘들다고 해두면 되는거 아닌가?"* → `AskUserQuestion` *"이메일 계정으로 옮기기 제공"*.
 *
 * ## 신원은 여전히 에이전시 직원 행이다
 * 카카오로 만들어도 `users` 에 에이전시를 얹지 않는다 — 직원 행(`agency_staff`)을 하나 만들고 `user_id` 로
 * 그 카카오 계정과 **잇기만** 한다. 성과·몫은 계속 에이전시 단위로 잡힌다(2026-10-11 결정의 핵심은 그대로).
 * 로그인 토큰도 같은 에이전시 전용 열쇠로 서명한다 — 카카오 세션으로 에이전시 API 를 직접 부르지 않는다.
 *
 * ## 왜 혼자 쓰는 계정인가
 * 카카오 계정은 한 사람의 것이다. 함께 쓰려면 비밀번호를 나눠야 하는데, 카카오 비밀번호를 나누는 것은
 * 그 사람의 메신저·결제를 통째로 나누는 일이다. 그래서 직원 초대는 이메일 계정으로 옮긴 뒤에 열린다.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { hashPassword, validatePasswordComplexity } from '@/lib/password'
import { csrfProtection } from '@/lib/csrf'
import { buildSystemEmailHtml, sendSystemEmail } from '@/lib/system-email'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAuth } from '@/worker/middleware/auth'
import { resolveUserId } from '@/worker/utils/resolve-user-id'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { isKakaoOnlyStaffEmail, kakaoStaffEmail } from '@/shared/agency-kakao'
import { ensureAgencyConsoleTables, AGENCY_NAME_MAX, type AgencyKind } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'
import {
  AGENCY_MAIL_DOWN, agencyMailReady, checkAgencyBusiness, consumeLinkToken, frontendBase,
  issueLinkToken, loginPayload, normalizeBusinessNumber, normalizeEmail,
} from './agency-auth.routes'

type Bindings = {
  DB: D1Database; JWT_SECRET: string
  RESEND_API_KEY?: string; RESEND_FROM?: string; FRONTEND_URL?: string
  PUBLIC_DATA_SERVICE_KEY?: string; NTS_API_KEY?: string
}
type AuthUser = { id: string | number; type?: string; isDbId?: boolean; name?: string }
type Vars = { agencyStaff: AgencyStaffContext; user: AuthUser }

export const agencyKakaoRoutes = new Hono<{ Bindings: Bindings; Variables: Vars }>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * 카카오(손님) 로그인인가 — 셀러·어드민 토큰도 `requireAuth` 를 통과하므로 종류를 본다.
 * 셀러 토큰의 id 는 sellers.id 라 users.id 로 쓰면 **남의 계정**과 잇게 된다.
 */
async function consumerUserId(u: AuthUser | undefined, DB: D1Database): Promise<number | null> {
  if (!u || (u.type && u.type !== 'user')) return null
  return resolveUserId(DB, u.id, u.isDbId)
}

/** 이 카카오 계정과 이어진 살아 있는 에이전시 직원 — 없으면 null. */
async function linkedStaffId(DB: D1Database, userId: number): Promise<number | null> {
  const row = await DB.prepare(
    `SELECT s.id FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id
      WHERE s.user_id = ? AND s.status = 'active' AND a.status = 'active' LIMIT 1`,
  ).bind(userId).first<{ id: number }>()
  return row?.id ?? null
}

// ── 카카오로 에이전시 만들기 ──────────────────────────────────────────────────
agencyKakaoRoutes.post('/kakao/create', requireAuth(), csrfProtection(),
  rateLimit({ action: 'agency_kakao_create', max: 5, windowSec: 600 }), async (c) => {
    try {
      const userId = await consumerUserId(c.get('user'), c.env.DB)
      if (!userId) return c.json({ success: false, code: 'KAKAO_LOGIN_REQUIRED', error: '카카오로 로그인한 뒤에 만들 수 있어요.' }, 401)
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
      const kind: AgencyKind = body.kind === 'individual' ? 'individual' : 'business'
      const name = typeof body.agency_name === 'string' ? body.agency_name.trim() : ''
      if (body.agree_terms !== true) return c.json({ success: false, error: '이용약관에 동의해 주세요.' }, 400)
      if (!name || name.length > AGENCY_NAME_MAX) return c.json({ success: false, error: `에이전시 이름을 ${AGENCY_NAME_MAX}자 안으로 적어 주세요.` }, 400)
      let businessNumber: string | null = null
      if (kind === 'business') {
        businessNumber = normalizeBusinessNumber(body.business_number)
        if (!businessNumber) return c.json({ success: false, error: '사업자등록번호 10자리를 적어 주세요.' }, 400)
      }

      const { DB } = c.env
      await ensureAgencyConsoleTables(DB)
      // 한 카카오 계정은 에이전시 하나 — 이미 있으면 새로 만들지 않고 그 에이전시로 들어간다.
      const already = await linkedStaffId(DB, userId)
      if (already) {
        const p = await loginPayload(c.env, already)
        return p ? c.json({ success: true, already: true, ...p }) : c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
      }

      let businessStatus: string | null = null
      if (kind === 'business' && businessNumber) {
        const v = await checkAgencyBusiness(c.env, businessNumber)
        if (v.reject) return c.json({ success: false, code: 'BUSINESS_INVALID', error: v.reject }, 400)
        businessStatus = v.status
      }

      const u = await DB.prepare('SELECT name FROM users WHERE id = ? LIMIT 1').bind(userId).first<{ name: string | null }>()
      // 카카오 신원은 카카오가 확인했으므로 이메일 인증 단계 없이 바로 쓴다.
      const acc = await DB.prepare(
        "INSERT INTO agency_accounts (name, kind, business_number, business_status, status) VALUES (?, ?, ?, ?, 'active')",
      ).bind(name, kind, businessNumber, businessStatus).run()
      const agencyId = Number(acc.meta?.last_row_id)
      const ins = await DB.prepare(
        "INSERT OR IGNORE INTO agency_staff (agency_id, email, name, role, is_owner, status, user_id) VALUES (?, ?, ?, 'admin', 1, 'active', ?)",
      ).bind(agencyId, kakaoStaffEmail(userId), (u?.name || '').slice(0, 40) || null, userId).run()
      if ((ins.meta?.changes ?? 0) === 0) {
        // 같은 카카오 계정으로 동시에 두 번 눌렀다 — 먼저 들어간 쪽이 이긴다. 고아 에이전시는 지운다.
        await DB.prepare('DELETE FROM agency_accounts WHERE id = ?').bind(agencyId).run().catch(swallow('agency-kakao:orphan'))
        const winner = await linkedStaffId(DB, userId)
        const p = winner ? await loginPayload(c.env, winner) : null
        return p ? c.json({ success: true, already: true, ...p }) : c.json({ success: false, error: '잠시 뒤 다시 시도해 주세요.' }, 409)
      }
      const p = await loginPayload(c.env, Number(ins.meta?.last_row_id))
      if (!p) return c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
      return c.json({ success: true, ...p })
    } catch (err) {
      return safeError(c, err, '에이전시를 만드는 중 오류가 발생했어요', '[agency-kakao:create]')
    }
  })

// ── 카카오 로그인으로 에이전시 잇기 — 마이가 한 번 부른다 ────────────────────────
agencyKakaoRoutes.post('/kakao/session', requireAuth(), csrfProtection(),
  rateLimit({ action: 'agency_kakao_session', max: 30, windowSec: 600 }), async (c) => {
    try {
      const userId = await consumerUserId(c.get('user'), c.env.DB)
      if (!userId) return c.json({ success: false, code: 'KAKAO_LOGIN_REQUIRED', error: '카카오로 로그인해 주세요.' }, 401)
      await ensureAgencyConsoleTables(c.env.DB)
      const staffId = await linkedStaffId(c.env.DB, userId)
      if (!staffId) return c.json({ success: false, code: 'NO_AGENCY', error: '이 카카오 계정과 이어진 에이전시가 없어요.' }, 404)
      const p = await loginPayload(c.env, staffId)
      if (!p) return c.json({ success: false, code: 'NO_AGENCY', error: '이 카카오 계정과 이어진 에이전시가 없어요.' }, 404)
      return c.json({ success: true, ...p })
    } catch (err) {
      return safeError(c, err, '에이전시를 불러오지 못했어요', '[agency-kakao:session]')
    }
  })

// ── 이메일 계정으로 옮기기 (카카오로 만든 에이전시의 주인만) ───────────────────────
agencyKakaoRoutes.post('/move-to-email', cors(), requireAgencyStaff({ adminOnly: true }),
  rateLimit({ action: 'agency_move_to_email', max: 5, windowSec: 3600 }), async (c) => {
    try {
      const me = c.get('agencyStaff')
      if (!me.isOwner || !isKakaoOnlyStaffEmail(me.email)) {
        return c.json({ success: false, code: 'NOT_KAKAO_ACCOUNT', error: '이미 이메일로 쓰는 계정이에요.' }, 409)
      }
      const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }))
      const email = normalizeEmail(body.email)
      if (!EMAIL_RE.test(email) || email.length > 254 || isKakaoOnlyStaffEmail(email)) {
        return c.json({ success: false, error: '이메일 형식을 확인해 주세요.' }, 400)
      }
      const pw = validatePasswordComplexity(body.password || '')
      if (!pw.ok) return c.json({ success: false, error: pw.error }, 400)
      if (!agencyMailReady(c.env)) return c.json(AGENCY_MAIL_DOWN, 503)
      const { DB } = c.env
      const taken = await DB.prepare('SELECT id FROM agency_staff WHERE LOWER(email) = ? LIMIT 1').bind(email).first<{ id: number }>()
      if (taken) return c.json({ success: false, code: 'EMAIL_TAKEN', error: '이 이메일은 이미 에이전시 계정으로 쓰이고 있어요. 다른 이메일을 적어 주세요.' }, 409)
      const hash = await hashPassword(body.password as string)
      await DB.prepare(
        "UPDATE agency_staff SET pending_email = ?, pending_password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      ).bind(email, hash, me.staffId).run()
      const raw = await issueLinkToken(DB, me.staffId, 'move')
      await sendSystemEmail(c.env, email, {
        subject: '[유어딜] 에이전시를 이메일 계정으로 옮기기',
        html: buildSystemEmailHtml({
          title: '이 이메일로 에이전시에 들어오시겠어요?',
          greeting: '안녕하세요.',
          body: '아래 버튼을 누르면 카카오로 쓰던 에이전시가 이 이메일 계정이 돼요. 그다음부터 직원을 초대해 함께 쓸 수 있어요. 링크는 24시간 동안 쓸 수 있어요.\n\n직접 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.',
          actionLabel: '이메일 계정으로 옮기기',
          actionUrl: `${frontendBase(c.env)}/agency/verify?kind=move&token=${raw}`,
        }),
      }, { ignorePreference: true }).catch(swallow('agency-kakao:move-mail'))
      return c.json({ success: true, message: `${email} 로 확인 메일을 보냈어요. 메일의 버튼을 누르면 옮겨져요.` })
    } catch (err) {
      return safeError(c, err, '이메일 계정으로 옮기는 중 오류가 발생했어요', '[agency-kakao:move]')
    }
  })

agencyKakaoRoutes.post('/verify-move', cors(), rateLimit({ action: 'agency_verify_move', max: 20, windowSec: 600 }), async (c) => {
  try {
    const { token } = await c.req.json<{ token?: string }>().catch(() => ({ token: '' }))
    const { DB } = c.env
    await ensureAgencyConsoleTables(DB)
    const r = await consumeLinkToken(DB, token || '', 'move')
    if ('error' in r) {
      return c.json({
        success: false,
        code: r.error === 'expired' ? 'LINK_EXPIRED' : 'LINK_INVALID',
        error: r.error === 'expired' ? '링크가 만료됐어요. 마이에서 다시 옮기기를 눌러 주세요.' : '이미 쓴 링크이거나 잘못된 링크예요.',
      }, 400)
    }
    try {
      // 옮기는 사이 같은 이메일을 다른 사람이 썼으면 유일 인덱스가 막는다(아래 catch).
      const done = await DB.prepare(
        `UPDATE agency_staff SET email = pending_email, password_hash = pending_password_hash,
                pending_email = NULL, pending_password_hash = NULL, updated_at = datetime('now')
          WHERE id = ? AND status = 'active' AND pending_email IS NOT NULL AND pending_password_hash IS NOT NULL`,
      ).bind(r.staffId).run()
      if ((done.meta?.changes ?? 0) === 0) return c.json({ success: false, code: 'LINK_INVALID', error: '이미 쓴 링크이거나 잘못된 링크예요.' }, 400)
    } catch {
      return c.json({ success: false, code: 'EMAIL_TAKEN', error: '그 이메일은 그사이 다른 에이전시 계정이 됐어요. 다른 이메일로 다시 옮겨 주세요.' }, 409)
    }
    const p = await loginPayload(c.env, r.staffId)
    if (!p) return c.json({ success: false, error: '계정을 찾지 못했어요.' }, 404)
    return c.json({ success: true, ...p })
  } catch (err) {
    return safeError(c, err, '옮기는 중 오류가 발생했어요', '[agency-kakao:verify-move]')
  }
})
