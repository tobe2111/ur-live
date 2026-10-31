import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys, seedDetailFromListRow } from '@/hooks/queries'
import type { Product } from '@/pages/main-home/types'

/**
 * 🔥 인기순 첫 페이지 — PC 홈의 순위 줄과 지역 타일 사진이 함께 쓴다(2026-10-14 시안 4).
 *
 * ⚠️ 키·주소를 `GroupBuyFeed` 의 인기순과 **byte-같게** 둔다:
 *   - 키 `groupBuyList('active','all','popular')` — 아래 피드를 인기순으로 바꾸면 요청 0 번(캐시 공유).
 *   - 주소 `?status=active&category=all&sort=popular` — cron 이 예열하는 바로 그 주소다
 *     (`prewarm-matches-feed` 가 대조). 한 글자라도 다르면 예열을 못 받아 콜드 D1 로 간다.
 */
export function usePopularDeals() {
  const qc = useQueryClient()
  return useQuery<Product[]>({
    queryKey: queryKeys.groupBuyList('active', 'all', 'popular'),
    queryFn: async () => {
      const res = await api.get('/api/group-buy/products?status=active&category=all&sort=popular')
      const arr: Product[] = Array.isArray(res.data?.data) ? res.data.data : []
      for (const p of arr) seedDetailFromListRow(qc, p)
      return arr
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
