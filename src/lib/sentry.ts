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

      // 🛡️ 2026-05-01: Sentry 429 (quota 초과) 신고 — 샘플링 대폭 축소.
      //   tracesSampleRate: 10% → 1% (트랜잭션은 운영 monitoring 용 — 적은 표본도 충분)
      //   replaysSessionSampleRate: 10% → 0% (일반 세션 replay 안 함)
      //   replaysOnErrorSampleRate: 100% → 10% (에러 시도 10%만)
      tracesSampleRate: 0.01,
      replaysSessionSampleRate: 0,     // 일반 세션 replay 0 (quota 초과 방어)
      replaysOnErrorSampleRate: 0.1,   // 에러 발생 시 10% 기록

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
        // 🛡️ 2026-04-30: PII / 시크릿 마스킹 강화
        if (breadcrumb.category === 'console' && breadcrumb.message) {
          let m = breadcrumb.message
          // 토큰류 (JWT 3-part / hex secret)
          m = m.replace(/token=[^&\s,]*/gi, 'token=***')
          m = m.replace(/password=[^&\s,]*/gi, 'password=***')
          m = m.replace(/secret=[^&\s,]*/gi, 'secret=***')
          m = m.replace(/api[_-]?key=[^&\s,]*/gi, 'api_key=***')
          m = m.replace(/authorization:\s*bearer\s+[^\s,]+/gi, 'Authorization: Bearer ***')
          // JWT (eyJ로 시작하는 base64url 3파트)
          m = m.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'eyJ***')
          // 한국 전화번호
          m = m.replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, '010-****-****')
          // 이메일 (도메인은 유지, 로컬파트 마스킹)
          m = m.replace(/\b([A-Za-z0-9._-]{1,2})[A-Za-z0-9._-]*@/g, '$1***@')
          breadcrumb.message = m
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
