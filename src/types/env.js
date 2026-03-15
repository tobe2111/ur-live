// TypeScript Environment Interface
// 이 파일은 Cloudflare Workers/Pages 환경 변수의 타입을 정의합니다.
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
export function validateEnv(env) {
    const requiredVars = [
        'DB',
        'SESSION_KV',
        'CACHE_KV',
        'TOSS_SECRET_KEY',
        'TOSS_CLIENT_KEY'
    ];
    const missingVars = [];
    for (const varName of requiredVars) {
        if (!env[varName]) {
            missingVars.push(varName);
        }
    }
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}\n\n` +
            `Please configure them:\n` +
            missingVars.map(v => {
                if (v === 'TOSS_SECRET_KEY' || v === 'TOSS_CLIENT_KEY') {
                    return `  npx wrangler pages secret put ${v} --project-name ur-live`;
                }
                return `  Check wrangler.jsonc for ${v} binding`;
            }).join('\n') +
            `\n\nFor more details, see ENV_SETUP_GUIDE.md`);
    }
}
/**
 * 환경 변수 로깅 헬퍼 (개발용)
 *
 * 보안상 민감한 정보는 출력하지 않습니다.
 *
 * @param env - Cloudflare 환경 객체
 */
export function logEnvStatus(env) {
    console.log('[ENV] Environment check:');
    console.log('  DB:', env.DB ? '✅ Connected' : '❌ Missing');
    console.log('  SESSION_KV:', env.SESSION_KV ? '✅ Connected' : '❌ Missing');
    console.log('  CACHE_KV:', env.CACHE_KV ? '✅ Connected' : '❌ Missing');
    console.log('  TOSS_SECRET_KEY:', env.TOSS_SECRET_KEY ? '✅ Set' : '❌ Missing');
    console.log('  TOSS_CLIENT_KEY:', env.TOSS_CLIENT_KEY ? '✅ Set' : '❌ Missing');
}
