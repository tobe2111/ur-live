/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 내 공동구매 (추천 그룹 + 교환권 + 커뮤니티 공구).
 *
 * 기존 MyGroupBuysPage 는 useEffect 안에서 3개 엔드포인트 Promise.allSettled +
 * 추천 그룹의 상품정보 hydration 을 직접 수행(수동 4 state).
 * → 전체 로드 로직을 단일 useQuery queryFn 으로 캡슐화(동작 동일, 캐싱 추가).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { isLoggedInSync } from '@/utils/auth'

export interface Tier { count: number; discount: number }

export interface ReferralGroup {
  id: number | string
  invite_code: string
  product_id: number
  creator_user_id: number | string
  creator_name: string
  current_count: number
  target_count: number
  discount_percent: number
  tiers?: Tier[]
  unlocked_tier?: Tier | null
  expires_at: string
  status: 'open' | 'achieved' | 'expired' | 'cancelled'
  is_creator: boolean
}

export interface VoucherEntry {
  id: number
  code: string
  product_id: number
  status: 'unused' | 'used' | 'expired' | 'refunded'
  used_at?: string | null
  expires_at?: string | null
  created_at: string
  product_name?: string
  restaurant_name?: string
  product_image?: string
}

export interface CommunityGroupBuy {
  id: number
  invite_code?: string
  creator_user_id: string | number
  creator_name: string
  restaurant_name: string
  proposed_price: number
  deposit_per_person: number
  target_count: number
  current_count: number
  status: 'proposed' | 'negotiating' | 'confirmed' | 'achieved' | 'failed' | 'refunded'
  confirmed_price?: number
  confirmed_discount_percent?: number
  expires_at?: string
  created_at: string
  my_status?: string
}

export interface ProductInfo {
  id: number
  name: string
  image_url?: string
  thumbnail_url?: string
}

export interface MyGroupBuysData {
  referralGroups: ReferralGroup[]
  vouchers: VoucherEntry[]
  community: CommunityGroupBuy[]
  products: Record<number, ProductInfo>
}

async function fetchMyGroupBuys(): Promise<MyGroupBuysData> {
  // 3 endpoints in parallel — 하나 실패해도 페이지가 비지 않도록 allSettled
  const [refRes, vouRes, comRes] = await Promise.allSettled([
    api.get('/api/referral/my'),
    api.get('/api/group-buy/my'),
    api.get('/api/community-group-buy/my'),
  ])

  let referralGroups: ReferralGroup[] = []
  let vouchers: VoucherEntry[] = []
  let community: CommunityGroupBuy[] = []

  if (refRes.status === 'fulfilled' && refRes.value.data?.success) {
    referralGroups = refRes.value.data.data || []
  }
  if (vouRes.status === 'fulfilled' && vouRes.value.data?.success) {
    vouchers = vouRes.value.data.data || []
  }
  if (comRes.status === 'fulfilled' && comRes.value.data?.success) {
    const d = comRes.value.data.data || {}
    const created = (d.created || []) as CommunityGroupBuy[]
    const joined = (d.joined || []) as CommunityGroupBuy[]
    community = [...created, ...joined]
  }

  // 추천 그룹의 상품정보 hydration (교환권은 이미 상품 필드 포함)
  const products: Record<number, ProductInfo> = {}
  const productIds = Array.from(new Set(referralGroups.map((g) => g.product_id).filter(Boolean)))
  if (productIds.length > 0) {
    const results = await Promise.all(
      productIds.map(async (pid) => {
        try {
          const p = await api.get(`/api/group-buy/products/${pid}`)
          if (p.data?.success) return [pid, p.data.data as ProductInfo] as const
        } catch {
          /* ignore */
        }
        return null
      }),
    )
    results.forEach((r) => { if (r) products[r[0]] = r[1] })
  }

  return { referralGroups, vouchers, community, products }
}

export function useMyGroupBuys() {
  return useQuery<MyGroupBuysData>({
    queryKey: queryKeys.myGroupBuys(),
    queryFn: fetchMyGroupBuys,
    enabled: isLoggedInSync(),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
