/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 블로그 공개 글 (slug 단건, public 콘텐츠).
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'

export interface BlogPost {
  id: number
  slug: string
  title: string
  summary: string
  content: string
  tags: string
  author: string
  thumbnail_url: string | null
  published_at: string
}

export function useBlogPost(slug: string | undefined, initialData?: BlogPost | null) {
  return useQuery<BlogPost | null>({
    queryKey: queryKeys.blogPost(slug ?? ''),
    queryFn: () =>
      api
        .get(`/api/blog/public/${slug}`)
        .then((r) => (r.data?.success ? (r.data.data as BlogPost) : null))
        .catch(() => null),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // public 콘텐츠 — 길게 캐시
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    // 📝 2026-07-01 SSR 시드(__SSR_INITIAL_BLOGPOST__) 즉시 사용 → 0-RTT 첫 페인트.
    //   stale 로 표시(updatedAt=0)해 마운트 시 최신본 재검증(잘못된 옛값 고착 방지).
    ...(initialData ? { initialData, initialDataUpdatedAt: 0 } : {}),
  })
}
