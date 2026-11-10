import { useInfiniteQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Product } from './useProduct'

export interface SearchResult {
  products: Product[]
  total: number
  page: number
  limit: number
  // 🛡️ 2026-05-19: 0 건 시 오타 보정 제안 (Levenshtein, 백엔드 자동).
  suggested_query?: string | null
}

// 🧹 2026-07-20 (Phase 3 죽은 검색 코드 청소): 미사용 export 제거 —
//   useSearch(단발 useQuery, importer 0) / usePopularSearches(importer 0) /
//   useRecentSearches('recent-searches' store, importer 0). SearchPage 는 useSearchInfinite 만 사용.
//   최근검색 UI 는 SearchStates(addRecentSearch, 'recent_searches_v1') / 지도는 'restaurant_search_history'.

// 🛡️ 2026-05-19: cursor 무한스크롤 hook — SearchPage 에서 사용.
//   페이지 단위로 누적 로드. backend /api/search?page=N&limit=M.
import { SEARCH_PAGE_SIZE, readSearchSeed } from '@/shared/search-page' // 🌱 2026-11-10 워커 시드(첫 장)와 같은 장 크기·읽기
/**
 * 📍 2026-11-02: `scope` 를 서버에 보낸다 — 서버가 이용권(또는 교환권)만 골라 보내므로 한 장 50개가
 *   온전히 결과다. 종전엔 섞인 50개를 화면이 걸러 `서울` 은 첫 장이 40개였다.
 *   ⚠️ 화면의 클라이언트 필터(SearchPage)는 그대로 둔다 — 캐시된 옛 응답에도 범위가 새지 않게.
 */
type SearchApiBody = { data?: unknown[]; pagination?: { total?: number; page?: number; limit?: number }; suggested_query?: string | null }
function toSearchResult(body: SearchApiBody): SearchResult {
  return {
    products: (body.data || []) as SearchResult['products'],
    total: body.pagination?.total ?? (body.data?.length || 0),
    page: body.pagination?.page ?? 1,
    limit: body.pagination?.limit ?? SEARCH_PAGE_SIZE,
    suggested_query: body.suggested_query || null,
  } as SearchResult
}

export function useSearchInfinite(query: string, scope: 'voucher' | 'exchange' = 'voucher') {
  // 🌱 2026-11-10 워커가 HTML 에 실은 첫 장(같은 검색어·범위일 때만 — `readSearchSeed` 가 대조하고 한 번 읽고 지운다).
  //   React Query 는 캐시가 비었을 때만 initialData 를 쓰므로, 앱 안에서 다른 검색어로 왔다 돌아와도 시드가 결과를 덮지 않는다.
  const seed = query.length >= 2 ? readSearchSeed<SearchApiBody>(query, scope) : null
  return useInfiniteQuery({
    queryKey: ['search-infinite', query, scope],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ q: query, page: String(pageParam), limit: String(SEARCH_PAGE_SIZE), scope })
      const response = await api.get(`/api/search?${params.toString()}`)
      return toSearchResult(response.data as SearchApiBody)
    },
    enabled: query.length >= 2,
    initialPageParam: 1,
    initialData: seed ? { pages: [toSearchResult(seed)], pageParams: [1] } : undefined,
    initialDataUpdatedAt: seed ? Date.now() : undefined,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.limit
      if (loaded >= lastPage.total) return undefined
      return lastPage.page + 1
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
