/**
 * Kakao OIDC id_token 디코딩(parseIdToken) 단위 테스트.
 *
 * 배경 (2026-06-20): openid scope 요청 시 토큰교환 응답에 id_token(JWT)이 동봉됨.
 *   이를 디코드해 sub/nickname/picture/email 을 얻으면 getUserInfo 카카오 왕복 1회 절약.
 *   id_token 은 TLS 로 카카오 토큰 엔드포인트에서 직접 받은 것이라 서명검증 생략 가능.
 *
 * 회귀 가드:
 *   - 정상 claim → KakaoUser 매핑
 *   - 한글 닉네임 UTF-8 정확 디코딩(atob 단독은 깨짐 → TextDecoder 경로 검증)
 *   - sub / nickname 누락 → null (호출자가 getUserInfo 로 폴백)
 *   - 형식 오류(점 3개 아님) → null
 *   - email_verified 없으면 false(보수적 — 자동연결 게이트 안전)
 *   - http 프로필 이미지 → https 승격
 */

import { describe, it, expect } from 'vitest'
import { KakaoAuthService } from '@/features/auth/services/KakaoAuthService'

// 테스트용 가짜 id_token(서명 무관 — parseIdToken 은 디코드만) 생성기. UTF-8 안전 인코딩.
function makeIdToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj))
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}.sig`
}

const svc = new KakaoAuthService({} as never, 'dummy-rest-key')
const now = Math.floor(Date.now() / 1000)

describe('KakaoAuthService.parseIdToken (OIDC fast path)', () => {
  it('정상 claim → KakaoUser 매핑', () => {
    const token = makeIdToken({
      sub: '1234567890', nickname: 'Jiwon', email: 'a@b.com',
      email_verified: true, picture: 'https://k.kakaocdn.net/img.jpg', exp: now + 600,
    })
    expect(svc.parseIdToken(token)).toEqual({
      kakaoId: '1234567890',
      name: 'Jiwon',
      email: 'a@b.com',
      emailVerified: true,
      profileImage: 'https://k.kakaocdn.net/img.jpg',
      phoneNumber: undefined,
    })
  })

  it('한글 닉네임 UTF-8 정확 디코딩', () => {
    const token = makeIdToken({ sub: '1', nickname: '정지원', exp: now + 600 })
    expect(svc.parseIdToken(token)?.name).toBe('정지원')
  })

  it('sub(=kakaoId) 누락 → null (getUserInfo 폴백)', () => {
    expect(svc.parseIdToken(makeIdToken({ nickname: '닉', exp: now + 600 }))).toBeNull()
  })

  it('nickname 누락 → null (이름 보장 위해 폴백)', () => {
    expect(svc.parseIdToken(makeIdToken({ sub: '1', exp: now + 600 }))).toBeNull()
  })

  it('형식 오류(점 3개 아님) → null', () => {
    expect(svc.parseIdToken('not-a-jwt')).toBeNull()
    expect(svc.parseIdToken('only.two')).toBeNull()
  })

  it('null / undefined / 빈 문자열 → null', () => {
    expect(svc.parseIdToken(null)).toBeNull()
    expect(svc.parseIdToken(undefined)).toBeNull()
    expect(svc.parseIdToken('')).toBeNull()
  })

  it('email_verified 없으면 false (자동연결 게이트 안전)', () => {
    const token = makeIdToken({ sub: '1', nickname: '닉', email: 'a@b.com', exp: now + 600 })
    expect(svc.parseIdToken(token)?.emailVerified).toBe(false)
  })

  it('http 프로필 이미지 → https 승격', () => {
    const token = makeIdToken({ sub: '1', nickname: '닉', picture: 'http://x.com/a.jpg', exp: now + 600 })
    expect(svc.parseIdToken(token)?.profileImage).toBe('https://x.com/a.jpg')
  })

  it('email 없으면 undefined (phone 도 항상 undefined — id_token 미포함)', () => {
    const out = svc.parseIdToken(makeIdToken({ sub: '1', nickname: '닉', exp: now + 600 }))
    expect(out?.email).toBeUndefined()
    expect(out?.phoneNumber).toBeUndefined()
  })
})
