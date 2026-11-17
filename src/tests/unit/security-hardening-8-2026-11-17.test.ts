/**
 * 🔐 2026-11-17 보안 점검 8차 — 개인정보·계정 탈취 경로(대표 *"해킹이나 개인정보 탈취 등의 허점 없을까?"*).
 *
 * ① 셀러 비밀번호 재설정 토큰은 **해시로만** 저장한다.
 *    종전엔 `password_reset_tokens.token` 에 원문이 들어갔다 — DB 를 읽을 수 있는 쪽(백업·읽기 권한·SQL 주입)이
 *    1시간 안에 그 값으로 아무 사장님 계정의 비밀번호를 바꿀 수 있었다. 에이전시는 이미 해시였고 셀러만 남아 있었다.
 *
 * ## ⚠️ 못 보는 것
 * - 이행기(배포 직후 1시간)에 남아 있는 옛 원문 행 — 만료되면 사라진다.
 * - 메일함이 털린 경우(링크 자체가 새는 것)는 이 수리와 무관하다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'

describe('① 셀러 비밀번호 재설정 토큰 — 해시 저장', () => {
  const code = readCode('src/features/auth/api/seller.routes.ts')
  it('저장은 hashToken(token)', () => {
    expect(code).toMatch(/\.bind\(seller\.id, await hashToken\(token\), expiresAt\)/)
    expect(code).not.toMatch(/\.bind\(seller\.id, token, expiresAt\)/)
  })
  it('조회는 해시로, 원문 대조는 옛 형식(32자 hex)만', () => {
    expect(code).toMatch(/\.bind\(await hashToken\(token\), \/\^\[0-9a-f\]\{32\}\$\/\.test\(token\) \? token : ''\)/)
  })
  it('저장된 해시를 토큰인 척 내밀면 원문 대조에 안 걸린다', async () => {
    const { hashToken } = await import('@/lib/password')
    const stored = await hashToken('0123456789abcdef0123456789abcdef')
    expect(stored.startsWith('s256$')).toBe(true)
    expect(/^[0-9a-f]{32}$/.test(stored)).toBe(false) // ⇒ 원문 자리엔 '' 이 묶인다
    expect(await hashToken(stored)).not.toBe(stored)
  })
})
