/**
 * PK Battle 로직 단위 테스트 — Phase 2-7
 */

import { describe, it, expect } from 'vitest'
import {
  determinePKWinner,
  shouldEndPK,
  pkRevenueShares,
  isValidPKDuration,
  validatePKMatch,
} from '../../shared/utils/pk-battle-logic'

describe('pk-battle: determinePKWinner', () => {
  it('A 매출 더 높음 → A 우승', () => {
    expect(determinePKWinner({
      sellerAId: 1, sellerBId: 2, revenueA: 100_000, revenueB: 50_000,
    })).toBe(1)
  })

  it('B 매출 더 높음 → B 우승', () => {
    expect(determinePKWinner({
      sellerAId: 1, sellerBId: 2, revenueA: 30_000, revenueB: 80_000,
    })).toBe(2)
  })

  it('동률 → null (무승부)', () => {
    expect(determinePKWinner({
      sellerAId: 1, sellerBId: 2, revenueA: 50_000, revenueB: 50_000,
    })).toBeNull()
  })

  it('둘 다 0 → null', () => {
    expect(determinePKWinner({
      sellerAId: 1, sellerBId: 2, revenueA: 0, revenueB: 0,
    })).toBeNull()
  })
})

describe('pk-battle: shouldEndPK', () => {
  it('미래 ends_at → false', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(shouldEndPK(future)).toBe(false)
  })

  it('과거 ends_at → true', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(shouldEndPK(past)).toBe(true)
  })

  it('지정 now 기준', () => {
    const fixedNow = new Date('2026-01-01T00:00:00Z')
    expect(shouldEndPK('2026-01-01T00:00:00Z', fixedNow)).toBe(true)
    expect(shouldEndPK('2026-01-01T00:00:01Z', fixedNow)).toBe(false)
  })
})

describe('pk-battle: pkRevenueShares', () => {
  it('동일 매출 → 50:50', () => {
    expect(pkRevenueShares(100, 100)).toEqual({ aPercent: 50, bPercent: 50 })
  })

  it('A 80% / B 20%', () => {
    expect(pkRevenueShares(80, 20)).toEqual({ aPercent: 80, bPercent: 20 })
  })

  it('총 0 → 50:50 (안전)', () => {
    expect(pkRevenueShares(0, 0)).toEqual({ aPercent: 50, bPercent: 50 })
  })

  it('소수점 1자리 반올림', () => {
    const r = pkRevenueShares(33, 67)
    expect(r.aPercent).toBe(33)
    expect(r.bPercent).toBe(67)
  })
})

describe('pk-battle: validation', () => {
  it('15/30/60분만 valid', () => {
    expect(isValidPKDuration(15)).toBe(true)
    expect(isValidPKDuration(30)).toBe(true)
    expect(isValidPKDuration(60)).toBe(true)
    expect(isValidPKDuration(45)).toBe(false)
    expect(isValidPKDuration(0)).toBe(false)
    expect(isValidPKDuration(-1)).toBe(false)
  })

  it('valid 매칭', () => {
    expect(validatePKMatch({ sellerAId: 1, sellerBId: 2, durationMinutes: 30 }))
      .toEqual({ valid: true })
  })

  it('같은 셀러 → invalid', () => {
    const r = validatePKMatch({ sellerAId: 1, sellerBId: 1, durationMinutes: 30 })
    expect(r).toEqual({ valid: false, reason: 'same_seller' })
  })

  it('잘못된 duration → invalid', () => {
    const r = validatePKMatch({ sellerAId: 1, sellerBId: 2, durationMinutes: 45 })
    expect(r).toEqual({ valid: false, reason: 'invalid_duration' })
  })

  it('셀러 ID 누락 → invalid', () => {
    const r = validatePKMatch({ sellerAId: 0, sellerBId: 2, durationMinutes: 30 })
    expect(r).toEqual({ valid: false, reason: 'missing_seller' })
  })
})
