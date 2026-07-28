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

// 헬스체크 — 배포/서비스바인딩 검증용. gates: 자동수집/시트동기화가 **이 워커(ur-ads) env** 기준으로 켜졌는지
//   (2026-07-23 전수조사: 어드민 배너가 메인 워커 env 를 읽어 실제 cron 게이트와 어긋나던 것 — 메인이 이걸 물어 표시).
app.get('/__ads/health', (c) => {
  const e = c.env as unknown as Record<string, string | undefined>
  const on = (k: string) => e[k] === 'true'
  return c.json({
    ok: true, service: 'ur-ads',
    // ⚠️ 게이트는 **이 워커 env** 가 진실 — 메인(어드민)이 자기 env 를 읽어 표시하면 실제 cron 과 어긋난다
    //   (2026-07-28 실측: 어드민이 전부 OFF 로 보였는데 실제 가동 여부 불명). 파트너 트랙 게이트 전부 노출.
    gates: {
      auto_collect: on('ADS_AUTO_COLLECT_ENABLED'), sheets_sync: on('ADS_SHEETS_SYNC_ENABLED'),
      company_collect: on('ADS_COMPANY_COLLECT_ENABLED'), storeinfo: on('ADS_STOREINFO_ENABLED'),
      commerce: on('ADS_COMMERCE_ENABLED'), franchise: on('ADS_FRANCHISE_ENABLED'),
      nps: on('ADS_NPS_ENABLED'), work24: on('ADS_WORK24_ENABLED'), localdata: on('ADS_LOCALDATA_ENABLED'),
      enrich_disabled: on('ADS_ENRICH_DISABLED'),
    },
  })
})

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

