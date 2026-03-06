import * as Sentry from '@sentry/react'

/**
 * Sentry 초기화
 * - 프로덕션 환경에서만 활성화
 * - 성능 추적 (LCP, FID, CLS)
 * - 세션 재생 (에러 발생 시)
 * - 에러 필터링
 */
export function initSentry() {
  if (import.meta.env.PROD) {
    const dsn = import.meta.env.VITE_SENTRY_DSN

    if (!dsn) {
      console.warn('⚠️  Sentry DSN이 설정되지 않았습니다. 모니터링이 비활성화됩니다.')
      return
    }

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: `ur-live@${import.meta.env.VITE_APP_VERSION || 'unknown'}`,

      // 성능 추적 통합
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // 트랜잭션 샘플링 (100% 추적)
      tracesSampleRate: 1.0,

      // 세션 재생
      replaysSessionSampleRate: 0.1,   // 10% 샘플링
      replaysOnErrorSampleRate: 1.0,   // 에러 발생 시 100% 기록

      // 에러 필터링
      beforeSend(event, hint) {
        // localStorage 관련 오류 무시
        if (event.message?.includes('localStorage')) {
          return null
        }

        // 네트워크 오류 (401, 403 제외)
        if (event.message?.includes('NetworkError')) {
          return null
        }

        // 개발 환경 오류 무시
        if (event.environment === 'development') {
          return null
        }

        return event
      },

      // 에러 핸들링
      beforeBreadcrumb(breadcrumb, hint) {
        // 민감한 정보 마스킹
        if (breadcrumb.category === 'console' && breadcrumb.message) {
          breadcrumb.message = breadcrumb.message.replace(/token=[^&]*/g, 'token=***')
          breadcrumb.message = breadcrumb.message.replace(/password=[^&]*/g, 'password=***')
        }
        return breadcrumb
      },
    })

    console.log('✅ Sentry 초기화 완료')
  } else {
    console.log('ℹ️  Sentry는 프로덕션 환경에서만 활성화됩니다')
  }
}

/**
 * 에러 캡처 헬퍼 함수
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (import.meta.env.PROD) {
    Sentry.captureException(error, {
      extra: context,
    })
  } else {
    console.error('🐛 Error:', error, context)
  }
}

/**
 * 에러 로깅 (errorHandler.ts 호환)
 */
export function logError(error: Error, context?: Record<string, any>) {
  captureError(error, context)
}

/**
 * 메시지 캡처 헬퍼 함수
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (import.meta.env.PROD) {
    Sentry.captureMessage(message, level)
  } else {
    console.log(`📝 Message (${level}):`, message)
  }
}

/**
 * 사용자 컨텍스트 설정
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (import.meta.env.PROD) {
    Sentry.setUser(user)
  }
}
