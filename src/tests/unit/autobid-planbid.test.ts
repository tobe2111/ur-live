import { describe, it, expect } from 'vitest'
import { planBid } from '../../features/marketing/api/autobid'

// planBid 의 핵심 안전 불변식: 엔진은 절대 사용자 max_bid(및 글로벌 10만) 초과 입찰 불가.
describe('planBid — 자동입찰 안전 클램프', () => {
  it('추정가가 max_bid 를 넘으면 max_bid 로 캡(capped_at_max)', () => {
    const p = planBid(50000, 3000, 1000)
    expect(p.bid).toBe(3000)
    expect(p.bid).toBeLessThanOrEqual(3000)
    expect(p.change).toBe(true)
    expect(p.reason).toBe('capped_at_max')
  })

  it('추정가가 max_bid 이하면 추정가 매칭(matched_estimate)', () => {
    const p = planBid(2500, 5000, 1000)
    expect(p.bid).toBe(2500)
    expect(p.reason).toBe('matched_estimate')
  })

  it('절대 글로벌 상한 10만원 초과 불가(max_bid 가 비정상적으로 커도)', () => {
    const p = planBid(999999, 999999, 1000)
    expect(p.bid).toBeLessThanOrEqual(100000)
    expect(p.bid).toBe(100000)
  })

  it('추정 실패(0/음수)면 현재가 유지·변경 없음', () => {
    expect(planBid(0, 5000, 1200)).toEqual({ bid: 1200, change: false, reason: 'no_estimate' })
    expect(planBid(-5, 5000, 1200).change).toBe(false)
  })

  it('현재가와 차이가 10원 미만이면 변경 안 함(PUT 남발 방지)', () => {
    const p = planBid(1205, 5000, 1200)
    expect(p.change).toBe(false)
    expect(p.reason).toBe('within_threshold')
  })

  it('최소 입찰가(70원) 하한 보장', () => {
    const p = planBid(10, 5000, 0)
    expect(p.bid).toBeGreaterThanOrEqual(70)
  })
})
