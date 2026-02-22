// TypeScript Environment Interface
// 이 파일은 Cloudflare Workers/Pages 환경 변수의 타입을 정의합니다.

/**
 * Cloudflare Workers/Pages 환경 바인딩 인터페이스
 * 
 * 이 인터페이스는 다음을 보장합니다:
 * 1. 컴파일 타임 타입 체크
 * 2. IDE 자동 완성
 * 3. 누락된 환경 변수 조기 발견
 */
export interface CloudflareBindings {
  // ========================================
  // 데이터베이스 바인딩
  // ========================================
  
  /**
   * D1 메인 데이터베이스
   * @description 사용자, 주문, 상품 등 모든 데이터 저장
   * @required true
   */
  DB: D1Database;
  
  // ========================================
  // KV 네임스페이스 바인딩
  // ========================================
  
  /**
   * 세션 저장소 (KV)
   * @description 사용자 세션 토큰 및 세션 데이터 저장
   * @ttl 24시간
   * @required true
   */
  SESSION_KV: KVNamespace;
  
  /**
   * 캐시 저장소 (KV)
   * @description API 응답 캐싱 등에 사용
   * @required true
   */
  CACHE_KV: KVNamespace;
  
  /**
   * Rate Limiting 저장소 (KV)
   * @description API 요청 제한을 위한 저장소
   * @required true
   */
  RATE_LIMIT_KV: KVNamespace;
  
  // ========================================
  // 환경 변수 (Secrets)
  // ========================================
  
  /**
   * Toss Payments API 시크릿 키
   * @description 결제 승인 API 호출 시 사용 (서버 사이드)
   * @required true
   * @example test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY (테스트)
   * @setup npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
   */
  TOSS_SECRET_KEY: string;
  
  /**
   * Toss Payments 클라이언트 키
   * @description Toss Payments 위젯 초기화 시 사용 (클라이언트 사이드)
   * @required true
   * @example test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm (테스트)
   * @setup npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live
   */
  TOSS_CLIENT_KEY: string;
}

/**
 * Hono Context 타입 헬퍼
 * 
 * 사용 예시:
 * ```typescript
 * import { Hono } from 'hono';
 * import type { CloudflareBindings } from './types/env';
 * 
 * const app = new Hono<{ Bindings: CloudflareBindings }>();
 * 
 * app.get('/api/test', (c) => {
 *   const db = c.env.DB;  // ✅ 타입 체크됨
 *   const secret = c.env.TOSS_SECRET_KEY;  // ✅ 타입 체크됨
 * });
 * ```
 */

/**
 * 환경 변수 검증 헬퍼 함수
 * 
 * 런타임에 필수 환경 변수가 설정되었는지 검증합니다.
 * 
 * @param env - Cloudflare 환경 객체
 * @throws Error - 필수 환경 변수가 누락된 경우
 * 
 * @example
 * ```typescript
 * app.use('*', async (c, next) => {
 *   validateEnv(c.env);
 *   await next();
 * });
 * ```
 */
export function validateEnv(env: CloudflareBindings): void {
  const requiredVars: Array<keyof CloudflareBindings> = [
    'DB',
    'SESSION_KV',
    'CACHE_KV',
    'TOSS_SECRET_KEY',
    'TOSS_CLIENT_KEY'
  ];
  
  const missingVars: string[] = [];
  
  for (const varName of requiredVars) {
    if (!env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n\n` +
      `Please configure them:\n` +
      missingVars.map(v => {
        if (v === 'TOSS_SECRET_KEY' || v === 'TOSS_CLIENT_KEY') {
          return `  npx wrangler pages secret put ${v} --project-name ur-live`;
        }
        return `  Check wrangler.jsonc for ${v} binding`;
      }).join('\n') +
      `\n\nFor more details, see ENV_SETUP_GUIDE.md`
    );
  }
}

/**
 * 환경 변수 로깅 헬퍼 (개발용)
 * 
 * 보안상 민감한 정보는 출력하지 않습니다.
 * 
 * @param env - Cloudflare 환경 객체
 */
export function logEnvStatus(env: CloudflareBindings): void {
  console.log('[ENV] Environment check:');
  console.log('  DB:', env.DB ? '✅ Connected' : '❌ Missing');
  console.log('  SESSION_KV:', env.SESSION_KV ? '✅ Connected' : '❌ Missing');
  console.log('  CACHE_KV:', env.CACHE_KV ? '✅ Connected' : '❌ Missing');
  console.log('  TOSS_SECRET_KEY:', env.TOSS_SECRET_KEY ? '✅ Set' : '❌ Missing');
  console.log('  TOSS_CLIENT_KEY:', env.TOSS_CLIENT_KEY ? '✅ Set' : '❌ Missing');
}
