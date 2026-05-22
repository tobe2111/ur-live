/**
 * 🛡️ 2026-05-22: 딜 잔액 — 5분 staleTime + localStorage cache + event invalidation.
 *
 * 효과:
 *   - 페이지 진입 시 0ms 표시 (localStorage)
 *   - 5분 내 같은 데이터 — 서버 호출 0
 *   - 결제/후원/충전 직후 mutation hook 이 자동 invalidate
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { readCache, writeCache } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

const CACHE_KEY = 'balance'

export function useBalance() {
  return useQuery<number>({
    queryKey: queryKeys.balance(),
    queryFn: () =>
      api.get('/api/points/balance').then((r) => {
        const b = Number(r.data?.data?.balance ?? 0)
        if (Number.isFinite(b) && b >= 0) {
          writeCache(CACHE_KEY, b)
          return b
        }
        return 0
      }).catch(() => readCache<number>(CACHE_KEY, 0)),
    initialData: () => readCache<number>(CACHE_KEY, 0),
    enabled: isLoggedInSync(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** mutation 시점 (충전 / 후원 / 환불) 호출 — 새 balance 즉시 반영 + 다음 fetch 강제. */
export function useSetBalance() {
  const qc = useQueryClient()
  return (newBalance: number) => {
    qc.setQueryData(queryKeys.balance(), newBalance)
    writeCache(CACHE_KEY, newBalance)
  }
}

/** balance 변경 가능성 있는 액션 후 호출 (mutation 결과를 알 수 없을 때). */
export function useInvalidateBalance() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.balance() })
}
