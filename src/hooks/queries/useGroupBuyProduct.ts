/**
 * 🛡️ 2026-05-22 Phase 2: 공구 상품 상세 + 목록 hooks (useProduct 와 동일 패턴).
 */

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'

export interface GroupBuyProduct {
  id: number
  name: string
  price: number
  image_url?: string
  category?: string
  group_buy_current?: number
  group_buy_target?: number
  group_buy_status?: string
  group_buy_deadline?: string
  [k: string]: unknown
}

async function fetchGroupBuyProduct(id: string): Promise<GroupBuyProduct | null> {
  const r = await api.get(`/api/group-buy/products/${id}`)
  const data = r.data?.data as GroupBuyProduct | null
  if (data) writeCache(`gb:${id}`, data)
  return data ?? null
}

export function useGroupBuyProduct(id: number | string | undefined) {
  const productId = id != null ? String(id) : ''
  const qc = useQueryClient()

  return useQuery<GroupBuyProduct | null>({
    queryKey: queryKeys.groupBuyProduct(productId || 'none'),
    queryFn: () => fetchGroupBuyProduct(productId).catch(() => readCache<GroupBuyProduct | null>(`gb:${productId}`, null)),
    initialData: () => readCache<GroupBuyProduct | null>(`gb:${productId}`, null),
    placeholderData: () => {
      if (!productId) return undefined
      const lists = qc.getQueriesData<GroupBuyProduct[]>({ queryKey: queryKeys.groupBuy() })
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

export function usePrefetchGroupBuyProduct() {
  const qc = useQueryClient()
  return (id: number | string) => prefetchGroupBuyProduct(qc, id)
}

export function prefetchGroupBuyProduct(qc: QueryClient, id: number | string) {
  const productId = String(id)
  return qc.prefetchQuery({
    queryKey: queryKeys.groupBuyProduct(productId),
    queryFn: () => fetchGroupBuyProduct(productId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useHydrateGroupBuyCache(products: GroupBuyProduct[] | undefined) {
  const qc = useQueryClient()
  if (!products || products.length === 0) return
  for (const p of products) {
    if (p?.id != null) qc.setQueryData(queryKeys.groupBuyProduct(p.id), p)
  }
}
