import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Product } from './useProduct'

export interface SearchResult {
  products: Product[]
  total: number
  page: number
  limit: number
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
      return response.data.data as SearchResult
    },
    enabled: query.length >= 2, // 2글자 이상만 검색
    staleTime: 10 * 60 * 1000,  // 10분간 캐시
    gcTime: 30 * 60 * 1000,     // 30분 후 메모리 해제
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
