/**
 * 💗 위시리스트 안 B — "지금 사야 할 것" 신호 (2026-09-03 대표 확정)
 *
 * 이 검사가 지키는 계약:
 *   ① "찜한 뒤 내렸다"는 **오직 `base_price` 대비**로만 말한다 — 상시 할인율로 대신하지 않는다
 *   ② 마감이 지난 것은 신호가 아니다(살 수 없는 것을 앞에 세우지 않는다)
 *   ③ 배지·정렬·요약이 **같은 판정**을 쓴다(카드엔 뜨는데 요약은 0 인 화면 금지)
 *   ④ 정렬은 원본을 안 건드리고, 동점이면 최근 찜순으로 떨어진다
 *   ⑤ 서버가 `base_price` 를 안 주면 조용히 신호만 없다(목록은 그대로 뜬다)
 *
 * ⚠️ 못 막는 것: 서버가 그 열을 실제로 채우는지(=`wishlist-notify` 의 seed 배선). 그건
 *    `wishlist-baseline-wiring` 이 소스로 고정한다 — 여기서는 계산만 본다.
 */
import { describe, it, expect } from 'vitest'
import { priceDrop, daysLeft, isSoon, summarize, sortWishlist, SOON_DAYS } from '@/pages/wishlist/wishlist-signals'
import type { WishlistItem } from '@/hooks/queries/useWishlist'

const DAY = 86_400_000
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 19).replace('T', ' ')

function item(over: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: 1, user_id: 1, product_id: 1, created_at: at(-1),
    product_name: '테스트', price: 10000, original_price: 12000, discount_rate: 16,
    image_url: '', stock: 5, category: 'meal_voucher', is_active: 1,
    seller_name: '가게', seller_id: 1,
    ...over,
  } as WishlistItem
}

describe('찜 신호 — 가격 인하', () => {
  it('① base_price 대비로만 센다 (할인율은 상시가라 인하가 아니다)', () => {
    expect(priceDrop(item({ price: 10000, base_price: 14200 }))).toBe(4200)
    // 할인율 30% 여도 찜한 뒤 안 내렸으면 신호 없음
    expect(priceDrop(item({ price: 10000, base_price: 10000, discount_rate: 30 }))).toBeNull()
    expect(priceDrop(item({ price: 12000, base_price: 10000 }))).toBeNull() // 올랐다
  })

  it('⑤ base_price 가 없으면 신호가 없을 뿐 (목록이 깨지지 않는다)', () => {
    expect(priceDrop(item({ base_price: undefined }))).toBeNull()
    expect(priceDrop(item({ base_price: null }))).toBeNull()
    expect(priceDrop(item({ base_price: 0 }))).toBeNull()
    expect(() => summarize([item(), item({ base_price: null })])).not.toThrow()
  })
})

describe('찜 신호 — 마감', () => {
  it('② 지난 마감·종료된 공구는 신호가 아니다', () => {
    expect(daysLeft(item({ expires_at: at(-1) }))).toBeNull()
    expect(daysLeft(item({ expires_at: at(5), group_buy_status: 'ended' }))).toBeNull()
    expect(daysLeft(item({ expires_at: null }))).toBeNull()
  })

  it('남은 일수는 내림 (오늘 안이면 0)', () => {
    expect(daysLeft(item({ expires_at: at(2.5) }))).toBe(2)
    expect(daysLeft(item({ expires_at: at(0.4) }))).toBe(0)
    expect(isSoon(item({ expires_at: at(SOON_DAYS - 0.5) }))).toBe(true)
    expect(isSoon(item({ expires_at: at(SOON_DAYS + 2) }))).toBe(false)
  })
})

describe('찜 신호 — 요약과 정렬이 같은 판정을 쓴다', () => {
  const items = [
    item({ id: 1, price: 10000, base_price: 14200, category: 'meal_voucher' }),          // 인하 4200
    item({ id: 2, expires_at: at(1), category: 'stay_voucher' }),                        // 1일 남음
    item({ id: 3, price: 9000, base_price: 9500, expires_at: at(10), category: 'meal_voucher' }), // 인하 500
    item({ id: 4, category: 'beauty_voucher', discount_rate: 40 }),
  ]

  it('③ 요약 숫자 = 배지가 뜨는 카드 수', () => {
    const s = summarize(items)
    expect(s.total).toBe(4)
    expect(s.drops).toBe(items.filter((i) => priceDrop(i) != null).length)
    expect(s.drops).toBe(2)
    expect(s.soon).toBe(items.filter((i) => isSoon(i)).length)
    expect(s.soon).toBe(1)
    expect(s.byCategory[0]).toEqual({ category: 'meal_voucher', count: 2 })
  })

  it('④ 정렬은 원본을 안 건드린다', () => {
    const before = items.map((i) => i.id)
    sortWishlist(items, 'drop')
    expect(items.map((i) => i.id)).toEqual(before)
  })

  it('가격 내림순 — 많이 내린 것부터, 안 내린 건 뒤로', () => {
    expect(sortWishlist(items, 'drop').map((i) => i.id)).toEqual([1, 3, 2, 4])
  })

  it('마감 임박순 — 마감 없는 것은 맨 뒤 (앞으로 끌어올리지 않는다)', () => {
    const ids = sortWishlist(items, 'deadline').map((i) => i.id)
    expect(ids[0]).toBe(2)
    expect(ids[1]).toBe(3)
    expect(ids.slice(2).sort()).toEqual([1, 4]) // 마감 없는 둘 — 원래 순서 유지
  })

  it('할인율순 · 최근 찜순(=서버 순서 그대로)', () => {
    expect(sortWishlist(items, 'discount')[0].id).toBe(4)
    expect(sortWishlist(items, 'recent')).toBe(items)
  })
})
