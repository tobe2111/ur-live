/**
 * 🛡️ 2026-05-22 P1 영구 fix: 어드민 페이지 query hooks.
 *
 * 이전 문제: AdminPage / AdminOrdersPage / AdminOpsInsightsPage 등 10+ 페이지가
 *   직접 `api.get()` 호출 → 페이지 전환 마다 서버 재요청 (cache 없음).
 *   admin 10명 × 페이지 전환 빈도 = 시간당 D1 hit 100+.
 *
 * 영구 해결: React Query staleTime + dedup + invalidation pattern.
 *   같은 admin 가 다른 페이지 진입 시 cache hit (server hit 0).
 *
 * 룰:
 *   - 모든 admin page 는 직접 api.get() 대신 본 hook 사용.
 *   - mutation 후 useInvalidateAdmin* 호출 → cache 자동 무효화.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const KEYS = {
  ops: ['admin', 'ops-insights'] as const,
  sellers: (filter?: string) => ['admin', 'sellers', filter ?? 'all'] as const,
  pendingSellers: () => ['admin', 'sellers', 'pending'] as const,
  users: (filter?: Record<string, unknown>) => ['admin', 'users', filter ?? {}] as const,
  agencies: () => ['admin', 'agencies'] as const,
  agencyApprovals: (status?: string) => ['admin', 'agency-approvals', status ?? 'pending'] as const,
  influencers: () => ['admin', 'influencers'] as const,
  payouts: (filter?: string) => ['admin', 'payouts', filter ?? 'all'] as const,
  commissionRates: () => ['admin', 'commission-rates'] as const,
  cronFailures: () => ['admin', 'cron-failures'] as const,
  alimtalkFailures: () => ['admin', 'alimtalk-failures'] as const,
  disputes: (status?: string) => ['admin', 'disputes', status ?? 'pending'] as const,
} as const

/** 운영 인사이트 (대시보드 메인) — 서버 KV cache 5분 + 클라이언트 5분 stale. */
export function useAdminOpsInsights() {
  return useQuery({
    queryKey: KEYS.ops,
    queryFn: () => api.get('/api/admin/ops-insights').then(r => r.data?.data ?? {}),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminSellers(filter?: string) {
  return useQuery({
    queryKey: KEYS.sellers(filter),
    queryFn: () => {
      const q = filter && filter !== 'all' ? `?status=${encodeURIComponent(filter)}` : ''
      return api.get(`/api/admin/sellers${q}`).then(r => (Array.isArray(r.data?.data) ? r.data.data : []))
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminPendingSellers() {
  return useQuery({
    queryKey: KEYS.pendingSellers(),
    queryFn: () => api.get('/api/admin/sellers/pending').then(r => (Array.isArray(r.data?.data) ? r.data.data : [])),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminAgencies() {
  return useQuery({
    queryKey: KEYS.agencies(),
    queryFn: () => api.get('/api/admin/agencies').then(r => (Array.isArray(r.data?.data) ? r.data.data : [])),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminAgencyApprovals(status: string = 'pending') {
  return useQuery({
    queryKey: KEYS.agencyApprovals(status),
    queryFn: () => api.get(`/api/admin/agency-creator-approvals?status=${encodeURIComponent(status)}`).then(r => (Array.isArray(r.data?.data) ? r.data.data : [])),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminCommissionRates() {
  return useQuery({
    queryKey: KEYS.commissionRates(),
    queryFn: () => api.get('/api/admin/payouts/commission-rates').then(r => r.data?.data ?? {}),
    staleTime: 10 * 60 * 1000,  // 수수료율 자주 안 바뀜
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminCronFailures() {
  return useQuery({
    queryKey: KEYS.cronFailures(),
    queryFn: () => api.get('/api/admin/cron-failures?resolved=0').then(r => (Array.isArray(r.data?.data) ? r.data.data : [])),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,  // 5분마다 background refetch (운영 모니터링)
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
}

export function useAdminAlimtalkFailures() {
  return useQuery({
    queryKey: KEYS.alimtalkFailures(),
    queryFn: () => api.get('/api/admin/alimtalk-failures').then(r => (Array.isArray(r.data?.data) ? r.data.data : [])),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminDisputes(status: string = 'pending') {
  return useQuery({
    queryKey: KEYS.disputes(status),
    queryFn: () => api.get(`/api/admin/disputes?status=${encodeURIComponent(status)}`).then(r => (Array.isArray(r.data?.data) ? r.data.data : [])),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

// ── Invalidators (mutation 후 호출) ─────────────────────────────────────────
export function useInvalidateAdminSellers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin', 'sellers'] })
}
export function useInvalidateAdminAgencies() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin', 'agencies'] })
}
export function useInvalidateAdminAgencyApprovals() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin', 'agency-approvals'] })
}
export function useInvalidateAdminDisputes() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin', 'disputes'] })
}
export function useInvalidateAdminAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin'] })
}
