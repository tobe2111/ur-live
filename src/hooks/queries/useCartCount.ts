/**
 * 🛡️ 2026-05-22: 장바구니 카운트 — 1분 stale + localStorage cache + event invalidation.
 *
 * MainHomePage + DesktopTopNav 가 같은 queryKey 사용 → 자동 dedup.
 * 사용자 1명 메인 진입 = 1 server hit (이전: 2).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

const CACHE_KEY = 'cart-count'

export function useCartCount() {
  return useQuery<number>({
    queryKey: queryKeys.cartCount(),
    queryFn: () =>
      api.get('/api/cart').then((r) => {
        const items = r.data?.data?.items || (Array.isArray(r.data?.data) ? r.data.data : [])
        const count = items.reduce((s: number, it: { quantity?: number }) => s + (it.quantity || 1), 0)
        if (Number.isFinite(count) && count >= 0) {
          writeCache(CACHE_KEY, count)
          return count
        }
        return 0
      }).catch(() => readCache<number>(CACHE_KEY, 0)),
    initialData: () => readCache<number>(CACHE_KEY, 0),
    enabled: isLoggedInSync(),
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** add-to-cart / remove 후 호출 (낙관적 갱신). */
export function useSetCartCount() {
  const qc = useQueryClient()
  return (newCount: number) => {
    qc.setQueryData(queryKeys.cartCount(), newCount)
    writeCache(CACHE_KEY, newCount)
  }
}

export function useInvalidateCart() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.cart() })
}
