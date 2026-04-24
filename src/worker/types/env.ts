// ============================================================
// Cloudflare Worker — Environment Bindings (Unified)
// All bindings used across worker + feature modules
// ============================================================

import type { D1Database, KVNamespace, DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  // ---- D1 Database ----
  DB: D1Database;

  // ---- KV Namespaces ----
  RATE_LIMIT_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;

  // ---- Durable Objects ----
  LIVE_STREAM?: DurableObjectNamespace;

  // ---- Toss Payments ----
  TOSS_SECRET_KEY: string;
  TOSS_WEBHOOK_SECRET: string;
  TOSS_CLIENT_KEY: string;

  // ---- Stripe (Global region) ----
  STRIPE_SECRET_KEY?: string;

  // ---- Auth ----
  JWT_SECRET: string;

  // ---- Firebase ----
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_DATABASE_URL?: string;

  // ---- Kakao ----
  KAKAO_REST_API_KEY?: string;

  // ---- Cafe24 ----
  CAFE24_CLIENT_ID?: string;
  CAFE24_CLIENT_SECRET?: string;
  CAFE24_MALL_ID?: string;
  CAFE24_WEBHOOK_SECRET?: string;

  // ---- Aligo (알림톡) ----
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
  ALIMTALK_SENDER_KEY?: string;
  ALIGO_SENDER_KEY?: string;
  ALIGO_SENDER_PHONE?: string;           // 발신번호 (예: 07080420000)
  ALIGO_TPL_ORDER_CONFIRM?: string;      // 주문완료 템플릿 코드
  ALIGO_TPL_SHIPPING_START?: string;     // 배송시작 템플릿 코드
  ALIGO_TPL_ORDER_CANCEL?: string;       // 주문취소 템플릿 코드
  ALIGO_TPL_SAMPLE_APPROVED?: string;    // 샘플 신청 승인 템플릿 코드

  // ---- YouTube ----
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  YOUTUBE_REDIRECT_URI?: string;

  // ---- Push Notifications ----
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;

  // ---- Email (Resend) ----
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_WEBHOOK_SECRET?: string;

  // ---- Monitoring ----
  DISCORD_WEBHOOK_URL?: string;
  SENTRY_DSN?: string;

  // ---- Security ----
  ADMIN_IP_WHITELIST?: string; // comma-separated IPs/CIDRs, e.g. "1.2.3.4,10.0.0.0/8"
  INTERNAL_API_TOKEN?: string; // shared secret for internal-only endpoints (cron, commission calc)
  // 🛡️ 2026-04-22: DB at-rest 암호화용 KEK (Cafe24/Push subscription 토큰 보호)
  // 32자 이상의 random string. Cloudflare Dashboard → Variables and Secrets 에서 설정.
  DATA_ENCRYPTION_KEY?: string;

  // ---- Naver Ad Scraper ----
  // ⚠️ [LEGAL/PIPA] 크롤러로 수집한 이메일/연락처를 마케팅 목적으로 사용하려면
  // 정보주체의 명시적 동의가 선행되어야 합니다(개인정보 보호법 제15·22조).
  // SCRAPER_ENABLED 플래그가 'true'가 아니면 라우트는 503을 반환합니다.
  SCRAPER_ENABLED?: string; // 'true'일 때만 네이버 광고주 크롤러 활성화
  SCRAPER_URL?: string; // 스크래퍼 서버 URL (dev: http://localhost:3456)
  GITHUB_TOKEN?: string; // GitHub workflow dispatch용 (prod에서 스크래퍼 실행)
  GITHUB_REPO?: string;  // owner/repo 형식 (예: tobe2111/ur-live)

  // ---- Naver Search API (식당 이미지 등) ----
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;

  // ---- App Config ----
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  REGION?: string;

  // ---- Cloudflare Specific ----
  // Note: env.ASSETS is automatically available when [assets] is configured
  // No explicit binding needed in wrangler.toml
  ASSETS?: { fetch: (req: Request) => Promise<Response> };

  // ---- Build Info (injected at deploy time) ----
  BUILD_SHA?: string;
  BUILD_TIMESTAMP?: string;

  // ---- Bootstrap / Internal ----
  BOOTSTRAP_TOKEN?: string;
  INTERNAL_CRON_TOKEN?: string;

  // ---- Alimtalk Templates ----
  ALIMTALK_BROADCAST_TPL?: string;

  // ---- Refresh Token ----
  REFRESH_TOKEN_SECRET?: string;
}
