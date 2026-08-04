import { envDriftInfo } from './env-drift'
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
import { makeHourGates, dailyGapMinutes, laneCadenceFields, staleGapMinutes, createLaneRegistry, recordKnownLanes, buildAgeInfo } from './lane-cadence'
import { registerPublicDataCrons } from './cron-public-data'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'
import { adminAdsRoutes } from '@/features/marketing/api/admin-ads.routes'
import { shortLinkRedirectRoutes } from '@/features/marketing/api/routes/shortlink-redirect.routes'
import { publicDataRoutes } from './public-data.routes'
import { chainRoutes } from './chain.routes'
import { createBeatBatch, makeBeatWriter } from './beat-batch'
import { closeTick } from './tail-bound'
import { runAutobidJob, runFollowupJob, runWeeklyJob } from './side-jobs'
import { dispatchPendingLanes, type RunnableLane } from './lane-runner'
import { laneUrl, selfBeatMiddleware } from './self-beat'
import { enrichRoutes } from './enrich.routes'
import { laneAlarmDrivesEnrich, bootstrapLaneAlarm } from './lane-alarm-boot'
import { scheduleMaintenanceCron } from './maintenance-cron'
import { healthRoutes } from './health.routes'
import { batchLaneRoutes } from './batch-lanes.routes'
// 🥗 2026-07-15 소셜 미디어 자동화(유어딜 자체 홍보) — 메인 워커 CF Free 1MB 한도 회복을 위해
//   여기(ur-ads 3MB)로 이전. 라우트는 자체 requireAdmin(같은 JWT_SECRET). 메인은 프록시 위임.
import { socialMediaRoutes } from '@/features/social-media/api/social-media.routes'

// 🌙 야간 재보정 시각 — 정의는 `rescan-hour.ts`(정비 cron 모듈과 공유하며 순환 import 를 피한다).
export { RESCAN_HOUR_UTC } from './rescan-hour'
import { RESCAN_HOUR_UTC } from './rescan-hour'

const app = new Hono<{ Bindings: Env }>()

// 🔎 식별 헤더 — 이 워커가 실제로 서빙 중임을 외부에서 확정하기 위한 신호(운영/컷오버 검증용).
//   메인이 Service Binding 으로 위임하면 이 헤더가 응답에 실려 나감(메인 로컬 폴백엔 없음) → ur-ads 경유 확인 가능.
app.use('*', async (c, next) => {
  await next()
  try { c.res.headers.set('X-Served-By', 'ur-ads') } catch { /* 불변 응답 등 — 무시 */ }
})

// 🫀 레인이 자기 하트비트를 쓴다 — 미들웨어 본체와 근거는 `self-beat.ts`(그 모듈의 관심사다).
app.use('/__ads/*', selfBeatMiddleware())

