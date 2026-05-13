/**
 * useProductStock
 *
 * 🛡️ 2026-05-13 (#2 비용/속도): 5초 폴링 → 60초 백업 폴링 + visibility refresh.
 *   WS product_change 이벤트가 상품 변경/재고 동기화의 1차 경로 (latency <200ms).
 *   이 폴링은 "WS 끊김 케이스의 안전망" 만 담당 → 60초로 간격 ↑ → 서버 D1 부하 12배 ↓.
 *
 *   비용 영향 (시청자 1000명 기준):
 *     - 이전: 1000 × 12/min = 12,000 D1 reads/min → 17.28M reads/day
 *     - 현재: 1000 × 1/min  =  1,000 D1 reads/min →  1.44M reads/day
 *   D1 free tier (5M reads/day) 안에서 운영 가능.
 */

import { useState, useEffect } from 'react'
import type { ProductData } from '@/types/live-stream'

const POLL_INTERVAL_MS = 60_000  // 60초 — WS 끊김 안전망. 평소 WS 가 즉시 갱신.

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
        // Non-fatal: WS 가 1차 경로, 다음 폴링이 안전망
      }
    }

    poll()
    const interval = setInterval(() => { if (!document.hidden) poll() }, POLL_INTERVAL_MS)
    // visibility 복귀 시 즉시 refresh — 백그라운드에서 돌아왔을 때 stale 가능성 ↓
    const onVisible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [productId])

  return { productData }
}
