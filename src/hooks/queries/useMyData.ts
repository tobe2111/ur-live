/**
 * 🛡️ 2026-05-22 Phase 3: 사용자 자산 hooks (orders / vouchers / appointments).
 *
 * 개인화 데이터 — edge cache X, 클라이언트 cache 만.
 * mutation (주문 / 환불 / voucher 사용) 후 invalidate.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
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
        const arr = Array.isArray(r.data?.data) ? (r.data.data as MyOrder[]) : []
        writeCache(cacheKey, arr)
        return arr
      }).catch(() => readCache<MyOrder[]>(cacheKey, []))
    },
    initialData: () => readCache<MyOrder[]>(cacheKey, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
      }).catch(() => readCache<MyVoucher[]>('my-vouchers', [])),
    initialData: () => readCache<MyVoucher[]>('my-vouchers', []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
      }).catch(() => readCache<MyAppointment[]>('my-appointments', [])),
    initialData: () => readCache<MyAppointment[]>('my-appointments', []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
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
