/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 알림 목록 + 읽음 처리.
 *
 * 기존 NotificationsPage 는 수동 useState+useEffect+fetch.
 * React Query 로 이전 + 보너스: 읽음 처리 mutation 이 unreadCount(벨 배지) 를 invalidate
 *   → 알림 읽으면 헤더/홈의 안 읽은 개수 배지가 자동 갱신(기존엔 페이지 재방문해야 갱신됐음).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface NotificationItem {
  id: number
  type: string
  title: string
  message?: string
  link?: string
  is_read: number
  created_at: string
}

const CACHE_KEY = 'notifications'

export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: queryKeys.notifications(),
    queryFn: () =>
      api
        .get('/api/social/notifications')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as NotificationItem[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<NotificationItem[]>(CACHE_KEY, [])),
    initialData: () => readCache<NotificationItem[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.put('/api/social/notifications/read-all'),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.notifications() })
      const prev = qc.getQueryData<NotificationItem[]>(queryKeys.notifications())
      qc.setQueryData<NotificationItem[]>(queryKeys.notifications(), (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: 1 })),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.notifications(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.unreadCount() }),
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.put(`/api/social/notifications/${id}/read`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.notifications() })
      const prev = qc.getQueryData<NotificationItem[]>(queryKeys.notifications())
      qc.setQueryData<NotificationItem[]>(queryKeys.notifications(), (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.notifications(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.unreadCount() }),
  })
}
