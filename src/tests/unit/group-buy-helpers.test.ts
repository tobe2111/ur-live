/**
 * 🛡️ 2026-05-15: helpers.ts 단위 테스트.
 * calcTierDiscount + generateVoucherCode + generateStoreOwnerToken 검증.
 */

import { describe, it, expect } from 'vitest'
import { calcTierDiscount, generateVoucherCode, generateStoreOwnerToken } from '@/features/group-buy/api/helpers'

describe('calcTierDiscount', () => {
  it('null/empty tiers → 0% discount', () => {
    expect(calcTierDiscount(null, 10)).toEqual({ discount_pct: 0, next_tier: null })
    expect(calcTierDiscount('', 10)).toEqual({ discount_pct: 0, next_tier: null })
    expect(calcTierDiscount('[]', 10)).toEqual({ discount_pct: 0, next_tier: null })
  })

  it('잘못된 JSON → 0% discount', () => {
    expect(calcTierDiscount('not-json', 10)).toEqual({ discount_pct: 0, next_tier: null })
    expect(calcTierDiscount('{}', 10)).toEqual({ discount_pct: 0, next_tier: null })
  })

  it('current 가 첫 tier 미만 → 0% + next_tier 표시', () => {
    const tiers = JSON.stringify([
      { min: 5, discount_pct: 5 },
      { min: 10, discount_pct: 10 },
    ])
    const r = calcTierDiscount(tiers, 3)
    expect(r.discount_pct).toBe(0)
    expect(r.next_tier).toEqual({ min: 5, discount_pct: 5 })
  })

  it('current 가 중간 tier 도달 → 해당 tier discount + 다음 tier next_tier', () => {
    const tiers = JSON.stringify([
      { min: 5, discount_pct: 5 },
      { min: 10, discount_pct: 10 },
      { min: 20, discount_pct: 20 },
    ])
    const r = calcTierDiscount(tiers, 12)
    expect(r.discount_pct).toBe(10)
    expect(r.next_tier).toEqual({ min: 20, discount_pct: 20 })
  })

  it('current 가 최고 tier 초과 → 최고 discount + next_tier null', () => {
    const tiers = JSON.stringify([
      { min: 5, discount_pct: 5 },
      { min: 10, discount_pct: 15 },
    ])
    const r = calcTierDiscount(tiers, 25)
    expect(r.discount_pct).toBe(15)
    expect(r.next_tier).toBeNull()
  })

  it('정렬되지 않은 tier 도 올바르게 처리', () => {
    const tiers = JSON.stringify([
      { min: 20, discount_pct: 20 },
      { min: 5, discount_pct: 5 },
      { min: 10, discount_pct: 10 },
    ])
    const r = calcTierDiscount(tiers, 8)
    expect(r.discount_pct).toBe(5)
    expect(r.next_tier).toEqual({ min: 10, discount_pct: 10 })
  })
})

describe('generateVoucherCode', () => {
  it('UR- 로 시작, 12자 (UR-XXXX-XXXX = 3+4+1+4)', () => {
    const code = generateVoucherCode()
    expect(code).toMatch(/^UR-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(code.length).toBe(12)
  })

  it('100회 호출 unique 율 100%', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 100; i++) codes.add(generateVoucherCode())
    expect(codes.size).toBe(100)
  })

  it('I/L/O/0/1 같은 헷갈리는 문자 제외', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVoucherCode()
      expect(code).not.toMatch(/[IO01]/)
    }
  })
})

describe('generateStoreOwnerToken', () => {
  it('32자 hex string', () => {
    const token = generateStoreOwnerToken()
    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('100회 호출 unique', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) tokens.add(generateStoreOwnerToken())
    expect(tokens.size).toBe(100)
  })
})
