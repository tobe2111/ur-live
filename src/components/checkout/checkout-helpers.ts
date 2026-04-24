import { CartItem } from '@/types/cart'
import { SellerGroup, GroupBuyTier } from './checkout-types'

/**
 * 장바구니 아이템을 셀러별로 그룹화합니다.
 */
export function buildSellerGroups(cartItems: CartItem[]): Record<number, SellerGroup> {
  return cartItems.reduce((groups, item) => {
    const sellerId = Number(item.seller_id) || 0
    if (!groups[sellerId]) {
      groups[sellerId] = {
        seller_id: sellerId,
        seller_name: item.seller_name || '판매자',
        items: [],
        subtotal: 0,
        shipping_fee: item.shipping_fee || 3000,
        free_shipping_threshold: item.free_shipping_threshold || 0,
      }
    }
    groups[sellerId].items.push(item)
    groups[sellerId].subtotal += (item.price_snapshot ?? item.price ?? 0) * item.quantity
    return groups
  }, {} as Record<number, SellerGroup>)
}

/**
 * 총 배송비를 계산합니다. 무료 배송 임계값을 고려합니다.
 */
export function calcTotalShippingFee(sellerGroups: Record<number, SellerGroup>): number {
  return Object.values(sellerGroups).reduce((total, group) => {
    if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) {
      return total
    }
    return total + group.shipping_fee
  }, 0)
}

/**
 * 공동구매 할인 총액을 계산합니다.
 */
export function calcTotalGroupBuyDiscount(
  cartItems: CartItem[],
  groupBuyDiscounts: Record<number, { percent: number; tier: GroupBuyTier | null }>
): number {
  return cartItems.reduce((sum, item) => {
    const pid = Number(item.product_id)
    const discount = groupBuyDiscounts[pid]
    if (!discount || !discount.percent) return sum
    const itemPrice = item.price_snapshot ?? item.price ?? 0
    return sum + Math.floor(itemPrice * item.quantity * discount.percent / 100)
  }, 0)
}

/**
 * 셀러 그룹의 실제 배송비를 계산합니다 (무료 배송 조건 적용).
 */
export function calcGroupShippingFee(group: SellerGroup): number {
  return group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
    ? 0
    : group.shipping_fee
}

/**
 * 제휴 레퍼러 ID를 localStorage/쿠키에서 읽습니다.
 */
export function getAffiliateRef(): string | undefined {
  const ref = localStorage.getItem('affiliate_ref')
  const expires = localStorage.getItem('affiliate_ref_expires')
  if (ref && expires && Date.now() < Number(expires)) return ref
  const cookie = document.cookie.match(/affiliate_ref=([^;]+)/)
  return cookie?.[1] || undefined
}
