/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 숙소 검색 결과 (query string 별 캐시).
 * 기존 StaysSearchPage 의 수동 load() → useStaysSearch(qs).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'

export interface StaySearchItem {
  id: number
  name: string
  image_url?: string
  property_type?: string
  star_rating?: number | null
  region_sido?: string
  region_sigungu?: string
  amenities?: string | null
  price_from?: number | null
  max_guests?: number | null
  avg_rating?: number | null
  review_count?: number
}

export function useStaysSearch(qs: string) {
  return useQuery<StaySearchItem[]>({
    queryKey: queryKeys.staysSearch(qs),
    // 🛡️ 2026-06-26 (소비자 감사 P0): 기존 `.catch(() => [])` 가 5xx/네트워크 실패를 '검색결과 없음'(재고
    //   없음)으로 위장 → 예약 이탈. catch 제거 → 에러는 isError 로 노출(페이지가 재시도 분기 렌더).
    queryFn: () =>
      api
        .get(`/api/group-buy/stays/search?${qs}`)
        .then((r) => (r.data?.success ? (r.data.data || []) : []) as StaySearchItem[]),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
