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
import type { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'
import { adminAdsRoutes } from '@/features/marketing/api/admin-ads.routes'
import { shortLinkRedirectRoutes } from '@/features/marketing/api/routes/shortlink-redirect.routes'
// 🥗 2026-07-15 소셜 미디어 자동화(유어딜 자체 홍보) — 메인 워커 CF Free 1MB 한도 회복을 위해
//   여기(ur-ads 3MB)로 이전. 라우트는 자체 requireAdmin(같은 JWT_SECRET). 메인은 프록시 위임.
import { socialMediaRoutes } from '@/features/social-media/api/social-media.routes'

const app = new Hono<{ Bindings: Env }>()

// 🔎 식별 헤더 — 이 워커가 실제로 서빙 중임을 외부에서 확정하기 위한 신호(운영/컷오버 검증용).
//   메인이 Service Binding 으로 위임하면 이 헤더가 응답에 실려 나감(메인 로컬 폴백엔 없음) → ur-ads 경유 확인 가능.
app.use('*', async (c, next) => {
  await next()
  try { c.res.headers.set('X-Served-By', 'ur-ads') } catch { /* 불변 응답 등 — 무시 */ }
})

// 헬스체크 — 배포/서비스바인딩 검증용.
app.get('/__ads/health', (c) => c.json({ ok: true, service: 'ur-ads' }))

// 🎯 인플루언서 수동 수집 트리거 — 메인 어드민이 env.ADS(서비스바인딩)로만 호출(공개 라우팅 대상 아님:
//   메인 프록시는 /api/ads/* · /l/* 만 위임 → /__ads/* 는 외부에서 도달 불가). 게이트 무관(수동=의도).
app.post('/__ads/collect', async (c) => {
  try {
    const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
    const stats = await runInfluencerAutoCollect(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 메인 Worker 의 마운트와 동일 경로 — Service Binding 위임 시 URL 이 그대로 전달되므로 경로 일치가 중요.
app.route('/', shortLinkRedirectRoutes)      // /l/:code (공개 리다이렉트)
app.route('/api/ads', marketingRoutes)        // 유어애즈 데이터/인증 API
app.route('/api/admin/ads', adminAdsRoutes)   // 유어애즈 운영 어드민
app.route('/api/admin/social', socialMediaRoutes) // 🥗 소셜 홍보 자동화(자체 requireAdmin, 같은 JWT_SECRET)

// ⏰ Cron — 소셜 홍보 유지보수/초안(메인에서 이관). 전부 게이트 OFF 기본 → 미설정 시 no-op.
//   wrangler-ads.toml crons: "0 * * * *"(매시간 렌더폴링+예약발행) · "0 0 * * 1"(주간 초안).
async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const cron = event.cron
  // 🎯 Phase E(2026-07-18): 광고 cron 5종+섀도우 — 메인 scheduled.ts 에서 이관(설계 §4 Phase E).
  //   로직/게이트/멱등 전부 메인과 동일(같은 D1 이라 데이터 정합 무변). 메인 쪽은 같은 커밋에서 제거.
  if (cron === '*/5 * * * *') {
    // 자동입찰 — 글로벌 킬스위치(ADS_AUTOBID_ENABLED='true')일 때만 실제 동작(기본 OFF = no-op).
    if (env.ADS_AUTOBID_ENABLED === 'true') {
      ctx.waitUntil((async () => {
        try {
          const { runAutobidAll } = await import('@/features/marketing/api/autobid')
          await runAutobidAll(env)
        } catch { /* fail-soft */ }
      })())
    }
  }
  if (cron === '0 18 * * *') {
    // 일일 배치(순서 유지: 가격 갱신 → 순위 → 스냅샷 → 알림(최신 last_lowest 반영) → 자동입찰 섀도우).
    ctx.waitUntil((async () => {
      try {
        const { refreshAllWatches } = await import('@/features/marketing/api/price-monitor')
        await refreshAllWatches(env)
      } catch { /* fail-soft */ }
      try {
        const { refreshAllRankTargets } = await import('@/features/marketing/api/rank-tracker')
        await refreshAllRankTargets(env)
      } catch { /* fail-soft */ }
      try {
        const { snapshotAllAccounts } = await import('@/features/marketing/api/metrics-history')
        await snapshotAllAccounts(env)
      } catch { /* fail-soft */ }
      try {
        const { runAlertsAll } = await import('@/features/marketing/api/alerts')
        await runAlertsAll(env)
      } catch { /* fail-soft */ }
      try {
        const { runAutobidShadowAll } = await import('@/features/marketing/api/autobid')
        await runAutobidShadowAll(env)
      } catch { /* fail-soft */ }
    })())
    // 🎯 인플루언서 자동 수집(Phase E, 2026-07-20) — 게이트 ADS_AUTO_COLLECT_ENABLED='true' 일 때만.
    //   무료 공식 API(YouTube·네이버)로 시드 키워드 순환 발굴 → 공용 풀(account_id=0) 누적. 독립 fail-soft.
    if (env.ADS_AUTO_COLLECT_ENABLED === 'true') {
      ctx.waitUntil((async () => {
        try {
          const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
          await runInfluencerAutoCollect(env)
        } catch { /* fail-soft */ }
      })())
    }
  }
  if (cron === '0 * * * *') {
    ctx.waitUntil((async () => {
      try {
        const { handleSocialMaintenance } = await import('@/worker/cron/social-maintenance')
        await handleSocialMaintenance(env)
      } catch { /* fail-soft */ }
    })())
  }
  if (cron === '0 0 * * 1') {
    ctx.waitUntil((async () => {
      try {
        const { handleSocialDraft } = await import('@/worker/cron/social-draft')
        await handleSocialDraft(env)
      } catch { /* fail-soft */ }
    })())
    // 🎯 Phase E: 유어애즈 AI 주간 리포트(주당 1회 멱등, 연결 고객사만) — 메인 agency-weekly-batch 에서 이관.
    ctx.waitUntil((async () => {
      try {
        const { handleAdsWeeklyReport } = await import('@/features/marketing/api/weekly-report')
        await handleAdsWeeklyReport(env)
      } catch { /* fail-soft */ }
    })())
  }
}

export default { fetch: app.fetch, scheduled }
