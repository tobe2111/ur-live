/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 유통스타트(도매 B2B) 읽기 페이지들.
 * seller_token Bearer 인증. 주문/거래내역서/카탈로그/내정보/제안.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { supplierApi, getSupplierToken } from '@/lib/supplier-api'

function sellerAuth(): { headers: Record<string, string> } {
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return { headers: token ? { Authorization: `Bearer ${token}` } : {} }
}

function hasSellerToken(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
}

/**
 * 🏭 2026-06-19 (대표 전수조사 — 로그인/비로그인 UI 섞임 근본수정) 인증 상태 캐시-키 접미사.
 *
 * 게스트/로그인 응답이 **다른**(가격 노출 여부가 다른) 쿼리는 반드시 이 접미사로 캐시 키를 분리해야 함.
 * 안 그러면 게스트로 본 응답(가격 null)이 로그인 후에도 staleTime 동안 남아 '비로그인 UI 고착'.
 * `enabled: hasSellerToken()` 인 쿼리(로그인 전용)는 게스트로 절대 안 돌아 안전 — 이 접미사 불필요.
 * 가격/등급이 응답에 포함되는 dual-mode 쿼리(카탈로그/프리미엄/검색/상세)에만 적용.
 */
export function wholesaleAuthSeg(): 'in' | 'out' {
  return hasSellerToken() ? 'in' : 'out'
}

export interface WholesaleOrderItem {
  product_id: number
  name: string | null
  qty: number
  distributor_unit_price: number
  line_total: number
  supplier_name?: string | null
  option_label?: string | null      // 📦 드랍십: 라인 옵션(상품상세)
  ext_order_no?: string | null       // 판매사 외부 주문번호(참조)
  ship_to_name?: string | null       // 드랍십 라인별 받는사람
  ship_to_message?: string | null
  line_status?: string | null
  courier?: string | null            // 🏭 2026-07-01 라인별 운송장(다제조사/부분발송 — 주문레벨 tracking 은 단일공급자만)
  tracking_number?: string | null
}

export interface WholesaleOrderRow {
  id: number
  toss_order_id?: string
  status: string
  grade: string | null
  subtotal: number
  shipping_total?: number
  grand_total?: number  // subtotal + 배송비 — 예치금 실제 차감액(표시 기준)
  courier?: string | null
  tracking_number?: string | null
  refunded_amount?: number  // 🏭 2026-07-01 (라이브 감사): 부분/전액 환불액 — 판매사도 환불 가시성
  created_at: string
  paid_at?: string | null
  shipped_at?: string | null
  // 🏭 2026-06-29 주문내역 상세화 — 라인아이템 + 배송지(목록 API 가 첨부).
  items?: WholesaleOrderItem[]
  ship_to_name?: string | null
  ship_to_phone?: string | null
  ship_to_address?: string | null
  ship_to_postal?: string | null
  ship_to_message?: string | null
  // 🏭 2026-06-30: 거절/취소 사유 — 제조사 거절(REJECTED) 시 판매사가 사유 확인용.
  reject_reason?: string | null
  cancel_reason?: string | null
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
//   host → mall (없으면 기본 몰 '유통스타트'/#FC5424). 헤더 브랜드명·로고·색·카테고리에 사용.
//   per-host 라서 staleTime 길게(어차피 한 도메인은 한 몰). deposit_account/commission 미노출.
export interface WholesaleMallBrand {
  slug: string
  name: string
  brand_name: string | null
  brand_color: string | null
  logo_url: string | null
  categories: { id: string; label: string }[] | null
}

/** 기본 몰 fallback — config 없거나 로딩 전이면 항상 유통스타트/#FC5424 (default 몰 byte-identical). */
export const DEFAULT_MALL_BRAND: WholesaleMallBrand = {
  slug: 'default',
  name: '유통스타트',
  brand_name: '유통스타트',
  brand_color: '#FC5424',
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
    brandColor: mall.brand_color || '#FC5424',
    logoUrl: mall.logo_url || null,
    categories: mall.categories || null,
    isLoading: q.isLoading,
  }
}

