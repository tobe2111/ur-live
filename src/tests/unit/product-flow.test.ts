import { describe, it, expect } from 'vitest'
import { canonicalDetailPath } from '@/shared/product-flow'

/**
 * 🧭 2026-06-22: /products/:id 종류별 정규 페이지 라우팅 SSOT 단위 테스트.
 *
 * 검증 (사용자 권장 ① 자동화):
 *   - 교환권(deal_only=1)        → /vouchers/:id
 *   - 공구(voucher 카테고리)       → /group-buy/:id (레거시 카테고리 포함)
 *   - 온라인 일반 상품             → null (redirect 없이 /products/:id 유지)
 *   - 우선순위: 교환권 > 공구
 *   - ⚠️ group_buy_status 로 분류하지 않음 (모든 상품 DEFAULT 'active' 회귀 방지)
 */
describe('canonicalDetailPath', () => {
  it('교환권(deal_only=1) → /vouchers/:id', () => {
    expect(canonicalDetailPath({ id: 25, deal_only: 1, category: 'meal_voucher' })).toBe('/vouchers/25')
  })

  it('deal_only 가 문자열 "1" 이어도 교환권으로 인식', () => {
    expect(canonicalDetailPath({ id: 7, deal_only: '1' as unknown as number })).toBe('/vouchers/7')
  })

  it('공구(voucher 카테고리) → /group-buy/:id', () => {
    expect(canonicalDetailPath({ id: 25, deal_only: 0, category: 'meal_voucher' })).toBe('/group-buy/25')
    expect(canonicalDetailPath({ id: 31, category: 'beauty_voucher' })).toBe('/group-buy/31')
    expect(canonicalDetailPath({ id: 9, category: 'stay_voucher' })).toBe('/group-buy/9')
    expect(canonicalDetailPath({ id: 4, category: 'etc_voucher' })).toBe('/group-buy/4')
  })

  it('레거시 voucher 카테고리도 공구로 인식', () => {
    expect(canonicalDetailPath({ id: 12, category: 'health_voucher' })).toBe('/group-buy/12')
    expect(canonicalDetailPath({ id: 13, category: 'pet_voucher' })).toBe('/group-buy/13')
    expect(canonicalDetailPath({ id: 14, category: 'activity_voucher' })).toBe('/group-buy/14')
  })

  it('온라인 일반 상품 → null (redirect 없음)', () => {
    expect(canonicalDetailPath({ id: 25, deal_only: 0, category: 'fashion' })).toBeNull()
    expect(canonicalDetailPath({ id: 25, category: null })).toBeNull()
    expect(canonicalDetailPath({ id: 25 })).toBeNull()
  })

  it('우선순위: 교환권 > 공구 (deal_only=1 이면 카테고리 무관 /vouchers)', () => {
    expect(canonicalDetailPath({ id: 5, deal_only: 1, category: 'stay_voucher' })).toBe('/vouchers/5')
  })

  it('group_buy_status="active" 단독으로는 공구로 오분류하지 않음 (일반 상품 유지)', () => {
    // 모든 상품이 group_buy_status DEFAULT 'active' 라 라우팅에 쓰면 안 됨.
    const p = { id: 25, deal_only: 0, category: 'fashion', group_buy_status: 'active' } as Parameters<typeof canonicalDetailPath>[0]
    expect(canonicalDetailPath(p)).toBeNull()
  })

  it('문자열 id 도 그대로 경로에 반영', () => {
    expect(canonicalDetailPath({ id: 'abc', category: 'meal_voucher' })).toBe('/group-buy/abc')
  })
})
