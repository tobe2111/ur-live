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

// 🔁 인플루언서 수집 self-chain — YT 예산 버스트용. 한 인보케이션이 1회 수집 후, 예산이 남고 SELF 바인딩이 있으면
//   다음 인보케이션(fresh 서브리퀘스트 예산)을 waitUntil 로 던지고 즉시 반환 → 오케스트레이터 시간제한 없이
//   하루 예산(기본 100회)을 백그라운드에서 끝까지 소진. 가드: depth 40 상한 + 예산소진/쿼터초과/진전없음 시 중단.
//   SELF 미바인딩이면 chained=false 로 1회만 실행(메인 오케스트레이터가 시간예산 내 폴백). 메인 어드민/자기자신만 호출.
app.post('/__ads/collect-chain', async (c) => {
  const depth = Math.max(0, parseInt(c.req.query('depth') || '0', 10) || 0)
  const pv = parseInt(c.req.query('pu') || '-1', 10); const prevUsed = Number.isFinite(pv) ? pv : -1
  let stats: import('@/features/marketing/api/influencer-auto-collect').AutoCollectStats | null = null
  try {
    const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
    stats = await runInfluencerAutoCollect(c.env)
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
  const yb = stats?.yt_budget
  const used = yb && typeof yb.used === 'number' ? yb.used : -1
  const total = yb && typeof yb.total === 'number' ? yb.total : 0
  const done = !!stats?.youtube_quota_hit || !yb || used >= total || used <= prevUsed || depth >= 40 // 소진/쿼터/진전없음/깊이 상한
  let chained = false
  if (!done && c.env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    c.executionCtx.waitUntil(c.env.SELF.fetch(new Request(`https://ur-ads/__ads/collect-chain?depth=${depth + 1}&pu=${used}`, { method: 'POST' })).then(() => undefined).catch(() => undefined))
  }
  return c.json({ ok: true, stats, chained })
})

// 🤝 파트너(업체) 수동 수집 트리거 — 메인 어드민이 env.ADS(서비스바인딩)로만 호출(외부 도달 불가). 게이트 무관(수동=의도).
app.post('/__ads/collect-company', async (c) => {
  try {
    const { runCompanyAutoCollect } = await import('@/features/marketing/api/company-collect')
    const stats = await runCompanyAutoCollect(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 📧 파트너 리드 연락처 보강(보류 리드 이메일 크롤) — 메인 어드민이 env.ADS 로만 호출.
app.post('/__ads/enrich-company', async (c) => {
  try {
    const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect')
    const stats = await enrichHeldLeads(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🏪 상가정보(공공데이터) 수동 수집 트리거 — 메인 어드민이 env.ADS 로만 호출. 게이트 무관(수동=의도).
app.post('/__ads/collect-storeinfo', async (c) => {
  try {
    const { runStoreInfoCollect } = await import('@/features/marketing/api/store-info-collect')
    const stats = await runStoreInfoCollect(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🛒 통신판매사업자 · 🏢 공정위 가맹정보 · 📢 공고 스캐너 수동 트리거 — 메인 어드민이 env.ADS 로만 호출.
app.post('/__ads/collect-commerce', async (c) => {
  try { const { runCommerceCollect } = await import('@/features/marketing/api/commerce-notify-collect'); return c.json({ ok: true, stats: await runCommerceCollect(c.env) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})
app.post('/__ads/collect-franchise', async (c) => {
  try { const { runFranchiseCollect } = await import('@/features/marketing/api/franchise-collect'); return c.json({ ok: true, stats: await runFranchiseCollect(c.env) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})
app.post('/__ads/scan-notices', async (c) => {
  try { const { runNoticeScan } = await import('@/features/marketing/api/notice-scan'); return c.json({ ok: true, stats: await runNoticeScan(c.env) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🏪 매장 후보(인허가) 수동 수집 트리거 — 메인 어드민이 env.ADS 로만 호출. 게이트 무관(수동=의도).
//   전일 변동분 + (백필 설정 시) 과거 1청크도 함께 진행 — 버튼 누를수록 축적 가속.
app.post('/__ads/collect-localdata', async (c) => {
  try {
    const { runLocalDataCollect, runLocalDataBackfill } = await import('@/features/marketing/api/localdata-collect')
    const stats = await runLocalDataCollect(c.env)
    const backfill = await runLocalDataBackfill(c.env, 2).catch(() => null)
    return c.json({ ok: true, stats, backfill })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 📧 매장 후보(인허가) 이메일 우선 연락처 보강 — 메인 어드민이 env.ADS 로만 호출. 게이트 무관(수동=의도).
app.post('/__ads/enrich-prospects', async (c) => {
  try {
    const { enrichProspectContacts } = await import('@/features/marketing/api/prospect-enrich')
    const stats = await enrichProspectContacts(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 📊 인플루언서 풀 → 구글시트 수동 동기화 — 메인 어드민이 서비스바인딩으로만 호출(외부 도달 불가).
app.post('/__ads/sheets-sync', async (c) => {
  try {
    const { syncInfluencerPoolToSheets } = await import('@/features/marketing/api/sheets-sync')
    const r = await syncInfluencerPoolToSheets(c.env)
    return c.json(r, r.ok ? 200 : 400)
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 메인 Worker 의 마운트와 동일 경로 — Service Binding 위임 시 URL 이 그대로 전달되므로 경로 일치가 중요.
app.route('/', shortLinkRedirectRoutes)      // /l/:code (공개 리다이렉트)
app.route('/api/ads', marketingRoutes)        // 유어애즈 데이터/인증 API
app.route('/api/admin/ads', adminAdsRoutes)   // 유어애즈 운영 어드민
app.route('/api/admin/social', socialMediaRoutes) // 🥗 소셜 홍보 자동화(자체 requireAdmin, 같은 JWT_SECRET)

// ⏰ Cron — ⚠️ 2026-07-20: Cloudflare **계정 전체 cron 5개 한도**(code 10072)에 걸려 ur-ads 의 4개
//   등록이 통째로 거부됐음(→ 자동수집/일일배치 전부 미실행). **cron 1개("0 * * * *")로 통합** +
//   scheduled 핸들러 안에서 event.scheduledTime 의 시각/요일로 분기 → 계정 slot 부담 4→1.
//   (autobid "*/5" 는 게이트 OFF 기본이라 제거 — 필요 시 매시간 틱에서 게이트 뒤로 실행.)
async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const now = new Date(event.scheduledTime)
  const hourUTC = now.getUTCHours()
  const dowUTC = now.getUTCDay() // 0=일 … 1=월

  // ── 매시간(정각) — 소셜 유지보수 + 인플루언서 자동수집 ──────────────────────
  ctx.waitUntil((async () => {
    try {
      const { handleSocialMaintenance } = await import('@/worker/cron/social-maintenance')
      await handleSocialMaintenance(env)
    } catch { /* fail-soft */ }
  })())
  // 🎯 인플루언서 자동 수집 — 대표 "무한하게, 가능할 때까지". 매시간 순환 발굴 → 공용 풀 누적.
  //   YT 쿼터 소진 시 그 틱부터 네이버만(quotaHit 가드) → 다음날 자동 재개. 게이트 ADS_AUTO_COLLECT_ENABLED.
  ctx.waitUntil((async () => {
    if (env.ADS_AUTO_COLLECT_ENABLED === 'true') {
      try {
        const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
        await runInfluencerAutoCollect(env)
      } catch { /* fail-soft */ }
    }
    // 📊 매시간 구글시트 미러(수집 게이트와 독립 — 수집이 꺼져 있어도 큐레이션 변경분 반영).
    if (env.ADS_SHEETS_SYNC_ENABLED === 'true') {
      try {
        const { syncInfluencerPoolToSheets } = await import('@/features/marketing/api/sheets-sync')
        await syncInfluencerPoolToSheets(env)
      } catch { /* fail-soft */ }
    }
  })())
  // 🤝 파트너(업체) 자동수집 — 홀수시만(인플루언서는 매시간 유지 → 반토막 방지, 겹침 최소). 네이버 지역검색(local.json).
  //   게이트 ADS_COMPANY_COLLECT_ENABLED(기본 OFF). 별도 FetchBudget/커서/키워드 → 인플루언서 트랙 무영향.
  if (hourUTC % 2 === 1 && env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { runCompanyAutoCollect } = await import('@/features/marketing/api/company-collect')
        await runCompanyAutoCollect(env)
      } catch { /* fail-soft */ }
    })())
  }
  // 📇 연락처 보강 자동 드레인 — **매시간**(수집과 별개 예산). 보류(연락처 없는) 리드에 카카오 전화+홈페이지 크롤.
  //   게이트 ADS_COMPANY_COLLECT_ENABLED(수집 켜면 보강도 자동). 백로그를 시간당 ~45건씩 자동 소진 → 수동 클릭 불필요.
  if (env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect')
        await enrichHeldLeads(env)
      } catch { /* fail-soft */ }
    })())
  }
  // 🏪 상가정보(공공데이터) 자동수집 — 짝수시만(company-collect 홀수시와 분리, 예산 반토막 방지).
  //   게이트 ADS_STOREINFO_ENABLED(기본 OFF). 별도 커서/예산 → 다른 트랙 무영향. 연락처는 네이버 역조회로 보강.
  if (hourUTC % 2 === 0 && env.ADS_STOREINFO_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { runStoreInfoCollect } = await import('@/features/marketing/api/store-info-collect')
        await runStoreInfoCollect(env)
      } catch { /* fail-soft */ }
    })())
  }
  // 🏪 매장 후보(인허가) 변동분 — **일 1회**(hourUTC===20 = KST 05시, 전일 변동분 마감 후). 게이트 ADS_LOCALDATA_ENABLED.
  if (hourUTC === 20 && (env as unknown as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { runLocalDataCollect } = await import('@/features/marketing/api/localdata-collect')
        await runLocalDataCollect(env)
      } catch { /* fail-soft */ }
    })())
  }
  // 📧 매장 후보 이메일 우선 연락처 보강 자동 드레인 — **매시간**(수집과 별개 예산). 홈페이지 크롤/네이버 링크발견.
  //   게이트 ADS_LOCALDATA_ENABLED(매장 후보 트랙 켜면 보강도 자동). 이메일 백로그를 시간당 자동 소진.
  //   📦 + 과거 백필 1청크(ADS_LOCALDATA_BACKFILL_DAYS 설정 시) — 시간당 2일씩 역방향 소급 → 매장 DB 수량 확대.
  if ((env as unknown as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { enrichProspectContacts } = await import('@/features/marketing/api/prospect-enrich')
        await enrichProspectContacts(env)
      } catch { /* fail-soft */ }
      try {
        const { runLocalDataBackfill } = await import('@/features/marketing/api/localdata-collect')
        await runLocalDataBackfill(env, 2)
      } catch { /* fail-soft */ }
    })())
  }
  const envx = env as unknown as { ADS_COMMERCE_ENABLED?: string; ADS_FRANCHISE_ENABLED?: string; ADS_NOTICE_ENABLED?: string }
  // 🛒 통신판매사업자 — 짝수시(상가정보와 같은 창이나 별도 커서·예산). 🏢 공정위 가맹 — hourUTC===22(주 1회 성격, 매일 소량 페이지).
  if (hourUTC % 2 === 0 && envx.ADS_COMMERCE_ENABLED === 'true') {
    ctx.waitUntil((async () => { try { const { runCommerceCollect } = await import('@/features/marketing/api/commerce-notify-collect'); await runCommerceCollect(env) } catch { /* fail-soft */ } })())
  }
  if (hourUTC === 22 && envx.ADS_FRANCHISE_ENABLED === 'true') {
    ctx.waitUntil((async () => { try { const { runFranchiseCollect } = await import('@/features/marketing/api/franchise-collect'); await runFranchiseCollect(env) } catch { /* fail-soft */ } })())
  }
  // 📢 공고 스캐너 — 일 1회(hourUTC===21 = KST 06시). 게이트 ADS_NOTICE_ENABLED.
  if (hourUTC === 21 && envx.ADS_NOTICE_ENABLED === 'true') {
    ctx.waitUntil((async () => { try { const { runNoticeScan } = await import('@/features/marketing/api/notice-scan'); await runNoticeScan(env) } catch { /* fail-soft */ } })())
  }
  // 자동입찰(게이트 ON 일 때만) — 이전 "*/5" 대체(매시간). 기본 OFF = no-op.
  if (env.ADS_AUTOBID_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { runAutobidAll } = await import('@/features/marketing/api/autobid')
        await runAutobidAll(env)
      } catch { /* fail-soft */ }
    })())
  }

  // ── 매일 18:00 UTC — 일일 배치(가격→순위→스냅샷→알림→자동입찰 섀도우) ────────
  if (hourUTC === 18) {
    ctx.waitUntil((async () => {
      try { const { refreshAllWatches } = await import('@/features/marketing/api/price-monitor'); await refreshAllWatches(env) } catch { /* fail-soft */ }
      try { const { refreshAllRankTargets } = await import('@/features/marketing/api/rank-tracker'); await refreshAllRankTargets(env) } catch { /* fail-soft */ }
      try { const { snapshotAllAccounts } = await import('@/features/marketing/api/metrics-history'); await snapshotAllAccounts(env) } catch { /* fail-soft */ }
      try { const { runAlertsAll } = await import('@/features/marketing/api/alerts'); await runAlertsAll(env) } catch { /* fail-soft */ }
      try { const { runAutobidShadowAll } = await import('@/features/marketing/api/autobid'); await runAutobidShadowAll(env) } catch { /* fail-soft */ }
    })())
  }

  // ── 매일 23:00 UTC(=08:00 KST) — 유어애즈 아웃리치 팔로업 리마인더(무응답·회신도착 다이제스트) ──
  //   0건이면 무발송(no-op) — Discord 스팸 방지. 자동 감지는 웹훅(resend)이 실시간 처리, 여기선 요약만.
  if (hourUTC === 23) {
    ctx.waitUntil((async () => {
      try { const { runFollowupReminder } = await import('@/features/marketing/api/outreach-webhook'); await runFollowupReminder(env) } catch { /* fail-soft */ }
    })())
  }

  // ── 월요일 00:00 UTC — 소셜 초안 + 유어애즈 AI 주간 리포트 ────────────────────
  if (hourUTC === 0 && dowUTC === 1) {
    ctx.waitUntil((async () => {
      try { const { handleSocialDraft } = await import('@/worker/cron/social-draft'); await handleSocialDraft(env) } catch { /* fail-soft */ }
      try { const { handleAdsWeeklyReport } = await import('@/features/marketing/api/weekly-report'); await handleAdsWeeklyReport(env) } catch { /* fail-soft */ }
    })())
  }
}

export default { fetch: app.fetch, scheduled }
