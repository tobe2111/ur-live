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
const SEARCH_PAGE_SIZE = 50
export function useSearchInfinite(query: string) {
  return useInfiniteQuery({
    queryKey: ['search-infinite', query],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ q: query, page: String(pageParam), limit: String(SEARCH_PAGE_SIZE) })
      const response = await api.get(`/api/search?${params.toString()}`)
      return {
        products: response.data.data || [],
        total: response.data.pagination?.total ?? (response.data.data?.length || 0),
        page: response.data.pagination?.page ?? 1,
        limit: response.data.pagination?.limit ?? SEARCH_PAGE_SIZE,
        suggested_query: response.data.suggested_query || null,
      } as SearchResult
    },
    enabled: query.length >= 2,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.limit
      if (loaded >= lastPage.total) return undefined
      return lastPage.page + 1
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
