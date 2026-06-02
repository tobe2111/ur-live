/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 내 숙소 예약 목록 (read; cancel/review 후 refetch).
 * 기존 MyStaysPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface MyBooking {
  id: number
  product_id: number
  product_name: string
  room_id: number
  room_name: string
  image_url: string | null
  check_in_date: string | null
  check_out_date: string | null
  nights: number
  guest_count: number
  total_amount: number
  status: string
  check_in_code: string | null
  created_at: string
  sale_mode?: 'date' | 'voucher'
  voucher_type?: 'weekday' | 'weekend' | null
  voucher_expires_at?: string | null
  voucher_used_at?: string | null
}

const CACHE_KEY = 'my-stays'

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('access_token') || localStorage.getItem('firebase_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useMyStays() {
  return useQuery<MyBooking[]>({
    queryKey: queryKeys.myStays(),
    queryFn: () =>
      api
        .get('/api/group-buy/stays/my-bookings', { headers: authHeader() })
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as MyBooking[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<MyBooking[]>(CACHE_KEY, [])),
    initialData: () => readCache<MyBooking[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
