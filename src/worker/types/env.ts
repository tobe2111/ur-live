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

  // ---- Aligo (알림톡) ----
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
  ALIMTALK_SENDER_KEY?: string;

  // ---- Kakao ----
  KAKAO_REST_API_KEY?: string;

  // ---- Cafe24 ----
  CAFE24_CLIENT_ID?: string;
  CAFE24_CLIENT_SECRET?: string;
  CAFE24_MALL_ID?: string;

  // ---- Aligo 알림톡 ----
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
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

  // ---- Monitoring ----
  DISCORD_WEBHOOK_URL?: string;
  SENTRY_DSN?: string;

  // ---- Security ----
  ADMIN_IP_WHITELIST?: string; // comma-separated IPs/CIDRs, e.g. "1.2.3.4,10.0.0.0/8"

  // ---- Naver Ad Scraper ----
  SCRAPER_URL?: string; // 스크래퍼 서버 URL (dev: http://localhost:3456)

  // ---- App Config ----
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  REGION?: string;

  // ---- Cloudflare Specific ----
  // Note: env.ASSETS is automatically available when [assets] is configured
  // No explicit binding needed in wrangler.toml
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}
