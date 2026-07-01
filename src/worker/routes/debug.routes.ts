/**
 * Debug Routes (Admin only)
 *
 * 빌드 정보 / 환경 변수 진단 등 운영 디버깅용 엔드포인트.
 * 더 큰 디버그 라우트들 (whoami, auth-trace, kv-usage, smoke-test 등) 은
 * 의존성 (auth context, KV, sessions) 이 많아 향후 추가 추출 예정.
 *
 * 마운트: 메인 worker/index.ts 에서 직접 (sub-app 형태)
 *
 * 작성일: 2026-04-26 (M9 부분 추출)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAdmin } from '../middleware/auth'

export const debugRoutes = new Hono<{ Bindings: Env }>()

// ── GET /build-info ─────────────────────────────────
// CI 배포 시 BUILD_SHA / BUILD_TIMESTAMP 주입 확인.
debugRoutes.get('/build-info', requireAdmin(), (c) => {
  return c.json({
    success: true,
    commitSha: (c.env as any).BUILD_SHA || 'unknown',
    buildTimestamp: (c.env as any).BUILD_TIMESTAMP || 'unknown',
    markers: {
      whoamiEndpoint: true,
      buildInfoEndpoint: true,
      // M9 분리 후 추가
      separatedDebugRoutes: true,
    },
  })
})

// ── GET /bindings ───────────────────────────────────
// Worker 환경 바인딩 상태 진단 (DB/KV 등 키 확인).
debugRoutes.get('/bindings', requireAdmin(), (c) => {
  const env = c.env as Env
  const e = env as any
  // 🆕 2026-07-01 (Cloudflare 전수조사): KV/R2/Durable Objects 바인딩을 빠짐없이 노출.
  //   기존엔 CACHE_KV/ANALYTICS_KV/MEDIA_BUCKET/PUBLIC_R2_URL/Durable Objects 가 빠져
  //   "프로덕션이 이상적으로 바인딩됐는지" 한 번에 확인 불가했음. 상세 진단은 /api/health/env-readiness.
  const kv = { SESSION_KV: !!e.SESSION_KV, RATE_LIMIT_KV: !!e.RATE_LIMIT_KV, CACHE_KV: !!e.CACHE_KV, ANALYTICS_KV: !!e.ANALYTICS_KV }
  const r2 = { MEDIA_BUCKET: !!e.MEDIA_BUCKET, BACKUP_BUCKET: !!e.BACKUP_BUCKET }
  const durableObjects = { LIVE_STREAM: !!e.LIVE_STREAM, RATE_LIMITER: !!e.RATE_LIMITER }
  return c.json({
    hasDB: !!env.DB,
    // 하위호환(기존 필드 유지 — env-check 페이지가 참조).
    hasSessionKV: kv.SESSION_KV,
    hasRateLimitKV: kv.RATE_LIMIT_KV,
    hasBackupBucket: r2.BACKUP_BUCKET,
    hasDiscordWebhook: !!e.DISCORD_WEBHOOK_URL,
    ktAlphaPinMode: e.KT_ALPHA_PIN_MODE === '1',
    // 🆕 전체 Cloudflare 인프라 바인딩 그룹.
    kv,
    r2,
    durableObjects,
    publicR2Url: e.PUBLIC_R2_URL || null,   // 있으면 media.ur-team.com 서빙(워커 과금 회피)
    environment: env.ENVIRONMENT,
    frontendUrl: env.FRONTEND_URL,
    region: env.REGION,
    envKeys: Object.keys(env || {}),
  })
})
