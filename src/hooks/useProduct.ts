import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

/**
 * 상품 타입 - useProduct hook 및 ProductDetailPage 공통 사용
 * id는 string | number union (DB에 따라 다를 수 있음)
 */
export interface Product {
  /**
   * 📦 2026-08-01 세션 ④-a — 픽업 정보(픽업 공구). **없으면 `null`** → 화면이 블록을 안 그린다.
   * 서버(`products.routes` GET /:id)가 `product_supply_meta` 에서 읽어 동봉한다.
   * 🔴 몰 상품인지로 가르지 않는다 — **있으면 보여준다**(데이터가 결정, 몰 결합 없음).
   */
  pickup?: { date: string | null; place: string | null; storage: 'cold' | 'room' | null } | null
  /**
   * 🏬 2026-08-02 — 상품이 속한 몰. `1`(MAIN_MALL) = 본진 유어딜, 그 외 = 운영자 몰.
   * 상세가 **유어딜 영입 CTA·추천 섹션을 그릴지**를 이 값으로 가른다(대표 UX 기준 ⑤).
   * 🔴 판정은 `isMallProduct()`(shared/mall/resolve) 로만 — 직접 `!== 1` 비교 금지
   *   (`null`/문자열/0 이 섞이면 본진 상품이 몰 상품으로 잘못 잡힌다).
   */
  mall_id?: number | null
  id: string | number
  name: string
  description?: string
  long_description?: string  // ✅ 추가: ProductDetailPage에서 사용
  price: number
  current_price?: number
  original_price?: number
  discount_rate?: number
  image_url: string
  detail_images?: string | string[]  // ✅ 이미 있음
  seller_name?: string
  seller_id?: string | number
  category?: string
  stock?: number
  stock_quantity?: number
  sales_count?: number
  sold_count?: number
  kakao_chat_link?: string
  // 이용권 / 공동구매
  restaurant_name?: string
  restaurant_address?: string
  restaurant_phone?: string
  voucher_expiry?: string
  voucher_terms?: string
  group_buy_target?: number
  group_buy_current?: number
  group_buy_deadline?: string
  group_buy_status?: string
  group_buy_tiers?: unknown
  restaurant_lat?: number
  restaurant_lng?: number
  // 🛡️ 2026-05-19: KT Alpha 직판 상품 마커.
  kt_alpha_gift_code?: string | null
  deal_only?: number      // 1 = 딜 교환 전용
  auto_voucher_send?: number
  // 🛡️ 2026-05-19: 추천 (affiliate) 시스템 — 어드민이 상품별 ON/OFF + 보상률 설정.
  referral_enabled?: number       // 0=OFF / 1=ON
  referral_commission_rate?: number | null  // NULL=platform default 5%
}

export interface ProductOption {
  id: string | number
  product_id?: string | number
  name?: string
  option_type?: string
  option_value?: string
  price_adjustment: number
  stock?: number
  stock_quantity?: number
}

// 🛡️ 2026-05-30 (loading): 워커가 head 에 inject 한 __SSR_INITIAL_PRODUCT__ 를 읽어 즉시 first-paint.
//   id 일치할 때만 사용 (클라 navigate 후 stale slot 오용 방지). slot 없으면 undefined → 정상 fetch.
function readSsrProduct(productId: string | undefined): Product | undefined {
  if (!productId || typeof document === 'undefined') return undefined
  const el = document.getElementById('__SSR_INITIAL_PRODUCT__')
  if (!el?.textContent) return undefined
  try {
    const parsed = JSON.parse(el.textContent)
    const p = (parsed?.data ?? parsed) as Product | undefined
    if (p && String(p.id) === String(productId)) return p
  } catch { /* malformed slot — fall back to fetch */ }
  return undefined
}

// 🎯 상품 상세 조회 Hook
// 🛡️ 2026-05-24 (loading P0): staleTime override 제거 — global default (30분) 적용.
export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID is required')
      const response = await api.get(`/api/products/${productId}`)
      return response.data.data as Product
    },
    enabled: !!productId,
    initialData: () => readSsrProduct(productId),
    // 🛠️ 2026-06-17 (initialData stale 버그 클래스 방어): SSR seed 를 즉시 stale 처리 →
    //   첫 페인트는 SSR 로 0-RTT 유지하되, mount 후 1회 refetch 로 가격/재고 최신화(30분 고착 방지).
    initialDataUpdatedAt: 0,
  })
}

// 🎯 상품 옵션 조회 Hook
export function useProductOptions(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-options', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID is required')
      const response = await api.get(`/api/products/${productId}/options`)
      // 🛡️ 2026-07-02 (쇼핑 전수조사): 서버는 data:[배열] 직반환 — 이전엔 data.data.options(항상 undefined)
      //   를 읽어 옵션이 상세 페이지에서 절대 로드되지 않았음(옵션 상품 구매 자체 불가).
      const data = response.data?.data
      return (Array.isArray(data) ? data : (data?.options ?? [])) as ProductOption[]
    },
    enabled: !!productId,
  })
}

// 🎯 상품 목록 조회 Hook (HomePage용)
export function useProducts(params?: { category?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params?.category) queryParams.append('category', params.category)
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())

      const url = `/api/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await api.get(url)
      return response.data.data.products as Product[]
    },
  })
}
