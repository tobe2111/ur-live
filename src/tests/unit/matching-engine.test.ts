import { describe, it, expect } from 'vitest'
import {
  N_MIN,
  categoryLabel,
  guPrefix,
  isSuppressed,
  confidenceOf,
  repeatRatePct,
  cvrPct,
  aovOf,
  badgeOf,
  computeFitScore,
  fitReasonOf,
  normalizeStrength,
  aggregateInfluencerMetrics,
  type AvRow,
} from '../../features/marketing/api/matching'

const av = (visitor: string, voucher: number, amount: number, category: string | null, gu: string | null): AvRow =>
  ({ visitor, voucher_id: voucher, amount, category, gu })

/**
 * 인플루언서↔업체 성과기반 매칭 엔진 — 순수 함수 불변식.
 * (SQL 집계는 D1 필요 — graceful/빈결과는 라우트 레벨에서. 여기선 로직 정확성만.)
 */

describe('categoryLabel / guPrefix', () => {
  it('업종 코드 → 짧은 한글 라벨', () => {
    expect(categoryLabel('meal_voucher')).toBe('식사')
    expect(categoryLabel('beauty_voucher')).toBe('미용')
    expect(categoryLabel('health_voucher')).toBe('미용') // 레거시도 매핑
  })
  it('없거나 미상 코드는 graceful', () => {
    expect(categoryLabel(null)).toBe('기타')
    expect(categoryLabel('unknown_x')).toBe('unknown_x')
  })
  it('상권(구) = 행정동코드 앞 5자리', () => {
    expect(guPrefix('1168010800')).toBe('11680')
    expect(guPrefix('116')).toBeNull()
    expect(guPrefix(null)).toBeNull()
  })
})

describe('n<5 억제 + 신뢰도', () => {
  it('표본 < N_MIN → 억제', () => {
    expect(isSuppressed(N_MIN - 1)).toBe(true)
    expect(isSuppressed(N_MIN)).toBe(false)
    expect(isSuppressed(NaN)).toBe(true)
  })
  it('방문자수 → 신뢰도 등급', () => {
    expect(confidenceOf(0)).toBe('cold')
    expect(confidenceOf(3)).toBe('sparse')
    expect(confidenceOf(N_MIN)).toBe('measured')
  })
})

describe('비율/객단가 — 분모 0 graceful', () => {
  it('재방문율', () => {
    expect(repeatRatePct(4, 10)).toBe(40)
    expect(repeatRatePct(0, 0)).toBe(0)
  })
  it('전환율', () => {
    expect(cvrPct(8, 100)).toBe(8)
    expect(cvrPct(5, 0)).toBe(0)
  })
  it('객단가', () => {
    expect(aovOf(50000, 5)).toBe(10000)
    expect(aovOf(50000, 0)).toBe(0)
  })
})

describe('배지', () => {
  it('콜드 표본은 항상 cold', () => {
    expect(badgeOf('cold', 90)).toBe('cold')
  })
  it('측정 + 재방문율 높으면 repeat', () => {
    expect(badgeOf('measured', 45)).toBe('repeat')
    expect(badgeOf('measured', 20)).toBe('measured')
  })
})

describe('적합도 점수', () => {
  it('강한 실전환 = 높은 점수', () => {
    const s = computeFitScore({ categoryCvr: 10, regionStrength: 90, repeatRate: 50, visitors: 40 })
    expect(s).toBeGreaterThan(80)
    expect(s).toBeLessThanOrEqual(100)
  })
  it('콜드(표본<5)는 55 상한 — 허수 상위노출 방지', () => {
    const s = computeFitScore({ categoryCvr: 99, regionStrength: 100, repeatRate: 99, visitors: 3 })
    expect(s).toBeLessThanOrEqual(55)
  })
  it('0 입력 = 0', () => {
    expect(computeFitScore({ categoryCvr: 0, regionStrength: 0, repeatRate: 0, visitors: 0 })).toBe(0)
  })
  it('항상 0~100 clamp', () => {
    const s = computeFitScore({ categoryCvr: 1000, regionStrength: 1000, repeatRate: 1000, visitors: 1000 })
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(100)
  })
})

