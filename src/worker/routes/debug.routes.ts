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
  return c.json({
    hasDB: !!env.DB,
    hasSessionKV: !!(env as any).SESSION_KV,
    hasRateLimitKV: !!(env as any).RATE_LIMIT_KV,
    hasBackupBucket: !!(env as any).BACKUP_BUCKET,
    environment: env.ENVIRONMENT,
    frontendUrl: env.FRONTEND_URL,
    region: env.REGION,
    envKeys: Object.keys(env || {}),
  })
})
