/**
 * 🛡️ 2026-05-22 Phase 2: 상품 상세 + 목록 hooks.
 *
 * 효과:
 *   - 같은 상품 detail 진입 N회 → server hit 1
 *   - localStorage 로 즉시 0ms 표시 (사용자 마지막 본 상품)
 *   - 사용자가 list ↔ detail 왔다갔다 → 캐시 hit (이전: 매번 API call)
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'

interface Product {
  id: number
  name: string
  price: number
  image_url?: string
  description?: string
  [k: string]: unknown
}

export function useProduct(id: number | string | undefined) {
  const productId = id != null ? String(id) : ''
  return useQuery<Product | null>({
    queryKey: queryKeys.product(productId || 'none'),
    queryFn: () =>
      api.get(`/api/products/${productId}`).then((r) => {
        const data = r.data?.data as Product | null
        if (data) writeCache(`product:${productId}`, data)
        return data ?? null
      }).catch(() => readCache<Product | null>(`product:${productId}`, null)),
    initialData: () => readCache<Product | null>(`product:${productId}`, null),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

interface ProductListFilters {
  category?: string
  status?: string
  seller_id?: number | string
}

export function useProductList(filters: ProductListFilters = {}) {
  return useQuery<Product[]>({
    queryKey: queryKeys.productList(filters as Record<string, unknown>),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.category) params.set('category', filters.category)
      if (filters.status) params.set('status', filters.status)
      if (filters.seller_id) params.set('seller_id', String(filters.seller_id))
      const query = params.toString() ? `?${params}` : ''
      return api.get(`/api/products${query}`).then((r) => {
        const arr = Array.isArray(r.data?.data) ? (r.data.data as Product[]) : []
        return arr
      }).catch(() => [] as Product[])
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
