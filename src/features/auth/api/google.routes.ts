/**
 * 🌏 구글 로그인 — 외국인 손님 전용 (2026-11-18 대표 지시).
 *
 *   GET /api/auth/google/enabled   → { enabled }  (GOOGLE_CLIENT_ID·GOOGLE_CLIENT_SECRET 둘 다 있을 때만 true)
 *   GET /auth/google/start         → 서명 state + state 쿠키 → 구글 동의 화면
 *   GET /auth/google/callback      → state 확인 → 서버에서 code 교환 → id_token 클레임 확인 → 회원 → 세션
 *
 * 버튼은 기기 언어가 한국어가 아닐 때만 보인다(`pages/login/GoogleLoginButton.tsx`) — 관광객은 한국 IP 라
 *   IP 로 가르지 않는다. 자격이 없으면 모든 길이 아무것도 안 한다(enabled=false · start/callback 은 /login 으로).
 *
 * 세션은 카카오와 **같은 방식**이다: 302 에 `ur_session`(크롬 등) + fragment `#st=` 확립 티켓(iOS — same-origin
 *   POST /api/auth/session/establish 로 교환). 근거: CLAUDE.md 카카오 OAuth 룰 · iOS 쿠키 영속 룰.
 *
 * 🔒 Firebase 토큰을 받지 않는다 — `scripts/check-no-firebase-auth.mjs` 가 막는 `googleRoutes`(Firebase ID 토큰
 *   수용 경로, 2026-07-28 마운트 해제)와 다른 것이다. 이 라우트는 브라우저가 낸 토큰을 믿지 않는다.
 */
import { Hono } from 'hono'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { createSessionCookie, clearSessionCookie } from '@/worker/utils/session'
import { safeError } from '@/worker/utils/safe-error'
import { sessionPersistProbeCookie } from '../../../shared/session-persist-probe'
import { signEstablishTicket } from '../../../worker/utils/session-establish-ticket'
import { signPurposeState, verifyPurposeState } from '../../../worker/utils/oauth-signed-state'
import { oauthSafeRedirect as safeRedirect, oauthReadCookie as readCookie } from './kakao.routes'
import {
  GOOGLE_AUTHORIZE_URL, isGoogleLoginConfigured, exchangeGoogleCode, decodeJwtPayload,
  validateGoogleIdTokenClaims, findOrCreateGoogleUser,
} from '../services/google-oauth'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

export const googleOauthRoutes = new Hono<{ Bindings: Bindings }>()

const STATE_COOKIE = 'google_oauth_state'
export const GOOGLE_STATE_PURPOSE = 'google_oauth_state'

