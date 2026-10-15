/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 숙소 검색 결과 (query string 별 캐시).
 * 기존 StaysSearchPage 의 수동 load() → useStaysSearch(qs).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { takeStaysEarly } from '@/shared/stays-early'

export interface StaySearchItem {
  id: number
  name: string
  image_url?: string
  property_type?: string
  star_rating?: number | null
  region_sido?: string
  region_sigungu?: string
  /** 📍 서버가 이미 내려주고 있었는데 타입에만 없었다(2026-09-14). 카드 지역 표기의 진실은 이쪽이다 —
   *  라이브 50건 중 12건은 `region_*` 과 주소가 서로 다르다. 판정은 `shared/stay-address.ts`. */
  address?: string | null
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
    // 🏨 2026-10-15: 첫 진입은 index.html 이 HTML 파싱 중에 미리 보낸 같은 요청을 이어받는다(shared/stays-early.ts).
    //   그 요청이 실패하면 일반 경로로 다시 받는다(가속일 뿐 필수가 아니다).
    queryFn: () => {
      const viaApi = () => api
        .get(`/api/group-buy/stays/search?${qs}`)
        .then((r) => (r.data?.success ? (r.data.data || []) : []) as StaySearchItem[])
      const early = takeStaysEarly(qs)
      if (!early) return viaApi()
      return early
        .then((j) => { const d = j as { success?: boolean; data?: StaySearchItem[] }; if (!d?.success) throw new Error('early'); return d.data || [] })
        .catch(viaApi)
    },
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
