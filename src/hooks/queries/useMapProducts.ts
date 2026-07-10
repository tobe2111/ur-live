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
    // 📄 2026-07-08 (대표 "전체 상품이 안 나옴 — 50곳밖에"): 서버 기본 피드는 LIMIT 50(캐시/SSR 고정)이라
    //   50개 초과 상품이 홈 지도/리스트에서 통째로 누락됐음. 지도는 마커를 다 찍어야 하므로 페이지네이션으로
    //   **전체를 누적**해 반환. page1 = 기본 요청(캐시 fast-path), 이후 page=2.. 라이브(같은 정렬 = DEMO_LAST,
    //   created_at DESC → 중복/누락 0). id 중복 제거로 경계 겹침 방어. 안전 상한 12페이지(600개).
    queryFn: async () => {
      const all: Restaurant[] = []
      const seen = new Set<number | string>()
      for (let page = 1; page <= 12; page++) {
        const params: Record<string, string | number> = { category }
        if (page > 1) { params.page = page; params.limit = 50 }  // page1 은 무파라미터=캐시 경로 유지
        const r = await api.get('/api/group-buy/products', { params }).catch(() => null)
        const arr = (r?.data?.success ? (r.data.data || []) : []) as Restaurant[]
        for (const p of arr) {
          const id = (p as { id?: number | string }).id
          if (id != null && !seen.has(id)) { seen.add(id); all.push(p) }
        }
        if (arr.length < 50) break  // 마지막 페이지(50 미만) → 종료
      }
      return all
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
