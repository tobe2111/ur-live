/**
 * Kakao OAuth signed-state(self-contained) 단위 테스트.
 *
 * 배경 (2026-06-20): iOS Safari/WebKit 는 OAuth 왕복(특히 카카오톡 앱 핸드오프 →
 *   Safari 복귀, ITP cross-site 쿠키 처리)에서 `kakao_oauth_state` Lax 쿠키를
 *   콜백에 안 돌려주는 케이스가 있어 `oauth_state_expired` 로 로그인 실패 (Chrome 은 정상).
 *   → state 파라미터를 JWT_SECRET 으로 서명해 redirect/intent/nonce/만료를 담으면
 *     쿠키 없이도 서명 검증으로 CSRF·라우팅 복구 가능.
 *
 * 보안 회귀 가드:
 *   - 올바른 서명 + 미만료 → redirect/intent 복구
 *   - 다른 secret(위조) → null (CSRF 차단)
 *   - 변조된 토큰 → null
 *   - 만료된 토큰 → null
 *   - 레거시 opaque UUID(점 2개 아님) → null (검증 대상 아님)
 *   - redirect 는 safeRedirect 통과 (open-redirect 차단)
 */

import { describe, it, expect } from 'vitest'
import {
  __signOauthStateForTest as signOauthState,
  __verifySignedStateForTest as verifySignedState,
} from '@/features/auth/api/kakao.routes'

const SECRET = 'test-jwt-secret-please-rotate-in-prod-0123456789'

describe('Kakao signed OAuth state (쿠키 유실 fallback)', () => {
  it('서명 → 검증 왕복: redirect/intent 복구', async () => {
    const token = await signOauthState('/products/123', 'user', 'nonce-1', SECRET)
    expect(token.split('.').length).toBe(3) // JWT 형태
    const out = await verifySignedState(token, SECRET)
    expect(out).toEqual({ redirect: '/products/123', intent: 'user' })
  })

  it('intent=seller / agency 보존', async () => {
    const s = await signOauthState('/seller', 'seller', 'n', SECRET)
    expect((await verifySignedState(s, SECRET))?.intent).toBe('seller')
    const a = await signOauthState('/agency', 'agency', 'n', SECRET)
    expect((await verifySignedState(a, SECRET))?.intent).toBe('agency')
  })

  it('다른 secret 으로 검증 → null (위조 차단 = CSRF)', async () => {
    const token = await signOauthState('/', 'user', 'n', SECRET)
    expect(await verifySignedState(token, 'a-totally-different-secret')).toBeNull()
  })

  it('변조된 토큰 → null', async () => {
    const token = await signOauthState('/', 'user', 'n', SECRET)
    const tampered = token.slice(0, -3) + 'xyz'
    expect(await verifySignedState(tampered, SECRET)).toBeNull()
  })

  it('만료된 토큰 → null', async () => {
    // exp 이 과거인 토큰을 직접 서명 (hono/jwt 는 exp 과거면 verify throw)
    const { sign } = await import('hono/jwt')
    const past = Math.floor(Date.now() / 1000) - 10
    const expired = await sign(
      { p: 'kakao_oauth_state', n: 'n', r: '/', i: 'user', iat: past - 1800, exp: past },
      SECRET,
    )
    expect(await verifySignedState(expired, SECRET)).toBeNull()
  })

  it('purpose 불일치(다른 용도 JWT) → null', async () => {
    const { sign } = await import('hono/jwt')
    const wrong = await sign(
      { p: 'something_else', r: '/', i: 'user', exp: Math.floor(Date.now() / 1000) + 600 },
      SECRET,
    )
    expect(await verifySignedState(wrong, SECRET)).toBeNull()
  })

  it('레거시 opaque UUID(점 2개 아님) → null (검증 대상 아님)', async () => {
    expect(await verifySignedState('550e8400-e29b-41d4-a716-446655440000', SECRET)).toBeNull()
  })

  it('null / 빈 secret → null', async () => {
    expect(await verifySignedState(null, SECRET)).toBeNull()
    const t = await signOauthState('/', 'user', 'n', SECRET)
    expect(await verifySignedState(t, '')).toBeNull()
  })

  it('redirect 는 safeRedirect 통과 — open redirect 차단', async () => {
    // 서명 시점엔 이미 safeRedirect 된 값이 들어오지만, 방어적으로 검증단도 통과시킴
    const token = await signOauthState('https://evil.com' as string, 'user', 'n', SECRET)
    const out = await verifySignedState(token, SECRET)
    expect(out?.redirect).toBe('/') // 외부 URL → '/' 로 clamp
  })

  it('쿠키 호환: state(JWT)에 "|" 없음 → cookie split 안전', async () => {
    const token = await signOauthState('/checkout', 'user', 'n', SECRET)
    expect(token.includes('|')).toBe(false)
    // cookie value 형태 재현: `${state}|${b64}|${intent}` → split 시 3조각, 첫 조각이 그대로 JWT
    const cookieVal = `${token}|cGF0aA|user`
    const parts = cookieVal.split('|')
    expect(parts.length).toBe(3)
    expect(parts[0]).toBe(token)
  })
})