function clearStateCookie(): string {
  return `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

/** 로그인 화면으로 오류 코드와 함께 돌려보낸다. `/login` 은 safeRedirect 가 막는 주소라 여기서 고정 문자열로 만든다. */
export function loginErrorPath(code: string, returnTo: string): string {
  const qs = new URLSearchParams({ error: code })
  if (returnTo && returnTo !== '/') qs.set('returnUrl', returnTo)
  return `/login?${qs.toString()}`
}

/**
 * 콜백의 state 판정 — 쿠키(nonce)가 있으면 서명 state 의 nonce 와 같아야 하고, 쿠키가 없으면(iOS 유실) 서명만으로 통과.
 * 서명이 없거나 틀리면 null(=CSRF 차단).
 */
export async function resolveGoogleState(
  receivedState: string | null | undefined,
  cookieNonce: string | null,
  secret: string,
): Promise<{ redirect: string; cookieMatched: boolean } | null> {
  const payload = await verifyPurposeState(receivedState, GOOGLE_STATE_PURPOSE, secret)
  if (!payload) return null
  // 쿠키 nonce 가 달라도(두 번 누름·뒤로가기로 쿠키가 낡음) 서명이 맞으면 통과 — 카카오 콜백과 같은 신뢰 모델.
  //   서명은 JWT_SECRET 없이 위조할 수 없고 30분 만료다. 쿠키는 그래서 '있으면 좋은' 보조 신호일 뿐이다.
  return {
    redirect: safeRedirect(typeof payload.r === 'string' ? payload.r : '/'),
    cookieMatched: !!cookieNonce && payload.n === cookieNonce,
  }
}

// 버튼을 그릴지 — 비밀 값은 돌려주지 않는다(있다/없다만).
googleOauthRoutes.get('/enabled', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json({ enabled: isGoogleLoginConfigured(c.env) })
})

googleOauthRoutes.get('/start', rateLimit({ action: 'google_start', max: 30, windowSec: 60 }), async (c) => {
  const redirect = safeRedirect(c.req.query('redirect') || '/')
  if (!isGoogleLoginConfigured(c.env) || !c.env.JWT_SECRET) {
    return c.redirect(loginErrorPath('google_unavailable', redirect), 302)
  }
  try {
    const nonce = crypto.randomUUID()
    const state = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: nonce, r: redirect }, c.env.JWT_SECRET)
    c.header('Set-Cookie', `${STATE_COOKIE}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`)
    const origin = new URL(c.req.url).origin
    const u = new URL(GOOGLE_AUTHORIZE_URL)
    u.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID!)
    u.searchParams.set('redirect_uri', `${origin}/auth/google/callback`)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', 'openid email profile')
    u.searchParams.set('prompt', 'select_account')
    u.searchParams.set('state', state)
    return c.redirect(u.toString(), 302)
  } catch (err) {
    return safeError(c, err, '로그인을 시작하지 못했어요. 다시 시도해 주세요.', '[google-start]')
  }
})

googleOauthRoutes.get('/callback', rateLimit({ action: 'google_callback', max: 30, windowSec: 60 }), async (c) => {
  if (!isGoogleLoginConfigured(c.env) || !c.env.JWT_SECRET) {
    return c.redirect(loginErrorPath('google_unavailable', '/'), 302)
  }
  const state = await resolveGoogleState(c.req.query('state'), readCookie(c.req.header('Cookie'), STATE_COOKIE), c.env.JWT_SECRET)
  c.header('Set-Cookie', clearStateCookie())
  if (!state) return c.redirect(loginErrorPath('oauth_state_expired', '/'), 302)
  const target = state.redirect

  if (c.req.query('error')) return c.redirect(loginErrorPath('google_cancelled', target), 302) // 동의 화면에서 취소
  const code = c.req.query('code')
  if (!code || code.length > 2048) return c.redirect(loginErrorPath('google_auth_failed', target), 302)

  try {
    const origin = new URL(c.req.url).origin
    const tokens = await exchangeGoogleCode(code, `${origin}/auth/google/callback`, c.env)
    const claims = validateGoogleIdTokenClaims(decodeJwtPayload(tokens.id_token), c.env.GOOGLE_CLIENT_ID!)
    if (!claims) return c.redirect(loginErrorPath('google_auth_failed', target), 302)

    const result = await findOrCreateGoogleUser(c.env.DB, claims)
    if (result.kind === 'email_in_use') {
      return c.redirect(loginErrorPath(result.via === 'kakao' ? 'email_in_use_kakao' : 'email_in_use', target), 302)
    }
    const user = result.user

    if (result.kind === 'created') {
      // 약관 간주 동의(로그인 화면 고지 — 카카오 신규 가입과 같다) · 어드민 가입 알림. 둘 다 fail-soft.
      try {
        const { recordTermsAgreements } = await import('../../../worker/utils/terms-agreements')
        await recordTermsAgreements(c.env.DB, 'user', String(user.id), [
          { doc_type: 'service', agreed: true },
          { doc_type: 'privacy', agreed: true },
        ])
      } catch { /* fail-soft */ }
      try { c.executionCtx.waitUntil(import('../../../worker/utils/admin-event-notify').then((m) => m.notifyAdminEvent(c.env.DB, { type: 'user_signup', title: '새 유저 가입', message: `${String(user.name || '이름 없음').slice(0, 30)} · 구글`, link: '/admin/users' }))) } catch { /* fail-soft */ }
    }

    // 다른 사람 기기에 남은 역할 세션은 걷는다(카카오와 같다). 구글은 손님 계정만 — 역할 토큰은 발급하지 않는다.
    c.header('Set-Cookie', clearSessionCookie('seller'), { append: true })
    c.header('Set-Cookie', clearSessionCookie('admin'), { append: true })
    c.header('Set-Cookie', clearSessionCookie('agency'), { append: true })
    const sessionCookie = await createSessionCookie(user.id, user.name, user.email || '', user.profile_image || undefined, c.env.JWT_SECRET)
    c.header('Set-Cookie', sessionCookie, { append: true })
    c.header('Set-Cookie', sessionPersistProbeCookie(), { append: true })

    const url = new URL(target, 'https://dummy.invalid')
    url.searchParams.set('login', 'success')
    url.searchParams.set('userId', String(user.id))
    url.searchParams.set('userName', user.name)
    if (user.profile_image) url.searchParams.set('profileImage', user.profile_image)
    if (result.kind === 'created') url.searchParams.set('new', '1')
    let frag = ''
    try { frag = '#st=' + encodeURIComponent(await signEstablishTicket(c.env.JWT_SECRET, user)) } catch { /* 302 쿠키로 degrade */ }
    return c.redirect(url.pathname + url.search + frag, 302)
  } catch (err) {
    if (import.meta.env.DEV) console.error('[google-callback]', err)
    return c.redirect(loginErrorPath('google_auth_failed', target), 302)
  }
})