// 📝 인플루언서 풀 보강 1라운드(블로거 활동성·연락처 + 링크인바이오) — 수집과 **분리된 인보케이션**.
//   왜 분리했는지는 `influencer-enrich-lane.ts` 헤더(라이브 실측: 수집에 얹혀 있어 한 건도 못 돌았음).
//   💥 원문 릴레이 — 'FAILED' 로 뭉개면 라운드가 왜 안 도는지 라이브에서 알 길이 없다(파트너풀 레인과 동일).
app.post('/__ads/enrich-influencer', async (c) => {
  try {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    return c.json({ ok: true, stats: await runInfluencerEnrich(c.env) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
})

// 🔀 업체형 블로그/카페 → B2B 파트너풀 라우팅(수동 전용). **기본 dry-run** — `?apply=1` 이어야 실제 저장.
//   외부 요청 0회(D1 만) — 상호+블로그URL 을 넘기면 파트너풀 보강 레인이 전화/이메일을 채운다.
app.post('/__ads/route-biz-blogs', async (c) => {
  try {
    const { routeBusinessBlogsToPartnerPool } = await import('@/features/marketing/api/biz-blog-router')
    const max = Math.max(100, Math.min(20000, parseInt(c.req.query('max') || '', 10) || 3000))
    return c.json({ ok: true, stats: await routeBusinessBlogsToPartnerPool(c.env, { dryRun: c.req.query('apply') !== '1', max, reset: c.req.query('reset') === '1' }) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
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
    // 💥 원문 릴레이(2026-07-28) — 'FAILED' 로 뭉개면 라이브에서 라운드가 왜 안 끝나는지 알 길이 없다.
    //   내부 진단 엔드포인트(어드민 위임 전용)라 원문 노출 대상이 관리자로 한정된다.
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
})

// 💼 고용24 채용기업 수집 — 채용 중(성장 신호) 광고·마케팅·판촉 계열 기업 발굴. 수동=게이트 무관.
app.post('/__ads/collect-work24', async (c) => {
  try {
    const { runWork24JobsCollect } = await import('@/features/marketing/api/work24-jobs-collect')
    return c.json({ ok: true, stats: await runWork24JobsCollect(c.env) })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 👥 국민연금 규모 검증 — 기존 리드(대행사 우선)의 직원수(가입자수) 조회(엄격 매칭, 허위 0).
app.post('/__ads/collect-nps', async (c) => {
  try {
    const { runNpsWorkplaceEnrich } = await import('@/features/marketing/api/nps-workplace-enrich')
    const stats = await runNpsWorkplaceEnrich(c.env, 100) // 40→100(2026-07-27 대표 "더 정확히" — data.go.kr 쿼터 여유)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🏭 도매몰 제조사·판매사 후보 수집 — 게이트 `SUPPLY_MAKER_COLLECT_ENABLED`(cron 측에서 검사, 수동은 무관).
//   ⚠️ 서비스 분리: 이 워커에 두는 이유는 **매시간 트리거(`0 * * * *`)가 여기에만 있기 때문**이다
//   (배포된 ur-live 워커의 트리거는 `*/5`·`0 18`·`0 19` 뿐 — 2026-07-28 Cloudflare API 실측).
//   이 잡은 도매(supply) 테이블만 건드리고 소비자/마케팅 데이터에 쓰지 않는다.
app.post('/__ads/collect-maker', async (c) => {
  try {
    const { runMakerCollect } = await import('@/features/supply/api/maker-collect')
    return c.json({ ok: true, stats: await runMakerCollect(c.env) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
})

// ☎️ 카카오 전용 전화 스윕 — 보류 리드 전화 대량 채움(시간당 기본 600건, 카카오만 — 네이버 쿼터 무접촉).
app.post('/__ads/sweep-kakao-phone', async (c) => {
  try {
    const { runKakaoPhoneSweep } = await import('@/features/marketing/api/company-collect')
    return c.json({ ok: true, stats: await runKakaoPhoneSweep(c.env) })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🧭 파트너 리드 소급 재분류 — 공고/정부페이지 제거 + 업종을 리드 자신의 텍스트 근거로 재적용(배치 커서).
app.post('/__ads/reclassify-company', async (c) => {
  try {
    const { reclassifyCompanyLeads } = await import('@/features/marketing/api/company-discovery')
    // passes: 한 인보케이션에서 N패스(기본 1) — cron 이 5패스로 호출(2026-07-28 실측: SELF 바인딩이면
    //   엔드포인트가 1패스만 돌아 시간당 1,000행에 그쳤음. 잔여 10.9만 → 4.5일 소요되던 병목).
    const passes = Math.min(8, Math.max(1, parseInt(c.req.query('passes') || '1', 10) || 1))
    let stats = await reclassifyCompanyLeads(c.env.DB, 1000, c.req.query('light') !== '1') // light=억제스윕 생략
    let total = stats.scanned
    for (let i = 1; i < passes && !stats.done; i++) { stats = await reclassifyCompanyLeads(c.env.DB, 1000, false); total += stats.scanned }
    return c.json({ ok: true, stats: { ...stats, scanned: total } })
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

// 📑 나라장터 조달업체(대행사 계열) 수동 수집 트리거 — 메인 어드민이 env.ADS 로만 호출. 게이트 무관(수동=의도).
app.post('/__ads/collect-nara-vendor', async (c) => {
  try { const { runNaraVendorCollect } = await import('@/features/marketing/api/nara-vendor-collect'); return c.json({ ok: true, stats: await runNaraVendorCollect(c.env, 5) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🎓 나이스 학원·교습소 · 🏥 심평원 병원 수동 수집 트리거 — 메인 어드민이 env.ADS 로만 호출. 게이트 무관(수동=의도).
app.post('/__ads/collect-neis', async (c) => {
  try { const { runNeisAcademyCollect } = await import('@/features/marketing/api/neis-academy-collect'); return c.json({ ok: true, stats: await runNeisAcademyCollect(c.env, 6) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})
app.post('/__ads/collect-hira', async (c) => {
  try { const { runHiraHospitalCollect } = await import('@/features/marketing/api/hira-hospital-collect'); return c.json({ ok: true, stats: await runHiraHospitalCollect(c.env, 6) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 📮 이메일 재검증 스윕 수동 트리거 — 기존 저장 이메일의 죽은 도메인(반송 확정) 정리.
app.post('/__ads/sweep-mx', async (c) => {
  try { const { sweepEmailMx } = await import('@/features/marketing/api/email-mx-sweep'); return c.json({ ok: true, stats: await sweepEmailMx(c.env) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🏛️ 사업자 폐업 스윕 수동 트리거 — 국세청 상태조회 활용신청 검증 겸(메인 어드민이 env.ADS 로만 호출).
app.post('/__ads/sweep-nts', async (c) => {
  try {
    const { sweepBusinessStatus } = await import('@/features/marketing/api/business-status-sweep')
    const stats = await sweepBusinessStatus(c.env)
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

// 🌙 야간 자동 정비 — cron(SELF.fetch)이 새 invocation 예산으로 호출. 어드민 버튼과 동일 SSOT 모듈.
//   ?phase=merge|reextract|reclassify|quality — 2026-07-28: 단계별 **자체 인보케이션**(fresh 예산). 무료 플랜의
//   실효 상한(인보케이션당 ~29 D1 연산)에선 4단계를 한 번에 돌 수 없다(= 07-27 이후 무음 정지의 원인).
//   phase 없으면 4단계 순차(🧰 전체 정비 버튼 폴백 — 각 단계가 내부적으로 자기 예산을 쓴다).
app.post('/__ads/maintenance', async (c) => {
  try {
    const m = await import('@/features/marketing/api/influencer-maintenance')
    const p = c.req.query('phase')
    const r = m.isMaintPhase(p) ? await m.runMaintenancePhase(c.env, p) : await m.runNightlyMaintenance(c.env)
    return c.json({ ok: true, ...r })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})
app.post('/__ads/maintenance-rescan', async (c) => {
  try {
    const { runNightlyRescan } = await import('@/features/marketing/api/influencer-maintenance')
    const r = await runNightlyRescan(c.env)
    return c.json({ ok: true, ...r })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🎓 신청자 온보딩 안내(신청 익일 1회) — 기본 ON(약속 이행). 킬스위치 ADS_ONBOARDING_DISABLED.
app.post('/__ads/inbound-onboarding', async (c) => {
  try {
    const { runInboundOnboarding } = await import('@/features/marketing/api/inbound-onboarding')
    return c.json({ ok: true, ...(await runInboundOnboarding(c.env)) })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

// 🔁 동의 리드 리마인드(1회 시퀀스) — 게이트 ADS_REMINDER_ENABLED(기본 OFF)·야간 스킵은 러너 내부에서.
app.post('/__ads/consented-reminder', async (c) => {
  try {
    const { runConsentedReminder } = await import('@/features/marketing/api/consented-reminder')
    const r = await runConsentedReminder(c.env)
    return c.json({ ok: true, ...r })
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
  // 🚧 서브리퀘스트 격리(2026-07-27 실사고 "Too many subrequests by single Worker invocation") — 한 cron
  //   인보케이션에 트랙이 겹치면(인플루언서 수집 ~수백 fetch + 시트 미러 + 업체 보강/상가정보 …) 합산이
  //   인보케이션 한도를 넘어 늦게 실행되는 트랙(YT 검색·저장)이 중간에 죽음. 각 트랙을 SELF 서비스바인딩으로
  //   **자체 인보케이션**(fresh 한도)에 격리 — 야간 정비(18/19시)와 동일 패턴. SELF 미바인딩이면 직접 실행
  //   폴백(로컬 안전). 실패는 fail-soft(매시간 cron 이라 다음 틱 재시도).
  const kick = (path: string, fallback: () => Promise<unknown>): void => {
    ctx.waitUntil((async () => {
      try {
        if (env.SELF?.fetch) await env.SELF.fetch(new Request(`https://ur-ads${path}`, { method: 'POST' }))
        else await fallback()
      } catch { /* fail-soft */ }
    })())
  }

  // ── 매시간(정각) — 소셜 유지보수 + 인플루언서 자동수집 ──────────────────────
  ctx.waitUntil((async () => {
    try {
      const { handleSocialMaintenance } = await import('@/worker/cron/social-maintenance')
      await handleSocialMaintenance(env)
    } catch { /* fail-soft */ }
  })())
  // 🎯 인플루언서 자동 수집 — 대표 "무한하게, 가능할 때까지". 매시간 순환 발굴 → 공용 풀 누적.
  //   YT 쿼터 소진 시 그 틱부터 네이버만(quotaHit 가드) → 다음날 자동 재개. 게이트 ADS_AUTO_COLLECT_ENABLED.
  if (env.ADS_AUTO_COLLECT_ENABLED === 'true') {
    kick('/__ads/collect', async () => { const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect'); return runInfluencerAutoCollect(env) })
  }
  // 📝 인플루언서 풀 보강 시간당 N라운드 — **수집 게이트와 분리**(2026-07-28).
  //   배경(라이브 실측): 보강 4종이 수집과 같은 인보케이션에 얹혀 있어 발굴이 서브리퀘스트를 다 쓰고 나면
  //   전부 0 으로 즉시 반환했다(`naver_enrich.tried:0` · `bio_enriched:0` 고착 · 표본 1,000행 중
  //   `perf_checked_at` 채워진 행 0). 그 결과 풀 37,414명 중 연락처 보유가 8.8% 에 고정 —
  //   특히 74%를 차지하는 네이버 블로거는 활동성조차 한 번도 측정된 적이 없다.
  //   ⇒ 파트너풀 이메일 보강과 동일한 처방: **라운드 = 독립 인보케이션 = 새 서브리퀘스트 예산**.
  //   각 라운드가 perf_checked_at/bio_checked_at 도장을 찍어 다음 라운드는 다음 구간을 이어 순회(중복 0).
  //   기본 ON(킬스위치 ADS_INFLUENCER_ENRICH_DISABLED='true' 만 끔) — 켜야 도는 구조로 두면
  //   "켠 줄 알았는데 안 돌던" 사고(제조사 수집 cron 누락)를 반복한다.
  if ((env as unknown as { ADS_INFLUENCER_ENRICH_DISABLED?: string }).ADS_INFLUENCER_ENRICH_DISABLED !== 'true') {
    const rounds = Math.min(20, Math.max(1, parseInt((env as unknown as { ADS_INFLUENCER_ENRICH_ROUNDS?: string }).ADS_INFLUENCER_ENRICH_ROUNDS || '', 10) || 6))
    ctx.waitUntil((async () => {
      try {
        if (env.SELF?.fetch) {
          for (let i = 0; i < rounds; i++) await env.SELF.fetch(new Request('https://ur-ads/__ads/enrich-influencer', { method: 'POST' }))
        } else {
          const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
          await runInfluencerEnrich(env) // SELF 미바인딩(로컬) — 1라운드만
        }
      } catch { /* fail-soft — 다음 틱 재시도 */ }
    })())
  }
  // 📊 매시간 구글시트 미러(수집 게이트와 독립 — 수집이 꺼져 있어도 큐레이션 변경분 반영).
  //   🛡️ 2026-07-23: 실패가 무음으로 사라지던 것 — 결과는 sheets-sync 가 platform_settings 에 기록하고,
  //   여기서 **에러가 바뀐 첫 회에만** Discord 경보(같은 에러 매시간 스팸 방지 · 회복되면 기록이 ok 로 리셋).
  //   동기화 자체는 SELF 인보케이션에서(풀 성장에 비례하는 D1 페이지 읽기+Sheets 쓰기를 수집과 격리),
  //   경보 판단만 여기서(응답 JSON 파싱 — 1 fetch + D1 1읽기라 가벼움).
  if (env.ADS_SHEETS_SYNC_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const prevRaw = await env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_sheets_last_sync'").first<{ value: string }>().catch(() => null)
        const prevErr = (() => { try { return (JSON.parse(prevRaw?.value || '{}') as { error?: string | null }).error || null } catch { return null } })()
        let r: { ok: boolean; error?: string | null }
        if (env.SELF?.fetch) {
          const resp = await env.SELF.fetch(new Request('https://ur-ads/__ads/sheets-sync', { method: 'POST' }))
          r = await resp.json().then(j => j as { ok: boolean; error?: string | null }).catch(() => ({ ok: false, error: 'SELF_RESPONSE_PARSE' }))
        } else {
          const { syncInfluencerPoolToSheets } = await import('@/features/marketing/api/sheets-sync')
          r = await syncInfluencerPoolToSheets(env)
        }
        if (!r.ok && env.DISCORD_WEBHOOK_URL && (r.error || '') !== (prevErr || '')) {
          const { sendDiscordAlert } = await import('@/worker/utils/discord-alert')
          await sendDiscordAlert(env.DISCORD_WEBHOOK_URL, '유어애즈 구글시트 동기화 실패', `${r.error || 'unknown'}\n(해결 전까지 시트 미러 정지 — 어드민 정비 도구에서 수동 재시도 가능)`, 'warn').catch(() => null)
        }
      } catch { /* fail-soft */ }
    })())
  }
  // 🔁 동의 리드 리마인드 — 매시간 시도(러너가 게이트 OFF/야간/무대상이면 no-op). 1인 1회(reminded_at CAS).
  if (env.ADS_REMINDER_ENABLED === 'true') {
    kick('/__ads/consented-reminder', async () => { const { runConsentedReminder } = await import('@/features/marketing/api/consented-reminder'); return runConsentedReminder(env) })
  }
  // 🎓 신청자 온보딩 안내 — 기본 ON(환영메일이 약속한 안내를 실제로 이행). 킬스위치만 끔. 무대상이면 no-op.
  if ((env as unknown as { ADS_ONBOARDING_DISABLED?: string }).ADS_ONBOARDING_DISABLED !== 'true') {
    kick('/__ads/inbound-onboarding', async () => { const { runInboundOnboarding } = await import('@/features/marketing/api/inbound-onboarding'); return runInboundOnboarding(env) })
  }
  // 🤝 파트너(업체) 자동수집 — 홀수시만(인플루언서는 매시간 유지 → 반토막 방지, 겹침 최소). 네이버 지역검색(local.json).
  //   게이트 ADS_COMPANY_COLLECT_ENABLED(기본 OFF). 별도 FetchBudget/커서/키워드 → 인플루언서 트랙 무영향.
  if (hourUTC % 2 === 1 && env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    kick('/__ads/collect-company', async () => { const { runCompanyAutoCollect } = await import('@/features/marketing/api/company-collect'); return runCompanyAutoCollect(env) })
  }
  // 📇 연락처 보강 자동 드레인 — **매시간, 수집 게이트와 분리**(2026-07-27 대표 "이메일 보유 대행사 13개" 원인:
  //   보강이 ADS_COMPANY_COLLECT_ENABLED 에 묶여, 수집 OFF 면 ADS_ENRICH_BUDGET 을 올려도 한 번도 안 돌았음).
  //   킬스위치 ADS_ENRICH_DISABLED='true' 만 끔. 키 없으면 내부에서 해당 단계 자연 스킵(fail-soft).
  if ((env as unknown as { ADS_ENRICH_DISABLED?: string }).ADS_ENRICH_DISABLED !== 'true') {
    // 📧 이메일 보강 시간당 **N라운드 순차** — 각 라운드가 SELF **독립 인보케이션(fresh 서브요청 예산)** 이고,
    //   1라운드가 enrich_checked_at 도장을 찍어 다음 라운드는 다음 백로그 구간을 이어 순회(중복 크롤 0).
    //   ⚠️ 2026-07-28 실측으로 라운드 수가 **유일한 처리량 레버**임이 확정됐다: 서브리퀘스트 수리 후 크롤이
    //   실제로 작동해 적중률 0%→45%(ok 5/11)가 됐지만, 학습된 실효 상한이 **29**(= 워커 호출당 한도가
    //   명목 1,000이 아니라 훨씬 낮고 D1 쿼리까지 나눠 씀) → **라운드당 11건**이 천장. 2라운드면 22건/시간인데
    //   백로그가 12만+ 이라 의미 있는 속도가 안 나온다. 라운드를 늘리는 것만이 정직한 증속(각 라운드가
    //   새 예산을 받으므로). SELF fetch 자체는 이 cron 인보케이션의 서브요청 1개씩이라 20라운드도 안전.
    const enrichRounds = Math.min(20, Math.max(1, parseInt((env as unknown as { ADS_ENRICH_ROUNDS?: string }).ADS_ENRICH_ROUNDS || '', 10) || 8))
    ctx.waitUntil((async () => {
      try {
        if (env.SELF?.fetch) {
          for (let i = 0; i < enrichRounds; i++) {
            await env.SELF.fetch(new Request('https://ur-ads/__ads/enrich-company', { method: 'POST' }))
          }
        } else { const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect'); await enrichHeldLeads(env) }
      } catch { /* fail-soft — 다음 틱 재시도 */ }
    })())
    // ☎️ 카카오 전용 전화 스윕 — 보류 대량 전화 채움(카카오 쿼터 10만/일 활용, 네이버·크롤 무접촉).
    kick('/__ads/sweep-kakao-phone', async () => { const { runKakaoPhoneSweep } = await import('@/features/marketing/api/company-collect'); return runKakaoPhoneSweep(env) })
    // 🧭 소급 재분류 — 매시간 5패스×1000건(DB-only, 외부 API 0·예산 무소모 — 규칙 버전 bump 후 전량
    //   재검사도 클릭 없이 ~하루면 자동 소진). 기사제목/키워드메아리/쓰레기전화/의심이름 자동 청소.
    kick('/__ads/reclassify-company?passes=5', async () => {
      const { reclassifyCompanyLeads } = await import('@/features/marketing/api/company-discovery')
      let last = await reclassifyCompanyLeads(env.DB, 1000) // 첫 패스만 housekeeping(억제 스윕)
      for (let i = 1; i < 5 && !last.done; i++) last = await reclassifyCompanyLeads(env.DB, 1000, false)
      return last
    })
  }
  // 🏭 2026-07-28: 제조사·판매사 풀 자동 수집 — **배선 누락 수리**(대표 "제조사는 왜 저렇게 적어?").
  //   `runMakerCollect` 는 어드민 수동 버튼에만 연결돼 있었고 **cron 이 어디에도 없어서** 제조사 풀이
  //   수동 실행분(82건)에 고착했다. 게이트 `SUPPLY_MAKER_COLLECT_ENABLED` 도 상태 배지 표시에만 쓰여
  //   "켜도 아무 일이 없는" 상태였다 → 여기서 실제 스케줄에 연결한다.
  //   ⚠️ 이 워커에 두는 이유: **매시간 트리거가 여기에만 존재**(배포된 ur-live 워커는 `*/5`·`0 18`·`0 19`
  //   뿐 — 2026-07-28 Cloudflare API 실측). kick = SELF 독립 인보케이션이라 보강 레인과 서브리퀘스트 예산을
  //   나눠 쓰지 않는다. 도매(supply) 테이블만 건드리므로 서비스 분리 위반 아님.
  if (env.SUPPLY_MAKER_COLLECT_ENABLED === 'true') {
    kick('/__ads/collect-maker', async () => {
      const { runMakerCollect } = await import('@/features/supply/api/maker-collect')
      return runMakerCollect(env)
    })
  }
  // 🏪 상가정보(공공데이터) 자동수집 — 짝수시만(company-collect 홀수시와 분리, 예산 반토막 방지).
  //   게이트 ADS_STOREINFO_ENABLED(기본 OFF). 별도 커서/예산 → 다른 트랙 무영향. 연락처는 네이버 역조회로 보강.
  if (hourUTC % 2 === 0 && env.ADS_STOREINFO_ENABLED === 'true') {
    kick('/__ads/collect-storeinfo', async () => { const { runStoreInfoCollect } = await import('@/features/marketing/api/store-info-collect'); return runStoreInfoCollect(env) })
  }
  // 💼 고용24 채용기업 — 일 1회(hourUTC===15 = KST 00시). 게이트 ADS_WORK24_ENABLED(기본 OFF).
  if (hourUTC === 15 && (env as unknown as { ADS_WORK24_ENABLED?: string }).ADS_WORK24_ENABLED === 'true') {
    kick('/__ads/collect-work24', async () => { const { runWork24JobsCollect } = await import('@/features/marketing/api/work24-jobs-collect'); return runWork24JobsCollect(env) })
  }
  // 👥 국민연금 규모 검증 — 일 1회(hourUTC===16 = KST 01시). 게이트 ADS_NPS_ENABLED(기본 OFF).
  if (hourUTC === 16 && (env as unknown as { ADS_NPS_ENABLED?: string }).ADS_NPS_ENABLED === 'true') {
    kick('/__ads/collect-nps', async () => { const { runNpsWorkplaceEnrich } = await import('@/features/marketing/api/nps-workplace-enrich'); return runNpsWorkplaceEnrich(env, 100) })
  }
  // 📮 이메일 재검증 스윕 — 일 1회(hourUTC===17 = KST 02시). 기존 저장 이메일의 죽은 도메인(반송 확정) 정리.
  if (hourUTC === 17 && env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try { const { sweepEmailMx } = await import('@/features/marketing/api/email-mx-sweep'); await sweepEmailMx(env) } catch { /* fail-soft */ }
    })())
  }
  // 📑 나라장터 조달업체(대행사 계열) — 일 1회(hourUTC===23 = KST 08시). 게이트 ADS_NARA_VENDOR_ENABLED.
  if (hourUTC === 23 && (env as unknown as { ADS_NARA_VENDOR_ENABLED?: string }).ADS_NARA_VENDOR_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try { const { runNaraVendorCollect } = await import('@/features/marketing/api/nara-vendor-collect'); await runNaraVendorCollect(env, 5) } catch { /* fail-soft */ }
    })())
  }
  // 🏛️ 사업자 폐업 스윕 — 일 1회(hourUTC===19 = KST 04시). 사업자번호 보유 리드 100건/일 국세청 상태조회 →
  //   폐업이면 active=0(죽은 연락처에 아웃리치 낭비 방지). fail-soft(활용신청 전엔 no-op + note).
  if (hourUTC === 19 && env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { sweepBusinessStatus } = await import('@/features/marketing/api/business-status-sweep')
        await sweepBusinessStatus(env)
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
  // 🎓 학원(NEIS) · 🏥 병원(심평원) 매시간 소량 수집 — 각자 게이트(기본 OFF), 커서 순환으로 전국을 며칠에 커버.
  if ((env as unknown as { ADS_NEIS_ENABLED?: string }).ADS_NEIS_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try { const { runNeisAcademyCollect } = await import('@/features/marketing/api/neis-academy-collect'); await runNeisAcademyCollect(env, 3) } catch { /* fail-soft */ }
    })())
  }
  if ((env as unknown as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try { const { runHiraHospitalCollect } = await import('@/features/marketing/api/hira-hospital-collect'); await runHiraHospitalCollect(env, 3) } catch { /* fail-soft */ }
    })())
  }
  // 📧 매장 후보 이메일 우선 연락처 보강 자동 드레인 — **매시간, 수집 게이트와 분리**(2026-07-27 — 회사 풀과
  //   동일 병목: 인허가 게이트 OFF 면 보강도 0회이던 결합 해소). 킬스위치 ADS_ENRICH_DISABLED 만 끔.
  if ((env as unknown as { ADS_ENRICH_DISABLED?: string }).ADS_ENRICH_DISABLED !== 'true') {
    kick('/__ads/enrich-prospects', async () => { const { enrichProspectContacts } = await import('@/features/marketing/api/prospect-enrich'); return enrichProspectContacts(env) })
  }
  // 📦 과거 백필 1청크(ADS_LOCALDATA_BACKFILL_DAYS 설정 시) — 인허가 트랙 게이트 유지(수집 예산 소비).
  if ((env as unknown as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      try {
        const { runLocalDataBackfill } = await import('@/features/marketing/api/localdata-collect')
        await runLocalDataBackfill(env, 2)
      } catch { /* fail-soft */ }
    })())
  }
  const envx = env as unknown as { ADS_COMMERCE_ENABLED?: string; ADS_FRANCHISE_ENABLED?: string; ADS_NOTICE_ENABLED?: string }
  // 🛒 통신판매사업자 — 짝수시(상가정보와 같은 창이나 별도 커서·예산). 🏢 공정위 가맹 — hourUTC===22(주 1회 성격, 매일 소량 페이지).
  if (hourUTC % 2 === 0 && envx.ADS_COMMERCE_ENABLED === 'true') {
    kick('/__ads/collect-commerce', async () => { const { runCommerceCollect } = await import('@/features/marketing/api/commerce-notify-collect'); return runCommerceCollect(env) })
  }
  if (hourUTC === 22 && envx.ADS_FRANCHISE_ENABLED === 'true') {
    kick('/__ads/collect-franchise', async () => { const { runFranchiseCollect } = await import('@/features/marketing/api/franchise-collect'); return runFranchiseCollect(env) })
  }
  // 📢 공고 스캐너 — 일 1회(hourUTC===21 = KST 06시). 게이트 ADS_NOTICE_ENABLED.
  if (hourUTC === 21 && envx.ADS_NOTICE_ENABLED === 'true') {
    kick('/__ads/scan-notices', async () => { const { runNoticeScan } = await import('@/features/marketing/api/notice-scan'); return runNoticeScan(env) })
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

  // ── 🌙 자동 정비 = **매시간 1단계 순환** + 19:00 UTC(=KST 04시) 라이브 재보정 (2026-07-26 대표 "버튼 말고 자동으로") ──
  //   버튼 시퀀스(🧬중복통합→🔗재추출→🏷️재분류→🏅품질)의 자동화 — influencer-maintenance SSOT(버튼과 동일 로직, 멱등).
  //   SELF 바인딩으로 **자체 인보케이션**에서 실행(fresh 서브리퀘스트 예산 — 같은 틱의 다른 레인과 예산 미공유). 미바인딩 시 직접 실행 폴백.
  //   기본 ON(대표 지시) — 끄려면 ur-ads env ADS_AUTO_MAINTENANCE_ENABLED='false'. 결과는 platform_settings 에 기록(무음 실패 방지).
  //   🩹 2026-07-28 근본수리: 기존엔 18시에 **4단계를 한 인보케이션**으로 몰아 돌렸다. 무료 플랜의 실효
  //   서브리퀘스트 상한은 ~29(학습값)인데 정비 1회는 수백~수천 D1 연산이 필요해 **매번 첫 단계 도중 죽었고**,
  //   모든 D1 호출이 `.catch(()=>null)` 이라 결과 스탬프조차 못 남겨 "07-26 이후 멈춤"으로 보였다.
  //   ⇒ ① 매시간 **한 단계씩 순환**(단계당 fresh 인보케이션 예산 — 하루 24회 ≈ 단계별 6회) ② 각 단계는 커서로
  //      다음 회차에 이어받는다 ③ 결과는 예산 밖에서 항상 기록. **새 cron 추가 없음**(무료 계정 cron 5/5 소진).
  if (env.ADS_AUTO_MAINTENANCE_ENABLED !== 'false') {
    const PHASES = ['merge', 'reextract', 'reclassify', 'quality'] as const
    const phase = PHASES[hourUTC % PHASES.length]
    kick(`/__ads/maintenance?phase=${phase}`, async () => {
      const { runMaintenancePhase } = await import('@/features/marketing/api/influencer-maintenance')
      return runMaintenancePhase(env, phase)
    })
  }
  // 🧭 라이브 재보정(YouTube 쿼터 소비)은 기존대로 하루 1회(19:00 UTC = KST 04시)만.
  if (hourUTC === 19 && env.ADS_AUTO_MAINTENANCE_ENABLED !== 'false') {
    kick('/__ads/maintenance-rescan', async () => {
      const { runNightlyRescan } = await import('@/features/marketing/api/influencer-maintenance')
      return runNightlyRescan(env)
    })
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
