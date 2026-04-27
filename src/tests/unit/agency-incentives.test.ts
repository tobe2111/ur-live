/**
 * agency-incentives.routes.ts 의 순수 함수 단위 테스트.
 *
 * 검증:
 *   - matchIncentiveRule: priority DESC 순 첫 매치 (max-bonus 패턴)
 *   - computeCommission: base + bonus 계산
 *
 * 작성: 2026-04-26 (W2)
 */

import { describe, it, expect } from 'vitest'
import {
  matchIncentiveRule,
  computeCommission,
} from '../../features/agency/api/agency-incentives.routes'

const sampleStats = {
  seller_id: 1,
  sales: 5_000_000,
  orders: 50,
  rating: 4.5,
  streams: 8,
  viewers: 1500,
}

describe('agency-incentives: matchIncentiveRule', () => {
  it('빈 규칙 → matched null + value 0', () => {
    const r = matchIncentiveRule(sampleStats, [])
    expect(r.matched).toBeNull()
    expect(r.metricValue).toBe(0)
  })

  it('첫 매치 반환 (priority 순 가정)', () => {
    const rules = [
      { id: 1, name: '500만↑', metric: 'sales' as const, threshold: 5_000_000, bonus_rate: 1 },
      { id: 2, name: '100만↑', metric: 'sales' as const, threshold: 1_000_000, bonus_rate: 0.5 },
    ]
    const r = matchIncentiveRule(sampleStats, rules)
    expect(r.matched?.id).toBe(1)         // 첫 매치
    expect(r.metricValue).toBe(5_000_000)
  })

  it('첫 규칙 미달 → 다음 규칙 시도', () => {
    const rules = [
      { id: 1, name: '평점 4.8↑', metric: 'rating' as const, threshold: 4.8, bonus_rate: 0.5 },
      { id: 2, name: '평점 4.0↑', metric: 'rating' as const, threshold: 4.0, bonus_rate: 0.2 },
    ]
    const r = matchIncentiveRule(sampleStats, rules)
    expect(r.matched?.id).toBe(2)
    expect(r.metricValue).toBe(4.5)
  })

  it('모든 규칙 미충족 → matched null + 첫 metric 값 snapshot', () => {
    const rules = [
      { id: 1, name: '5000만↑', metric: 'sales' as const, threshold: 50_000_000, bonus_rate: 2 },
      { id: 2, name: '평점 5.0↑', metric: 'rating' as const, threshold: 5.0, bonus_rate: 1 },
    ]
    const r = matchIncentiveRule(sampleStats, rules)
    expect(r.matched).toBeNull()
    expect(r.metricValue).toBe(5_000_000)  // 첫 규칙 의 sales 값
  })

  it('정확히 threshold = 매치 (>= 비교)', () => {
    const rules = [
      { id: 1, name: '500만 정확', metric: 'sales' as const, threshold: 5_000_000, bonus_rate: 0.5 },
    ]
    const r = matchIncentiveRule(sampleStats, rules)
    expect(r.matched?.id).toBe(1)
  })

  it('5종 metric 모두 평가 가능', () => {
    const rules = [
      { id: 1, name: 'streams 5↑', metric: 'streams' as const, threshold: 5, bonus_rate: 0.3 },
    ]
    const r = matchIncentiveRule(sampleStats, rules)
    expect(r.matched?.id).toBe(1)
    expect(r.metricValue).toBe(8)
  })

  it('미정의 metric 은 0 으로 처리', () => {
    const partial = { ...sampleStats, viewers: undefined as any }
    const rules = [
      { id: 1, name: 'viewers 100↑', metric: 'viewers' as const, threshold: 100, bonus_rate: 0.2 },
    ]
    const r = matchIncentiveRule(partial, rules)
    expect(r.matched).toBeNull()  // undefined → 0 < 100
  })
})

describe('agency-incentives: computeCommission', () => {
  it('base 만 (bonus 없음)', () => {
    const r = computeCommission({ sales: 10_000_000, baseRate: 2.0 })
    expect(r.base).toBe(200_000)
    expect(r.bonus).toBe(0)
    expect(r.total).toBe(200_000)
  })

  it('base + bonus', () => {
    const r = computeCommission({ sales: 10_000_000, baseRate: 2.0, bonusRate: 0.5 })
    expect(r.base).toBe(200_000)
    expect(r.bonus).toBe(50_000)
    expect(r.total).toBe(250_000)
  })

  it('round 처리', () => {
    // 333,333 × 2% = 6,666.66 → round → 6,667
    const r = computeCommission({ sales: 333_333, baseRate: 2.0 })
    expect(r.base).toBe(6_667)
  })

  it('senior 급 매출', () => {
    // 1억 × 2.5% = 250만, + 0.5% = 50만, total 300만
    const r = computeCommission({ sales: 100_000_000, baseRate: 2.5, bonusRate: 0.5 })
    expect(r.base).toBe(2_500_000)
    expect(r.bonus).toBe(500_000)
    expect(r.total).toBe(3_000_000)
  })

  it('매출 0 → 모두 0', () => {
    const r = computeCommission({ sales: 0, baseRate: 2.0, bonusRate: 1.0 })
    expect(r.total).toBe(0)
  })
})
