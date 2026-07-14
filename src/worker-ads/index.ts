/**
 * 🆕 2026-07-14 유어애즈 독립 Worker 엔트리 (Phase A 스캐폴드).
 *   설계 SSOT: docs/design/urads-worker-split.md.
 *
 *   메인 Pages Worker(ur-live)가 Service Binding `env.ADS` 로 `/api/ads/*` · `/api/admin/ads/*` · `/l/*`
 *   를 이 Worker 에 위임한다. 같은 D1(database_id d9530ba6…) + 같은 JWT_SECRET 바인딩(대표 Cloudflare 셋업).
 *
 *   ⚠️ Phase A: 아직 라이브 미배선(메인 index.ts 무변경). 이 파일은 type-check 만 되고 어떤 번들에도
 *   포함되지 않음(메인 build:worker 는 src/worker/index.ts 만, vite 는 src/main.tsx 만 엔트리로 사용).
 *   실제 배포는 Phase B(별도 wrangler-ads.toml + esbuild)에서. 컷오버는 Phase C(ADS_WORKER_ENABLED 게이트).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'
import { adminAdsRoutes } from '@/features/marketing/api/admin-ads.routes'
import { shortLinkRedirectRoutes } from '@/features/marketing/api/routes/shortlink-redirect.routes'

const app = new Hono<{ Bindings: Env }>()

// 🔎 식별 헤더 — 이 워커가 실제로 서빙 중임을 외부에서 확정하기 위한 신호(운영/컷오버 검증용).
//   메인이 Service Binding 으로 위임하면 이 헤더가 응답에 실려 나감(메인 로컬 폴백엔 없음) → ur-ads 경유 확인 가능.
app.use('*', async (c, next) => {
  await next()
  try { c.res.headers.set('X-Served-By', 'ur-ads') } catch { /* 불변 응답 등 — 무시 */ }
})

// 헬스체크 — 배포/서비스바인딩 검증용.
app.get('/__ads/health', (c) => c.json({ ok: true, service: 'ur-ads' }))

// 메인 Worker 의 마운트와 동일 경로 — Service Binding 위임 시 URL 이 그대로 전달되므로 경로 일치가 중요.
app.route('/', shortLinkRedirectRoutes)      // /l/:code (공개 리다이렉트)
app.route('/api/ads', marketingRoutes)        // 유어애즈 데이터/인증 API
app.route('/api/admin/ads', adminAdsRoutes)   // 유어애즈 운영 어드민

export default app
