import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

/**
 * 상품 타입 - useProduct hook 및 ProductDetailPage 공통 사용
 * id는 string | number union (DB에 따라 다를 수 있음)
 */
export interface Product {
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
  // 식사권 / 공동구매
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

// 🎯 상품 상세 조회 Hook
export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID is required')
      const response = await api.get(`/api/products/${productId}`)
      // ✅ API 응답: {success: true, data: {...product}}
      return response.data.data as Product
    },
    enabled: !!productId, // productId가 있을 때만 실행
    staleTime: 5 * 60 * 1000, // 5분간 캐시
  })
}

// 🎯 상품 옵션 조회 Hook
export function useProductOptions(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-options', productId],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID is required')
      const response = await api.get(`/api/products/${productId}/options`)
      return (response.data.data.options || []) as ProductOption[]
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000, // 5분간 캐시
    gcTime: 30 * 60 * 1000,   // 30분 후 메모리 해제
  })
}
