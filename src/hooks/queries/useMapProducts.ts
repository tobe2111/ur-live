/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 레스토랑 지도 상품(공구) 목록 (카테고리별 캐시).
 * RestaurantMapPage 의 products fetch 만 이전 — live-poller(visibility 튜닝)는 그대로 유지.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import type { Restaurant } from '@/pages/restaurant-map/types'

export function useMapProducts(category: string) {
  return useQuery<Restaurant[]>({
    queryKey: queryKeys.mapProducts(category),
    queryFn: () =>
      api
        .get('/api/group-buy/products', { params: { category } })
        .then((r) => (r.data?.success ? (r.data.data || []) : []) as Restaurant[])
        .catch(() => [] as Restaurant[]),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