describe('추천 근거', () => {
  it('콜드는 데이터 수집중 문구', () => {
    expect(fitReasonOf({ categoryLabelKo: '식사', categoryCvr: 0, regionStrength: 0, repeatRate: 0, confidence: 'cold' }))
      .toContain('데이터 수집 중')
  })
  it('측정된 강점을 근거로', () => {
    const r = fitReasonOf({ categoryLabelKo: '식사', categoryCvr: 8, regionStrength: 70, repeatRate: 45, confidence: 'measured' })
    expect(r).toContain('식사')
    expect(r).toContain('8%')
    expect(r).toContain('재방문율')
  })
})

describe('상권 강세 정규화', () => {
  it('최대값 기준 0~100', () => {
    expect(normalizeStrength(50, 100)).toBe(50)
    expect(normalizeStrength(100, 100)).toBe(100)
    expect(normalizeStrength(10, 0)).toBe(0) // 분모 0 graceful
  })
})

describe('aggregateInfluencerMetrics (순수 집계 + n<5 억제)', () => {
  it('빈 데이터 = 0 + cold (엔진 안 깨짐)', () => {
    const m = aggregateInfluencerMetrics({ influencerId: '7', handle: null, displayName: null, inflowClicks: 0, signups: 0, rows: [] })
    expect(m.visitors).toBe(0)
    expect(m.visits).toBe(0)
    expect(m.repeatVisitors).toBe(0)
    expect(m.confidence).toBe('cold')
    expect(m.categoryStats).toEqual([])
    expect(m.regionStats).toEqual([])
  })

  it('방문/재방문/GMV + 업종·상권 분해, n<5 셀 억제', () => {
    const rows: AvRow[] = [
      av('u1', 1, 10000, 'meal_voucher', '11680'),
      av('u1', 2, 12000, 'meal_voucher', '11680'), // u1 재방문
      av('u2', 3, 9000, 'meal_voucher', '11680'),
      av('u3', 4, 8000, 'meal_voucher', '11680'),
      av('u4', 5, 7000, 'meal_voucher', '11680'),
      av('u5', 6, 11000, 'meal_voucher', '11680'),
      av('u6', 7, 5000, 'beauty_voucher', '11650'), // beauty 방문자 1명 → 억제
    ]
    const m = aggregateInfluencerMetrics({ influencerId: '7', handle: 'jihyun', displayName: '지현', inflowClicks: 200, signups: 10, rows })
    expect(m.visitors).toBe(6)        // distinct visitor
    expect(m.visits).toBe(7)          // distinct voucher_id
    expect(m.repeatVisitors).toBe(1)  // u1 만 2회+
    expect(m.repeatRate).toBe(repeatRatePct(1, 6))
    expect(m.gmv).toBe(62000) // 10+12+9+8+7+11+5 천원
    expect(m.aov).toBe(Math.round(62000 / 7))
    expect(m.confidence).toBe('measured')

    const meal = m.categoryStats.find((c) => c.category === 'meal_voucher')!
    expect(meal.suppressed).toBe(false) // 방문자 5명 ≥ N_MIN
    expect(meal.visitors).toBe(5)
    expect(meal.cvr).toBe(cvrPct(5, 10)) // 50%
    const beauty = m.categoryStats.find((c) => c.category === 'beauty_voucher')!
    expect(beauty.suppressed).toBe(true) // 방문자 1명 < N_MIN
    expect(beauty.cvr).toBe(0)           // 억제 셀은 값 0

    const gu = m.regionStats.find((r) => r.code === '11680')!
    expect(gu.suppressed).toBe(false)
    const gu2 = m.regionStats.find((r) => r.code === '11650')!
    expect(gu2.suppressed).toBe(true)
  })

  it('null visitor/미상 카테고리도 graceful (방문건은 세되 분해 제외)', () => {
    const rows: AvRow[] = [
      { visitor: null, voucher_id: 9, amount: 3000, category: null, gu: null },
      av('u1', 10, 4000, null, null),
    ]
    const m = aggregateInfluencerMetrics({ influencerId: '7', handle: null, displayName: null, inflowClicks: 5, signups: 1, rows })
    expect(m.visits).toBe(2)       // voucher 9,10
    expect(m.visitors).toBe(1)     // u1 만(null 제외)
    expect(m.gmv).toBe(7000)
    expect(m.categoryStats).toEqual([]) // 카테고리 null → 분해 없음
  })
})
