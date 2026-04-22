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
        // 🛡️ 2026-04-22: PII 마스킹 — 결제/주소/전화/카드번호 유출 방어
        // replay 세션에 모든 사용자 텍스트를 숨김. input 은 Sentry 기본 마스킹 유지.
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
          maskAllInputs: true,
          // 네트워크 상세 URL 화이트리스트 — 외부 결제/인증 URL 제외
          networkDetailAllowUrls: [window.location.origin],
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

    // Sentry initialized
  } else {
    // Sentry only active in production
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
    // Dev message suppressed
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

/**
 * Breadcrumb 추가 — 에러 발생 시 직전 흐름을 Sentry에 함께 전송.
 * 결제/주문/로그인 같은 critical flow에서 호출하여 디버깅 컨텍스트를 확보.
 *
 * 민감한 값(email, phone, token 등)은 호출 전에 마스킹해서 전달할 것.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: 'info' | 'warning' | 'error' = 'info',
) {
  try {
    Sentry.addBreadcrumb({ category, message, data, level })
  } catch {
    // Sentry 초기화 실패 시 무시
  }
}

/**
 * 사용자 컨텍스트 설정 (breadcrumb와 같이 쓰는 간편 함수).
 * `type`은 'user' | 'seller' | 'admin' 등 세그먼트 구분용.
 */
export function setUserContext(user: { id: string | number; type?: string; email?: string }) {
  try {
    Sentry.setUser({
      id: String(user.id),
      ...(user.email ? { email: user.email } : {}),
      ...(user.type ? { segment: user.type } : {}),
    })
  } catch {
    // no-op
  }
}

/**
 * 이메일 마스킹 헬퍼 (breadcrumb data용).
 * 'hello@ex.com' → 'h***@ex.com'
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return ''
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const head = local.slice(0, 1)
  return `${head}***@${domain}`
}
