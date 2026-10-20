/**
 * 🛡️ 2026-05-15: helpers.ts 단위 테스트.
 * calcTierDiscount + generateVoucherCode + generateStoreOwnerToken 검증.
 */

import { describe, it, expect, vi } from 'vitest'
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

describe('generateVoucherCode — 6자리 숫자 (2026-10-12)', () => {
  it('6자리 숫자 문자열(앞 0 포함)', () => {
    for (let i = 0; i < 500; i++) expect(generateVoucherCode()).toMatch(/^\d{6}$/)
  })

  it('치우침 없이 뽑는다 — 2^32 나머지 구간을 버린다', () => {
    const vals = new Uint32Array([0xffffffff, 1234])
    let i = 0
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((a: Uint32Array) => { a[0] = vals[i++]; return a }) as never)
    try {
      // 첫 값(0xffffffff)은 치우침 구간이라 버리고 두 번째 값을 쓴다
      expect(generateVoucherCode()).toBe('001234')
      expect(i).toBe(2)
    } finally { spy.mockRestore() }
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

// 🛡️ 2026-06-01: maxTierDiscount — 즉시판매 단일가 모델(현재 활성). calcTierDiscount 대체.
//   인원 무관 최대 tier 할인 적용 → 실제 공구 판매가 결정. (테스트 누락분 보강)
import { maxTierDiscount } from '@/features/group-buy/api/helpers'

describe('maxTierDiscount (즉시판매 단일가)', () => {
  it('null/empty/잘못된 JSON → 0', () => {
    expect(maxTierDiscount(null)).toBe(0)
    expect(maxTierDiscount('')).toBe(0)
    expect(maxTierDiscount('[]')).toBe(0)
    expect(maxTierDiscount('not-json')).toBe(0)
    expect(maxTierDiscount('{}')).toBe(0)
  })

  it('여러 tier 중 최대 discount_pct 반환 (인원 무관)', () => {
    const tiers = JSON.stringify([
      { min: 5, discount_pct: 10 },
      { min: 10, discount_pct: 20 },
      { min: 20, discount_pct: 35 },
    ])
    expect(maxTierDiscount(tiers)).toBe(35)
  })

  it('정렬 순서 무관하게 최대값', () => {
    const tiers = JSON.stringify([
      { min: 20, discount_pct: 35 },
      { min: 5, discount_pct: 10 },
    ])
    expect(maxTierDiscount(tiers)).toBe(35)
  })

  it('단일 tier → 그 값', () => {
    expect(maxTierDiscount(JSON.stringify([{ min: 1, discount_pct: 15 }]))).toBe(15)
  })

  it('비정상 discount_pct(문자/null) → 0 으로 안전 처리', () => {
    const tiers = JSON.stringify([
      { min: 5, discount_pct: 'abc' },
      { min: 10, discount_pct: 25 },
    ])
    expect(maxTierDiscount(tiers)).toBe(25)
  })
})
