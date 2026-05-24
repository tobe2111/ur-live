import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

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
      // 🔥 에러 발생 시 1회 재시도
      retry: 1,
      // 🔥 백그라운드 자동 갱신 — 윈도우 포커스 시 stale 갱신
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // 🔥 mount 시 자동 refetch 끔 — staleTime 안에 있으면 cached 사용
      refetchOnMount: false,
    },
    mutations: {
      // 🔥 mutation 에러 시 1회 재시도
      retry: 1,
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
