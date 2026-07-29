/**
 * 🛡️ 결제 금액 정합 — 배송비·현재가는 **서버 권위 견적**으로 (2026-07-02 쇼핑 전수조사)
 *
 * 왜: 클라가 자체 계산하면 서버 주문 총액과 어긋나 Toss confirm 이 "금액 불일치" 400 을 낸다.
 * 어긋나던 원인 네 가지 — 바로구매 배송비 3,000 하드코드 / 무료배송 threshold 미반영 /
 * 제주·도서산간 지역 추가비 미인지 / 장바구니 가격 snapshot 이 stale.
 * → 서버 주문 생성과 **같은 함수·같은 데이터**(POST /api/orders/shipping-quote)를 쓴다.
 *
 * 견적이 실패하면 아무것도 바꾸지 않는다 — 호출부의 기존 클라 계산이 그대로 fallback 이다.
 */
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface QuoteItem { product_id: string; quantity: number }
interface CartLike {
  product_id: string | number
  quantity: number
  price_snapshot?: number | null
  price?: number | null
  item_total?: number
}

export function useShippingQuote<T extends CartLike>(
  cartItems: T[],
  postalCode: string | null | undefined,
  setCartItems: (updater: (prev: T[]) => T[]) => void,
  t: (k: string, o?: Record<string, unknown>) => string,
): Record<string, number> | null {
  const [quotedFees, setQuotedFees] = useState<Record<string, number> | null>(null)
  // 같은 장바구니·같은 배송지면 다시 묻지 않는다(주소 입력 중 매 글자마다 호출되는 것 방지).
  const quoteKeyRef = useRef('')

  useEffect(() => {
    if (cartItems.length === 0) return
    const key = cartItems.map(i => `${i.product_id}x${i.quantity}`).sort().join(',') + '|' + (postalCode || '')
    if (quoteKeyRef.current === key) return
    quoteKeyRef.current = key

    const items: QuoteItem[] = cartItems.map(i => ({ product_id: String(i.product_id), quantity: i.quantity }))
    api.post('/api/orders/shipping-quote', { items, postal_code: postalCode || null }).then(r => {
      if (!r.data?.success) return
      const data = r.data.data as {
        items: Array<{ product_id: string; unit_price: number; available: boolean }>
        groups: Array<{ seller_id: string | null; shipping_fee: number }>
      }
      const fees: Record<string, number> = {}
      for (const g of data.groups) fees[String(Number(g.seller_id) || 0)] = g.shipping_fee
      setQuotedFees(fees)

      // 현재가 반영 — snapshot 이 stale(셀러가 가격을 바꿈)이면 최신가로 교체. 판매종료 상품은 뺀다.
      const priceMap = new Map(data.items.filter(it => it.available).map(it => [String(it.product_id), it.unit_price]))
      const unavailable = new Set(data.items.filter(it => !it.available).map(it => String(it.product_id)))
      let changed = false
      let removed = false
      setCartItems(prev => {
        const next = prev
          .filter(it => { const gone = unavailable.has(String(it.product_id)); if (gone) removed = true; return !gone })
          .map(it => {
            const cur = priceMap.get(String(it.product_id))
            const shown = it.price_snapshot ?? it.price ?? 0
            if (cur == null || cur === shown) return it
            changed = true
            return { ...it, price_snapshot: cur, price: cur, item_total: cur * it.quantity }
          })
        return (changed || removed) ? next : prev
      })
      if (removed) toast.error(t('checkoutPage.itemsUnavailableRemoved', { defaultValue: '판매가 종료된 상품을 주문에서 제외했어요' }))
      else if (changed) toast.info(t('checkoutPage.pricesUpdated', { defaultValue: '상품 가격이 변경되어 최신 가격으로 반영했어요' }))
    }).catch(err => {
      if (import.meta.env.DEV) console.warn('[Checkout] shipping-quote 실패 — 클라 계산 fallback:', err)
    })
  }, [cartItems, postalCode, setCartItems, t])

  return quotedFees
}
