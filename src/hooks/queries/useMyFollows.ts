/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 exemplar — 내 단골 셀러 목록 + 알림 매트릭스.
 *
 * 기존 MyFollowsPage 는 useState+useEffect+fetch 수동 패턴(재방문 시 매번 빈 화면→로드).
 * React Query 로 이전:
 *   - 재방문 시 캐시 즉시 표시(staleTime 내 깜빡임 0) + 백그라운드 갱신
 *   - 토글/해제 mutation 의 optimistic update 를 queryClient 캐시에서 일관 처리(롤백 자동)
 *
 * useMyData.ts 컨벤션 따름: queryKeys SSOT / localCache 오프라인 fallback / refetchOnMount:'always'.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface Follow {
  seller_id: number
  seller_name: string
  seller_username: string | null
  seller_avatar: string | null
  notify_new_product: boolean
  notify_live_start: boolean
  notify_group_buy: boolean
  created_at: string
}

export type FollowNotifyKey = 'notify_new_product' | 'notify_live_start' | 'notify_group_buy'

const CACHE_KEY = 'my-follows'

export function useMyFollows() {
  return useQuery<Follow[]>({
    queryKey: queryKeys.myFollows(),
    queryFn: () =>
      api
        .get('/api/seller-public/my/follows')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as Follow[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<Follow[]>(CACHE_KEY, [])),
    initialData: () => readCache<Follow[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}

/**
 * 알림 종류 토글 — optimistic. 실패 시 onError 가 이전 캐시로 롤백.
 */
export function useToggleFollowNotify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sellerId, key, value }: { sellerId: number; key: FollowNotifyKey; value: boolean }) =>
      api.patch(`/api/seller-public/${sellerId}/follow/preferences`, { [key]: value }).then((r) => {
        if (!r.data?.success) throw new Error(r.data?.error || '변경 실패')
        return r.data
      }),
    onMutate: async ({ sellerId, key, value }) => {
      await qc.cancelQueries({ queryKey: queryKeys.myFollows() })
      const prev = qc.getQueryData<Follow[]>(queryKeys.myFollows())
      qc.setQueryData<Follow[]>(queryKeys.myFollows(), (old) =>
        (old ?? []).map((f) => (f.seller_id === sellerId ? { ...f, [key]: value } : f)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.myFollows(), ctx.prev)
    },
  })
}

/**
 * 단골 해제 — optimistic 제거.
 */
export function useUnfollowSeller() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sellerId: number) => api.delete(`/api/seller-public/${sellerId}/follow`),
    onMutate: async (sellerId) => {
      await qc.cancelQueries({ queryKey: queryKeys.myFollows() })
      const prev = qc.getQueryData<Follow[]>(queryKeys.myFollows())
      qc.setQueryData<Follow[]>(queryKeys.myFollows(), (old) => (old ?? []).filter((f) => f.seller_id !== sellerId))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.myFollows(), ctx.prev)
    },
  })
}
