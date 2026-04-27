/**
 * agency-tier-eval.ts 의 순수 함수 단위 테스트.
 *
 * 검증:
 *   - isUpgrade(prev, next): 등급 순서 비교
 *   - determineTier({ageDays, lastMonthRevenue}): 등급 산정 로직
 *   - tierBaseCommissionRate(tier): 등급별 디폴트 수수료율
 *
 * 작성: 2026-04-26 (R2)
 */

import { describe, it, expect } from 'vitest'
import {
  isUpgrade,
  determineTier,
  tierBaseCommissionRate,
} from '../../worker/cron/agency-tier-eval'

describe('agency-tier-eval: isUpgrade', () => {
  it('new → junior: upgrade', () => {
    expect(isUpgrade('new', 'junior')).toBe(true)
  })
  it('new → senior: upgrade', () => {
    expect(isUpgrade('new', 'senior')).toBe(true)
  })
  it('junior → senior: upgrade', () => {
    expect(isUpgrade('junior', 'senior')).toBe(true)
  })
  it('senior → junior: downgrade', () => {
    expect(isUpgrade('senior', 'junior')).toBe(false)
  })
  it('junior → new: downgrade', () => {
    expect(isUpgrade('junior', 'new')).toBe(false)
  })
  it('동일 등급: false', () => {
    expect(isUpgrade('senior', 'senior')).toBe(false)
    expect(isUpgrade('new', 'new')).toBe(false)
  })
  it('알 수 없는 prev/next: 0 으로 fallback (false)', () => {
    expect(isUpgrade('hacker', 'junior')).toBe(true)   // junior(1) > 0
    expect(isUpgrade('senior', 'hacker')).toBe(false)  // 0 < senior(2)
    expect(isUpgrade('foo', 'bar')).toBe(false)        // 0 < 0 = false
  })
})

describe('agency-tier-eval: determineTier', () => {
  describe('senior 조건 (전월 매출 ≥ 500만원)', () => {
    it('가입 1일 + 매출 500만 → senior (매출이 가장 우선)', () => {
      expect(determineTier({ ageDays: 1, lastMonthRevenue: 5_000_000 })).toBe('senior')
    })
    it('가입 1년 + 매출 1억 → senior', () => {
      expect(determineTier({ ageDays: 365, lastMonthRevenue: 100_000_000 })).toBe('senior')
    })
    it('정확히 500만원 (경계) → senior', () => {
      expect(determineTier({ ageDays: 100, lastMonthRevenue: 5_000_000 })).toBe('senior')
    })
  })

  describe('junior 조건 (가입 ≥ 90일 + 매출 < 500만)', () => {
    it('가입 90일 + 매출 0 → junior', () => {
      expect(determineTier({ ageDays: 90, lastMonthRevenue: 0 })).toBe('junior')
    })
    it('가입 100일 + 매출 100만 → junior', () => {
      expect(determineTier({ ageDays: 100, lastMonthRevenue: 1_000_000 })).toBe('junior')
    })
    it('가입 1년 + 매출 4,999,999 (senior 미달) → junior', () => {
      expect(determineTier({ ageDays: 365, lastMonthRevenue: 4_999_999 })).toBe('junior')
    })
  })

  describe('new 조건 (가입 < 90일 + 매출 < 500만)', () => {
    it('가입 1일 + 매출 0 → new', () => {
      expect(determineTier({ ageDays: 1, lastMonthRevenue: 0 })).toBe('new')
    })
    it('가입 89일 + 매출 100만 → new (90일 직전)', () => {
      expect(determineTier({ ageDays: 89, lastMonthRevenue: 1_000_000 })).toBe('new')
    })
    it('가입 89일 + 매출 4,999,999 → new', () => {
      expect(determineTier({ ageDays: 89, lastMonthRevenue: 4_999_999 })).toBe('new')
    })
  })

  describe('우선순위: senior > 가입일', () => {
    it('가입 0일이라도 senior 매출 → senior', () => {
      expect(determineTier({ ageDays: 0, lastMonthRevenue: 5_000_000 })).toBe('senior')
    })
  })
})

describe('agency-tier-eval: tierBaseCommissionRate', () => {
  it('senior = 2.5%', () => {
    expect(tierBaseCommissionRate('senior')).toBe(2.5)
  })
  it('junior = 2.0%', () => {
    expect(tierBaseCommissionRate('junior')).toBe(2.0)
  })
  it('new = 1.5%', () => {
    expect(tierBaseCommissionRate('new')).toBe(1.5)
  })
  it('알 수 없는 tier = new (1.5%) fallback', () => {
    expect(tierBaseCommissionRate('hacker')).toBe(1.5)
    expect(tierBaseCommissionRate('')).toBe(1.5)
  })
})
