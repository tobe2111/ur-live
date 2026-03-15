// ============================================================
// Cloudflare Worker — Environment Bindings (Unified)
// All bindings used across worker + feature modules
// ============================================================

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  // ---- D1 Database ----
  DB: D1Database;

  // ---- KV Namespaces ----
  RATE_LIMIT_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;

  // ---- Toss Payments ----
  TOSS_SECRET_KEY: string;
  TOSS_WEBHOOK_SECRET: string;
  TOSS_CLIENT_KEY: string;

  // ---- Auth ----
  JWT_SECRET: string;

  // ---- Firebase ----
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_DATABASE_URL?: string;

  // ---- Kakao ----
  KAKAO_REST_API_KEY?: string;

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

  // ---- App Config ----
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  REGION?: string;

  // ---- Cloudflare Specific ----
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}
