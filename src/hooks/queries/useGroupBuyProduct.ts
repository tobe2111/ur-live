/**
 * 🛡️ 2026-05-22 Phase 2: 공구 상품 상세 + 목록 hooks (useProduct 와 동일 패턴).
 */

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { writeCache, cachedInitialData, cacheOrRethrow } from './localCache'

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
    queryFn: () => fetchGroupBuyProduct(productId).catch((err) => cacheOrRethrow<GroupBuyProduct | null>(`gb:${productId}`, err)),
    initialData: () => cachedInitialData<GroupBuyProduct>(`gb:${productId}`),
    // 🛠️ 2026-06-17 (근본수정): 캐시 seed 즉시 stale → cold mount 1회 서버 보정(SSR 0-RTT paint 무관).
    initialDataUpdatedAt: 0,
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

/**
 * 🖼️ 2026-10-31 (대표 "이용권 페이지도 새로고침을 해야 사진 여러장이 보이는 문제"): 목록 행으로 상세 캐시를 **미리 채운다**.
 *
 * 목록 행은 상세의 **부분 사본**이다 — 사진은 서버가 카드용으로 최대 3장만 싣고 설명·상품 구성도 없다.
 * 그런데 종전엔 `setQueryData` 로 **지금 받은 것처럼**(updatedAt=now) 넣었고, 상세의 `fetchQuery`(staleTime 60s)·
 * 카드 미리받기(5분)가 그걸 신선한 상세로 믿어 **다시 받지 않았다** → 새로고침해야 사진이 다 보였다.
 * ⇒ ① `updatedAt: 0` 으로 넣어 첫 그림에만 쓰고 상세가 반드시 다시 받게 한다 ② 이미 있는 값(진짜 상세일 수 있다)은 덮지 않는다.
 */
export function seedDetailFromListRow<T extends { id?: number | string | null }>(qc: QueryClient, p: T | null | undefined) {
  if (p?.id == null) return
  const key = queryKeys.groupBuyProduct(p.id)
  if (qc.getQueryData(key) !== undefined) return
  qc.setQueryData(key, p, { updatedAt: 0 })
}

export function useHydrateGroupBuyCache(products: GroupBuyProduct[] | undefined) {
  const qc = useQueryClient()
  if (!products || products.length === 0) return
  for (const p of products) seedDetailFromListRow(qc, p)
}
