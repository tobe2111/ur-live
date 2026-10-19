/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 숙소 검색 결과 (query string 별 캐시).
 * 기존 StaysSearchPage 의 수동 load() → useStaysSearch(qs).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { takeStaysEarly, readStaysSeed } from '@/shared/stays-early'

// 🏨 2026-10-19 타입은 `shared/stays-list.ts` 한 곳 — 워커 첫 화면이 같은 모양을 읽는다.
export type { StaySearchItem } from '@/shared/stays-list'
import type { StaySearchItem } from '@/shared/stays-list'

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
    // 🏨 2026-10-19 서버 첫 화면이 그린 결과로 **첫 렌더**를 한다(카드가 사라졌다 다시 나타나지 않게).
    //   `initialDataUpdatedAt: 0` — 시드는 엣지 캐시 값이라 마운트 뒤 한 번 새로 받는다(그 요청은 위 미리 출발분을 이어받는다).
    initialData: () => readStaysSeed<StaySearchItem>(qs),
    initialDataUpdatedAt: 0,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
