import * as Sentry from '@sentry/react';

/**
 * Sentry 초기화
 * 
 * 환경 변수:
 * - VITE_SENTRY_DSN: Sentry DSN (선택사항, 없으면 Mock 모드)
 * - VITE_SENTRY_ENVIRONMENT: 환경 (development, production)
 */
export function initSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;

  if (!sentryDsn) {
    console.log('[Sentry] Mock mode - DSN not configured');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    
    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Performance 샘플링 (10% of transactions)
    tracesSampleRate: 0.1,
    
    // Session Replay 샘플링
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // 에러 필터링 (불필요한 에러 제외)
    beforeSend(event, hint) {
      // 개발 환경에서는 콘솔에만 출력
      if (environment === 'development') {
        console.error('[Sentry - Dev]', hint.originalException || hint.syntheticException);
        return null; // 개발 환경에서는 Sentry로 전송하지 않음
      }

      // ResizeObserver 에러 무시 (브라우저 내부 에러)
      if (event.message?.includes('ResizeObserver')) {
        return null;
      }

      // 네트워크 에러 무시 (사용자 인터넷 문제)
      if (event.message?.includes('NetworkError') || event.message?.includes('Failed to fetch')) {
        return null;
      }

      return event;
    },
  });

  console.log('[Sentry] Initialized:', { environment, dsn: sentryDsn.substring(0, 20) + '...' });
}

/**
 * 사용자 컨텍스트 설정
 */
export function setSentryUser(user: { id: string; email?: string; username?: string; userType?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    userType: user.userType,
  });
}

/**
 * 사용자 컨텍스트 제거 (로그아웃 시)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * 커스텀 에러 캡처
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext('custom', context);
  }
  
  Sentry.captureException(error);
}

/**
 * 커스텀 메시지 캡처
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * 에러 로그 (레거시 호환용)
 */
export function logError(error: Error, context?: Record<string, any>) {
  captureError(error, context);
}

/**
 * 🎯 커스텀 이벤트 추적 (비즈니스 메트릭)
 */
export function trackEvent(eventName: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category: 'custom_event',
    message: eventName,
    level: 'info',
    data,
  });
}

/**
 * 🔐 로그인 성공 이벤트
 */
export function trackLoginSuccess(method: 'kakao' | 'email' | 'google', userId: string) {
  trackEvent('login_success', { method, userId, timestamp: Date.now() });
  Sentry.setTag('login_method', method);
}

/**
 * 🔐 로그인 실패 이벤트
 */
export function trackLoginFailure(method: 'kakao' | 'email' | 'google', reason: string) {
  trackEvent('login_failure', { method, reason, timestamp: Date.now() });
  captureMessage(`Login failed: ${method} - ${reason}`, 'warning');
}

/**
 * 💳 결제 성공 이벤트
 */
export function trackPaymentSuccess(orderId: string, amount: number, method: string) {
  trackEvent('payment_success', { orderId, amount, method, timestamp: Date.now() });
  Sentry.setTag('payment_method', method);
}

/**
 * 💳 결제 실패 이벤트
 */
export function trackPaymentFailure(orderId: string, amount: number, reason: string) {
  trackEvent('payment_failure', { orderId, amount, reason, timestamp: Date.now() });
  captureMessage(`Payment failed: ${orderId} - ${reason}`, 'error');
}

/**
 * ⏱️ 페이지 로드 시간 추적
 */
export function trackPageLoadTime(pageName: string, loadTimeMs: number) {
  trackEvent('page_load', { pageName, loadTimeMs, timestamp: Date.now() });
  
  // 3초 이상 느린 경우 경고
  if (loadTimeMs > 3000) {
    captureMessage(`Slow page load: ${pageName} took ${loadTimeMs}ms`, 'warning');
  }
}
