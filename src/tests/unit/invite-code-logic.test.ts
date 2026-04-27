/**
 * Invite Code 로직 단위 테스트 — Phase 1-3
 */

import { describe, it, expect } from 'vitest'
import {
  isInviteCodeExpired,
  computeInviteCodeExpiry,
  canUseInviteCode,
  isValidInviteCodeFormat,
  generateInviteCode,
} from '../../shared/utils/invite-code-logic'

describe('invite-code: 만료', () => {
  it('미래 → 미만료', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isInviteCodeExpired(future)).toBe(false)
  })

  it('과거 → 만료', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isInviteCodeExpired(past)).toBe(true)
  })

  it('expiresAt 7일 후 (24*7 시간)', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    expect(computeInviteCodeExpiry(start)).toBe('2026-01-08T00:00:00.000Z')
  })
})

describe('invite-code: canUseInviteCode', () => {
  const now = new Date('2026-01-15T00:00:00Z')
  const futureExpiry = new Date('2026-01-20T00:00:00Z').toISOString()
  const pastExpiry = new Date('2026-01-01T00:00:00Z').toISOString()

  it('정상 활성 + 만료 X + 사용 가능 → ok', () => {
    expect(canUseInviteCode({
      isActive: 1, expiresAt: futureExpiry, usedCount: 5, maxUses: 100, now,
    })).toEqual({ ok: true })
  })

  it('비활성 → inactive', () => {
    expect(canUseInviteCode({
      isActive: 0, expiresAt: futureExpiry, usedCount: 5, maxUses: 100, now,
    })).toEqual({ ok: false, reason: 'inactive' })
  })

  it('만료 → expired', () => {
    expect(canUseInviteCode({
      isActive: 1, expiresAt: pastExpiry, usedCount: 5, maxUses: 100, now,
    })).toEqual({ ok: false, reason: 'expired' })
  })

  it('사용 가능 횟수 소진 → used_up', () => {
    expect(canUseInviteCode({
      isActive: 1, expiresAt: futureExpiry, usedCount: 100, maxUses: 100, now,
    })).toEqual({ ok: false, reason: 'used_up' })
  })

  it('inactive + expired 동시 → inactive 우선', () => {
    expect(canUseInviteCode({
      isActive: 0, expiresAt: pastExpiry, usedCount: 5, maxUses: 100, now,
    })).toEqual({ ok: false, reason: 'inactive' })
  })
})

describe('invite-code: 형식 검증', () => {
  it('8자 대문자 영숫자 → valid', () => {
    expect(isValidInviteCodeFormat('ABCD2345')).toBe(true)
    expect(isValidInviteCodeFormat('XYZ23456')).toBe(true)
  })

  it('짧은 코드 → invalid', () => {
    expect(isValidInviteCodeFormat('ABCD')).toBe(false)
  })

  it('헷갈리는 문자 (0/O/I/L/1) → invalid', () => {
    expect(isValidInviteCodeFormat('ABCD0234')).toBe(false) // 0
    expect(isValidInviteCodeFormat('ABCDIJKL')).toBe(false) // I, L
    expect(isValidInviteCodeFormat('ABCD1234')).toBe(false) // 1
  })

  it('소문자 → invalid', () => {
    expect(isValidInviteCodeFormat('abcd2345')).toBe(false)
  })
})

describe('invite-code: 생성', () => {
  it('8자 코드 생성', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
  })

  it('생성된 코드는 항상 형식 valid', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode()
      expect(isValidInviteCodeFormat(code)).toBe(true)
    }
  })

  it('mock RNG 로 deterministic 생성', () => {
    let seed = 0
    const mockRng = () => {
      const x = Math.sin(seed++) * 10000
      return x - Math.floor(x)
    }
    const code1 = generateInviteCode(mockRng)
    seed = 0
    const code2 = generateInviteCode(mockRng)
    expect(code1).toBe(code2)
  })
})
