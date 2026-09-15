/**
 * 🔘🕐 장바구니 버튼이 대신 골라 준다 + 로딩과 "없음"을 구분한다 〔2026-09-15〕
 *
 * 대표: *"따로 골라서 결제할 필요도 또 없지 않나? … 각 페이지들마다 접속 시 로딩들이 좀 불만이야.
 * 계속 중간에 연관없는 페이지도 보이는 것 같고?"*
 *
 * ## ① 버튼이 고른다
 * 교환권(딜)과 이용권(카드)이 섞이면 예전엔 **버튼을 잠그고** "따로 골라서 결제해주세요" 라고 했다.
 * 우리 내부 레일 사정을 사용자한테 떠넘긴 것이다. 이제 버튼이 한 덩어리를 골라 주고 나머지는 남긴다.
 *
 * ## ② 로딩 ≠ 없음 (실측으로 찾은 것)
 * `initialData: () => readCache(key, [])` 는 캐시가 없어도 **빈 배열을 진짜 데이터로** 넘겨
 * `isLoading:false` 를 만든다 → 화면이 **"받아둔 이용권이 없어요"** 를 먼저 그린다.
 * 렌더 실측: `/my-vouchers` 806ms 에 "없어요", 그 뒤에 진짜 결과. 훅 20곳이 같은 패턴이었다.
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제 체감 속도(프록시·CPU 스로틀로 절대 ms 는 못 믿는다 — 배포 후 라이브 실측이 판정)
 * - 결제가 실제로 되는지(S-CART 실결제)
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import { cartCta, itemKind } from '@/pages/cart/cart-cta'
import { computeCartTotals } from '@/pages/cart/cart-totals'
import { cachedInitialData, writeCache } from '@/hooks/queries/localCache'
import { CartSummary } from '@/components/cart/CartSummary'
import type { CartItem } from '@/types/cart'

const fmt = (n: number) => n.toLocaleString('en-US')
const t = (k: string, o?: Record<string, unknown>) =>
  k === 'cart.selectProductsFirst' ? '상품을 선택해주세요'
  : k === 'cart.placeOrder' ? `${o?.amount}원 주문하기` : k

/** 픽스처 공장. ⚠️ `mk` 라는 이름은 쓰지 말 것 — 주입 탐지기가 가짜 헬퍼 시그니처로 읽는다. */
const cartItem = (o: Partial<CartItem>): CartItem => ({
  id: 1, product_id: 1, product_name: 'x', quantity: 1, price: 1000, ...o,
} as CartItem)

const CARD_A = cartItem({ id: 1, product_id: 1, price: 16500, category: 'meal_voucher', seller_id: 11 })
const CARD_B = cartItem({ id: 2, product_id: 2, price: 29000, quantity: 2, category: 'beauty_voucher', seller_id: 22 })
const DEAL = cartItem({ id: 3, product_id: 3, price: 4500, quantity: 3, category: 'etc_voucher', deal_only: 1 })
const SHIP = cartItem({ id: 4, product_id: 4, price: 20000, category: 'fashion', seller_id: 33 })

describe('① 섞였을 때 버튼이 한 덩어리를 골라 준다', () => {
  const cta = (selected: CartItem[]) => cartCta({ selected, cardTotal: 74500, dealAmount: 13500, fmt, t })

  it('🔴 섞여도 **버튼이 안 잠긴다** — 체크박스를 푸는 노동을 사용자에게 안 시킨다', () => {
    const r = cta([CARD_A, CARD_B, DEAL])
    expect(r.disabled).toBe(false)
    expect(r.label).not.toContain('따로 골라서')
  })

  it('고른 덩어리와 금액을 버튼이 말한다', () => {
    const r = cta([CARD_A, CARD_B, DEAL])
    expect(r.label).toBe('이용권 3개 먼저 결제 · 74,500원')     // 16,500 + 29,000×2
    expect(r.payItems.map(i => i.id)).toEqual([1, 2])
  })

  it('🔴 결제 대상이 **한 통화로만** 묶인다 (딜과 원이 한 결제에 안 섞인다)', () => {
    for (const sel of [[CARD_A, DEAL], [DEAL, SHIP], [CARD_A, CARD_B, DEAL, SHIP]]) {
      const kinds = new Set(cta(sel).payItems.map(itemKind))
      expect(kinds.size).toBe(1)
    }
  })

  it('개수가 많은 쪽을 먼저 — 교환권이 더 많으면 교환권부터(딜 단위로 말한다)', () => {
    const r = cta([CARD_A, DEAL])   // 이용권 1개 vs 교환권 3개
    expect(r.label).toBe('교환권 3개 먼저 결제 · 13,500딜')
    expect(r.payItems.map(i => i.id)).toEqual([3])
  })

  it('남는 것이 무엇인지 말한다 (사라지는 게 아니라 장바구니에 남는다)', () => {
    const r = cta([CARD_A, CARD_B, DEAL])
    expect(r.hint).toContain('교환권 3개')
    expect(r.hint).toContain('교환권 3개는 장바구니에 남겨')
    expect(r.hint, '`은(는)` 같은 회피 표기는 사람이 쓴 글이 아니다').not.toContain('은(는)')
    expect(r.hint).toContain('교환권은 딜로, 이용권은 카드로')
  })

  it('안 섞였으면 종전 그대로 — 안내도 분할도 없다', () => {
    expect(cta([CARD_A, CARD_B])).toMatchObject({ label: '74,500원 주문하기', hint: null, disabled: false })
    expect(cta([DEAL])).toMatchObject({ label: '13,500딜로 주문하기', hint: null })
    expect(cta([CARD_A, CARD_B]).payItems).toHaveLength(2)
  })

  it('아무것도 안 골랐으면 잠긴다', () => {
    expect(cta([])).toMatchObject({ disabled: true, payItems: [] })
  })
})

