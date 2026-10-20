/**
 * 💗 위시리스트 안 B — "지금 사야 할 것" 신호 (2026-09-03 대표 확정)
 *
 * 이 검사가 지키는 계약:
 *   ① "찜한 뒤 내렸다"는 **오직 `base_price` 대비**로만 말한다 — 상시 할인율로 대신하지 않는다
 *   ② 배지·정렬·요약이 **같은 판정**을 쓴다(카드엔 뜨는데 요약은 0 인 화면 금지)
 *   ③ 정렬은 원본을 안 건드리고, 동점이면 최근 찜순으로 떨어진다
 *   ④ 서버가 `base_price` 를 안 주면 조용히 신호만 없다(목록은 그대로 뜬다)
 *   ⑤ 🗓️ 2026-09-04 (대표 "마감 개념은 없어") — 마감 신호가 **되살아나지 않는다**.
 *      마감이 없으니 남은 일수는 늘 null 이고, 그러면 그 정렬은 전부 동점이라 칩을 눌러도
 *      순서가 그대로다. 하는 일이 없는 칩을 화면에 두는 것이 이 검사가 막는 상태다.
 *
 * ⚠️ 못 막는 것: 서버가 그 열을 실제로 채우는지(=`wishlist-notify` 의 seed 배선). 그건
 *    `wishlist-baseline-wiring` 이 소스로 고정한다 — 여기서는 계산만 본다.
 */
import { describe, it, expect } from 'vitest'
import { priceDrop, summarize, sortWishlist } from '@/pages/wishlist/wishlist-signals'
import { readFileSync } from 'node:fs'
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

  it('④ base_price 가 없으면 신호가 없을 뿐 (목록이 깨지지 않는다)', () => {
    expect(priceDrop(item({ base_price: undefined }))).toBeNull()
    expect(priceDrop(item({ base_price: null }))).toBeNull()
    expect(priceDrop(item({ base_price: 0 }))).toBeNull()
    expect(() => summarize([item(), item({ base_price: null })])).not.toThrow()
  })
})

describe('찜 신호 — 마감 개념이 되살아나지 않는다', () => {
  /** ⚠️ 주석은 걷어내고 **코드만** 본다 — 설명에 그 단어를 쓰면 판정이 뒤집힌다(이 레포의 함정). */
  const code = (p: string) =>
    readFileSync(p, 'utf-8').split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n')

  it('⑤ 신호 모듈에 마감 계산이 없다', () => {
    const s = code('src/pages/wishlist/wishlist-signals.ts')
    expect(s).not.toMatch(/daysLeft|isSoon|SOON_DAYS/)
    expect(s).not.toMatch(/'deadline'/)
    // 살아 있는 신호는 그대로여야 한다(과잉 삭제 방지)
    expect(s).toMatch(/export function priceDrop/)
    expect(s).toMatch(/export function sortWishlist/)
  })

  it('⑤ 정렬 칩과 요약에서 마감이 빠졌다', () => {
    const s = code('src/pages/wishlist/WishlistParts.tsx')
    expect(s).not.toMatch(/마감/)
    expect(s).not.toMatch(/'deadline'/)
    expect(s).toMatch(/가격 내림/)
  })

  it('⑤ 요약에 soon 카운트가 없다 — 영구히 0 인 숫자를 만들지 않는다', () => {
    expect(Object.keys(summarize([item()]))).not.toContain('soon')
  })
})

describe('찜 신호 — 요약과 정렬이 같은 판정을 쓴다', () => {
  const items = [
    item({ id: 1, price: 10000, base_price: 14200, category: 'meal_voucher' }),          // 인하 4200
    item({ id: 2, expires_at: at(1), category: 'stay_voucher' }),                        // 1일 남음
    item({ id: 3, price: 9000, base_price: 9500, expires_at: at(10), category: 'meal_voucher' }), // 인하 500
    item({ id: 4, category: 'beauty_voucher', discount_rate: 40 }),
  ]

  it('② 요약 숫자 = 배지가 뜨는 카드 수', () => {
    const s = summarize(items)
    expect(s.total).toBe(4)
    expect(s.drops).toBe(items.filter((i) => priceDrop(i) != null).length)
    expect(s.drops).toBe(2)
    expect(s.byCategory[0]).toEqual({ category: 'meal_voucher', count: 2 })
  })

  it('③ 정렬은 원본을 안 건드린다', () => {
    const before = items.map((i) => i.id)
    sortWishlist(items, 'drop')
    expect(items.map((i) => i.id)).toEqual(before)
  })

  it('가격 내림순 — 많이 내린 것부터, 안 내린 건 뒤로', () => {
    expect(sortWishlist(items, 'drop').map((i) => i.id)).toEqual([1, 3, 2, 4])
  })

  it('할인율순 · 최근 찜순(=서버 순서 그대로)', () => {
    expect(sortWishlist(items, 'discount')[0].id).toBe(4)
    expect(sortWishlist(items, 'recent')).toBe(items)
  })
})
