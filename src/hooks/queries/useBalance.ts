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

// 🛡️ 2026-05-24: 잔액 표시 정확성 영구 fix (사용자 신고 "/points/charge 잔액 안 맞아").
//   기본 옵션 = 안전한 캐시 (60초 stale). fresh=true 면 0초 stale + mount/focus 마다 refetch.
// 🛠️ 2026-06-17 (근본 원인 — 사용자 신고 "교환권 상세서 딜 부족 오표시"):
//   기존 주석은 "기본 모드도 refetchOnMount 로 자가보정"이라 적었지만 **틀렸다**.
//   React Query 는 `initialData`(initialDataUpdatedAt 미지정)를 "방금 fetch 한 fresh 데이터"로
//   간주(dataUpdatedAt=mount 시각) → staleTime(60s) 동안 fresh → `refetchOnMount: true`(=stale 일
//   때만 refetch)가 동작 안 함 → 캐시 seed(미캐시면 0)를 60초간 그대로 노출. 잔액 0 은 "미로딩"이
//   아니라 "잔액 부족"의 의미값이라, 결제 판단 화면에서 false '딜 부족' 으로 이어졌다.
//   fix: `initialDataUpdatedAt: 0` 으로 캐시 seed 를 "즉시 stale" 처리 → refetchOnMount 가 실제로
//   refetch(0ms 즉시표시 유지 + cold mount 마다 서버값으로 보정). fresh=true 경로엔 영향 없음(이미 always).
export function useBalance(opts?: { fresh?: boolean }) {
  const fresh = opts?.fresh === true
  return useQuery<number>({
    queryKey: queryKeys.balance(),
    // 🛡️ 2026-06-26 (소비자 감사 P0): 기존 `.catch(() => readCache(0))` 가 일시 5xx/타임아웃/쿠키 race 를
    //   '잔액 0(성공)'으로 위장 → 잔액 있는 유저에게 '딜 부족' 오표시로 결제/후원 차단. catch 제거 →
    //   에러는 isError 로 노출(RQ 는 마지막 성공값/initialData 를 data 로 유지하므로 표시는 안 깨짐),
    //   결제 직전 화면이 isError 를 보고 '부족' 단정 대신 재시도를 띄울 수 있게 한다.
    queryFn: () =>
      api.get('/api/points/balance').then((r) => {
        const b = Number(r.data?.data?.balance ?? 0)
        if (Number.isFinite(b) && b >= 0) {
          writeCache(CACHE_KEY, b)
          return b
        }
        return 0
      }),
    initialData: () => readCache<number>(CACHE_KEY, 0),
    // 🛠️ 캐시 seed 를 즉시 stale 로 — refetchOnMount 가 반드시 1회 서버 확인하게(false 0 표시 방지).
    initialDataUpdatedAt: 0,
    enabled: isLoggedInSync(),
    // fresh=true (PointsChargePage) — 0초 stale, mount 마다 refetch.
    // 기본 — 60초 stale (이전 5분 너무 길어 충전 직후 잔액 반영 X 사고). + initialDataUpdatedAt:0 로 cold mount 보정.
    staleTime: fresh ? 0 : 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: fresh ? 'always' : true,
    refetchOnWindowFocus: fresh ? true : false,
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
