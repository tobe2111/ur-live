import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// 🎯 React Query 전역 설정
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🔥 5분간 캐시 유지 (중복 요청 방지)
      staleTime: 5 * 60 * 1000,
      // 🔥 30분 후 가비지 컬렉션
      gcTime: 30 * 60 * 1000,
      // 🔥 에러 발생 시 1회 재시도 (3회 → 1회로 변경, 불필요한 지연 방지)
      retry: 1,
      // 🔥 백그라운드 자동 갱신
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // 🔥 mutation 에러 시 3회 재시도
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
