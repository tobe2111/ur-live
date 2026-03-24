/**
 * Sentry 에러 추적 설정 (Workers용)
 *
 * 연동 방법:
 * 1. https://sentry.io 에서 프로젝트 생성 후 DSN 복사
 * 2. wrangler.jsonc의 [vars] 또는 secrets에 SENTRY_DSN 추가:
 *    wrangler secret put SENTRY_DSN
 * 3. 클라이언트 Sentry는 src/lib/sentry.ts 참고 (VITE_SENTRY_DSN 필요)
 *
 * Workers 에러 핸들러는 src/worker/middleware/error-handler.ts에서 자동 처리됨
 */

/*
import { Toucan } from 'toucan-js';

export function initSentry(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Toucan {
  return new Toucan({
    dsn: env.SENTRY_DSN,
    context: ctx,
    request,
    allowedHeaders: ['user-agent'],
    allowedSearchParams: /(.*)/,
  });
}

// 에러 캡처 예시
export function captureError(
  sentry: Toucan,
  error: Error,
  context?: Record<string, any>
): void {
  if (context) {
    sentry.setExtras(context);
  }
  sentry.captureException(error);
}

// 사용 예시:
// const sentry = initSentry(request, env, ctx);
// try {
//   // ... 코드
// } catch (error) {
//   captureError(sentry, error, { userId, action: 'payment' });
//   throw error;
// }
*/

export const placeholder = true;