export function useWholesaleOrders() {
  return useQuery<WholesaleOrderRow[]>({
    queryKey: queryKeys.wholesale('orders'),
    // 🛡️ 2026-06-19 (감사): .catch 로 에러를 빈배열로 삼키지 않음 — 전역 retry:1 로 일시 실패 자동 복구.
    //   삼키면 네트워크/5xx 가 '주문 없음'으로 오표시 + staleTime 동안 재시도 0. 소비처는 `data: orders=[]` 안전.
    queryFn: () =>
      api.get('/api/wholesale/orders', sellerAuth()).then((r) => (r.data?.success ? (r.data.orders || []) : [])),
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
        // 🛡️ 2026-06-19 (감사): 에러 삼킴 제거 — retry:1 복구. 소비처 `data?.orders ?? []` 안전.
        .then((r) => (r.data?.success ? { orders: r.data.orders || [], summary: r.data.summary ?? null } : { orders: [], summary: null })),
    // 🏭 2026-06-10 (카탈로그 최속화): idle 이후 지연 가능 — 기본 true(기존 동작 불변).
    enabled: hasSellerToken() && (opts?.enabled ?? true),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useWholesaleCatalog(search: string) {
  return useQuery<WholesaleCatalogItem[]>({
    // 🏭 2026-06-19: 인증별 캐시 분리(게스트 가격 null 이 로그인 후 잔존 방지).
    queryKey: queryKeys.wholesale('catalog', `${search}:${wholesaleAuthSeg()}`),
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      // 🛡️ 2026-06-29 엣지 캐시 인증 누수 차단(상세와 동일): 로그인 요청만 v=in 으로 *엣지 캐시 키*를 비로그인과
      //   분리 → 비로그인 'null 가격' 공유캐시를 로그인 판매사가 절대 안 읽음. 비로그인 URL 은 canonical 유지
      //   (SSR/cron prewarm 키 1:1 보존) — guest 엔 v 미부착. 서버는 v 무시.
      if (wholesaleAuthSeg() === 'in') params.set('v', 'in')
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
  // 🏭 2026-06-19 (대표 신고 — 로그인했는데 상세에 비로그인 UI): 게스트/로그인 응답은 가격이 다르므로
  //   캐시 키를 인증 상태로 분리. 기존엔 한 키를 공유 + staleTime 60s + 로그인 시 무효화 없음 →
  //   게스트로 본 응답(distributor_price=null)이 로그인 후에도 남아 비로그인 UI 고착. 카탈로그 훅은
  //   로그인 시 항상 fresh fetch 하는데 이 훅만 누락된 비대칭이 원인. 키 분리 → 로그인은 'in' 키로 항상 fresh.
  return useQuery<WholesaleProductData>({
    queryKey: queryKeys.wholesale('product', `${id ?? ''}:${wholesaleAuthSeg()}`),
    queryFn: () =>
      api
        // 🛡️ 2026-06-29 (대표 신고 — 상세만 '공급가 미설정' 간헐): 비로그인 상세 응답은 CDN public 300s 캐시인데
        //   CF 캐시 키가 Authorization 을 안 가려 비로그인 'null 가격' 응답이 로그인 판매사에게 서빙됨(목록은
        //   등급별 캐시키라 정상). 인증 구분자(v=in|out)를 URL 에 붙여 *엣지 캐시 키*를 분리 → 로그인은 비로그인
        //   캐시를 절대 안 읽음(서버 캐시 로직/비로그인 성능 불변). 서버는 v 파라미터 무시.
        .get(`/api/wholesale/catalog/${id}?v=${wholesaleAuthSeg()}`, sellerAuth())
        // 🛡️ 2026-06-19 (감사): 에러 삼킴 제거 — retry:1 로 콜드 상세(실측 콜드 1s) 일시 실패 복구. 소비처 `data?.item ?? null` 안전.
        .then((r) => (r.data?.success ? { item: r.data.item, grade: r.data.grade } : { item: null, grade: '' })),
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
  // 🏭 2026-06-30 (판매사 할 일): 수령 확인 대기 발주 수(SHIPPED/PARTIAL_REFUNDED) — 홈 액션 배너용.
  pending_receipt?: number
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
            ? { grade: r.data.grade || '', best: r.data.best || [], new: r.data.new || [], proposals: r.data.proposals || [], categories: r.data.categories || [], pending_receipt: Number(r.data.pending_receipt) || 0 }
            : { grade: '', best: [], new: [], proposals: [], categories: [], pending_receipt: 0 },
        )
        .catch(() => ({ grade: '', best: [], new: [], proposals: [], categories: [], pending_receipt: 0 })),
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

/** 판매사 본인 발행 자료(거래명세서/세금계산서, sales 방향). */
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

// 🏭 2026-06-09 Wave 3c: 거래단위 자동 전자세금계산서(매출 — 플랫폼→판매사).
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

/** 판매사 본인 매출 세금계산서(주문 결제완료 시 자동발행). */
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
        ),
    // 🛡️ 2026-06-19 (감사·머니 중요): 잔액 에러를 ₩0 으로 삼키지 않음 — retry:1 복구. 충전 직후 일시 조회실패가
    //   '잔액 없음'으로 오표시되어 사용자 자산 혼동 + 결제 차단되던 위험 제거. 소비처 `data?.balance` 안전.
    enabled: hasSellerToken(),
    // 💰 2026-06-27 (대표 — 예치금 실시간): 잔액은 돈이라 항상 신선해야 함. 주문/충전 후 즉시 반영되도록
    //   refetchOnMount:'always' + 탭 복귀(focus) 재조회. 주문 성공 시점엔 useInvalidateWholesaleDeposit() 로 즉시 무효화.
    staleTime: 10 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}

/**
 * 🏭 2026-06-29 (통합 셸 Phase 3): 제조사 정산 가용 잔액 — 공용 상단바(WholesaleUtilBar)의 '정산' 칩용.
 *   판매사 예치금(useWholesaleDeposit)에 대응하는 제조사 짝. supplier_token 게이트라 판매사/게스트엔 미실행(영향 0).
 *   /api/supplier/me 의 balance.available_amount(가용 정산금) 사용.
 *   ⚠️ 이 supplier API 호출은 *훅 파일*에 격리 — 공용 바(판매사 storefront 그룹)가 /api/supplier 를 직접
 *      호출하면 crossrole 가드가 막으므로, 바는 이 훅만 호출한다(역할 인지 = supplier_token 있을 때만 fetch).
 */
export interface SupplierBalance { available_amount?: number; pending_amount?: number; paid_amount?: number }
export function useSupplierBalance() {
  return useQuery<SupplierBalance | null>({
    queryKey: ['supplier', 'balance-me'],
    queryFn: async () => {
      const res = await supplierApi.get<{ data?: { balance?: SupplierBalance } }>('/api/supplier/me')
      return res?.data?.balance ?? null
    },
    enabled: typeof window !== 'undefined' && !!getSupplierToken(),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

/**
 * 💰 예치금 잔액 즉시 무효화 훅 — 주문 생성/충전 직후 호출하면 모든 화면(공용 util 바 포함)의
 *   예치금 표시가 실시간으로 갱신된다. (예치금 즉시차감 모델이라 클릭 직후 잔액이 바뀜.)
 */
export function useInvalidateWholesaleDeposit() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-me') })
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-requests') })
  }
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
        // 🛡️ 2026-06-19 (감사): 에러 삼킴 제거 — retry:1 복구. 소비처 `requestsQ.data ?? []` 안전.
        .then((r) => (r.data?.success ? (r.data.requests || []) : [])),
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
//   배너: 공개 GET. 프리미엄: catalog?premium=1. 제안·신고: 판매사 본인 작성/조회.
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
    // 🏭 2026-06-19: 인증별 캐시 분리(게스트 가격 null 이 로그인 후 잔존 방지).
    queryKey: queryKeys.wholesale('catalog', `premium:${wholesaleAuthSeg()}`),
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
export type WholesaleFeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'
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

/** 내 제안/신고 내역 — 판매사 본인 작성분만. */
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
