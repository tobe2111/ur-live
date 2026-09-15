/**
 * 🧾 장바구니가 **딜과 원을 안 더한다** 〔2026-09-15〕
 *
 * 대표: *"장바구니 켜줘 최대한 다 끝까지 다 해줘"* — 게이트를 켜기 직전에 라이브 번들을 실제로
 * 렌더해 보고 드러난 것이다. 이용권 74,500원 + 교환권 13,500딜을 고르면 요약이 **88,000원**이라고
 * 했다. 그런 금액으로는 아무 데서도 청구되지 않는다 — 교환권은 딜로, 이용권은 카드로 산다.
 *
 * ## 왜 소스 문자열이 아니라 **렌더**로 재는가
 * `deal_only` 라는 낱말은 이 파일들 곳곳에 있다. 문자열로 재면 계산을 통째로 지워도 통과한다
 * (이 레포가 반복해 당한 "검사가 실패할 수 없음"). 그래서 **화면에 찍힌 글자**를 본다.
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제 청구액(Toss 가 정한다 — staging 실결제 항목 S-CART)
 * - 장바구니 목록 자체의 배치·색 (그건 `check-dark-contrast` 와 눈으로 본다)
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CartSummary } from '@/components/cart/CartSummary'
import type { CartItem } from '@/types/cart'
import { readCode } from '../helpers/source-text'
import { computeCartTotals } from '@/pages/cart/cart-totals'

const txt = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? ''

describe('통화가 둘이면 줄도 둘이다', () => {
  it('🔴 이용권(원) + 교환권(딜) 을 한 숫자로 더하지 않는다', () => {
    const { container } = render(
      <CartSummary totalItems={2} subtotal={74500} shippingFee={0} total={74500}
        dealAmount={13500} cartKind="mixed" noShipping />,
    )
    const s = txt(container)
    expect(s).toContain('74,500원')
    expect(s).toContain('13,500딜')
    // 합산한 숫자가 **어디에도** 없어야 한다 — 이게 라이브에 떠 있던 값이다.
    expect(s).not.toContain('88,000')
    // 결제가 안 열리므로 합계를 말하지 않는다 — 한쪽 통화만 큰 글씨면 그게 청구될 것처럼 읽힌다.
    expect(s).not.toContain('결제예정금액')
    expect(s).not.toMatch(/부가세/)
  })

  it('교환권만이면 큰 숫자가 **딜** 이다 (원이 아니다)', () => {
    const { container } = render(
      <CartSummary totalItems={1} subtotal={0} shippingFee={0} total={0}
        dealAmount={13500} cartKind="deal" noShipping />,
    )
    const s = txt(container)
    expect(s).toContain('13,500딜')
    // "0원" 을 결제예정금액으로 띄우면 공짜처럼 읽힌다.
    expect(s).not.toContain('0원')
    expect(s).not.toMatch(/부가세/)   // 딜 결제엔 VAT 줄이 말이 안 된다
  })

  it('이용권만이면 종전 그대로 — 딜 줄이 안 뜬다', () => {
    const { container } = render(
      <CartSummary totalItems={1} subtotal={74500} shippingFee={0} total={74500}
        dealAmount={0} cartKind="voucher" noShipping />,
    )
    const s = txt(container)
    expect(s).toContain('74,500원')
    expect(s).not.toContain('딜')
  })

  it('배송 상품은 배송비 줄이 살아 있다 (회귀 방지)', () => {
    const { container } = render(
      <CartSummary totalItems={1} subtotal={20000} shippingFee={3000} total={23000} cartKind="shipping" />,
    )
    const s = txt(container)
    expect(s).toContain('+3,000원')
    expect(s).toContain('23,000원')
  })
})

describe('섞였으면 **누르기 전에** 말한다', () => {
  it('섞임이면 이유가 화면에 있다', () => {
    const { container } = render(
      <CartSummary totalItems={2} subtotal={74500} shippingFee={0} total={74500}
        dealAmount={13500} cartKind="mixed" noShipping />,
    )
    expect(txt(container)).toMatch(/한 번에 결제할 수 없어요/)
  })

  it('안 섞였으면 그 문장이 없다 (늘 떠 있으면 아무도 안 읽는다)', () => {
    const { container } = render(
      <CartSummary totalItems={1} subtotal={74500} shippingFee={0} total={74500} cartKind="voucher" noShipping />,
    )
    expect(txt(container)).not.toMatch(/한 번에 결제할 수 없어요/)
  })
})

/**
 * 장바구니 페이지가 그 값을 **실제로 나눠서** 넘기는가.
 * (컴포넌트만 고치고 호출부가 여전히 합산본을 넘기면 화면은 그대로다.)
 */
