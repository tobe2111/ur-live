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

/** 🏭 2026-06-07: 커뮤니티(맛집) 공구 상세 — /api/community-group-buy/detail/:code 응답. */
export interface CommunityGroupBuy {
  id: number
  invite_code: string
  creator_name: string
  restaurant_name: string
  restaurant_address?: string | null
  restaurant_phone?: string | null
  proposed_price: number
  confirmed_price?: number | null
  deposit_per_person: number
  target_count: number
  current_count: number
  total_deposited: number
  status: string
  description?: string | null
  expires_at?: string | null
  members: Member[]
}

export interface ReferralData {
  group: ReferralGroup | null
  product: ProductInfo | null
  community: CommunityGroupBuy | null
}

export function useReferral(code: string | undefined) {
  return useQuery<ReferralData>({
    queryKey: queryKeys.referral(code ?? ''),
    queryFn: async () => {
      const r = await api.get(`/api/referral/${code}`).catch(() => null)
      if (r?.data?.success) {
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
        return { group, product, community: null }
      }
      // 🏭 2026-06-07: referral 그룹이 아니면 커뮤니티(맛집) 공구 초대코드로 재조회.
      //   동일 라우트(/community-group-buy/:code)가 두 종류 공구를 모두 서빙.
      try {
        const cg = await api.get(`/api/community-group-buy/detail/${code}`)
        if (cg.data?.success && cg.data.data) {
          return { group: null, product: null, community: cg.data.data as CommunityGroupBuy }
        }
      } catch {
        /* 둘 다 없으면 not-found 처리 */
      }
      return { group: null, product: null, community: null }
    },
    enabled: !!code,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
