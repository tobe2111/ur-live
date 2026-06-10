/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 유통스타트(도매 B2B) 읽기 페이지들.
 * seller_token Bearer 인증. 주문/거래내역서/카탈로그/내정보/제안.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

// ── 🏬 2026-06-09 멀티-몰 테넌시 — 현재 호스트의 몰 브랜딩 (PUBLIC) ────────────────
//   host → mall (없으면 기본 몰 '유통스타트'/#FF0033). 헤더 브랜드명·로고·색·카테고리에 사용.
//   per-host 라서 staleTime 길게(어차피 한 도메인은 한 몰). deposit_account/commission 미노출.
export interface WholesaleMallBrand {
  slug: string
  name: string
  brand_name: string | null
  brand_color: string | null
  logo_url: string | null
  categories: { id: string; label: string }[] | null
}

/** 기본 몰 fallback — config 없거나 로딩 전이면 항상 유통스타트/#FF0033 (default 몰 byte-identical). */
export const DEFAULT_MALL_BRAND: WholesaleMallBrand = {
  slug: 'default',
  name: '유통스타트',
  brand_name: '유통스타트',
  brand_color: '#FF0033',
  logo_url: null,
  categories: null,
}

export function useWholesaleMall() {
  const q = useQuery<WholesaleMallBrand>({
    queryKey: queryKeys.wholesale('mall'),
    queryFn: () =>
      api
        .get('/api/wholesale/mall')
        .then((r) => (r.data?.success && r.data.mall ? (r.data.mall as WholesaleMallBrand) : DEFAULT_MALL_BRAND))
        .catch(() => DEFAULT_MALL_BRAND),
    staleTime: 30 * 60 * 1000, // per-host — 한 도메인은 한 몰. 길게 캐시.
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  // 항상 sensible fallback (로딩 중/에러여도 유통스타트 기본값) — 헤더가 절대 비지 않음.
  const mall = q.data ?? DEFAULT_MALL_BRAND
  return {
    mall,
    // 표시용 편의 — brand_name 우선, 없으면 name, 둘 다 없으면 유통스타트.
    displayName: mall.brand_name || mall.name || '유통스타트',
    brandColor: mall.brand_color || '#FF0033',
    logoUrl: mall.logo_url || null,
    categories: mall.categories || null,
    isLoading: q.isLoading,
  }
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

export function useWholesaleStatement(from: string, to: string, opts?: { enabled?: boolean }) {
  return useQuery<WholesaleStatementData>({
    queryKey: queryKeys.wholesale('statement', `${from}~${to}`),
    queryFn: () =>
      api
        .get(`/api/wholesale/statement?from=${from}&to=${to}`, sellerAuth())
        .then((r) => (r.data?.success ? { orders: r.data.orders || [], summary: r.data.summary ?? null } : { orders: [], summary: null }))
        .catch(() => ({ orders: [], summary: null })),
    // 🏭 2026-06-10 (카탈로그 최속화): idle 이후 지연 가능 — 기본 true(기존 동작 불변).
    enabled: hasSellerToken() && (opts?.enabled ?? true),
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
    // 🏭 2026-06-04 몰-first: 비로그인도 카탈로그 둘러보기 가능(가격은 서버가 null 로 가림).
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export interface WholesaleProductData {
  item: (WholesaleCatalogItem & {
    name: string
    description: string | null
    image_url: string | null
    category: string | null
    stock: number
    distributor_price: number
  }) | null
  grade: string
}

export function useWholesaleProduct(id: string | undefined) {
  return useQuery<WholesaleProductData>({
    queryKey: queryKeys.wholesale('product', id ?? ''),
    queryFn: () =>
      api
        .get(`/api/wholesale/catalog/${id}`, sellerAuth())
        .then((r) => (r.data?.success ? { item: r.data.item, grade: r.data.grade } : { item: null, grade: '' }))
        .catch(() => ({ item: null, grade: '' })),
    // 🏭 2026-06-04 몰-first: 비로그인도 상품 상세 열람 가능(가격 null).
    enabled: !!id,
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

export interface WholesaleHomeData {
  grade: string
  best: WholesaleCatalogItem[]
  new: WholesaleCatalogItem[]
  proposals: WholesaleCatalogItem[]
  categories: { key: string; count: number }[]
}

/** 도매몰 홈 한 번에 (베스트/신상품/추천제안/카테고리). 시안 홈의 섹션 레일용. */
export function useWholesaleHome() {
  return useQuery<WholesaleHomeData>({
    queryKey: queryKeys.wholesale('home'),
    queryFn: () =>
      api
        .get('/api/wholesale/home', sellerAuth())
        .then((r) =>
          r.data?.success
            ? { grade: r.data.grade || '', best: r.data.best || [], new: r.data.new || [], proposals: r.data.proposals || [], categories: r.data.categories || [] }
            : { grade: '', best: [], new: [], proposals: [], categories: [] },
        )
        .catch(() => ({ grade: '', best: [], new: [], proposals: [], categories: [] })),
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export interface WholesaleReorderItem {
  id: number; name: string; image_url: string | null; stock: number
  distributor_price: number; retail_price: number | null; moq?: number; last_qty: number; last_date: string
}

/** 빠른 재주문 — 최근 사입한 상품 + 마지막 수량. */
export function useWholesaleRecentItems(opts?: { enabled?: boolean }) {
  return useQuery<WholesaleReorderItem[]>({
    queryKey: queryKeys.wholesale('recent-items'),
    queryFn: () =>
      api.get('/api/wholesale/recent-items', sellerAuth()).then((r) => (r.data?.success ? (r.data.items || []) : [])).catch(() => []),
    // 🏭 2026-06-10 (카탈로그 최속화): 호출부가 idle 이후로 미룰 수 있게 enabled 옵션 — 기본 true(기존 동작 불변).
    enabled: hasSellerToken() && (opts?.enabled ?? true),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export interface WholesaleDocRow {
  id: number; doc_type: string; period_month: string; party_name: string | null
  supply_amount: number; vat_amount: number; total_amount: number; order_count: number
  status: string; issued_at: string | null; nts_confirm_num: string | null
}

/** 유통사 본인 발행 자료(거래명세서/세금계산서, sales 방향). */
export function useWholesaleDocuments() {
  return useQuery<WholesaleDocRow[]>({
    queryKey: queryKeys.wholesale('documents'),
    queryFn: () =>
      api.get('/api/wholesale/documents', sellerAuth()).then((r) => (r.data?.success ? (r.data.documents || []) : [])).catch(() => []),
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// 🏭 2026-06-09 Wave 3c: 거래단위 자동 전자세금계산서(매출 — 플랫폼→유통사).
export interface WholesaleTaxInvoiceRow {
  id: number
  order_id: number
  type: string
  supply_amount: number
  vat_amount: number
  total_amount: number
  status: string // draft | issued | failed
  provider_ref: string | null
  issued_at: string | null
  created_at: string
}

/** 유통사 본인 매출 세금계산서(주문 결제완료 시 자동발행). */
export function useWholesaleTaxInvoices() {
  return useQuery<WholesaleTaxInvoiceRow[]>({
    queryKey: queryKeys.wholesale('tax-invoices'),
    queryFn: () =>
      api.get('/api/wholesale/tax-invoices', sellerAuth()).then((r) => (r.data?.success ? (r.data.invoices || []) : [])).catch(() => []),
    enabled: hasSellerToken(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// ──────────────────────────────────────────────────────────────
// 🏦 2026-06-09 도매몰 예치금(선불 충전) — Toss 대체 결제수단.
//   잔액 + 거래내역 + 충전신청내역. seller_token Bearer.
// ──────────────────────────────────────────────────────────────
export type WholesaleDepositTxnType = 'charge' | 'order' | 'refund' | 'adjust'
export interface WholesaleDepositTxn {
  type: WholesaleDepositTxnType
  amount: number // signed
  balance_after: number
  memo: string | null
  created_at: string
}
export interface WholesaleDepositMe {
  balance: number
  deposit_account: string | null
  recent_txns: WholesaleDepositTxn[]
}

/** 내 예치금 잔액 + 입금계좌 + 최근 거래내역. */
export function useWholesaleDeposit() {
  return useQuery<WholesaleDepositMe>({
    queryKey: queryKeys.wholesale('deposit-me'),
    queryFn: () =>
      api
        .get('/api/wholesale/deposits/me', sellerAuth())
        .then((r) =>
          r.data?.success
            ? {
                balance: Number(r.data.balance) || 0,
                deposit_account: r.data.deposit_account ?? null,
                recent_txns: (r.data.recent_txns || []) as WholesaleDepositTxn[],
              }
            : { balance: 0, deposit_account: null, recent_txns: [] },
        )
        .catch(() => ({ balance: 0, deposit_account: null, recent_txns: [] })),
    enabled: hasSellerToken(),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export type WholesaleChargeStatus = 'pending' | 'confirmed' | 'rejected'
export interface WholesaleChargeRequest {
  id: number
  amount: number
  depositor_name: string
  status: WholesaleChargeStatus
  created_at: string
  confirmed_at: string | null
}

/** 내 충전 신청 내역. */
export function useWholesaleChargeRequests() {
  return useQuery<WholesaleChargeRequest[]>({
    queryKey: queryKeys.wholesale('deposit-requests'),
    queryFn: () =>
      api
        .get('/api/wholesale/deposits/requests', sellerAuth())
        .then((r) => (r.data?.success ? (r.data.requests || []) : []))
        .catch(() => []),
    enabled: hasSellerToken(),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** 충전 신청(입금 예정). 성공 후 잔액/신청내역 invalidate. */
export function useWholesaleChargeRequestMutation() {
  const qc = useQueryClient()
  return useMutation<
    { success: boolean; request_id?: number; status?: string },
    unknown,
    { amount: number; depositor_name: string }
  >({
    mutationFn: (body) =>
      api.post('/api/wholesale/deposits/charge-request', body, sellerAuth()).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-requests') })
      qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-me') })
    },
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

// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 2 도매몰 메인 리디자인 — 배너 캐러셀 / 프리미엄 전용관 / 제안·신고.
//   배너: 공개 GET. 프리미엄: catalog?premium=1. 제안·신고: 유통사 본인 작성/조회.
// ──────────────────────────────────────────────────────────────

export interface WholesaleBanner {
  id: number
  image_url: string
  link: string | null
  title: string | null
  sort: number
}

/** 메인 배너 캐러셀 — 공개(비로그인 노출). active 배너만 서버가 반환. */
export function useWholesaleBanners() {
  return useQuery<WholesaleBanner[]>({
    queryKey: queryKeys.wholesale('banners'),
    queryFn: () =>
      api
        .get('/api/wholesale/banners')
        .then((r) => (r.data?.success ? ((r.data.banners || []) as WholesaleBanner[]) : []))
        .catch(() => []),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** 프리미엄 전용관 카탈로그 — is_premium=1 필터. catalog 와 동일 응답 shape. */
export function useWholesalePremiumCatalog(enabled = true) {
  return useQuery<WholesaleCatalogItem[]>({
    queryKey: queryKeys.wholesale('catalog', 'premium'),
    queryFn: () =>
      api
        .get('/api/wholesale/catalog?premium=1', sellerAuth())
        .then((r) => (r.data?.success ? ((r.data.items || []) as WholesaleCatalogItem[]) : []))
        .catch(() => []),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export type WholesaleFeedbackType = 'proposal' | 'report'
export type WholesaleFeedbackStatus = 'open' | 'in_review' | 'resolved' | 'rejected'
export interface WholesaleFeedback {
  id: number
  type: WholesaleFeedbackType
  target: string | null
  subject: string
  body: string
  status: WholesaleFeedbackStatus
  admin_memo: string | null
  created_at: string
  resolved_at: string | null
}

/** 내 제안/신고 내역 — 유통사 본인 작성분만. */
export function useWholesaleFeedbacks() {
  return useQuery<WholesaleFeedback[]>({
    queryKey: queryKeys.wholesale('feedbacks'),
    queryFn: () =>
      api
        .get('/api/wholesale/proposal-tickets', sellerAuth())
        .then((r) => (r.data?.success ? ((r.data.proposals || r.data.items || []) as WholesaleFeedback[]) : []))
        .catch(() => []),
    enabled: hasSellerToken(),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** 제안/신고 제출. 성공 후 내 내역 invalidate. */
export function useWholesaleFeedbackMutation() {
  const qc = useQueryClient()
  return useMutation<
    { success: boolean; error?: string },
    unknown,
    { type: WholesaleFeedbackType; target?: string; subject: string; body: string }
  >({
    mutationFn: (body) =>
      api.post('/api/wholesale/proposal-tickets', body, sellerAuth()).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wholesale('feedbacks') })
    },
  })
}

// ── 👥 2026-06-09 직원 서브계정 ────────────────────────────────────────────────
export type WholesaleSubRole = 'admin' | 'staff' | 'viewer'
export interface WholesaleSubAccount {
  id: number
  email: string
  name: string | null
  role: WholesaleSubRole
  active: number
  created_at: string
  last_login_at: string | null
}

/** 본 회사 직원 목록 (owner/admin 토큰만 200, staff/viewer 는 403 → []). */
export function useWholesaleSubAccounts(enabled = true) {
  return useQuery<WholesaleSubAccount[]>({
    queryKey: queryKeys.wholesale('sub-accounts'),
    queryFn: () =>
      api.get('/api/wholesale/sub-accounts', sellerAuth()).then((r) => (r.data?.success ? (r.data.items || []) : [])).catch(() => []),
    enabled: enabled && hasSellerToken(),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** 직원 계정 생성. */
export function useCreateWholesaleSubAccount() {
  const qc = useQueryClient()
  return useMutation<
    { success: boolean; error?: string },
    unknown,
    { email: string; password: string; name: string; role: WholesaleSubRole }
  >({
    mutationFn: (body) => api.post('/api/wholesale/sub-accounts', body, sellerAuth()).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.wholesale('sub-accounts') }) },
  })
}

/** 직원 역할/활성 변경. */
export function useUpdateWholesaleSubAccount() {
  const qc = useQueryClient()
  return useMutation<
    { success: boolean; error?: string },
    unknown,
    { id: number; role?: WholesaleSubRole; active?: number }
  >({
    mutationFn: ({ id, ...body }) => api.patch(`/api/wholesale/sub-accounts/${id}`, body, sellerAuth()).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.wholesale('sub-accounts') }) },
  })
}

/** 직원 계정 삭제. */
export function useDeleteWholesaleSubAccount() {
  const qc = useQueryClient()
  return useMutation<{ success: boolean; error?: string }, unknown, number>({
    mutationFn: (id) => api.delete(`/api/wholesale/sub-accounts/${id}`, sellerAuth()).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.wholesale('sub-accounts') }) },
  })
}
