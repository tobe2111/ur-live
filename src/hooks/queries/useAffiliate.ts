/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 어필리에이트 대시보드 3개 섹션(독립 컴포넌트별 fetch).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { isLoggedInSync } from '@/utils/auth'

export interface AffiliateTopGroup {
  id: number
  name: string
  image_url?: string
  price: number
  restaurant_name?: string
  group_buy_target: number
  group_buy_current: number
  group_buy_deadline?: string
  progress_pct: number
  my_potential_bonus: number
  share_url: string
}

export interface AffiliateFunnel {
  total_referrals: number
  total_earned: number
  by_category: Array<{ category: string; count: number; earned: number }>
  daily: Array<{ day: string; count: number; earned: number }>
}

export function useAffiliateStats() {
  // 기존 useState<any> 와 동일 — stats 응답은 필드가 많고 느슨하게 소비됨.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery<any>({
    queryKey: queryKeys.affiliate('stats'),
    queryFn: () =>
      api.get('/api/affiliate/stats').then((r) => (r.data?.success ? r.data.data : null)),
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAffiliateTopGroups() {
  return useQuery<AffiliateTopGroup[]>({
    queryKey: queryKeys.affiliate('top-groups'),
    queryFn: () =>
      api.get('/api/affiliate/top-groups').then((r) => (r.data?.success ? (r.data.data || []) : [])).catch(() => []),
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAffiliateFunnel() {
  return useQuery<AffiliateFunnel | null>({
    queryKey: queryKeys.affiliate('funnel'),
    queryFn: () =>
      api.get('/api/affiliate/funnel').then((r) => (r.data?.success ? r.data.data : null)).catch(() => null),
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
