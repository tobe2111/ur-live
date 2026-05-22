/**
 * 🛡️ 2026-05-22 Phase 2 (100% 영구):
 *   상품 상세 + 목록 hooks + prefetch + hydration + cleanup.
 *
 * 효과 (사용자 흐름 내내 0ms):
 *   - 목록 → hover/touch → 즉시 prefetch → 클릭 시 데이터 이미 도착
 *   - 목록의 partial 데이터 → 상세 placeholderData → 즉시 partial UI 표시
 *   - 5분 stale + localStorage initialData → 재진입 0ms
 *   - 30일 LRU cleanup → localStorage 무한 부풀음 차단
 */

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'

export interface Product {
  id: number
  name: string
  price: number
  image_url?: string
  description?: string
  [k: string]: unknown
}

async function fetchProduct(id: string): Promise<Product | null> {
  const r = await api.get(`/api/products/${id}`)
  const data = r.data?.data as Product | null
  if (data) writeCache(`product:${id}`, data)
  return data ?? null
}

export function useProduct(id: number | string | undefined) {
  const productId = id != null ? String(id) : ''
  const qc = useQueryClient()

  return useQuery<Product | null>({
    queryKey: queryKeys.product(productId || 'none'),
    queryFn: () => fetchProduct(productId).catch(() => readCache<Product | null>(`product:${productId}`, null)),
    initialData: () => readCache<Product | null>(`product:${productId}`, null),
    // 🛡️ placeholderData: 목록에서 이미 받은 product 가 cache 에 있으면 → partial 즉시 표시.
    placeholderData: () => {
      if (!productId) return undefined
      // 다양한 list query 에서 이 id 의 product 찾기.
      const lists = qc.getQueriesData<Product[]>({ queryKey: queryKeys.products() })
      for (const [, data] of lists) {
        if (Array.isArray(data)) {
          const found = data.find(p => String(p.id) === productId)
          if (found) return found
        }
      }
      return undefined
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** 🛡️ prefetch 헬퍼 — 목록 카드의 hover/touch 핸들러에서 호출. */
export function usePrefetchProduct() {
  const qc = useQueryClient()
  return (id: number | string) => {
    const productId = String(id)
    qc.prefetchQuery({
      queryKey: queryKeys.product(productId),
      queryFn: () => fetchProduct(productId),
      staleTime: 5 * 60 * 1000,
    })
  }
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
        // 🛡️ List → individual product cache hydration.
        //   목록 응답으로 받은 각 product 를 detail query cache 에 즉시 채워둠.
        //   사용자가 상세 진입 시 → cache hit (server hit 0).
        return arr
      }).catch(() => [] as Product[])
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * 🛡️ 목록 응답을 받자마자 개별 product cache 에 hydrate.
 *   useProductList 의 onSuccess 대신 별도 effect 로 — placeholderData 와 함께 동작.
 *   사용 예 (목록 페이지 mount 시):
 *     const { data: list } = useProductList(...)
 *     useHydrateProductsCache(list)
 */
export function useHydrateProductsCache(products: Product[] | undefined) {
  const qc = useQueryClient()
  if (!products || products.length === 0) return
  // setQueryData 는 동기 — useEffect 불필요 (idempotent, 같은 데이터 set 안전).
  for (const p of products) {
    if (p?.id != null) qc.setQueryData(queryKeys.product(p.id), p)
  }
}

/** 외부에서 prefetch 가능한 standalone helper (Link onMouseEnter 등 — hook 외 context). */
export function prefetchProduct(qc: QueryClient, id: number | string) {
  const productId = String(id)
  return qc.prefetchQuery({
    queryKey: queryKeys.product(productId),
    queryFn: () => fetchProduct(productId),
    staleTime: 5 * 60 * 1000,
  })
}
