import { describe, it, expect } from 'vitest'
import { computeServicePrice, type ServicePricing } from '@/features/marketing/api/ad-services'

/**
 * 🆕 2026-07-02 유어애즈 서비스몰 — 가격 계산 순수함수 잠금(서버 권위).
 *   단위가×수량 → 수량구간 할인 → +옵션. 클라 값 불신(범위 클램프).
 */
const P: ServicePricing = {
  unit: '주', unitPrice: 90000, minQty: 1, maxQty: 52,
  qtyDiscounts: [{ min: 1, pct: 0 }, { min: 5, pct: 7 }, { min: 9, pct: 12 }, { min: 25, pct: 20 }],
  options: [{ key: 'report', label: '리포트', price: 30000 }, { key: 'design', label: '디자인', price: 80000 }],
}

describe('computeServicePrice', () => {
  it('할인 없는 구간(4주)', () => {
    const r = computeServicePrice(P, 4)
    expect(r.subtotal).toBe(360000); expect(r.discountPct).toBe(0); expect(r.total).toBe(360000)
  })
  it('수량구간 할인 적용(12주 → 12%)', () => {
    const r = computeServicePrice(P, 12)
    expect(r.discountPct).toBe(12)
    expect(r.discounted).toBe(Math.round(90000 * 12 * 0.88))
    expect(r.total).toBe(r.discounted)
  })
  it('최고 구간(52주 → 20%) + 옵션 합산', () => {
    const r = computeServicePrice(P, 52, ['report', 'design'])
    expect(r.discountPct).toBe(20)
    expect(r.optionsTotal).toBe(110000)
    expect(r.total).toBe(Math.round(90000 * 52 * 0.8) + 110000)
  })
  it('수량 범위 클램프(음수/초과 → min/max)', () => {
    expect(computeServicePrice(P, -5).quantity).toBe(1)
    expect(computeServicePrice(P, 9999).quantity).toBe(52)
    expect(computeServicePrice(P, 0).quantity).toBe(1)
  })
  it('알 수 없는 옵션 키는 무시', () => {
    expect(computeServicePrice(P, 4, ['nope']).optionsTotal).toBe(0)
  })
  it('minQty>1 상품(최소 2)', () => {
    const P2: ServicePricing = { ...P, minQty: 2 }
    expect(computeServicePrice(P2, 1).quantity).toBe(2)
  })
  it('구간 pct 가 비단조(오설정)여도 자격 구간 중 최대 할인 적용 — 큰 주문이 손해보지 않음', () => {
    const bad: ServicePricing = { ...P, qtyDiscounts: [{ min: 5, pct: 20 }, { min: 10, pct: 8 }] }
    // qty=12 는 두 구간(5,10) 모두 자격 → max(20,8)=20% 여야 함(마지막 8% 아님)
    expect(computeServicePrice(bad, 12).discountPct).toBe(20)
  })
  it('카탈로그에 중복 key 옵션이 있어도 1회만 가산(중복합산 방지)', () => {
    const dup: ServicePricing = { ...P, options: [{ key: 'report', label: 'A', price: 30000 }, { key: 'report', label: 'B', price: 30000 }] }
    expect(computeServicePrice(dup, 4, ['report']).optionsTotal).toBe(30000)
  })
})
