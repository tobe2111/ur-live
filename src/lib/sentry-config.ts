/**
 * Sentry 에러 추적 설정
 * 
 * TODO: Sentry 프로젝트 생성 및 DSN 설정
 * 1. https://sentry.io 에서 프로젝트 생성
 * 2. DSN 복사
 * 3. wrangler.jsonc에 환경 변수 추가: SENTRY_DSN
 * 4. Cloudflare Workers용 Sentry SDK 설치
 * 
 * npm install @sentry/browser (클라이언트)
 * 또는 Toucan (Cloudflare Workers용)
 * npm install toucan-js
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
