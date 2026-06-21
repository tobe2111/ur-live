/**
 * 🛡️ 2026-06-20 카카오 세션 확립 티켓(A 방식) 단위 테스트.
 *
 * 배경(진단 데이터): iOS(사파리/카톡인앱)는 OAuth 서버단 success 인데도 로그인 안 됨
 *   (httpOnly ur_session 쿠키가 cross-site 콜백 302 응답 set 후 WebKit 에서 미영속 → API 401).
 * A 방식: 콜백은 단명(120초)·서명 **세션 티켓**만 fragment(#st=)로 넘기고, 착지 클라가 same-origin
 *   POST /api/auth/session/establish 로 교환 → 서버가 httpOnly ur_session 을 first-party 200 에서 발급.
 *   토큰을 localStorage 에 두지 않음(OWASP). 티켓은 HS256/JWT_SECRET 서명 + 120초 만료.
 *
 * 검증: 티켓이 verify 되고 purpose/uid/만료(≤120s) 클레임이 정확한지 + 위조 거부.
 */
import { describe, it, expect } from 'vitest'
import { verify as jwtVerify } from 'hono/jwt'
import { __signEstablishTicketForTest as signEstablishTicket } from '@/features/auth/api/kakao.routes'

const SECRET = 'unit-test-jwt-secret-establish-0123456789'

describe('카카오 세션 확립 티켓 (A 방식 — same-origin httpOnly)', () => {
  it('티켓 verify + purpose/uid/identity 클레임 정확', async () => {
    const ticket = await signEstablishTicket(SECRET, { id: 12345, name: '정원', email: 'urteam@example.com', profile_image: 'https://img/x.jpg' })
    expect(ticket.split('.').length).toBe(3) // JWT
    const payload = (await jwtVerify(ticket, SECRET, 'HS256')) as Record<string, unknown>
    expect(payload.p).toBe('session_establish')
    expect(payload.uid).toBe('12345')
    expect(payload.name).toBe('정원')
    expect(payload.email).toBe('urteam@example.com')
    expect(payload.img).toBe('https://img/x.jpg')
  })

  it('만료가 단명(120초)인지 — 장기 토큰 아님', async () => {
    const ticket = await signEstablishTicket(SECRET, { id: 1, name: 'x', email: 'x@x.com' })
    const payload = (await jwtVerify(ticket, SECRET, 'HS256')) as Record<string, unknown>
    const ttl = (payload.exp as number) - (payload.iat as number)
    expect(ttl).toBe(120)
  })

  it('다른 secret 으로는 verify 실패 (위조 차단)', async () => {
    const ticket = await signEstablishTicket(SECRET, { id: 1, name: 'x', email: 'x@x.com' })
    await expect(jwtVerify(ticket, 'a-different-secret', 'HS256')).rejects.toThrow()
  })

  it('null/누락 식별자 안전 정규화', async () => {
    const ticket = await signEstablishTicket(SECRET, { id: 7, name: undefined, email: null, profile_image: null })
    const payload = (await jwtVerify(ticket, SECRET, 'HS256')) as Record<string, unknown>
    expect(payload.uid).toBe('7')
    expect(payload.name).toBe('')
    expect(payload.email).toBe('')
    expect(payload.img).toBe('')
  })
})
