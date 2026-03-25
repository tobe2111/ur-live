/**
 * useProductStock
 *
 * 상품 재고를 5초마다 D1에서 폴링하여 반환.
 * Firebase useFirebaseProduct 대체용 (Firebase Realtime DB 의존성 제거).
 *
 * 반환 타입이 useFirebaseProduct와 동일하여 drop-in 교체 가능.
 */

import { useState, useEffect } from 'react'
import type { ProductData } from './useFirebaseStream'

const POLL_INTERVAL_MS = 5000

export function useProductStock(productId: number | null): {
  productData: ProductData | null
} {
  const [productData, setProductData] = useState<ProductData | null>(null)

  useEffect(() => {
    if (!productId) {
      setProductData(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/products/${productId}`)
        if (!res.ok || cancelled) return
        const json = await res.json() as any
        const p = json.data ?? json
        if (p && p.id) {
          setProductData({
            id: p.id,
            name: p.name,
            price: p.price,
            original_price: p.original_price ?? p.originalPrice,
            discount_rate: p.discount_rate ?? p.discountRate ?? 0,
            stock: p.stock ?? 0,
            image_url: p.image_url ?? p.imageUrl,
            updated_at: Date.now(),
          })
        }
      } catch (e) {
        // Non-fatal: stock will be refreshed on next poll
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [productId])

  return { productData }
}
