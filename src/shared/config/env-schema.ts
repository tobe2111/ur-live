import { z } from 'zod';

/**
 * ✅ 환경 변수 스키마 정의 (Zod)
 * 
 * Week 5 Day 2 - 환경 변수 검증 레이어
 * 
 * 목적:
 * - 빌드 타임 + 런타임 환경 변수 검증
 * - KR/WORLD 분기별 필수 변수 차별화
 * - 명확한 에러 메시지 제공
 */

// ============================================
// 공통 환경 변수 (KR + WORLD 모두 필수)
// ============================================
const commonEnvSchema = z.object({
  // Firebase 설정 (모든 Region 필수)
  VITE_FIREBASE_API_KEY: z.string().min(1, 'Firebase API Key is required'),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase Auth Domain is required'),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required'),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase Storage Bucket is required'),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Firebase Messaging Sender ID is required'),
  VITE_FIREBASE_APP_ID: z.string().min(1, 'Firebase App ID is required'),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),

  // API Base URL
  VITE_API_BASE_URL: z.string().url('Invalid API Base URL').optional(),

  // Sentry (optional)
  VITE_SENTRY_DSN: z.string().url('Invalid Sentry DSN').optional(),

  // Region (자동 설정)
  VITE_REGION: z.enum(['KR', 'GLOBAL']).optional(),
});

// ============================================
// KR 전용 환경 변수
// ============================================
const krEnvSchema = commonEnvSchema.extend({
  // Kakao 설정 (KR 필수)
  // NOTE: KAKAO_REST_API_KEY는 서버 전용. 프론트는 /auth/kakao/start 경유.
  VITE_KAKAO_JAVASCRIPT_KEY: z.string().min(1, 'Kakao JavaScript Key is required for KR region'),
  VITE_KAKAO_AUTH_URL: z.string().url('Invalid Kakao Auth URL').optional(),

  // Toss 결제 설정 (KR 필수)
  VITE_TOSS_CLIENT_KEY: z.string().min(1, 'Toss Client Key is required for KR region'),

  // Daum 우편번호 API (KR 선택)
  VITE_DAUM_POSTCODE_KEY: z.string().optional(),
});

// ============================================
// WORLD 전용 환경 변수
// ============================================
const worldEnvSchema = commonEnvSchema.extend({
  // Google OAuth 설정 (WORLD 필수)
  VITE_GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required for WORLD region'),

  // Stripe 결제 설정 (WORLD 필수)
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'Stripe Publishable Key is required for WORLD region'),
});

// ============================================
// Worker 환경 변수 (Cloudflare Secrets)
// ============================================
const workerEnvSchema = z.object({
  // Firebase Admin SDK (Worker)
  FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required in Worker'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'Firebase Private Key is required in Worker'),
  FIREBASE_CLIENT_EMAIL: z.string().email('Invalid Firebase Client Email'),

  // Kakao (Worker - KR)
  KAKAO_REST_API_KEY: z.string().optional(), // KR만 필수
  KAKAO_CLIENT_SECRET: z.string().optional(),

  // Google (Worker - WORLD)
  GOOGLE_CLIENT_SECRET: z.string().optional(), // WORLD만 필수

  // Toss (Worker - KR)
  TOSS_SECRET_KEY: z.string().optional(), // KR만 필수

  // Stripe (Worker - WORLD)
  STRIPE_SECRET_KEY: z.string().optional(), // WORLD만 필수

  // D1 Database (Worker)
  DB: z.any().optional(), // Cloudflare Binding

  // KV Stores (Worker)
  SESSION_KV: z.any().optional(),
  CACHE_KV: z.any().optional(),

  // R2 Storage (Worker)
  ASSETS: z.any().optional(),

  // Discord Webhook (optional)
  DISCORD_WEBHOOK_URL: z.string().url('Invalid Discord Webhook URL').optional(),
});

// ============================================
// Export 스키마
// ============================================
export { commonEnvSchema, krEnvSchema, worldEnvSchema, workerEnvSchema };

// ============================================
// 타입 추론
// ============================================
export type CommonEnv = z.infer<typeof commonEnvSchema>;
export type KREnv = z.infer<typeof krEnvSchema>;
export type WorldEnv = z.infer<typeof worldEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
