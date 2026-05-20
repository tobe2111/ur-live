import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
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

// 🎯 상품 검색 Hook (디바운싱 + 캐싱)
export function useSearch(query: string, options?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['search', query, options],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('q', query)
      if (options?.page) params.append('page', options.page.toString())
      if (options?.limit) params.append('limit', options.limit.toString())

      const response = await api.get(`/api/search?${params.toString()}`)
      // 🛡️ 2026-05-19: backend response = { data: [], pagination: {...} } → SearchResult 정규화.
      return {
        products: response.data.data || [],
        total: response.data.pagination?.total ?? (response.data.data?.length || 0),
        page: response.data.pagination?.page ?? 1,
        limit: response.data.pagination?.limit ?? 20,
      } as SearchResult
    },
    enabled: query.length >= 2, // 2글자 이상만 검색
    staleTime: 10 * 60 * 1000,  // 10분간 캐시
    gcTime: 30 * 60 * 1000,     // 30분 후 메모리 해제
  })
}

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

// 🎯 인기 검색어 Hook
export function usePopularSearches() {
  return useQuery({
    queryKey: ['popular-searches'],
    queryFn: async () => {
      const response = await api.get('/api/search/popular')
      return response.data.data.keywords as string[]
    },
    staleTime: 30 * 60 * 1000, // 30분간 캐시
  })
}

// 🎯 최근 검색어 Hook (로컬 스토리지 기반)
export function useRecentSearches() {
  const getRecentSearches = (): string[] => {
    try {
      const stored = localStorage.getItem('recent-searches')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  const addRecentSearch = (keyword: string) => {
    const recent = getRecentSearches()
    const filtered = recent.filter((k) => k !== keyword)
    const updated = [keyword, ...filtered].slice(0, 10) // 최대 10개
    localStorage.setItem('recent-searches', JSON.stringify(updated))
  }

  const clearRecentSearches = () => {
    localStorage.removeItem('recent-searches')
  }

  return {
    recentSearches: getRecentSearches(),
    addRecentSearch,
    clearRecentSearches,
  }
}
