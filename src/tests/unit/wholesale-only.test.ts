/**
 * 🏭 2026-06-30 [서비스 분리 SSOT] computeWholesaleOnly — 셀러 대시보드 ↔ 도매몰 라우팅 판정.
 *
 * 핵심 불변식: is_distributor 는 '도매 접근권'(capability)일 뿐 '도매 전용'(exclusivity)이 아니다.
 *   겸업(소비자 셀러 + 판매사) 계정은 절대 lock-out 되면 안 되므로 항상 false(=셀러 대시보드 노출).
 *   '도매 전용'(true)은 (is_distributor=1) ∧ (seller_type ∉ {store_owner,both}) ∧ (소비자 상품 0) 일 때만.
 */
import { describe, it, expect } from 'vitest'
import { computeWholesaleOnly } from '@/features/supply/api/wholesale-helpers'

type SellerRow = { is_distributor: number | null; seller_type: string | null }

/** SQL 내용으로 분기하는 최소 D1 mock. sellerRow=셀러 조회 결과, hasConsumerProduct=소비자 상품 존재. */
function makeDB(sellerRow: SellerRow | null, hasConsumerProduct: boolean) {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: () => {
          if (/FROM sellers/i.test(sql)) return Promise.resolve(sellerRow)
          if (/FROM products/i.test(sql)) return Promise.resolve(hasConsumerProduct ? { x: 1 } : null)
          return Promise.resolve(null)
        },
      }),
    }),
  } as unknown as D1Database
}

describe('computeWholesaleOnly', () => {
  it('잘못된 sellerId → false (lock-out 금지)', async () => {
    expect(await computeWholesaleOnly(makeDB(null, false), 0)).toBe(false)
    expect(await computeWholesaleOnly(makeDB(null, false), -1)).toBe(false)
  })

  it('셀러 없음 → false', async () => {
    expect(await computeWholesaleOnly(makeDB(null, false), 5)).toBe(false)
  })

  it('is_distributor=0(일반 셀러) → false (셀러 대시보드)', async () => {
    expect(await computeWholesaleOnly(makeDB({ is_distributor: 0, seller_type: 'influencer' }, false), 5)).toBe(false)
  })

  it('store_owner 는 도매 접근권 있어도 → false (소비자 매장 운영자)', async () => {
    expect(await computeWholesaleOnly(makeDB({ is_distributor: 1, seller_type: 'store_owner' }, false), 5)).toBe(false)
  })

  it('both → false (겸업 매장)', async () => {
    expect(await computeWholesaleOnly(makeDB({ is_distributor: 1, seller_type: 'both' }, false), 5)).toBe(false)
  })

  it('influencer + 소비자 상품 보유 → false (겸업, lock-out 금지)', async () => {
    expect(await computeWholesaleOnly(makeDB({ is_distributor: 1, seller_type: 'influencer' }, true), 5)).toBe(false)
  })

  it('influencer + 소비자 상품 0 → true (순수 판매사 = 도매 전용)', async () => {
    expect(await computeWholesaleOnly(makeDB({ is_distributor: 1, seller_type: 'influencer' }, false), 5)).toBe(true)
  })
})
