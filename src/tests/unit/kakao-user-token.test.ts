/**
 * 🛡️ 2026-06-20 카카오 user_token(Bearer) 단위 테스트.
 *
 * 배경(진단 데이터): iOS(사파리/카톡인앱)는 OAuth 서버단 success 인데도 로그인 안 됨
 *   (httpOnly ur_session 쿠키가 cross-site 콜백 set 후 WebKit 에서 미유지 → API 401 → 재시도 루프).
 *   해결: user_token(Bearer) 발급 → 클라 localStorage 보관 + Authorization: Bearer → requireAuth
 *   Bearer 경로(type 기본 'user')가 쿠키 무관하게 인증.
 *
 * 검증: 서명된 토큰이 HS256/JWT_SECRET 로 verify 되고, requireAuth 가 읽는 클레임(sub/type)이 맞는지.
 */
import { describe, it, expect } from 'vitest'
import { verify as jwtVerify } from 'hono/jwt'
import { __signUserBearerTokenForTest as signUserBearerToken } from '@/features/auth/api/kakao.routes'

const SECRET = 'unit-test-jwt-secret-user-token-0123456789'

describe('카카오 user_token (Bearer) — iOS 쿠키 우회', () => {
  it('서명된 토큰이 JWT_SECRET/HS256 로 verify + sub/type 클레임 정확', async () => {
    const token = await signUserBearerToken(SECRET, 12345, '정원', 'urteam@example.com')
    expect(token.split('.').length).toBe(3) // JWT
    const payload = (await jwtVerify(token, SECRET, 'HS256')) as Record<string, unknown>
    // requireAuth Bearer 경로: jwtId = userId ?? sub, type 기본 'user'
    expect(payload.sub).toBe('12345')
    expect(payload.type).toBe('user')
    expect(payload.email).toBe('urteam@example.com')
    expect(payload.isDbId).toBe(true)
    expect(typeof payload.exp).toBe('number')
  })

  it('다른 secret 으로는 verify 실패 (위조 차단)', async () => {
    const token = await signUserBearerToken(SECRET, 1, 'x', 'x@x.com')
    await expect(jwtVerify(token, 'a-different-secret', 'HS256')).rejects.toThrow()
  })

  it('email 누락 시 빈 문자열로 정규화(throw 없음)', async () => {
    const token = await signUserBearerToken(SECRET, 7, '', '')
    const payload = (await jwtVerify(token, SECRET, 'HS256')) as Record<string, unknown>
    expect(payload.sub).toBe('7')
    expect(payload.email).toBe('')
  })
})
