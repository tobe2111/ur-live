/**
 * 🛡️ 2026-05-22: 사용자 프로필 — 10분 stale + localStorage.
 *
 * 프로필은 거의 안 바뀜 (이름/사진/이메일). 10분 cache + 변경 시 manual invalidate.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

const CACHE_KEY = 'user-profile'

export interface UserProfile {
  id: string
  email?: string
  name?: string
  phone?: string | null
  avatar_url?: string | null
  role?: string
  profileImage?: string | null
}

export function useUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: queryKeys.userProfile(),
    queryFn: () =>
      api.get('/api/auth/me').then((r) => {
        if (r.data?.success && r.data.data) {
          writeCache(CACHE_KEY, r.data.data)
          return r.data.data as UserProfile
        }
        return null
      }).catch(() => readCache<UserProfile | null>(CACHE_KEY, null)),
    initialData: () => readCache<UserProfile | null>(CACHE_KEY, null),
    enabled: isLoggedInSync(),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useInvalidateUserProfile() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.userProfile() })
}