describe('배선 — CartPage 가 딜을 따로 센다', () => {
  const PAGE = readCode('src/pages/CartPage.tsx')

  // 🔬 문자열이 아니라 **실행해서** 잰다 — 계산은 순수 함수로 빼 두었다(`cart/cart-totals.ts`).
  it('합계가 딜과 원을 다른 칸에 담는다 (실행 검증)', () => {
    const items = [
      { id: 1, product_id: 1, product_name: 'v', quantity: 1, price: 16500, category: 'meal_voucher', seller_id: 11 },
      { id: 2, product_id: 2, product_name: 'v2', quantity: 2, price: 29000, category: 'beauty_voucher', seller_id: 22 },
      { id: 3, product_id: 3, product_name: 'd', quantity: 3, price: 4500, category: 'etc_voucher', deal_only: 1, seller_id: null },
    ] as unknown as CartItem[]
    const all = new Set<string | number>([1, 2, 3])
    const t = computeCartTotals(items, all)
    expect(t.subtotal).toBe(74500)     // 16,500 + 58,000 — 원화만
    expect(t.dealAmount).toBe(13500)   // 4,500 × 3 — 딜만
    expect(t.subtotal + t.dealAmount).toBe(88000)  // 이 값이 화면에 뜨면 안 된다(라이브에 떠 있던 값)
    expect(t.cartKind).toBe('mixed')
    expect(t.totalItems - t.dealItems).toBe(3)     // 상품금액 줄의 개수 = 원화 품목 수량
    expect(t.shippingFee).toBe(0)                  // 이용권·교환권은 배송이 없다
  })

  it('교환권만이면 카드 금액이 0 이고 종류가 deal (실행 검증)', () => {
    const only = [{ id: 3, product_id: 3, product_name: 'd', quantity: 2, price: 4500, category: 'etc_voucher', deal_only: 1 }] as unknown as CartItem[]
    const t = computeCartTotals(only, new Set([3]))
    expect(t).toMatchObject({ subtotal: 0, dealAmount: 9000, cartKind: 'deal' })
  })

  it('판매 종료 상품은 합계에서 빠진다 (회귀 방지 — 2026-05-19)', () => {
    const items = [
      { id: 1, product_id: 1, product_name: 'v', quantity: 1, price: 10000, category: 'meal_voucher', product_is_active: 0 },
      { id: 2, product_id: 2, product_name: 'v2', quantity: 1, price: 20000, category: 'meal_voucher' },
    ] as unknown as CartItem[]
    expect(computeCartTotals(items, new Set([1, 2])).subtotal).toBe(20000)
  })

  it('요약에 `dealAmount` 와 `cartKind` 를 넘긴다', () => {
    expect(PAGE).toMatch(/<CartSummary[\s\S]{0,400}dealAmount=\{dealAmount\}[\s\S]{0,200}cartKind=\{cartKind\}/)
  })

  it('상품금액 줄의 **개수**에서 교환권 수량을 뺀다 (개수 6 · 금액 3개분 자기모순 방지)', () => {
    expect(PAGE).toMatch(/totalItems=\{totalItems - dealItems\}/)
  })

  it('버튼이 섞임이면 **비활성** 이고 교환권만이면 "딜로 주문하기" 라고 쓴다', () => {
    expect(PAGE).toMatch(/cartKind === 'mixed' \? '따로 골라서 결제해주세요'/)
    expect(PAGE).toMatch(/cartKind === 'deal' \? `\$\{formatNumber\(dealAmount\)\}딜로 주문하기`/)
    expect(PAGE).toMatch(/const ctaDisabled = selectedIds\.size === 0 \|\| updating \|\| cartKind === 'mixed'/)
  })

  it('두 CTA(모바일 하단바·PC 사이드)가 **같은 라벨**을 쓴다 — 한쪽만 고치면 갈린다', () => {
    expect((PAGE.match(/label=\{ctaLabel\}/g) || []).length).toBe(2)
    expect((PAGE.match(/disabled=\{ctaDisabled\}/g) || []).length).toBe(2)
    // 옛 인라인 라벨이 되살아나면 그쪽만 합산본을 쓴다.
    expect(PAGE).not.toMatch(/label=\{selectedIds\.size === 0 \?/)
  })
})
