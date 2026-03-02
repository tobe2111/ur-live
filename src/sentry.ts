import * as Sentry from '@sentry/react'

// Sentry 초기화 함수
export function initSentry() {
  // 환경 변수에서 DSN 읽기 (없으면 Mock 모드)
  const dsn = import.meta.env.VITE_SENTRY_DSN || ''
  
  // DSN이 없으면 콘솔 로그만 남기기 (Mock 모드)
  if (!dsn) {
    console.log('🔍 Sentry Mock Mode: DSN not configured')
    return
  }

  Sentry.init({
    dsn,
    integrations: [
      // 브라우저 추적
      Sentry.browserTracingIntegration(),
      // 리플레이 세션 (에러 발생 시 사용자 행동 재생)
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // 💰 비용 최적화: 성능 모니터링 샘플링 비율 (100% → 10%)
    // 예상 절감: 57% (100,000 MAU 기준 $699 → $299)
    tracesSampleRate: 0.1, // 10% 샘플링
    
    // 💰 비용 최적화: 에러 이벤트 샘플링
    sampleRate: 0.5, // 에러 이벤트 50% 샘플링
    
    // 세션 리플레이 샘플링
    replaysSessionSampleRate: 0.05, // 5% (10% → 5%)
    replaysOnErrorSampleRate: 0.5, // 에러 발생 시 50% (100% → 50%)
    
    // 환경 설정
    environment: import.meta.env.MODE || 'development',
    
    // 릴리즈 버전 (package.json의 version 사용)
    release: `webapp@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    
    // 💰 비용 최적화: 에러 필터링 (무시할 에러 확대)
    beforeSend(event, hint) {
      // 1. 네트워크 에러 무시
      if (event.exception) {
        const error = hint.originalException as Error
        const errorMessage = error?.message || ''
        
        // 네트워크 관련 에러 무시
        if (
          errorMessage.includes('Network Error') ||
          errorMessage.includes('Network request failed') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError')
        ) {
          console.log('🔇 Sentry: Network error ignored')
          return null
        }
        
        // 취소된 요청 무시
        if (errorMessage.includes('AbortError') || errorMessage.includes('cancelled')) {
          console.log('🔇 Sentry: Cancelled request ignored')
          return null
        }
        
        // 브라우저 확장 프로그램 에러 무시
        if (errorMessage.includes('extension') || errorMessage.includes('chrome://')) {
          console.log('🔇 Sentry: Browser extension error ignored')
          return null
        }
      }
      
      // 2. 스크립트 로딩 에러 무시 (ad blockers 등)
      if (event.request?.url?.includes('ad')) {
        console.log('🔇 Sentry: Ad-related error ignored')
        return null
      }
      
      return event
    },
  })

  console.log('✅ Sentry initialized successfully')
}

// 커스텀 에러 로깅
export function logError(error: Error, context?: Record<string, any>) {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  
  if (!dsn) {
    // Mock 모드: 콘솔에만 출력
    console.error('🔴 Error (Mock):', error.message, context)
    return
  }

  Sentry.captureException(error, {
    extra: context,
  })
}

// 사용자 정보 설정
export function setUser(user: { id: string; email?: string; name?: string }) {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  
  if (!dsn) {
    console.log('👤 Set User (Mock):', user)
    return
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  })
}

// 사용자 정보 제거 (로그아웃 시)
export function clearUser() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  
  if (!dsn) {
    console.log('👤 Clear User (Mock)')
    return
  }

  Sentry.setUser(null)
}

// 커스텀 이벤트 로깅
export function logEvent(message: string, data?: Record<string, any>) {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  
  if (!dsn) {
    console.log('📊 Event (Mock):', message, data)
    return
  }

  Sentry.captureMessage(message, {
    level: 'info',
    extra: data,
  })
}

// ErrorBoundary 컴포넌트 export
export const ErrorBoundary = Sentry.ErrorBoundary
