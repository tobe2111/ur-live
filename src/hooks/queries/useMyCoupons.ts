/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 내 쿠폰 목록 (read-only).
 * 기존 MyCouponsPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, readCacheOrNull, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface Coupon {
  id: number
  code: string
  name: string
  type: 'fixed' | 'percent'
  value: number
  min_order_amount: number
  max_discount: number | null
  expires_at: string | null
}

const CACHE_KEY = 'my-coupons'

export function useMyCoupons() {
  return useQuery<Coupon[]>({
    queryKey: queryKeys.myCoupons(),
    queryFn: () =>
      api
        .get('/api/coupons/my')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as Coupon[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch((err) => {
          // 🛡️ 2026-07-02: 캐시 폴백은 존재할 때만 — 없으면 throw → isError (빈 목록 위장 방지).
          const cached = readCacheOrNull<Coupon[]>(CACHE_KEY)
          if (cached) return cached
          throw err
        }),
    initialData: () => readCache<Coupon[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
