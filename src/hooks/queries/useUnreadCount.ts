/**
 * 🛡️ 2026-05-22: 알림 unread count — 60s stale + dedup.
 *
 * MainHomePage + DesktopTopNav 가 같은 queryKey → 자동 dedup.
 * 60s 자동 refetch (foreground only) — 실시간성 유지하면서 서버 부담 적당히.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

const CACHE_KEY = 'unread-count'

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: queryKeys.unreadCount(),
    queryFn: () =>
      api.get('/api/notifications/unread-count').then((r) => {
        const c = Number(r.data?.data?.count ?? r.data?.count ?? 0)
        const safe = Number.isFinite(c) && c >= 0 ? c : 0
        writeCache(CACHE_KEY, safe)
        return safe
      }).catch(() => readCache<number>(CACHE_KEY, 0)),
    initialData: () => readCache<number>(CACHE_KEY, 0),
    enabled: isLoggedInSync(),
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
}

export function useInvalidateUnreadCount() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.unreadCount() })
}
