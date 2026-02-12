// Sentry 에러 로깅 모듈 (Mock)
// 실제 프로덕션에서는 @sentry/react를 설치하고 사용

interface ErrorContext {
  [key: string]: any
}

/**
 * 에러를 Sentry에 로깅 (현재는 콘솔 로그)
 */
export function logError(error: Error, context?: ErrorContext): void {
  console.error('🔴 Error:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  })

  // TODO: 프로덕션에서는 Sentry.captureException(error, { extra: context }) 사용
}

/**
 * 사용자 정보 설정
 */
export function setUser(user: { id: string; email?: string; name?: string }): void {
  console.log('📝 User context set:', user)
  // TODO: 프로덕션에서는 Sentry.setUser(user) 사용
}

/**
 * 커스텀 메시지 로깅
 */
export function logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
  const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log
  logFn(`[${level.toUpperCase()}] ${message}`, context)
  // TODO: 프로덕션에서는 Sentry.captureMessage(message, level) 사용
}
