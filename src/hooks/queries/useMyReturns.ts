/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 내 반품 목록 + 회수 송장 등록 후 캐시 갱신.
 * 기존 MyReturnsPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface ReturnRecord {
  id: number
  order_id: number | null
  order_number: string
  status: string
  reason: string
  detail_reason: string | null
  return_shipping_company: string | null
  return_tracking_number: string | null
  inspection_result: string | null
  refund_amount: number | null
  requested_at: string
  shipped_at: string | null
  inspected_at: string | null
  refunded_at: string | null
  order_total: number | null
  order_status: string | null
}

const CACHE_KEY = 'my-returns'

export function useMyReturns() {
  return useQuery<ReturnRecord[]>({
    queryKey: queryKeys.myReturns(),
    queryFn: () =>
      api
        .get('/api/returns/my')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as ReturnRecord[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<ReturnRecord[]>(CACHE_KEY, [])),
    initialData: () => readCache<ReturnRecord[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}

/**
 * 회수 송장 등록 성공 후 해당 반품을 shipped 로 캐시 반영(전체 재요청 없이).
 */
export function useApplyReturnTracking() {
  const qc = useQueryClient()
  return (returnId: number, carrier: string, trackingNumber: string) => {
    qc.setQueryData<ReturnRecord[]>(queryKeys.myReturns(), (old) =>
      (old ?? []).map((x) =>
        x.id === returnId
          ? {
              ...x,
              status: 'shipped',
              return_shipping_company: carrier,
              return_tracking_number: trackingNumber,
              shipped_at: new Date().toISOString(),
            }
          : x,
      ),
    )
  }
}
