/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 위시리스트 목록 (read-only, auth-implicit endpoint).
 * 기존 WishlistPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface WishlistItem {
  id: number
  user_id: number
  product_id: number
  created_at: string
  product_name: string
  price: number
  original_price: number
  discount_rate: number
  image_url: string
  stock: number
  category: string
  is_active: number
  seller_name: string
  seller_id: number
  deal_only?: number
  /** 🎨 카드 그라데이션용 대표색 (서버 컬럼 — 없으면 클라이언트가 이미지에서 추출) */
  dominant_color?: string | null
  /** 🏪 카드 머천트 줄 (`products.restaurant_name`) */
  restaurant_name?: string | null
  /** ⏳ 공구 마감(`products.group_buy_deadline`) — 마감 임박 표시·정렬 */
  expires_at?: string | null
  group_buy_status?: string | null
  /**
   * 💗 **찜한 그 순간의 가격**(`wishlist_price_notifications.base_price`).
   *   "찜한 뒤 N원 내렸어요"의 기준. 서버 열이 없는 환경에선 그냥 안 내려오고(undefined)
   *   화면은 그 배지만 생략한다 — 없다고 목록이 깨지면 안 된다.
   */
  base_price?: number | null
}

const CACHE_KEY = 'wishlist'

export function useWishlist() {
  return useQuery<WishlistItem[]>({
    queryKey: queryKeys.wishlist(),
    queryFn: () =>
      api
        .get('/api/wishlists')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data?.items) ? r.data.data.items : []) as WishlistItem[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<WishlistItem[]>(CACHE_KEY, [])),
    initialData: () => readCache<WishlistItem[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
