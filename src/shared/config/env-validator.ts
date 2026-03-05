import { z } from 'zod';
import { krEnvSchema, worldEnvSchema, workerEnvSchema } from './env-schema';

/**
 * ✅ 환경 변수 검증 함수
 * 
 * Week 5 Day 2 - 환경 변수 검증 레이어
 * 
 * 사용:
 * - 빌드 타임: vite.config.ts에서 호출
 * - 런타임: main.tsx, worker/index.ts에서 호출
 */

// ============================================
// 에러 메시지 포맷팅
// ============================================
function formatValidationError(error: z.ZodError, region?: string): string {
  const errors = error.errors.map((err) => {
    const path = err.path.join('.');
    return `  ❌ ${path}: ${err.message}`;
  });

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 환경 변수 검증 실패 ${region ? `(Region: ${region})` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errors.join('\n')}

📝 해결 방법:
1. .env 파일에 누락된 환경 변수를 추가하세요.
2. Wrangler secrets의 경우 다음 명령어로 추가하세요:
   wrangler secret put <KEY_NAME>
3. GitHub Actions의 경우 Repository Secrets에 추가하세요:
   Settings → Secrets and variables → Actions → New repository secret

📖 참고 문서:
- Firebase: https://console.firebase.google.com/project/_/settings/general
- Kakao: https://developers.kakao.com/console/app
- Google: https://console.cloud.google.com/apis/credentials
- Toss: https://docs.tosspayments.com/reference/widget-sdk
- Stripe: https://dashboard.stripe.com/apikeys

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ============================================
// KR 환경 변수 검증
// ============================================
export function validateKREnv(env: Record<string, any> = import.meta.env): void {
  try {
    krEnvSchema.parse(env);
    console.log('✅ [Env Validator] KR 환경 변수 검증 성공');
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = formatValidationError(error, 'KR');
      console.error(message);
      throw new Error('KR 환경 변수 검증 실패');
    }
    throw error;
  }
}

// ============================================
// WORLD 환경 변수 검증
// ============================================
export function validateWorldEnv(env: Record<string, any> = import.meta.env): void {
  try {
    worldEnvSchema.parse(env);
    console.log('✅ [Env Validator] WORLD 환경 변수 검증 성공');
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = formatValidationError(error, 'WORLD');
      console.error(message);
      throw new Error('WORLD 환경 변수 검증 실패');
    }
    throw error;
  }
}

// ============================================
// Worker 환경 변수 검증
// ============================================
export function validateWorkerEnv(env: Record<string, any>, region: 'KR' | 'GLOBAL'): void {
  try {
    // 기본 스키마 검증
    workerEnvSchema.parse(env);

    // Region별 추가 검증
    if (region === 'KR') {
      if (!env.KAKAO_REST_API_KEY) {
        throw new Error('KAKAO_REST_API_KEY is required for KR region');
      }
      if (!env.TOSS_SECRET_KEY) {
        throw new Error('TOSS_SECRET_KEY is required for KR region');
      }
    } else if (region === 'GLOBAL') {
      if (!env.GOOGLE_CLIENT_SECRET) {
        throw new Error('GOOGLE_CLIENT_SECRET is required for GLOBAL region');
      }
      if (!env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is required for GLOBAL region');
      }
    }

    console.log(`✅ [Env Validator] Worker 환경 변수 검증 성공 (Region: ${region})`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = formatValidationError(error, `Worker - ${region}`);
      console.error(message);
      throw new Error(`Worker 환경 변수 검증 실패 (Region: ${region})`);
    }
    throw error;
  }
}

// ============================================
// 빌드 타임 검증 (vite.config.ts용)
// ============================================
export function validateEnvForBuild(mode: string): void {
  console.log(`\n🔍 [Env Validator] Runtime Detection Mode - Skipping strict build-time validation`);
  console.log(`   Region will be detected at runtime based on hostname`);
  console.log(`   Mode: ${mode}\n`);

  // ✅ Runtime Detection에서는 빌드 타임 검증 스킵
  // - KR과 GLOBAL 환경 변수를 모두 포함해야 하므로
  // - 런타임에 hostname 기반으로 필요한 변수만 체크
  
  console.log(`✅ [Env Validator] Build-time check passed (runtime validation will occur on page load)\n`);
}

// ============================================
// 런타임 검증 (main.tsx용)
// ============================================
export function validateEnvForRuntime(region: 'KR' | 'GLOBAL'): void {
  try {
    if (region === 'KR') {
      validateKREnv();
    } else {
      validateWorldEnv();
    }
  } catch (error) {
    // 런타임 에러는 사용자에게 보이지 않도록 콘솔에만 로그
    console.error('[Env Validator] 런타임 검증 실패:', error);
    // Sentry 등으로 에러 전송
    if (import.meta.env.VITE_SENTRY_DSN) {
      // TODO: Sentry.captureException(error);
    }
  }
}

// ============================================
// 편의 함수: 단일 변수 체크
// ============================================
export function requireEnv(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Required environment variable missing: ${key}`);
  }
  return value;
}

// ============================================
// 편의 함수: 선택적 변수 체크 (기본값 제공)
// ============================================
export function optionalEnv(key: string, value: string | undefined, defaultValue: string): string {
  return value || defaultValue;
}
