/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 유통스타트(도매 B2B) 읽기 페이지들.
 * seller_token Bearer 인증. 주문/거래내역서/카탈로그/내정보/제안.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'

function sellerAuth(): { headers: Record<string, string> } {
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} }
}

function hasSellerToken(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
}

export interface WholesaleOrderRow {
  id: number
  toss_order_id?: string
  status: string
  grade: string | null
  subtotal: number
  courier?: string | null
  tracking_number?: string | null
  created_at: string
  paid_at?: string | null
  shipped_at?: string | null
}

export interface WholesaleSummary {
  count: number
  total_paid: number
  total_refunded: number
  net: number
}

export interface WholesaleCatalogItem {
  id: number
  [k: string]: unknown
}

export function useWholesaleOrders() {
  return useQuery<WholesaleOrderRow[]>({
    queryKey: queryKeys.wholesale('orders'),
    queryFn: () =>
      api.get('/api/wholesale/orders', sellerAuth()).then((r) => (r.data?.success ? (r.data.orders || []) : [])).catch(() => []),
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export interface WholesaleStatementData {
  orders: WholesaleOrderRow[]
  summary: WholesaleSummary | null
}

export function useWholesaleStatement(from: string, to: string) {
  return useQuery<WholesaleStatementData>({
    queryKey: queryKeys.wholesale('statement', `${from}~${to}`),
    queryFn: () =>
      api
        .get(`/api/wholesale/statement?from=${from}&to=${to}`, sellerAuth())
        .then((r) => (r.data?.success ? { orders: r.data.orders || [], summary: r.data.summary ?? null } : { orders: [], summary: null }))
        .catch(() => ({ orders: [], summary: null })),
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useWholesaleCatalog(search: string) {
  return useQuery<WholesaleCatalogItem[]>({
    queryKey: queryKeys.wholesale('catalog', search),
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      return api.get(`/api/wholesale/catalog?${params.toString()}`, sellerAuth()).then((r) => (r.data?.success ? (r.data.items || []) : []))
    },
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useWholesaleMe() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery<any>({
    queryKey: queryKeys.wholesale('me'),
    queryFn: () => api.get('/api/wholesale/me', sellerAuth()).then((r) => (r.data?.success ? r.data : null)),
    enabled: hasSellerToken(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useWholesaleProposals() {
  return useQuery<WholesaleCatalogItem[]>({
    queryKey: queryKeys.wholesale('proposals'),
    queryFn: () =>
      api
        .get('/api/wholesale/proposals', sellerAuth())
        .then((r) =>
          r.data?.success
            ? ((r.data.proposals || []) as Array<{ product_id: number } & WholesaleCatalogItem>).map((p) => ({ ...p, id: p.product_id }))
            : [],
        )
        .catch(() => []),
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
