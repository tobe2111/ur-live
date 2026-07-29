import { describe, it, expect } from 'vitest'
import { hashToken, hashPassword, verifyPassword } from '@/lib/password'

// 🏭 2026-06-29 (로그인 속도): refresh 토큰 빠른 해시(SHA-256) ↔ verifyPassword 라운드트립 불변식.
//   이 불변식이 깨지면 로그인 직후 자동 refresh 가 전부 실패(재로그인 루프) → 절대 회귀 금지.
describe('hashToken (fast refresh-token hash) ↔ verifyPassword', () => {
  const token = 'eyJhbGciOi.JOENTROPY.refresh-token-9f3c2a' // refresh 토큰 유사 고엔트로피 문자열

  it('hashToken 출력은 s256$ prefix 를 가진다', async () => {
    const h = await hashToken(token)
    expect(h.startsWith('s256$')).toBe(true)
  })

  it('hashToken 으로 저장한 토큰을 verifyPassword 가 검증한다 (valid)', async () => {
    const h = await hashToken(token)
    const { valid } = await verifyPassword(token, h)
    expect(valid).toBe(true)
  })

  it('다른 토큰은 거부한다 (invalid)', async () => {
    const h = await hashToken(token)
    const { valid } = await verifyPassword(token + 'x', h)
    expect(valid).toBe(false)
  })

  it('동일 토큰은 동일 해시(결정적) — 향후 인덱스 조회 가능', async () => {
    const a = await hashToken(token)
    const b = await hashToken(token)
    expect(a).toBe(b)
  })

  it('기존 PBKDF2 비밀번호 해시는 그대로 검증된다 (무중단 마이그레이션)', async () => {
    const pw = 'Abcd1234!@#$'
    const h = await hashPassword(pw)
    expect(h.startsWith('s256$')).toBe(false) // PBKDF2 형식(salt$hash) — fast prefix 아님
    const { valid } = await verifyPassword(pw, h)
    expect(valid).toBe(true)
  })
})
