/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 관심 맛집/상품 목록 + 삭제.
 * 기존 InterestListPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface InterestItem {
  id: number
  restaurant_name: string
  product_id: number
  type: string
  created_at?: string
}

const CACHE_KEY = 'my-interests'

export function useMyInterests() {
  return useQuery<InterestItem[]>({
    queryKey: queryKeys.myInterests(),
    queryFn: () =>
      api
        .get('/api/interest/my')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as InterestItem[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<InterestItem[]>(CACHE_KEY, [])),
    initialData: () => readCache<InterestItem[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}

export function useRemoveInterest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: InterestItem) =>
      api.post('/api/interest/remove', { product_id: item.product_id, type: item.type }),
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: queryKeys.myInterests() })
      const prev = qc.getQueryData<InterestItem[]>(queryKeys.myInterests())
      qc.setQueryData<InterestItem[]>(queryKeys.myInterests(), (old) =>
        (old ?? []).filter((i) => i.id !== item.id),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.myInterests(), ctx.prev)
    },
  })
}
