/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 추천(공동구매 초대) 그룹 단건 + 상품 hydration.
 * 기존 ReferralPage 의 fetchGroup(그룹 + 상품 2-fetch) → 단일 useQuery. join 후 refetch.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'

export interface Tier { count: number; discount: number }
export interface Member { user_name: string; joined_at: string }

export interface ReferralGroup {
  invite_code: string
  creator_name: string
  product_id: number
  current_count: number
  target_count: number
  discount_percent: number
  tiers: Tier[]
  unlocked_tier: Tier | null
  next_tier: Tier | null
  expires_at: string
  status: 'open' | 'achieved' | 'expired'
  members: Member[]
}

export interface ProductInfo {
  id: number
  name: string
  price: number
  image_url?: string
}

export interface ReferralData {
  group: ReferralGroup | null
  product: ProductInfo | null
}

export function useReferral(code: string | undefined) {
  return useQuery<ReferralData>({
    queryKey: queryKeys.referral(code ?? ''),
    queryFn: async () => {
      const r = await api.get(`/api/referral/${code}`)
      if (!r.data?.success) return { group: null, product: null }
      const group = r.data.data as ReferralGroup
      let product: ProductInfo | null = null
      if (group.product_id) {
        try {
          const p = await api.get(`/api/group-buy/products/${group.product_id}`)
          if (p.data?.success) {
            const prod = p.data.data
            product = { id: prod.id, name: prod.name, price: prod.price, image_url: prod.image_url || prod.thumbnail_url }
          }
        } catch {
          /* 상품 조회 실패해도 그룹은 표시 */
        }
      }
      return { group, product }
    },
    enabled: !!code,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
