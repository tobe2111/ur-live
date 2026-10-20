/**
 * 🧾 장바구니 합계 — **순수 함수** (2026-09-15 추출)
 *
 * `CartPage` 안의 `useMemo` 였는데 그 자리는 두 가지가 나빴다:
 * ① 금액 계산이라 **실행해서 재야 하는데** 페이지 안에 있으면 렌더 없이는 못 잰다
 * ② 페이지가 file-size 래칫에 닿았다(god 파일 방지 룰).
 *
 * 🩸 **왜 통화를 나누는가**: 교환권(`deal_only=1`)은 **딜**로, 이용권·배송 상품은 **카드**로 산다.
 *    한 숫자로 더하면 "88,000원"(74,500원 + 13,500딜) 같은, 어디서도 청구되지 않는 금액이 나온다.
 *    라이브 번들을 실제로 렌더해 보고서야 보였다(그때 테스트는 전부 초록이었다).
 */
import type { CartItem } from '@/types/cart'
import { getCartItemPrice } from '@/types/cart'
import { isNoShippingProduct } from '@/shared/product-flow'
import { classifyCart, isDealOnlyCartItem, type CartKind } from './voucher-checkout'
import { priceDisplay } from '@/shared/price-display'

export interface CartTotals {
  /** 고른 것 전체 수량(교환권 포함) */
  totalItems: number
  /** 그중 교환권 수량 — 상품금액 줄의 개수에서 뺀다(개수 6 · 금액 3개분 자기모순 방지) */
  dealItems: number
  /** 카드로 낼 상품 금액. 딜은 안 들어간다. */
  subtotal: number
  shippingFee: number
  /** 딜로 낼 금액(교환권) */
  dealAmount: number
  /** 💸 정가 대비 아낀 금액(원화 줄만). 0 이면 줄을 안 그린다 — 0원 아꼈다는 말은 소음이다. */
  savedAmount: number
  cartKind: CartKind
}

/** 📦 배송비 판정은 SSOT 하나로 — 여기와 결제 화면이 갈려 총액이 달랐다(product-flow.ts). */
const isNoShip = (item: CartItem) => isNoShippingProduct({ deal_only: item.deal_only, category: item.category })

export function computeCartTotals(cartItems: CartItem[], selectedIds: Set<string | number>): CartTotals {
  let count = 0
  let dealCount = 0
  let sum = 0
  let deal = 0
  let saved = 0

  // 🛡️ 2026-05-19: 판매 종료 (product_is_active=0) 상품은 자동 제외 — 사용자 의도 무관하게
  //   결제 흐름에서 빠짐 (백엔드도 차단하지만 프론트 calc 도 정합).
  const isAvailable = (item: CartItem) => item.product_is_active === undefined || Number(item.product_is_active) === 1
  const selectedItems = cartItems.filter(item => selectedIds.has(item.id) && isAvailable(item))

  // 셀러별로 그룹화 — 배송비는 셀러 단위로 붙는다.
  const groups = selectedItems.reduce((acc, item) => {
    const sellerId = item.seller_id || 0
    if (!acc[sellerId]) {
      acc[sellerId] = {
        items: [], subtotal: 0,
        shipping_fee: item.shipping_fee ?? 3000,  // `||` 는 명시한 0 을 3,000 으로 되돌린다
        free_shipping_threshold: item.free_shipping_threshold || 0,
      }
    }
    acc[sellerId].items.push(item)
    acc[sellerId].subtotal += (getCartItemPrice(item) * item.quantity)
    return acc
  }, {} as Record<string | number, { items: CartItem[]; subtotal: number; shipping_fee: number; free_shipping_threshold: number }>)

  for (const item of selectedItems) {
    count += item.quantity
    const line = getCartItemPrice(item) * item.quantity
    if (isDealOnlyCartItem(item)) { deal += line; dealCount += item.quantity }
    else {
      sum += line
      // 표시 규칙은 홈 카드와 같은 SSOT — 정가가 실제로 더 클 때만 센다.
      const d = priceDisplay({ price: getCartItemPrice(item), original_price: item.original_price, discount_rate: item.discount_rate })
      if (d.showOriginal) saved += (d.originalPrice - d.price) * item.quantity
    }
  }

  const shippingFee = Object.values(groups).reduce((total, g) => {
    // 🛡️ 교환권은 휴대폰 발송, 이용권은 매장 사용 — 둘 다 배송비 없음.
    if (g.items.length > 0 && g.items.every(isNoShip)) return total
    // 무료배송 기준액 이상이면 0원
    if (g.free_shipping_threshold > 0 && g.subtotal >= g.free_shipping_threshold) return total
    return total + g.shipping_fee
  }, 0)

  return { totalItems: count, dealItems: dealCount, subtotal: sum, shippingFee, dealAmount: deal, savedAmount: saved, cartKind: classifyCart(selectedItems) }
}
