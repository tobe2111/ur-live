/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 라이브 다시보기(VOD) 단건 + 관련 종료 라이브.
 * 기존 LiveRecapPage 의 수동 2-fetch → 단일 useQuery 캡슐화(id 별 캐시).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'

export interface RecapStream {
  id: number
  title: string
  youtube_video_id: string | null
  seller_name: string | null
  viewer_count: number
  ended_at: string | null
  created_at: string
  current_product: { id: number; name: string; price: number; image_url: string | null } | null
}

export interface LiveRecapData {
  stream: RecapStream | null
  related: RecapStream[]
}

export function useLiveRecap(id: string | undefined) {
  return useQuery<LiveRecapData>({
    queryKey: queryKeys.liveRecap(id ?? ''),
    queryFn: async () => {
      const [streamRes, relRes] = await Promise.all([
        api.get(`/api/streams/${id}`).catch(() => null),
        api.get('/api/streams?status=ended&limit=6').catch(() => null),
      ])
      const stream = streamRes?.data?.success ? (streamRes.data.data as RecapStream) : null
      const related = relRes?.data?.success
        ? ((relRes.data.data || []) as RecapStream[]).filter((s) => String(s.id) !== id)
        : []
      return { stream, related }
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
