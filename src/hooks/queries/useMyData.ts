/**
 * 🛡️ 2026-05-22 Phase 3: 사용자 자산 hooks (orders / vouchers / appointments).
 *
 * 개인화 데이터 — edge cache X, 클라이언트 cache 만.
 * mutation (주문 / 환불 / voucher 사용) 후 invalidate.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, readCacheOrNull, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

interface MyOrder {
  id: number
  order_number: string
  status: string
  total_amount: number
  created_at: string
  [k: string]: unknown
}

interface MyVoucher {
  id: number
  code: string
  status: string
  product_name?: string
  expires_at?: string
  [k: string]: unknown
}

interface MyAppointment {
  id: number
  status: string
  date: string
  [k: string]: unknown
}

export function useMyOrders(filters?: { status?: string; limit?: number }) {
  const cacheKey = `my-orders:${JSON.stringify(filters ?? {})}`
  return useQuery<MyOrder[]>({
    queryKey: queryKeys.myOrders(filters as Record<string, unknown>),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.limit) params.set('limit', String(filters.limit))
      const q = params.toString() ? `?${params}` : ''
      return api.get(`/api/orders${q}`).then((r) => {
        // 🛡️ 2026-06-01: /api/orders 는 data:{items:[...]} 형태 (배열 아님) — items/orders fallback.
        //   (이전: Array.isArray 만 검사 → 항상 [] 반환하던 잠복 버그. refetchOnMount 잠금은 불변.)
        const d = r.data?.data
        const arr = (Array.isArray(d) ? d : (d?.items || d?.orders || [])) as MyOrder[]
        writeCache(cacheKey, arr)
        return arr
      }).catch((err) => {
        // 🛡️ 2026-07-02: 캐시 있으면 last-known 폴백(오프라인 UX), 없으면 throw → isError.
        //   기존 무조건 [] 폴백은 네트워크 오류를 "주문 0건"으로 위장(에러 UI dead branch).
        const cached = readCacheOrNull<MyOrder[]>(cacheKey)
        if (cached) return cached
        throw err
      })
    },
    initialData: () => readCache<MyOrder[]>(cacheKey, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    // 🛡️ 2026-05-27: voucher 와 동일 안전망 — invalidate 누락 시에도 페이지 진입 시 fresh.
    refetchOnMount: 'always',
  })
}

export function useMyVouchers() {
  return useQuery<MyVoucher[]>({
    queryKey: queryKeys.myVouchers(),
    queryFn: () =>
      api.get('/api/vouchers/my').then((r) => {
        const arr = Array.isArray(r.data?.data) ? (r.data.data as MyVoucher[]) : []
        writeCache('my-vouchers', arr)
        return arr
      }).catch((err) => {
        // 🛡️ 2026-07-02: 캐시 폴백은 존재할 때만 — 없으면 throw → isError (빈 지갑 위장 방지).
        const cached = readCacheOrNull<MyVoucher[]>('my-vouchers')
        if (cached) return cached
        throw err
      }),
    initialData: () => readCache<MyVoucher[]>('my-vouchers', []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    // 🛡️ 2026-05-27: 페이지 진입 시 항상 fresh — invalidate 누락된 발급 경로에 대한 안전망.
    //   사고: voucher 발급 후 /user/profile (직접 fetch) 은 fresh = 1 인데 /my-vouchers (RQ cache stale = 빈 array) 가 empty 표시.
    refetchOnMount: 'always',
  })
}

export function useMyAppointments() {
  return useQuery<MyAppointment[]>({
    queryKey: queryKeys.myAppointments(),
    queryFn: () =>
      api.get('/api/appointments/my').then((r) => {
        const arr = Array.isArray(r.data?.data) ? (r.data.data as MyAppointment[]) : []
        writeCache('my-appointments', arr)
        return arr
      }).catch((err) => {
        // 🛡️ 2026-07-02: 캐시 폴백은 존재할 때만 — 없으면 throw → isError.
        const cached = readCacheOrNull<MyAppointment[]>('my-appointments')
        if (cached) return cached
        throw err
      }),
    initialData: () => readCache<MyAppointment[]>('my-appointments', []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}

// mutation 후 호출 — order / payment / voucher 변경 시.
export function useInvalidateMyOrders() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['my', 'orders'] })
}

export function useInvalidateMyVouchers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.myVouchers() })
}

export function useInvalidateMyAppointments() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.myAppointments() })
}
