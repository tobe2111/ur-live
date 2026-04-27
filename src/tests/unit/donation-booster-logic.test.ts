/**
 * Donation Booster 로직 단위 테스트 — Phase 2-5
 */

import { describe, it, expect } from 'vitest'
import {
  validateBoosterParams,
  calculateMatchedAmount,
  isBoosterExpired,
  computeBoosterEndsAt,
} from '../../shared/utils/donation-booster-logic'

describe('booster: validateBoosterParams', () => {
  it('1.5x × 5분 valid', () => {
    expect(validateBoosterParams({ multiplier: 1.5, durationSeconds: 300 }))
      .toEqual({ valid: true })
  })

  it('2x × 10분 valid', () => {
    expect(validateBoosterParams({ multiplier: 2.0, durationSeconds: 600 }))
      .toEqual({ valid: true })
  })

  it('3x × 15분 valid', () => {
    expect(validateBoosterParams({ multiplier: 3.0, durationSeconds: 900 }))
      .toEqual({ valid: true })
  })

  it('잘못된 multiplier (5x) → invalid', () => {
    expect(validateBoosterParams({ multiplier: 5, durationSeconds: 600 }))
      .toEqual({ valid: false, reason: 'invalid_multiplier' })
  })

  it('잘못된 duration (1시간) → invalid', () => {
    expect(validateBoosterParams({ multiplier: 2, durationSeconds: 3600 }))
      .toEqual({ valid: false, reason: 'invalid_duration' })
  })
})

describe('booster: calculateMatchedAmount', () => {
  it('1.5x × 1000 → 500 매칭', () => {
    expect(calculateMatchedAmount(1000, 1.5)).toBe(500)
  })

  it('2x × 1000 → 1000 매칭', () => {
    expect(calculateMatchedAmount(1000, 2)).toBe(1000)
  })

  it('3x × 1000 → 2000 매칭', () => {
    expect(calculateMatchedAmount(1000, 3)).toBe(2000)
  })

  it('소수점 round down', () => {
    expect(calculateMatchedAmount(999, 1.5)).toBe(499) // 999 * 0.5 = 499.5 → 499
  })

  it('0 후원 → 0 매칭', () => {
    expect(calculateMatchedAmount(0, 2)).toBe(0)
  })

  it('multiplier 1 이하 → 0', () => {
    expect(calculateMatchedAmount(1000, 1)).toBe(0)
    expect(calculateMatchedAmount(1000, 0)).toBe(0)
  })

  it('음수 후원 → 0 (방어)', () => {
    expect(calculateMatchedAmount(-100, 2)).toBe(0)
  })
})

describe('booster: 만료 / ends_at', () => {
  it('미래 → 미만료', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isBoosterExpired(future)).toBe(false)
  })

  it('과거 → 만료', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isBoosterExpired(past)).toBe(true)
  })

  it('computeBoosterEndsAt: 5분 후 = +300000ms', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const endsAt = computeBoosterEndsAt(300, start)
    expect(endsAt).toBe('2026-01-01T00:05:00.000Z')
  })

  it('computeBoosterEndsAt: 15분 후', () => {
    const start = new Date('2026-01-01T12:00:00Z')
    const endsAt = computeBoosterEndsAt(900, start)
    expect(endsAt).toBe('2026-01-01T12:15:00.000Z')
  })
})
