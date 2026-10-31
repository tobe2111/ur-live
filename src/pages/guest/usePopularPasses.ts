/**
 * 🔥 "지금 많이 사는 이용권" — 홈 피드 기본 화면과 **같은 요청·같은 캐시**를 쓴다.
 *
 * 새 엔드포인트를 만들지 않는다: `GroupBuyFeed` 의 기본 상태(전체 · 인기순)는
 * `/api/group-buy/products?status=active&category=all&sort=popular` 이고, 그 주소는 cron 이 이미
 * 예열하는 키다(`cache-prewarm` HOT_PATHS). 그래서 홈을 거쳐 왔으면 **요청 0회**, 바로 들어와도 엣지 캐시를 맞는다.
 *
 * ⚠️ 키와 반환 모양(배열)이 홈 피드와 **같아야 한다**. 모양을 바꾸면(예: `{items,total}`) 같은 키에
 *   두 모양이 섞여 홈 피드가 조용히 깨진다 — 그래서 "전체 N개" 같은 합계는 여기서 내지 않는다.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import api from '@/lib/api'
import { queryKeys, seedDetailFromListRow } from '@/hooks/queries'
import type GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'

export type PassItem = ComponentProps<typeof GroupBuyFeedCard>['p']

export const POPULAR_PASSES_URL = '/api/group-buy/products?status=active&category=all&sort=popular'

export function usePopularPasses() {
  const qc = useQueryClient()
  return useQuery<PassItem[]>({
    queryKey: queryKeys.groupBuyList('active', 'all', 'popular'),
    queryFn: async () => {
      const res = await api.get(POPULAR_PASSES_URL)
      const arr: PassItem[] = Array.isArray(res.data?.data) ? res.data.data : []
      for (const p of arr) seedDetailFromListRow(qc, p)
      return arr
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
