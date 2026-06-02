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
