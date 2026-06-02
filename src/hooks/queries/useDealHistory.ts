/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 딜 사용 히스토리 (페이지네이션 + 필터).
 * 기존 MyDealHistoryPage 의 수동 useState+useEffect+useCallback(load) → React Query.
 *   - 페이지/필터를 queryKey 로 → 페이지 전환 시 이전 데이터 keepPreviousData 로 깜빡임 0
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { isLoggedInSync } from '@/utils/auth'

export interface Transaction {
  id: number
  type: string
  amount: number
  points_amount: number | null
  balance_after: number | null
  description: string
  order_id: number | null
  created_at: string
}

export interface DealHistoryResult {
  items: Transaction[]
  total: number
}

const PAGE_SIZE = 50

export function useDealHistory(page: number, filter: string) {
  return useQuery<DealHistoryResult>({
    queryKey: queryKeys.dealHistory(page, filter),
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
      if (filter) params.set('type', filter)
      const r = await api.get(`/api/points/history?${params}`)
      if (!r.data?.success) throw new Error('load failed')
      return {
        items: Array.isArray(r.data.data) ? (r.data.data as Transaction[]) : [],
        total: Number(r.data.pagination?.total) || 0,
      }
    },
    enabled: isLoggedInSync(),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