describe('② 로딩과 "없음"을 구분한다 — cachedInitialData', () => {
  it('🔴 캐시가 없으면 `undefined` (빈 배열이 아니다) — 그래야 화면이 로더를 그린다', () => {
    expect(cachedInitialData<number[]>('__no_such_key_2026__')).toBeUndefined()
  })

  it('캐시가 있으면 그 값을 즉시 준다 (0ms 표시라는 원래 목적은 유지)', () => {
    writeCache('__probe_2026__', [1, 2, 3])
    expect(cachedInitialData<number[]>('__probe_2026__')).toEqual([1, 2, 3])
  })

  it('캐시된 **빈 목록**은 빈 목록으로 준다 ("없음"을 캐시한 것은 진짜 없음이다)', () => {
    writeCache('__probe_empty_2026__', [])
    expect(cachedInitialData<number[]>('__probe_empty_2026__')).toEqual([])
  })

  it('훅들이 `readCache(key, [])` 로 되돌아가지 않는다 (20곳이 같은 함정이었다)', () => {
    // 되돌아가면 "없어요"가 다시 로더보다 먼저 뜬다.
    for (const f of ['useMyData', 'useWishlist', 'useNotifications', 'useMyCoupons', 'useAddresses',
      'useProduct', 'useSellerPublic', 'useUserProfile', 'useBalance']) {
      const src = readCode(`src/hooks/queries/${f}.ts`)
      expect(src, `${f}: initialData 가 readCache 폴백으로 되돌아갔다`)
        .not.toMatch(/initialData: \(\) => readCache</)
    }
  })
})

describe('③ 할인 정보 — 홈 카드와 같은 규칙', () => {
  it('아낀 금액을 정가 기준으로 센다 (딜 줄은 제외)', () => {
    const items = [
      cartItem({ id: 1, product_id: 1, price: 16500, original_price: 22000, category: 'meal_voucher' }),
      cartItem({ id: 2, product_id: 2, price: 29000, quantity: 2, original_price: 40000, category: 'beauty_voucher' }),
    ]
    const r = computeCartTotals(items, new Set([1, 2]))
    expect(r.savedAmount).toBe(5500 + 11000 * 2)
  })

  it('정가가 판매가보다 크지 않으면 0 — "0원 아꼈어요"는 소음이다', () => {
    const items = [cartItem({ id: 1, product_id: 1, price: 16500, original_price: 16500, category: 'meal_voucher' })]
    expect(computeCartTotals(items, new Set([1])).savedAmount).toBe(0)
  })

  it('요약이 할인 줄을 그린다 — 0 이면 안 그린다', () => {
    const on = render(<CartSummary totalItems={1} subtotal={16500} shippingFee={0} total={16500} savedAmount={5500} noShipping />)
    expect(on.container.textContent).toContain('−5,500')
    const off = render(<CartSummary totalItems={1} subtotal={16500} shippingFee={0} total={16500} savedAmount={0} noShipping />)
    expect(off.container.textContent).not.toContain('할인')
  })

  it('서버가 정가·할인율을 실제로 내려준다 (없으면 화면이 그릴 게 없다)', () => {
    const routes = readCode('src/features/cart/api/cart.routes.ts')
    expect(routes).toMatch(/p\.original_price,/)
    expect(routes).toMatch(/p\.discount_rate,/)
  })

  it('카드 줄이 **같은 SSOT** 를 쓴다 (화면마다 다른 할인율은 거짓말이다)', () => {
    expect(readCode('src/components/cart/CartItem.tsx')).toContain("from '@/shared/price-display'")
  })
})

describe('④ 지도가 받기 전에 "0곳"이라고 안 한다', () => {
  // "아직 모른다"를 별도 플래그가 아니라 `null` 로 나른다 — 0 과 구분되는 값이 타입에 있어야
  // 다음 사람이 실수로 0 을 넣지 못한다(이 PR 전체가 그 교훈이다).
  it('개수가 `null` 이면 숫자 대신 말줄임', () => {
    const bar = readCode('src/pages/restaurant-map/SheetFilterBar.tsx')
    expect(bar).toMatch(/\{filteredCount \?\? '…'\}/)
    expect(bar, '`number | null` 이라야 "모른다"가 표현된다').toMatch(/filteredCount: number \| null/)
  })

  it('두 곳(모바일·PC 시트) **모두** 로딩 중엔 null 을 넘긴다 — 한쪽만이면 갈린다', () => {
    const page = readCode('src/pages/RestaurantMapPage.tsx')
    expect((page.match(/filteredCount=\{loading && displayList\.length === 0 \? null :/g) || []).length).toBe(2)
  })
})
