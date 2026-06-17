import { describe, it, expect } from 'vitest'
import { computeCouponDiscount } from '@/features/coupons/coupon-discount'

describe('computeCouponDiscount (서버 권위 쿠폰 계산 SSOT)', () => {
  it('percent: round(base × value/100), max_discount 캡 적용', () => {
    // 10% of 12,000 = 1,200, cap 5,000 → 1,200
    expect(computeCouponDiscount({ type: 'percent', value: 10, max_discount: 5000 }, 12000)).toBe(1200)
    // 50% of 12,000 = 6,000, cap 5,000 → 5,000 (캡)
    expect(computeCouponDiscount({ type: 'percent', value: 50, max_discount: 5000 }, 12000)).toBe(5000)
  })

  it('percent: max_discount 없으면 base 로 폴백(과다할인 차단) — 단, base 초과 불가', () => {
    // 200% → 24,000 but capped at base 12,000
    expect(computeCouponDiscount({ type: 'percent', value: 200, max_discount: null }, 12000)).toBe(12000)
    // 30% of 10,000 = 3,000, no cap but < base → 3,000
    expect(computeCouponDiscount({ type: 'percent', value: 30, max_discount: null }, 10000)).toBe(3000)
  })

  it('fixed: value 정액, max_discount 있으면 캡, base 초과 불가', () => {
    expect(computeCouponDiscount({ type: 'fixed', value: 3000, max_discount: null }, 10000)).toBe(3000)
    expect(computeCouponDiscount({ type: 'fixed', value: 3000, max_discount: 2000 }, 10000)).toBe(2000)
    // 정액이 주문보다 큼 → base 로 클램프 (음수 결제 방지)
    expect(computeCouponDiscount({ type: 'fixed', value: 9999, max_discount: null }, 5000)).toBe(5000)
  })

  it('경계: base 0/음수, value 0/음수/NaN → 0', () => {
    expect(computeCouponDiscount({ type: 'percent', value: 10, max_discount: null }, 0)).toBe(0)
    expect(computeCouponDiscount({ type: 'percent', value: 10, max_discount: null }, -100)).toBe(0)
    expect(computeCouponDiscount({ type: 'fixed', value: 0, max_discount: null }, 10000)).toBe(0)
    expect(computeCouponDiscount({ type: 'fixed', value: -500, max_discount: null }, 10000)).toBe(0)
    expect(computeCouponDiscount({ type: 'percent', value: Number.NaN, max_discount: null }, 10000)).toBe(0)
  })

  it('정수 반환 보장 (round)', () => {
    // 7% of 10,001 = 700.07 → 700
    expect(computeCouponDiscount({ type: 'percent', value: 7, max_discount: null }, 10001)).toBe(700)
    expect(Number.isInteger(computeCouponDiscount({ type: 'percent', value: 13, max_discount: null }, 9999))).toBe(true)
  })
})
