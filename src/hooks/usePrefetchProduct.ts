/**
 * 🛡️ 2026-05-24 (loading P0): 상품 카드 hover/touch 시 백그라운드 prefetch.
 *
 * 사용:
 *   const prefetch = usePrefetchProduct()
 *   <button onMouseEnter={() => prefetch(product.id)} onTouchStart={() => prefetch(product.id)} ...>
 *
 * 효과:
 *   - PC: 마우스 hover → 클릭 전 200ms 이상 일찍 prefetch
 *   - Mobile: 터치 시작 → 손가락 떼기 전 ~150ms prefetch
 *   - 카드 클릭 → 즉시 ProductDetailPage 렌더 (캐시 적중 시 네트워크 0회)
 *
 * 안전장치:
 *   - 이미 캐시에 있으면 fetch 안 함 (queryClient.getQueryData 체크)
 *   - 같은 id 중복 prefetch 방지 (in-flight 자동 dedupe)
 *   - failure 시 silent — 사용자 액션 차단 안 함
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import api from '@/lib/api'

export function usePrefetchProduct() {
  const queryClient = useQueryClient()
  const pendingRef = useRef<Set<string | number>>(new Set())

  return useCallback((productId: string | number | undefined) => {
    if (!productId) return
    if (pendingRef.current.has(productId)) return
    // 이미 fresh cache 있으면 skip
    const existing = queryClient.getQueryState(['product', productId])
    if (existing?.data && Date.now() - (existing.dataUpdatedAt || 0) < 5 * 60 * 1000) return

    pendingRef.current.add(productId)
    queryClient.prefetchQuery({
      queryKey: ['product', productId],
      queryFn: async () => {
        const response = await api.get(`/api/products/${productId}`)
        return response.data.data
      },
      staleTime: 30 * 60 * 1000,
    }).catch(() => { /* silent */ })
      .finally(() => { pendingRef.current.delete(productId) })
  }, [queryClient])
}
