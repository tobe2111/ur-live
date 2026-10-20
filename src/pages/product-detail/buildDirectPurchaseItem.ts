/**
 * 🛒 바로구매 → 결제 화면으로 넘기는 아이템 1개.
 *
 * 2026-09-01 ProductDetailPage 에서 추출. 결제 화면(CheckoutPage)의 비배송 판정(배송지 생략·배송비 0)은
 * `category` / `deal_only` 를 보므로 **둘을 반드시 실어야 한다** — 안 실으면 이용권을 바로 사도
 * 배송지를 요구하고 3,000원을 찍는다(장바구니에서 고친 것과 같은 사고, 다른 입구).
 * 배송비 숫자는 표시용이다. 실제 청구는 서버 견적(`useShippingQuote`)이 이긴다.
 */
import { isNoShippingProduct } from '@/shared/product-flow'

interface ProductLike {
  id: number | string
  name: string
  description?: string | null
  image_url?: string | null
  seller_id?: number | string | null
  seller_name?: string | null
  category?: string | null
  deal_only?: number | null
}

export function buildDirectPurchaseItem(
  product: ProductLike,
  unitPrice: number,
  quantity: number,
  optionId: number | string | null,
  optionValue: string | null,
) {
  return {
    id: `direct_${product.id}_${Date.now()}`,
    product_id: product.id,
    product_name: product.name,
    product_description: product.description,
    product_price: unitPrice,
    product_image: product.image_url,
    image_url: product.image_url,
    quantity,
    price_snapshot: unitPrice,
    price: unitPrice,
    item_total: unitPrice * quantity,
    seller_id: product.seller_id ?? null,
    seller_name: product.seller_name ?? null,
    category: product.category ?? null,
    deal_only: Number(product.deal_only) === 1 ? 1 : 0,
    shipping_fee: isNoShippingProduct(product) ? 0 : 3000,
    free_shipping_threshold: 0,
    option_id: optionId,
    option_value: optionValue,
  }
}
