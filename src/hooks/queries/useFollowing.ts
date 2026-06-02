/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 내가 팔로우한 셀러 목록 (read-only).
 * 기존 FollowingPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface FollowedSeller {
  id: number
  name: string
  profile_image: string | null
  bio: string | null
}

const CACHE_KEY = 'following'

export function useFollowing() {
  return useQuery<FollowedSeller[]>({
    queryKey: queryKeys.following(),
    queryFn: () =>
      api
        .get('/api/social/following')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as FollowedSeller[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<FollowedSeller[]>(CACHE_KEY, [])),
    initialData: () => readCache<FollowedSeller[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
