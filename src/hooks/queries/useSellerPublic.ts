/**
 * 🛡️ 2026-05-22 Phase 3: 셀러 공개 프로필 — 10분 stale + localStorage.
 *
 * 셀러 프로필은 거의 안 바뀜. 사용자가 라이브 / 상품에서 셀러 클릭 시 빠르게.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'

interface SellerPublic {
  id: number
  name: string
  bio?: string
  profile_image?: string
  [k: string]: unknown
}

export function useSellerPublic(id: number | string | undefined) {
  const sellerId = id != null ? String(id) : ''
  return useQuery<SellerPublic | null>({
    queryKey: queryKeys.sellerPublic(sellerId || 'none'),
    queryFn: () =>
      api.get(`/api/seller-public/${sellerId}`).then((r) => {
        const data = r.data?.data as SellerPublic | null
        if (data) writeCache(`seller:${sellerId}`, data)
        return data ?? null
      }).catch(() => readCache<SellerPublic | null>(`seller:${sellerId}`, null)),
    initialData: () => readCache<SellerPublic | null>(`seller:${sellerId}`, null),
    enabled: !!sellerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
