/**
 * 🛡️ 2026-05-31: 제네릭 read 쿼리 훅 — 수동 useState+useEffect+api.get 복붙 제거용 SSOT.
 *
 * 배경: 256 페이지 중 231개가 React Query 를 우회하고 손수 useState/useEffect 로 fetch
 *   (TECHNICAL_DEBT "데이터 페칭 split-brain"). 캐시 불일치 + dedup 없음 + 복붙.
 *   대부분 admin/agency/seller 내부 대시보드 (유저 대면은 이미 RQ 훅 사용).
 *
 * 사용 (3줄 마이그레이션):
 *   const { data = [], isLoading, refetch } = useApiQuery<Row[]>(
 *     ['admin', 'abuse', filter], '/api/admin/abuse-detections',
 *     { params: { limit: 200 }, select: (r) => r.detections ?? [] })
 *
 * 비용: 순수 클라이언트 캐시 (React Query) — Cloudflare 서버 비용 0 (KV/edge write 없음).
 * 인증: api 인터셉터가 /api/admin|seller 토큰 자동 주입 (수동 헤더 불필요).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import api from '@/lib/api'

export function useApiQuery<T = unknown>(
  queryKey: readonly unknown[],
  url: string,
  opts?: {
    params?: Record<string, unknown>
    select?: (raw: unknown) => T
    enabled?: boolean
    staleTime?: number
    gcTime?: number
    refetchOnMount?: boolean | 'always'
  },
): UseQueryResult<T> {
  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const res = await api.get(url, opts?.params ? { params: opts.params } : undefined)
      return (opts?.select ? opts.select(res.data) : res.data) as T
    },
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? 60_000,
    gcTime: opts?.gcTime ?? 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: opts?.refetchOnMount,
  })
}
