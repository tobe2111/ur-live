/**
 * 🟡 유어애즈 카카오 로그인 (2026-07-27 대표 "/ads 도 카카오 로그인 가능하게").
 *
 *   메인 워커 전용 네임스페이스 `/api/ads-auth/*` — ads-pay 와 동일 패턴(KAKAO_REST_API_KEY 가
 *   메인 워커에 있고, `/api/ads/*` 는 ur-ads 위임이라 별도 네임스페이스). 유어딜 소비자 카카오
 *   플로우(kakao.routes.ts — 잠금)와 완전 분리: 콜백/state/계정 전부 ads 전용(서비스 분리).
 *
 *   플로우: GET /kakao/start → kauth 인가(302, state 쿠키 CSRF)
 *         → GET /kakao/callback → code 교환 → v2/user/me → kakaoLoginAdsAccount(ads-account.ts)
 *         → 302 `/ads/kakao#t={ads_token}` — 토큰은 fragment(서버로 재전송 안 됨) + localStorage
 *           (iOS 쿠키 미영속 룰: 역할 토큰은 fragment 전달이 표준 — ads_token 도 원래 localStorage).
 *
 *   ⚠️ 활성 조건: 카카오 개발자 콘솔 Redirect URI 에 `https://urdeal.kr/api/ads-auth/kakao/callback`
 *   등록 필요(미등록 시 카카오가 KOE006 에러 — 코드는 배포돼도 무해).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { kakaoLoginAdsAccount, signAdsToken } from './ads-account'

const STATE_COOKIE = 'ads_kakao_state'

const adsKakaoAuthRoutes = new Hono<{ Bindings: Env }>()

// GET /api/ads-auth/kakao/start — 카카오 인가 페이지로 302
adsKakaoAuthRoutes.get('/kakao/start', rateLimit({ action: 'ads-kakao-start', max: 30, windowSec: 60 }), async (c) => {
  const restKey = c.env.KAKAO_REST_API_KEY
  if (!restKey) return c.redirect('/ads/login?error=kakao_env', 302)
  const state = crypto.randomUUID()
  c.header('Set-Cookie', `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`)
  const origin = new URL(c.req.url).origin
  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize')
  authUrl.searchParams.set('client_id', restKey)
  authUrl.searchParams.set('redirect_uri', `${origin}/api/ads-auth/kakao/callback`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)
  return c.redirect(authUrl.toString(), 302)
})

// GET /api/ads-auth/kakao/callback — code 교환 → 계정 로그인/생성 → /ads/kakao#t={token}
adsKakaoAuthRoutes.get('/kakao/callback', rateLimit({ action: 'ads-kakao-cb', max: 30, windowSec: 60 }), async (c) => {
  const fail = (reason: string) => c.redirect(`/ads/login?error=${encodeURIComponent(reason)}`, 302)
  const clearState = () => c.header('Set-Cookie', `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`)
  try {
    const code = c.req.query('code')
    const state = c.req.query('state') || ''
    if (!code) return fail('kakao_denied') // 사용자가 카카오에서 취소
    // CSRF: state 쿠키 대조(Lax 쿠키는 top-level GET 복귀에 동봉됨).
    const cookies = c.req.header('Cookie') || ''
    const saved = cookies.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1]
    clearState()
    if (!saved || saved !== state) return fail('state_mismatch')
    if (!c.env.KAKAO_REST_API_KEY || !c.env.JWT_SECRET) return fail('kakao_env')

    const origin = new URL(c.req.url).origin
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: c.env.KAKAO_REST_API_KEY,
        redirect_uri: `${origin}/api/ads-auth/kakao/callback`,
        code,
      }).toString(),
    }).catch(() => null)
    const tokenJson = tokenRes?.ok ? await tokenRes.json().catch(() => null) as { access_token?: string } | null : null
    if (!tokenJson?.access_token) return fail('kakao_token')

    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    }).catch(() => null)
    const me = meRes?.ok ? await meRes.json().catch(() => null) as {
      id?: number | string
      kakao_account?: { email?: string; is_email_verified?: boolean; profile?: { nickname?: string } }
    } | null : null
    if (!me?.id) return fail('kakao_profile')

    const r = await kakaoLoginAdsAccount(c.env.DB, {
      kakaoId: String(me.id),
      email: me.kakao_account?.email || null,
      emailVerified: me.kakao_account?.is_email_verified === true,
      nickname: me.kakao_account?.profile?.nickname || null,
    })
    if (!r.ok) return fail(r.error)
    const token = await signAdsToken(r.account.id, c.env.JWT_SECRET)
    // 토큰은 fragment 로만 전달(서버/로그/리퍼러에 안 남음) — 랜딩(/ads/kakao)이 localStorage 저장.
    return c.redirect(`/ads/kakao#t=${encodeURIComponent(token)}`, 302)
  } catch {
    return fail('kakao_error')
  }
})

export { adsKakaoAuthRoutes }