// 🎯 인플루언서 수동 수집 트리거 — 메인 어드민이 env.ADS(서비스바인딩)로만 호출(공개 라우팅 대상 아님:
//   메인 프록시는 /api/ads/* · /l/* 만 위임 → /__ads/* 는 외부에서 도달 불가). 게이트 무관(수동=의도).
app.post('/__ads/collect', async (c) => {
  try {
    const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
    const stats = await runInfluencerAutoCollect(c.env)
    return c.json({ ok: true, stats })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
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

// 🔗 원부 이메일 이식 — **D1 전용**(외부 API 0). 크론 배선이 없어 어드민 버튼으로만 돌던 것을 정규 레인으로.
//   한 인보케이션 = 한 예산. 커서가 백로그를 이어 순회하므로 매시간 조금씩 전량을 훑는다.
app.post('/__ads/match-registry', async (c) => {
  try {
    const { matchRegistryEmails } = await import('@/features/marketing/api/registry-email-match')
    const budget = { left: 45 } // 플랫폼 서브리퀘스트 한도(≈50) 안쪽 — D1 쿼리도 여기서 지불한다
    let last = null as Awaited<ReturnType<typeof matchRegistryEmails>> | null
    for (let i = 0; i < 5; i++) {
      last = await matchRegistryEmails(c.env, 400, budget)
      if (last.done || budget.left <= 8) break
    }
    return c.json({ ok: true, stats: last })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
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

// 🪦 `/__ads/sweep-kakao-phone` 제거 (2026-08-04) — **같은 일을 `sweep-kakao-chain` 이 한다**
//   (`index.ts` 의 kick, 같은 `runKakaoPhoneSweep`). 이 라우트는 아무도 안 불렀는데 이름만 남아
//   하트비트 행이 **6일째 stale** 로 `/api/_healthcheck/cron` 을 503 에 묶어 뒀다 → uptime 프로브가
//   장애 이슈를 6일간 열어 두고(코멘트 84개) **진짜 사이트 다운 감지를 가리고 있었다.**
//   ⇒ 이름이 은퇴하면 라우트·도메인 등록도 같이 지운다. 낡은 하트비트 행 자체는
//   `cron-beat-retirement.ts` 가 `retired` 로 갈라 게이트에서 뺀다(정보는 남기고 게이트만 만족 가능하게).

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

// 🏛️ 공공데이터 수집·스윕 수동 트리거 — 별 모듈로 추출(2026-07-28, god 파일 래칫). 경로/동작 불변.
app.route('/', publicDataRoutes)
app.route('/', chainRoutes)           // 🔁 self-chain 진입점(전화 스윕·인허가) — 인보케이션 천장 때문에 이어 돈다
app.route('/', healthRoutes)        // 🩺 /__ads/health (게이트·튜닝값 — 이 워커 env 가 진실)
app.route('/', enrichRoutes)          // 📝 인플루언서 보강 레인 + 라운드 드라이버
app.route('/', batchLaneRoutes)        // 🚦 부모 인라인이던 무거운 레인(daily-batch·social-maintenance)

// 📊 인플루언서 풀 → 구글시트 동기화 — 메인 어드민(수동 버튼)과 아래 cron 이 **같은 라우트**를 쓴다.
//   ⚠️ 그래서 `?by=cron` 으로 출처를 구분해 스탬프에 남긴다 — 이게 없어서 "마지막 동기화 07-27"이
//   'cron 고장'인지 '사람이 한 번 누른 것'인지 갈리지 않아 41시간을 오진했다(sheets-sync.ts 주석 참조).
app.post('/__ads/sheets-sync', async (c) => {
  try {
    const { syncInfluencerPoolToSheets } = await import('@/features/marketing/api/sheets-sync')
    const r = await syncInfluencerPoolToSheets(c.env, c.req.query('by') === 'cron' ? 'cron' : 'manual')
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
  // 💓🚨 2026-07-28: ur-ads 는 **실패를 어디에도 남기지 않았다** — 아래 catch 들이 전부 조용히 삼켜
  //   cron_failures·어드민 벨에 한 건도 도달하지 않았다(메인 워커의 safeCron 과 달리 래퍼가 없었다).
  //   게다가 실행 기록도 없어 "안 돌았다"조차 알 수 없었다 — 07-26~28 자동 정비 무음 정지가 그 결과다(#793/#826).
  //   ⇒ 메인의 safeCron 과 같은 계약을 여기에도 준다: **성공·실패 무관 하트비트 + 실패 통지**.
  //   ⚠️ 의미 주의: kick 은 SELF 로 '던지는' 것이라 이 하트비트는 **디스패치 성공**을 뜻한다
  //      (트랙 자체의 완료는 각 트랙이 남기는 스탬프 — ads_maintenance_last 등 — 로 본다).
  // 🏷️ 실패 사유 = `cronErrorCode`(SSOT·근거는 그 docblock) · `maxGapMin`(#847) — 두 관심사는 독립이다.
  // 🧾 하트비트는 **모아서 한 번에** 쓴다 — `kick` 당 D1 1회씩 쓰면 부모 비용이 2N 이 되어
  //   천장(~50)에 닿고, 넘는 순간 뒤쪽 레인은 **디스패치도 실패 기록도 못 한다**(근거: beat-batch.ts).
  //   🛡️ 부모의 실패 기록이 자식의 성공을 덮지 않는 가드까지 포함한다 — 근거는 `beat-batch.ts`.
  const tickStartIso = new Date().toISOString()   // 회차 키 — 하트비트 가드와 이력이 같은 값을 쓴다
  const beats = createBeatBatch(makeBeatWriter(env, tickStartIso))
  // 📦 `extra` = 실패 사유와 **독립**인 부가 관측(예: 배포 직후 회차를 스스로 신고하는 build_age_min).
  //   오늘 세 번의 오진이 전부 "이 회차가 배포와 겹쳤나"를 사후에 못 봐서 났다 — 성공 회차에도 실어야 한다.
  const adsBeat = async (name: string, ok: boolean, ms: number, err?: unknown, maxGapMin?: number, extra?: Record<string, unknown>): Promise<void> => {
    try {
      const { cronErrorCode } = await import('@/worker/utils/cron-heartbeat')
      // 💥 **분류만 남기면 아무것도 못 고친다** — `cronErrorCode` 는 `name || 'Error'` 라, 평범한 Error 는
      //   메시지를 통째로 잃고 `err=Error` 한 단어가 된다. 2026-08-01 라이브가 정확히 그 상태였다:
      //   외부 HTTP 를 쓰는 레인 **12개**가 매시간 죽는데 기록이 전부 `err=Error` 라 원인 후보를 하나도
      //   못 좁혔다(자식이 죽으면 #904 의 자식측 기록도 안 남는다 — 그 경우 부모의 이 한 줄이 유일하다).
      //   ⇒ 분류(limit/timeout/…)는 그대로 두고 **원문을 함께** 싣는다. `summarizeResult` 가 72자로 자른다.
      const detail = ok ? '' : String((err as { message?: string } | null)?.message || err || '').slice(0, 160)
      const result = ok ? extra : { err: cronErrorCode(err), ...(detail ? { detail } : {}), ...(extra || {}) }
      beats.add({ name: `ads:${name}`, ok, ms, cron: event.cron, result, maxGapMin })
    } catch { /* 관측 실패가 작업을 막지 않는다 */ }
    if (!ok) {
      try {
        const { reportCronFailure } = await import('@/worker/utils/cron-reporter')
        await reportCronFailure(env as never, `ads:${name}`, err, { cron: event.cron }, 'error')
      } catch { /* 통지 실패도 삼킨다 */ }
    }
  }

  //   `beatName` — 경로가 바뀌어도 하트비트 이름을 고정(바꾸면 옛 행이 남아 stale watch 가 영원히 경보).
  const laneReg = createLaneRegistry()
  //   `gap` — 이 레인의 **실제** 기대 간격(분). 안 주면 매시간(= event.cron)으로 본다.
  //     일 1회/N시간 레인은 `gates.dailyAt`/`gates.everyNHours` 가 조건과 함께 자동으로 넣어준다
  //     — 조건과 주기를 따로 적으면 어긋나고, 어긋나도 조용하다(lane-cadence.ts 주석 참조).
  //   🚦 `pending` — 예전엔 `kick` 이 **즉시** 띄웠다. 그러면 한 정각에 15개가 동시에 매달려 부모
  //   예산(실측 ~10.5s)을 넘기고 **진행 중이던 7개가 한꺼번에 잘렸다**(늘 뒤쪽 같은 레인들 —
  //   값을 만드는 보강 레인이 10시간 굶은 원인). 이제 모아 두었다가 예산만큼만 띄운다.
  //   근거·배정 규칙·유료 전환 시 자동 확대: `dispatch-budget.ts`.
  const pending: RunnableLane[] = []
  const kick = (path: string, fallback: () => Promise<unknown>, opts?: { gap?: number; period?: number; beat?: string }): void => {
    const beat = opts?.beat || path.replace(/^\/__ads\//, '')
    laneReg.note(path, opts?.beat)   // 하트비트 이름과 **같은 이름**으로 등록해야 never_fired/orphan 이 어긋나지 않는다
    /**
     * 🕳️ **`gap` 을 안 주면 그 레인은 침묵 판정에서 통째로 빠진다** (2026-08-03 라이브 실측).
     *
     *   위 주석은 *"안 주면 매시간(= event.cron)으로 본다"* 고 적혀 있는데, **자식 하트비트에는
     *   그 유도가 없다.** 부모의 쓰기(`adsBeat`)는 `cron: event.cron` 을 싣지만, 레인이 응답 직전에
     *   쓰는 자기 하트비트(`writeSelfBeat`)는 설계상 cron 을 **일부러 안 싣고** 부모가 넘긴 `gap` 만
     *   믿는다(`self-beat.ts` — 레인은 자기 주기를 모르니 추측하면 일 1회 레인이 오경보를 낸다).
     *   그런데 자식 쓰기가 **나중**이라 부모가 실어 둔 `cron` 을 덮는다. 결과:
     *   `{"at":…,"ok":true,"ms":17004}` — `cron` 도 `g` 도 없다.
     *
     *   `getCronHealth` 는 `max_gap_min ?? expectedMaxAgeMinutes(cron)` 이 **둘 다 없으면**
     *   그 레인을 `missing` 으로 분류하고 **stale 검사에서 제외**한다. 게다가 `missing` 은
     *   `ok` 를 깨지 않는다 ⇒ **그 레인은 죽어도 dead-man's switch 가 안 울린다.**
     *   실측으로 `ads:sweep-kakao-chain`(17초, 매시간)이 정확히 그 상태였다 —
     *   *"안 도는 것"* 이 아니라 *"판정 대상이 아닌 것"* 이라 아무도 못 봤다.
     *
     *   ⇒ 문서화된 그 유도를 **여기서 실제로 한다**. 게이트 레인(`gates.*`)은 이미 자기 주기를
     *   명시로 넘기므로 이 기본값에 닿지 않는다 — 일 1회 레인이 매시간으로 오인될 위험은 없다.
     */
    pending.push({ beat, path, fallback, ...laneCadenceFields(opts) })  // 주기/임계 조립 SSOT: lane-cadence.ts
  }
  const gates = makeHourGates(hourUTC, kick, laneReg)
  /**
   * ⏰ **알람이 모는 레인은 부모가 손을 뗀다** — 판정은 한 번만 하고 아래 세 곳이 같이 본다
   *   (수집 · 보강 · 정비). `let` 이 아니라 여기서 선언하는 이유: 수집 게이트가 보강 블록보다
   *   **위**에 있어, 선언이 아래 있으면 TDZ 로 런타임에 터진다(작성 중 실제로 밟았다).
   */
  const laneAlarmOn = laneAlarmDrivesEnrich(env)

  // 🔔 이 워커의 cron 이 '울리기는 했다'는 사실 자체를 남긴다 — 개별 트랙이 전부 게이트 OFF 여도
  //   ur-ads 스케줄러가 살아있는지 구분할 수 있어야 한다(멈춤 경보의 최소 신호).
  //   🕐 이 회차가 **새 배포 직후인지**를 함께 남긴다 — 배포는 진행 중인 isolate 를 죽이므로
  //   배포 창에 걸린 정각 회차는 아무 일도 못 하고 사라진다(2026-07-29 에 그걸 세 번 오진했다:
  //   `ms=0` · 카운터 +0 을 보고 코드 결함으로 읽었는데 실제로는 배포와 겹친 것이었다).
  //   `build_age_min` 이 작으면(≈0~2) 그 회차의 관측은 **판정 근거로 쓰면 안 된다.**
  //   🔌 **설정했는데 코드가 안 읽는 env 키**도 같이 신고한다(2026-08-03) — 실측에서 4개 나왔고
  //   넷 다 오류를 안 낸다(대시보드엔 값이 보이는데 코드는 기본값으로 돈다). 이상 없으면 키가 아예 안 붙는다.
  ctx.waitUntil(adsBeat('scheduled', true, 0, undefined, undefined, { ...buildAgeInfo(), ...envDriftInfo(env) }))

  // ── 매시간(정각) — 소셜 유지보수 + 인플루언서 자동수집 ──────────────────────
  //   🚦 2026-08-02: 생 waitUntil(부모 CPU 직격, 실측 2,390ms/회차) → kick(자식 예산). 예산 분산에도 잡힌다.
  kick('/__ads/social-maintenance', async () => {
    const { handleSocialMaintenance } = await import('@/worker/cron/social-maintenance')
    return handleSocialMaintenance(env)
  })
  // 🎯 인플루언서 자동 수집 — 대표 "무한하게, 가능할 때까지". 매시간 순환 발굴 → 공용 풀 누적.
  //   YT 쿼터 소진 시 그 틱부터 네이버만(quotaHit 가드) → 다음날 자동 재개. 게이트 ADS_AUTO_COLLECT_ENABLED.
  //   🔁 2026-07-29 시간당 N라운드(`collect-chain`) — 1라운드로는 키워드 3개에서 예산이 끊겨 활성 210개
  //   한 바퀴에 70시간이었다. ⚠️ 라운드를 **여기서 N번 부르지 않는다**: 이 핸들러도 서브리퀘스트 50 을
  //   공유하는데 이미 보강 레인 둘이 14 라운드를 던진다 — 더 부풀리면 waitUntil 꼬리(다른 레인)가 조용히
  //   죽는다. 오케스트레이터는 1건만 던지고 체인이 스스로 잇는다. 하트비트 이름은 'collect' 고정(바꾸면
  //   옛 `cron_hb:ads:collect` 가 남아 침묵 경보). 경위: docs/CURRENT_WORK.md 10차.
  //   🎯 2026-08-03: 알람이 몰면 부모는 손을 뗀다(예산 1칸/4레인 = 4시간에 한 번인데 그마저 CPU 사망 —
  //   실측 6시간 20분 정지, 상세는 `lane-alarm-runners.ts` collect 항목). 리스가 있어도 겹쳐 던지는
  //   것 자체가 부모 CPU 를 먹으므로 게이트로 끊는다.
  if (!laneAlarmOn && env.ADS_AUTO_COLLECT_ENABLED === 'true') {
    kick('/__ads/collect-chain', async () => { const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect'); return runInfluencerAutoCollect(env) }, { beat: 'collect' })
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
  //   🔁 2026-07-29 **라운드를 체인으로** — 라운드 수는 그대로지만 오케스트레이터가 내는 비용이 6 → 1 이다.
  //   근거는 바로 아래 시트 미러 블록이 이미 적어 둔 실패 양식이다: 부모가 예산을 다 쓰면 **SELF.fetch 1개조차
  //   못 써서 throw** 한다(그래서 러너가 '시작조차 못 함'). 라운드를 부모에서 6번 부르면 그 위험을 6배로
  //   키우고, 그 피해는 waitUntil 목록에서 **뒤에 선 다른 레인**이 받는다. 체인은 각 라운드가 자기
  //   인보케이션에서 다음을 잇게 해 부모 비용을 1로 고정한다(수집 레인과 같은 구조).
  //  ⏰ **알람이 몰면 cron 은 손을 뗀다**(2026-08-02 시범) — 게이트·부트스트랩·근거는 `lane-alarm-boot.ts`.
  //   (`laneAlarmOn` 선언은 위 gates 옆으로 올렸다 — 수집 게이트가 이 블록보다 위에 있어서다.)
  if (laneAlarmOn) ctx.waitUntil(bootstrapLaneAlarm(env, adsBeat))
  if (!laneAlarmOn && (env as unknown as { ADS_INFLUENCER_ENRICH_DISABLED?: string }).ADS_INFLUENCER_ENRICH_DISABLED !== 'true') {
    // 🔁 라운드 루프는 **드라이버 인보케이션**이 돈다(`/__ads/enrich-influencer-driver`).
    //   여기서 for-await 로 돌리면 라운드 수만큼 부모의 서브리퀘스트를 먹는데, 부모는 이미 매시간
    //   11개 레인 × 2(fetch+하트비트) ≈ 31/50 을 쓰고 있다 — 라운드를 늘릴수록 **뒤쪽 waitUntil
    //   (시트 미러 등)부터 굶는다.** kick 1개로 넘기면 부모 비용은 고정 2, 라운드는 드라이버의
    //   독립 예산에서 돈다. 덤으로 이 레인도 드디어 하트비트가 찍힌다(그전엔 생 waitUntil 이라
    //   **관측 밖** — 조용히 멈춰도 아무도 몰랐다).
    // 🤝 **cron 도 자식을 기다린다**(2026-08-02 — 라이브 2회 반증 후 교정).
    //   드라이버가 즉시 반환하면 부모 `waitUntil` 이 0.6초에 풀려 손자가 통째로 취소된다
    //   (이 파일들이 이미 적어 둔 규칙: *"피호출자는 호출자보다 오래 살 수 없다"*).
    //   실측·근거·되돌릴 이유가 없는 까닭(최악=현상 유지)은 `ads-fanout-cron-sync.test.ts` 헤더에.
    //   ⚠️ 대기는 I/O 라 CPU 를 안 쓴다 · `sync=1` 은 릴레이도 막아 대기가 1라운드(~7초)로 유계다.
    kick('/__ads/enrich-influencer-driver?sync=1', async () => {
      const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
      return runInfluencerEnrich(env) // SELF 미바인딩(로컬) — 1라운드만
    }, { beat: 'enrich-influencer-driver' })
  }
  // ✍ 발송 큐 상위 초안 미리 채우기 — 실측: 발송가능 22,533명인데 접촉 0명, 큐 상위 표본은 전원 초안 없음.
  //   사람이 10명마다 AI 를 기다리는 구조라 수집·보강을 아무리 빨리 해도 접촉 수가 안 는다.
  //   💰 **AI 호출 = 비용**이라 기본 OFF(블로그 AI 초안 `BLOG_AI_DRAFTS_ENABLED` 와 같은 하우스 패턴).
  //   켜도 버퍼 상한(기본 100)까지만 — 22,533명 전량 생성은 레인 자체가 구조적으로 못 한다.
  //   ⚖️ [LEGAL] 생성만, 발송 없음(콜드 리드 자동발송 경로 없음 — 사람이 1건씩 검토·발송).
  if ((env as unknown as { ADS_OUTREACH_PREFILL_ENABLED?: string }).ADS_OUTREACH_PREFILL_ENABLED === 'true') {
    kick('/__ads/prefill-outreach-drafts', async () => {
      const { runOutreachDraftPrefill } = await import('@/features/marketing/api/outreach-draft-prefill')
      return runOutreachDraftPrefill(env)
    })
  }
  // 📊 매시간 구글시트 미러(수집 게이트와 독립 — 수집이 꺼져 있어도 큐레이션 변경분 반영).
  //   🔔 2026-07-29 **하트비트 배선**(#882) — 이 레인만 `kick()` 을 안 거쳐 생 `waitUntil` 이라 지금까지
  //   **관측 밖**이었다. `cron-stale-watch` 는 *한 번도 기록이 없는 이름을 판정 대상으로 잡지 못하므로*,
  //   멈춰도 침묵 경보에 안 걸렸다(실측: 다른 13개 레인이 다 돈 회차에 이것만 3시간 전 기록 그대로).
  //   🧹 2026-07-29 본문은 `sheets-mirror-lane.ts` 로 분리(엔트리 600줄 캡) — **동작 불변, 위치만**.
  //   ⏰ 2026-08-04 알람이 몰면 cron 은 손을 뗀다(전 레인 최다 CPU 사망 ×16 — 근거·⚠️행중복 방어는
  //   `lane-alarm-runners.ts` sheets-sync 항목). 시트 미러는 리스가 없어 이 게이트가 유일한 방어다.
  if (!laneAlarmOn && env.ADS_SHEETS_SYNC_ENABLED === 'true') {
    ctx.waitUntil((async () => {
      const { runSheetsMirrorLane } = await import('./sheets-mirror-lane')
      await runSheetsMirrorLane(env, adsBeat)
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
  if (env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    gates.everyNHours(2, 1, '/__ads/collect-company', async () => { const { runCompanyAutoCollect } = await import('@/features/marketing/api/company-collect'); return runCompanyAutoCollect(env) })
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
    //   새 예산을 받으므로).
    //   🔁 2026-07-29: 라운드 루프를 **드라이버 인보케이션**으로 옮겼다(`/__ads/enrich-company-driver`).
    //     여기서 돌리면 라운드 수만큼 부모의 서브리퀘스트를 먹는데, 부모는 이미 11개 레인 kick 으로
    //     천장 근처다 — 07:00 실측에서 인플루언서 수집이 **실패 기록조차 못 남겼다.** 드라이버로 넘기면
    //     부모 비용은 라운드 수와 무관하게 kick 1개(+하트비트)로 고정된다. 근거는 그 라우트 주석 참조.
    //     덤으로 이 레인도 드디어 하트비트가 찍힌다(그전엔 생 waitUntil 이라 조용히 멈춰도 몰랐다).
    kick('/__ads/enrich-company-driver', async () => {
      const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect')
      return enrichHeldLeads(env) // SELF 미바인딩(로컬) — 1라운드만
    }, { beat: 'enrich-company' })
    // 🔗 원부 이메일 이식 — 매시간. **외부 API 0·D1 전용**이라 크롤 한도와 무관하고, 크롤 한 번 없이
    //   타깃(대행사·전문서비스)에 이메일/홈페이지를 붙인다. 2026-07-28 까지 **크론이 아예 없어서**
    //   어드민이 버튼을 누를 때만 돌았다 — 자동수집이 영구적으로 돌아야 한다는 원칙의 누락분.
    kick('/__ads/match-registry', async () => {
      const { matchRegistryEmails } = await import('@/features/marketing/api/registry-email-match')
      return matchRegistryEmails(env, 400, { left: 45 })
    })
    // ☎️ 카카오 전용 전화 스윕 — 보류 대량 전화 채움(카카오 쿼터 10만/일 활용, 네이버·크롤 무접촉).
    //   체인 진입점 — 한 라운드(≈55건)에서 끝내지 않고 진전이 있는 한 이어 돈다(chain.routes.ts 주석).
    kick('/__ads/sweep-kakao-chain', async () => { const { runKakaoPhoneSweep } = await import('@/features/marketing/api/company-collect'); return runKakaoPhoneSweep(env) })
    // 🧭 소급 재분류 — 매시간 5패스×1000건(DB-only, 외부 API 0·예산 무소모 — 규칙 버전 bump 후 전량
    //   재검사도 클릭 없이 ~하루면 자동 소진). 기사제목/키워드메아리/쓰레기전화/의심이름 자동 청소.
    // ⚠️ beat 를 **현재 이름 그대로** 고정한다(쿼리 포함). 깔끔한 이름으로 바꾸면 라이브의 옛 행
    //   `ads:reclassify-company?passes=5` 가 남아 stale watch 가 영원히 울린다 — 이름은 못생겨도 안정이 먼저다.
    //   passes 값을 바꿔도 하트비트가 개명되지 않는다(그게 이 고정의 목적).
    kick('/__ads/reclassify-company?passes=5', async () => {
      const { reclassifyCompanyLeads } = await import('@/features/marketing/api/company-discovery')
      const { reclassifyWorkPlan } = await import('@/features/marketing/api/collect-budget')
      /**
       * ⏱️ **패스 루프에 마감선** (2026-08-03 라이브 실측 — 이 레인은 **매시간 CPU 한도로 죽고 있었다**).
       *
       *   `cron_hb:ads:reclassify-company?passes=5` → `ok=false ms=3880 detail=Worker exceeded CPU time limit.`
       *   5패스 × 1,000행 × 행당 정규식 ~20개 = **10만 회**를 한 인보케이션에서 돌린다. 이건
       *   `ads-cpu-work-cap` 이 이미 세운 교리 — *"막아야 하는 건 페이지 크기가 아니라 **인보케이션당 총량**"* —
       *   을 이 **호출부**가 어기고 있던 것이다(함수 자체는 호출당 1,000행으로 이미 묶여 있다).
       *
       *   ✅ **커버리지 손실 0**: 각 패스가 끝날 때 커서를 저장하고 `done:false` 로 남긴다 —
       *     일찍 멈춰도 다음 회차가 그 지점부터 이어받는다(시간만 더 걸린다).
       *   ⚠️ 벽시계는 CPU 의 **근사**다(대기 시간이 섞인다). 정확한 계측은 런타임이 안 준다 —
       *     그래서 관측된 사망 지점(3,880ms)의 **절반 아래**로 잡는다.
       *
       *   🩹 **2026-08-04 — 시간만으론 못 막았다.** 마감선 1,800ms 를 넣고도 `ms=1316` 에 CPU 한도로
       *     죽었다(자기 마감선에 닿기도 전에). 외부 호출 없는 DB-only 루프라 **벽시계가 안 흐르는데
       *     정규식은 CPU 를 계속 태운다** ⇒ 교리대로 **행 총량**으로도 묶는다(시간 상한은 병행).
       */
      const { rowsPerPass, maxRows, deadlineMs } = reclassifyWorkPlan(env)
      const t0 = Date.now()
      let last = await reclassifyCompanyLeads(env.DB, rowsPerPass) // 첫 패스만 housekeeping(억제 스윕)
      let passes = 1, rows = rowsPerPass
      for (; passes < 5 && !last.done && rows < maxRows && Date.now() - t0 < deadlineMs; passes++, rows += rowsPerPass) last = await reclassifyCompanyLeads(env.DB, rowsPerPass, false)
      // 관측: 매번 상한에서 끊기면 더 내려야 한다는 신호다(그때 커서 전진률을 같이 볼 것).
      return { ...last, passes, rows, elapsed_ms: Date.now() - t0, stopped_by: last.done ? 'done' : (rows >= maxRows ? 'rows' : (Date.now() - t0 >= deadlineMs ? 'deadline' : 'passes')) }
    }, { beat: 'reclassify-company?passes=5' })
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
  // 🏪 무인매장(아이스크림 할인점·무인판매점) — 매시간. 카카오 로컬 키워드 검색이라 인허가 승인과 무관하고
  //   **전화가 함께 들어온다**(네이버 지역검색은 전화가 빈값). 게이트 ADS_STORE_KAKAO_ENABLED(기본 OFF).
  if ((env as unknown as { ADS_STORE_KAKAO_ENABLED?: string }).ADS_STORE_KAKAO_ENABLED === 'true') {
    kick('/__ads/collect-store-kakao', async () => {
      const { runStoreKakaoCollect } = await import('@/features/marketing/api/store-kakao-collect')
      return runStoreKakaoCollect(env)
    })
  }
  // 🏪 상가정보(공공데이터) 자동수집 — 짝수시만(company-collect 홀수시와 분리, 예산 반토막 방지).
  //   게이트 ADS_STOREINFO_ENABLED(기본 OFF). 별도 커서/예산 → 다른 트랙 무영향. 연락처는 네이버 역조회로 보강.
  if (env.ADS_STOREINFO_ENABLED === 'true') {
    gates.everyNHours(2, 0, '/__ads/collect-storeinfo', async () => { const { runStoreInfoCollect } = await import('@/features/marketing/api/store-info-collect'); return runStoreInfoCollect(env) })
  }
  // 💼 고용24 채용기업 — 일 1회(hourUTC===15 = KST 00시). 게이트 ADS_WORK24_ENABLED(기본 OFF).
  if ((env as unknown as { ADS_WORK24_ENABLED?: string }).ADS_WORK24_ENABLED === 'true') {
    gates.dailyAt(15, '/__ads/collect-work24', async () => { const { runWork24JobsCollect } = await import('@/features/marketing/api/work24-jobs-collect'); return runWork24JobsCollect(env) })
  }
  // 👥 국민연금 규모 검증 — 일 1회(hourUTC===16 = KST 01시). 게이트 ADS_NPS_ENABLED(기본 OFF).
  if ((env as unknown as { ADS_NPS_ENABLED?: string }).ADS_NPS_ENABLED === 'true') {
    // ⏱️ 100 → 40 **되돌림** (2026-08-02 01:00 KST 실측 — CPU 한도로 26.6초에 사망).
    //   40→100 은 07-28(#768)이고 이 레인의 **마지막 성공은 07-27** 이다. 즉 올린 뒤로 한 번도
    //   성공한 적이 없다. "쿼터 여유" 는 맞았지만 병목이 쿼터가 아니라 CPU 였다.
    gates.dailyAt(16, '/__ads/collect-nps', async () => { const { runNpsWorkplaceEnrich } = await import('@/features/marketing/api/nps-workplace-enrich'); return runNpsWorkplaceEnrich(env) })
  }
  // 📮 이메일 재검증 스윕 — 일 1회(hourUTC===17 = KST 02시). 기존 저장 이메일의 죽은 도메인(반송 확정) 정리.
  if (env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    gates.dailyAt(17, '/__ads/sweep-mx', async () => { const { sweepEmailMx } = await import('@/features/marketing/api/email-mx-sweep'); return sweepEmailMx(env) })
  }
  // 🏛️ 나라장터 계약정보(상권활성화 용역) — 일 1회(hourUTC===23 = KST 08시). 게이트 ADS_NARA_CONTRACT_ENABLED.
  if ((env as unknown as { ADS_NARA_CONTRACT_ENABLED?: string }).ADS_NARA_CONTRACT_ENABLED === 'true') {
    gates.dailyAt(23, '/__ads/collect-nara-contract', async () => { const { runNaraContractCollect } = await import('@/features/marketing/api/nara-contract-collect'); return runNaraContractCollect(env) })
  }
  // 🏛️ 사업자 폐업 스윕 — 일 1회(hourUTC===19 = KST 04시). 사업자번호 보유 리드 100건/일 국세청 상태조회 →
  //   폐업이면 active=0(죽은 연락처에 아웃리치 낭비 방지). fail-soft(활용신청 전엔 no-op + note).
  if (env.ADS_COMPANY_COLLECT_ENABLED === 'true') {
    gates.dailyAt(19, '/__ads/sweep-nts', async () => { const { sweepBusinessStatus } = await import('@/features/marketing/api/business-status-sweep'); return sweepBusinessStatus(env) })
  }
  // 🏪 매장 후보(인허가) 변동분 — **일 1회**(hourUTC===20 = KST 05시, 전일 변동분 마감 후). 게이트 ADS_LOCALDATA_ENABLED.
  //   ⚠️ 2026-07-28: 직접 await → **kick(독립 인보케이션)**. 이 스케줄 핸들러의 waitUntil 블록들은
  //   **하나의 인보케이션**을 공유하므로, 인허가(업종 16 × 페이지) + NEIS + 심평원 + 백필이 서로의
  //   서브리퀘스트를 잡아먹어 라이브가 `⛔ 요청한도 도달` 로 `found:0` 에 고착했다. kick 은 각자 새 예산을 받는다.
  if ((env as unknown as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true') {
    //   체인 진입점(2026-07-29) — 업종 16개를 하루 1회로는 못 훑는다(그래서 음식점·카페·미용·숙박이 0건이었다).
    gates.dailyAt(20, '/__ads/collect-localdata-chain', async () => { const { runLocalDataCollect } = await import('@/features/marketing/api/localdata-collect'); return runLocalDataCollect(env) })
  }
  // 🎓 학원(NEIS) · 🏥 병원(심평원) 매시간 소량 수집 — 각자 게이트(기본 OFF), 커서 순환으로 전국을 며칠에 커버.
  // ⏱️ 슬라이스 숫자는 **레인 안**에 있다(2026-08-02 — 요금제별 명시값 `envPlanValue`). 여기서 리터럴로
  //   넘기면 그 기본값이 죽는다. 되돌림 근거(6→3 · CPU 26초)는 값 옆(neis-academy-collect)에 있고,
  //   `ads-cpu-deadline` 유닛이 그 위치에서 무료 실효값을 고정한다.
  //   ⚠️ 무료 값을 올리려면 하트비트의 `ms` 를 먼저 볼 것. 26,000 근처면 그게 천장이다.
  if ((env as unknown as { ADS_NEIS_ENABLED?: string }).ADS_NEIS_ENABLED === 'true') {
    kick('/__ads/collect-neis', async () => { const { runNeisAcademyCollect } = await import('@/features/marketing/api/neis-academy-collect'); return runNeisAcademyCollect(env) })
  }
  if ((env as unknown as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED === 'true') {
    kick('/__ads/collect-hira', async () => { const { runHiraHospitalCollect } = await import('@/features/marketing/api/hira-hospital-collect'); return runHiraHospitalCollect(env) })
  }
  // 📧 매장 후보 이메일 우선 연락처 보강 자동 드레인 — **매시간, 수집 게이트와 분리**(2026-07-27 — 회사 풀과
  //   동일 병목: 인허가 게이트 OFF 면 보강도 0회이던 결합 해소). 킬스위치 ADS_ENRICH_DISABLED 만 끔.
  if ((env as unknown as { ADS_ENRICH_DISABLED?: string }).ADS_ENRICH_DISABLED !== 'true') {
    kick('/__ads/enrich-prospects', async () => { const { enrichProspectContacts } = await import('@/features/marketing/api/prospect-enrich'); return enrichProspectContacts(env) })
  }
  // 📦 과거 백필 1청크(ADS_LOCALDATA_BACKFILL_DAYS 설정 시) — 인허가 트랙 게이트 유지(수집 예산 소비).
  //   ⚠️ 이 레인이 이 워커에서 가장 폭발적이었다(2일 × 16업종 × 6페이지 = 최대 192 fetch, **매시간**).
  //   인라인이던 동안 같은 인보케이션의 다른 작업들(시트 미러 포함)까지 예산을 굶겼을 가능성이 크다.
  if ((env as unknown as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true') {
    kick('/__ads/collect-localdata?mode=backfill', async () => { const { runLocalDataBackfill } = await import('@/features/marketing/api/localdata-collect'); return runLocalDataBackfill(env) }, { beat: 'collect-localdata?mode=backfill' })
  }
  // 🏛️ 공공데이터 계열 4종(통신판매·공정위가맹·전통시장·공고) — 시각/게이트는 `cron-public-data.ts` SSOT.
  registerPublicDataCrons(env, gates)
  runAutobidJob(env, adsBeat, (p) => ctx.waitUntil(p))

  // ── 매일 18:00 UTC — 일일 배치(가격→순위→스냅샷→알림→자동입찰 섀도우) ────────
  //   🚦 2026-08-02: 생 waitUntil(부모 CPU 직격, 실측 4,107ms) → kick. 이 시각은 collect-commerce(짝수시)와
  //   겹치는 가장 무거운 회차라, 부모에서 4초를 태우면 꼬리 레인이 그대로 잘린다(08-02 01:00·03:00 실측).
  gates.dailyAt(18, '/__ads/daily-batch', async () => {
    const { runAdsDailyBatch } = await import('./daily-batch') // 5단계 순차(순서에 의미) — 그 파일 헤더 참조
    return runAdsDailyBatch(env)
  })

  // ── 🔔 매일 23:00 UTC(KST 08시) — **레인 침묵 요약을 유어애즈 채널로 push**.
  //   근거·소음 억제 설계는 `silence-digest.ts` 헤더. 요약은 D1 읽기 몇 번뿐이라 가볍고,
  //   ⚠️ 시각을 **한산한 회차**로 골랐다 — 이 요약이 무거운 회차의 꼬리에 붙으면 부모 CPU 한도에
  //   잘려, 하필 *"레인이 잘린다"* 를 알리는 경보가 같은 이유로 안 온다(자기 참조 사고).
  gates.dailyAt(23, '/__ads/silence-digest', async () => {
    const { runAdsSilenceDigest } = await import('./silence-digest')
    return runAdsSilenceDigest(env)
  })

  // ── 🌙 자동 정비 순환(cron 경로) — 배정표·양보 규칙·근거는 `maintenance-cron.ts`(그 모듈의 관심사다).
  //   ⏰ 알람이 정비를 몰면 여기는 손을 뗀다 — 같은 리스를 다투면 진 쪽이 흔적도 없이 사라진다.
  if (env.ADS_AUTO_MAINTENANCE_ENABLED !== 'false' && !laneAlarmOn) scheduleMaintenanceCron(env, gates)
  // 🧭 라이브 재보정(YouTube 쿼터 소비)은 기존대로 하루 1회(19:00 UTC = KST 04시)만.
  //   ⚠️ 이 시각은 위 순환이 **양보**한다(같은 lease 경합 — 위 docblock 참조). 시각을 바꾸려면 두 곳을
  //     같이 바꿔야 하므로 상수 하나를 공유한다.
  if (env.ADS_AUTO_MAINTENANCE_ENABLED !== 'false') {
    gates.dailyAt(RESCAN_HOUR_UTC, '/__ads/maintenance-rescan', async () => {
      const { runNightlyRescan } = await import('@/features/marketing/api/influencer-maintenance')
      return runNightlyRescan(env)
    })
  }

  runFollowupJob(env, hourUTC, adsBeat, (p) => ctx.waitUntil(p), dailyGapMinutes())

  // 🔭 이번 실행이 '알고 있는' 레인(게이트 ON)을 남긴다 — 하트비트와 대조해 '한 번도 안 돈 레인'을 판정.
  ctx.waitUntil(recordKnownLanes(env, laneReg.list()))

  runWeeklyJob(env, hourUTC, dowUTC, adsBeat, (p) => ctx.waitUntil(p), staleGapMinutes(7 * 24 * 60))

  // 🚦 여기서 비로소 띄운다 — 이번 회차 예산만큼만. 미룬 레인은 **버린 게 아니라** 다음 차례에 돈다
  //   (`selectLanesForHour` 가 모든 레인이 `groups` 시간 안에 반드시 한 번 돎을 보장 — 유닛이 강제).
  const { kicked, ranNames } = await dispatchPendingLanes({ pending, env: env as never, hourUTC, laneUrl, beat: adsBeat, waitUntil: (p) => ctx.waitUntil(p) })

  // 🧾 디스패치 후 한 번에 쓴다(빈 배치를 쓰면 이후 기록이 영영 못 나간다) + 이력 한 줄. ⏳ 단 **무한정
  //   기다리지 않는다** — 근거·실측·못 기다린 레인을 왜 판정에서 빼는지는 `tail-bound.ts` 헤더에 있다.
  ctx.waitUntil(closeTick({ DB: env.DB, env: env as never, kicked, ranNames, at: tickStartIso, hourUTC, beats }))
}

// ⏰ DO 알람 레인 — wrangler-ads.toml 의 durable_objects 바인딩이 이 export 를 찾는다.
//   ⚠️ export 를 빼면 배포는 되는데 **알람이 영원히 안 깨어난다**(클래스를 못 찾아 조용히 실패).
export { AdsLaneDurableObject } from './lane-alarm'

export default { fetch: app.fetch, scheduled }
