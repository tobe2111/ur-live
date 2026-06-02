/**
 * 🛡️ 2026-06-01 Tier2 RQ 이전 — 디지털 보관함 (구매한 전자책/영상/가이드, read-only).
 * 기존 MyDigitalLibraryPage 의 수동 useState+useEffect+fetch → React Query.
 */

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

export interface DigitalAccess {
  access_id: number
  access_token: string
  expires_at: string | null
  download_count: number
  download_limit: number
  last_accessed: string | null
  status: 'active' | 'revoked' | 'expired'
  created_at: string
  product_id: number
  product_name: string
  image_url: string | null
  product_kind: 'digital' | 'video_course' | 'pdf_guide' | 'live_class'
  content_format: string | null
  file_size_mb: number | null
  preview_url: string | null
  seller_name: string | null
  seller_image: string | null
}

const CACHE_KEY = 'digital-library'

export function useDigitalLibrary() {
  return useQuery<DigitalAccess[]>({
    queryKey: queryKeys.digitalLibrary(),
    queryFn: () =>
      api
        .get('/api/digital/my')
        .then((r) => {
          const arr = (r.data?.success && Array.isArray(r.data.data) ? r.data.data : []) as DigitalAccess[]
          writeCache(CACHE_KEY, arr)
          return arr
        })
        .catch(() => readCache<DigitalAccess[]>(CACHE_KEY, [])),
    initialData: () => readCache<DigitalAccess[]>(CACHE_KEY, []),
    enabled: isLoggedInSync(),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
}
