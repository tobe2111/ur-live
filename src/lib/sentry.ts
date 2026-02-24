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
