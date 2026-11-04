import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

/**
 * 🛟 다시 물어 볼 가치가 있는 실패인가 — 상태 코드가 없으면(네트워크·시간 초과) 일시적이다.
 * 4xx 는 다시 해도 같다(429 '너무 많이' 만 예외 — 잠시 뒤엔 된다).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  const status = Number((error as { status?: number; response?: { status?: number } } | null)?.status
    ?? (error as { response?: { status?: number } } | null)?.response?.status)
  if (!Number.isFinite(status) || status === 0) return true
  return status >= 500 || status === 429 || status === 408
}

// 🎯 React Query 전역 설정
// 🛡️ 2026-05-24 (loading P0): staleTime 5분 → 30분 / gcTime 30분 → 1시간.
//   상품 목록 / 상세 / 옵션은 변동이 매우 잦지 않음. 재방문 + 뒤로가기 + 탭전환에서
//   즉시 렌더 (네트워크 0회). refetchOnWindowFocus 는 유지 — 가격/재고 변경 감지.
//   localStorage persist 는 다음 세션에서 stale price 위험 있어 의도적으로 skip.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🔥 30분간 stale 안 됨 (중복 요청 0)
      staleTime: 30 * 60 * 1000,
      // 🔥 1시간 후 가비지 컬렉션 (탭 전환/뒤로가기 동안 캐시 유지)
      gcTime: 60 * 60 * 1000,
      // 🛟 2026-11-04 (대표 *"대기업급 안정성"*) — **일시적 실패만** 다시 묻는다(네트워크 끊김·시간 초과·서버 5xx·429), 최대 2번.
      //   종전 `retry: 1` 은 404·401 처럼 다시 해도 같은 실패까지 1초 기다려 다시 물어 손님이 결과를 늦게 봤고,
      //   반대로 지하철·엘리베이터의 짧은 끊김에는 1번으로 모자랐다. 간격은 0.6초 → 1.8초(지수) — 몰릴 때 서버를 두드리지 않게.
      retry: shouldRetryQuery,
      retryDelay: (attempt) => Math.min(600 * 3 ** attempt, 4000),
      // 🔥 백그라운드 자동 갱신 — 윈도우 포커스 시 stale 갱신
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // 🔥 mount 시 자동 refetch 끔 — staleTime 안에 있으면 cached 사용
      refetchOnMount: false,
    },
    mutations: {
      // 🛟 2026-11-04 (대표 *"대기업급 안정성"*) — **쓰기는 자동으로 다시 보내지 않는다.**
      //   응답만 늦게 와도 실패로 보이는데, 그때 다시 보내면 서버에선 **두 번** 일어난다 — 장바구니 담기는 2개가 되고,
      //   팔로우·관심 같은 토글은 다시 풀린다(쓰는 곳: useCart · useMyFollows · useMyInterests · useNotifications).
      //   다시 시도는 사람이 결과를 보고 누르는 것이 맞다. (결제는 이 훅을 쓰지 않는다 — 멱등 키로 따로 막는다.)
      retry: 0,
    },
  },
})

interface QueryProviderProps {
  children: ReactNode
}

// 🎯 Provider 컴포넌트
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// v37 FIX: logout 시 useAuthKR 에서 캐시 초기화용 getter
export function getQueryClient() {
  return queryClient
}
