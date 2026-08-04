/**
 * 🛠️ 유어애즈 인플루언서 풀 — **실행(ops)** 엔드포인트: 수집 버스트 · 전체 정비 · 시트 동기화.
 *   admin-ads-influencers.routes.ts 에서 분리(파일크기 상한 준수). 같은 /api/admin/ads 마운트라 경로 불변.
 *
 *   공통 성질: 셋 다 **실제 작업은 ur-ads 워커에 위임**한다(서비스바인딩 env.ADS). 이유는 두 가지 —
 *     ① 수집/정비 코드를 메인 번들에 넣지 않는다 ② 각 단계가 fresh 인보케이션(서브리퀘스트·CPU 예산)을 받는다.
 *   길게 도는 것(버스트·정비)은 waitUntil 로 던지고 즉시 응답 → **브라우저가 페이지를 떠나도 서버는 계속 돈다.**
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import { isCollectRunning, isMaintainRunning } from './collect-lease'
import { parseOutreachCsv, normalizeOutreachItems, ingestOutreachStatuses, OUTREACH_INGEST_MAX } from './outreach-status-ingest' // ⚠️ 수집 엔진(influencer-auto-collect) import 금지 — 메인 번들 경량 유지

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// (2026-07-23 전수조사: 구 단발 수집 /influencer-pool/collect 엔드포인트 제거 — UI 는 collect-burst 만 호출,
//  유지되던 두 번째 트리거 경로가 lease 도입 후에도 표면만 넓혀 삭제. 필요 시 collect-burst 가 완전 상위 호환.)

// POST /api/admin/ads/influencer-pool/collect-burst — 🔥 오늘 YT 검색 예산 즉시 소진(버스트)
//   대표 "YT 검색 예산 최대한 바로 다 쓰는 방향". 배경: YT 무료 상한 = 하루 10k units = 검색 100회.
//   워커 한 실행은 30s·서브리퀘스트 한도라 100회를 한 번에 못 쏨(2026-07-20 'Too many subrequests' 사고).
//   병렬 실행은 공유 카운터(ads_yt_search_used)/커서를 경합해 중복 발굴로 쿼터 낭비 → **순차만 안전**.
//   ⇒ 백그라운드에서 수집 런을 연달아(각각 fresh ur-ads 인보케이션 = fresh 예산) 돌려 예산 소진까지 태움.
//   시간/횟수/진전 가드로 워커 과부하·무한루프 차단. 한 클릭에 다 못 태우면 카운터가 영속이라 재클릭/시간당 cron 이 이어받음.
type BurstStats = { youtube_quota_hit?: boolean; yt_budget?: { used?: number; total?: number } }
app.post('/influencer-pool/collect-burst', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  // 🔒 이미 돌고 있으면 시작하지 않고 그대로 알린다 — 예전엔 lease 가 조용히 막는데 UI 는 "시작했어요" 라고
  //   거짓 성공을 띄웠다(페이지 이탈 후 재진입 시 흔한 경로). 경합 방지는 여전히 lease 가 담당.
  if (await isCollectRunning(c.env.DB).catch(() => false)) return c.json({ success: true, busy: true, started: false })
  const burn = async () => {
    const startedAt = Date.now()
    let prevUsed = -1
    let reason = 'loop_cap' // 🔎 종료 사유 기록(전수조사 — "시작했어요" 이후 블랙박스이던 것 가시화)
    for (let i = 0; i < 40; i++) {
      if (Date.now() - startedAt > 220_000) { reason = 'time_cap'; break } // ⏱️ 시간 예산 — 남은 건 재클릭/cron 이 이어받음
      let body: { chained?: boolean; stats?: BurstStats } | null = null
      try {
        // self-chain 엔드포인트 — ads 에 SELF 바인딩이 있으면 chained=true 로 백그라운드 자가전파(메인 루프 종료).
        const r = await ads.fetch(new Request(`https://ur-ads/__ads/collect-chain?depth=${i}&pu=${prevUsed}`, { method: 'POST' }))
        body = (await r.json().catch(() => null)) as { chained?: boolean; stats?: BurstStats } | null
      } catch { reason = 'fetch_error'; break }
      if (!body) { reason = 'bad_response'; break }
      if (body.chained) { reason = 'chained'; break }          // ads(SELF)가 백그라운드로 자가전파 — 중복발화 방지
      const stats = body.stats
      if (!stats) { reason = 'no_stats'; break }
      if (stats.youtube_quota_hit) { reason = 'quota_hit'; break } // 구글이 초과 선언 — 오늘 끝
      const yb = stats.yt_budget
      if (!yb || typeof yb.used !== 'number' || typeof yb.total !== 'number') { reason = 'busy_or_no_budget'; break } // lease busy 포함
      if (yb.used >= yb.total) { reason = 'budget_done'; break }   // 오늘 예산(기본 100회) 소진 — 완료
      if (yb.used <= prevUsed) { reason = 'no_progress'; break }   // 진전 없음(YT 키워드 소진/YT 불가)
      prevUsed = yb.used
    }
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_burst_last', JSON.stringify({ at: new Date().toISOString(), reason, lastUsed: prevUsed })).run().catch(() => null)
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(burn()); return c.json({ success: true, started: true }) }
  await burn().catch(() => null) // 폴백(waitUntil 미지원): 동기 소진
  return c.json({ success: true, started: false })
})

// POST /api/admin/ads/influencer-pool/maintain-all — 🧰 전체 정비 원클릭
//   개별 정비 버튼 7개를 사람이 순서 지켜 누르는 건 재현이 어렵고 순서가 틀리면 낭비다(예: 병합으로 사라질 행에
//   점수를 먼저 매김). 순서는 이미 야간 cron 이 정답을 갖고 있으므로 **그 SSOT 를 그대로 재사용**한다 —
//   새 파이프라인을 만들지 않는 게 핵심(둘이 갈라지면 "밤엔 되는데 버튼은 안 되는" 클래스가 생긴다).
//     ① runNightlyMaintenance = 중복병합 → 연락처 재추출 → 재분류 → 품질점수 (로컬 D1 만, 외부 API 0)
//     ② runNightlyRescan      = 카테고리 재보정 → 라이브 재조회 → 네이버 스윕 (**YouTube 쿼터 소비**)
//   ⚠️ ②는 수집과 **같은 하루 YT 예산**을 쓴다 → 수집 진행 중이면 ②를 건너뛴다(신규 발굴이 우선).
//   ur-ads 에 위임하는 이유: 각 단계가 fresh 인보케이션(서브리퀘스트 예산)을 받아야 중간에 안 잘린다.
app.post('/influencer-pool/maintain-all', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 야간 cron 만 동작' }, 503)
  // 🔒 이미 정비가 돌고 있으면 새로 시작하지 않는다 — 버튼이 waitUntil 이라 즉시 다시 활성화되므로
  //   연타하면 파이프라인이 겹쳐 병합 레이스 + YouTube 쿼터 중복 소모가 난다(진짜 가드는 파이프라인 내부 lease).
  if (await isMaintainRunning(c.env.DB).catch(() => false)) return c.json({ success: true, busy: true, started: false })
  const collecting = await isCollectRunning(c.env.DB).catch(() => false)
  const hop = async (path: string) => {
    try {
      const r = await ads.fetch(new Request(`https://ur-ads${path}`, { method: 'POST' }))
      const j = await r.json().catch(() => null) as { ok?: boolean } | null
      return j?.ok === true
    } catch { return false }
  }
  const runAll = async () => {
    const out: Record<string, unknown> = { at: new Date().toISOString(), skipped_rescan: collecting }
    out.maintenance = await hop('/__ads/maintenance')
    if (!collecting) out.rescan = await hop('/__ads/maintenance-rescan') // YT 쿼터 경합 회피
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_maintain_all_last', JSON.stringify(out).slice(0, 1000)).run().catch(() => null)
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(runAll()); return c.json({ success: true, started: true, skipped_rescan: collecting }) }
  await runAll().catch(() => null) // 폴백(waitUntil 미지원): 동기
  return c.json({ success: true, started: false, skipped_rescan: collecting })
})

/**
 * 📝 POST /influencer-pool/enrich-run — **보강 레인 수동 실행**(ur-ads 위임, 동기 응답).
 *
 * 🔗 **실제 URL 은 `/api/admin/ads/influencer-pool/enrich-run`** — 이 라우터는 `admin-ads.routes` 를 거쳐
 *   `/api/admin/ads` 에 마운트된다. 파일 안의 경로만 보고 `/api/admin/influencer-pool/...` 로 치면
 *   `{"success":false,"error":"Not found"}` 가 오는데, 이게 **인증 실패나 미배포와 구분이 안 돼**
 *   엉뚱한 곳을 파게 된다(이 커밋을 쓰면서 실제로 그랬다).
 *
 * ## 왜 필요했나 (2026-07-29)
 * 수집엔 `collect-burst`, 정비엔 `maintain-all` 이 있는데 **보강 레인만 트리거가 없었다.**
 * 그래서 이 레인의 변경은 **매시 정각 cron 을 기다려야만** 검증됐다 — 오늘 하루 이 레인을 네 번 고치는 동안
 * 확인 사이클이 매번 1시간씩 들었고, 그 사이 잘못된 처방이 라이브에 그대로 서 있었다.
 * (실제로 두 번 헛짚었다: 몫 보장 → 여전히 0건, 홀수 교대 → 단일 라운드 틱에서 여전히 0건.)
 *
 * ⇒ 관측만으로는 부족하다. **되돌려 볼 수 있어야** 고치는 속도가 난다.
 *
 * ## 형태
 * 동기 응답 — 한 라운드는 실측 ~20초라 기다릴 수 있고, **결과(tried/measured/emails)를 그대로 돌려줘야**
 * "먹혔나"를 그 자리에서 판정한다(시트 동기화와 같은 이유로 동기).
 * `depth` 를 받아 특정 라운드를 지정할 수 있다 — 선두 교대가 depth 홀짝으로 갈리므로 양쪽을 다 시험한다.
 *
 * ⚠️ 체인은 타지 않는다(`/__ads/enrich-influencer`, 드라이버 아님) — 수동 실행이 백그라운드 체인을 낳아
 *   cron 과 겹치면 같은 구간을 중복 조회한다. 한 번에 한 라운드만.
 */
app.post('/influencer-pool/enrich-run', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 시간당 cron 만 동작' }, 503)
  const raw = parseInt(c.req.query('depth') || '0', 10)
  const depth = Number.isFinite(raw) && raw > 0 ? Math.min(19, raw) : 0
  /**
   * 🍰 **버튼은 드라이버를 부른다**(2026-08-02) — 그전엔 단발 라운드(`/__ads/enrich-influencer`)를 불러서,
   *   사람이 눌러도 **cron 이 하는 일의 일부**만 돌았다. 실측(08-02 01:06 수동 실행):
   *   `naver measured 18 · spent 44/45 · elapsed 6.9s · deadline_hit false` — 한 라운드는 **예산으로 끝난다**
   *   (시간이 아니라). 즉 남는 건 시간뿐이고, 그걸 쓰는 방법이 팬아웃이다.
   *   드라이버가 조각 K개를 동시에 띄우므로 같은 대기시간에 K배를 돈다(`resolveEnrichFanout` 주석).
   *
   *   🩸 **`sync=1` 이 빠지면 버튼이 0건을 처리한다**(08-02 실측으로 되돌린 회귀). 드라이버를 그냥 부르면
   *   `{fanout:4}` 를 즉시 돌려주는데, 그 순간 **이 요청이 끝나면서** ur-ads 의 `waitUntil` 자식이 통째로
   *   취소된다(서비스 바인딩 피호출자는 호출자보다 오래 못 산다 — `dispatchRoundChain` docblock).
   *   실측: 킥 후 30초 뒤 `nb_unmeasured` 변화 **0**(단발 경로일 땐 한 번에 22 감소).
   *   cron 은 부모가 다른 레인을 kick 하느라 살아 있어 안 죽는다 — **같은 코드가 호출자에 따라 다르게 죽는다.**
   *   ⇒ 수동 경로는 `sync=1` 로 자식을 **기다린다**(K라운드, 실측 라운드당 ~7초).
   *
   *   `?single=1` 이면 옛 단발 경로 — 한 라운드의 숫자를 그 자리에서 보고 싶을 때(디버깅)만 쓴다.
   *
   * ## 🧱 그런데 무료 플랜에선 **수동 경로가 무거운 일을 할 수 없다**(2026-08-02 배포 후 실측)
   * `sync=1` 배포 직후 이 버튼이 **502(3.9~5.7초) · 처리 0** 이 됐다. 단발(`single=1`)도 똑같이 502다.
   * 반면 같은 라운드가 **cron 에선 8.4초에 성공**하고, ads 워커 내부 `SELF.fetch` 자식도 정상이다.
   *
   * | 경로 | CPU 출처 | 결과 |
   * |---|---|---|
   * | cron(scheduled) → 라운드 | cron 인보케이션 예산 | ok 8.4s |
   * | ads 내부 `SELF.fetch` 자식 | 부모(cron) 예산 상속 | ok |
   * | **어드민 → `env.ADS` → 라운드** | **이 요청의 예산** | **502** |
   *
   * ⇒ 크로스워커 서비스 바인딩은 피호출자의 CPU 를 **호출자 몫에서** 쓴다. 그래서 이 버튼은
   *   **즉시 반환하면 자식이 죽고, 기다리면 CPU 로 죽는다 — 어느 쪽이든 0건이다.**
   *   유료 전환하면 호출자 예산이 커져 `sync` 가 **코드 변경 없이** 살아난다(구조는 그대로 둔다).
   *
   * ⚠️ 그래서 실패를 **날 502 로 흘리지 않는다.** 버튼을 누른 사람에게 "왜 안 되는지"와
   *   "그럼 뭐가 대신 도는지"를 말해 준다 — 원인 불명 에러는 다음 세션이 또 파게 만든다.
   */
  const single = c.req.query('single') === '1'
  const path = single ? `/__ads/enrich-influencer?depth=${depth}` : '/__ads/enrich-influencer-driver?sync=1'
  /** 무료 플랜 CPU 벽에 걸렸을 때의 안내 — 실패를 사실대로, 다음 행동까지. */
  const planWall = (detail: string) => c.json({
    success: false, depth, blocked: 'cpu-budget',
    error: `수동 실행은 이 플랜에서 무거운 라운드를 돌릴 수 없습니다(${detail}). `
      + `보강은 매시간 cron 이 계속 돌고 있습니다 — 어드민 '자동 실행 내역'에서 확인하세요. `
      + `유료 전환 시 이 버튼은 코드 변경 없이 동작합니다.`,
  }, 503)
  try {
    const r = await ads.fetch(new Request(`https://ur-ads${path}`, { method: 'POST' }))
    // 502/500 은 대개 피호출자가 CPU 로 끊긴 것이다 — JSON 이 아니라 Cloudflare 의 본문이 온다.
    const j = await r.json().catch(() => null) as { ok?: boolean; stats?: unknown; error?: string; fanout?: number; planned?: number; slices?: unknown } | null
    if (!j) return planWall(`ur-ads 응답 ${r.status}`)
    if (!j.ok) return c.json({ success: false, error: j.error || '보강 레인 실행 실패', depth }, 502)
    return c.json({ success: true, depth, stats: j.stats, fanout: j.fanout, planned: j.planned, slices: j.slices })
  } catch (err) {
    return planWall(`${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 120)}`)
  }
})

// POST /api/admin/ads/influencer-pool/sheets-sync — 📊 구글시트 수동 동기화(ur-ads 위임, 동기 응답).
//   시트 미러는 수초 내라 결과(행수/에러)를 그대로 전달 — 설정 안내가 사용자에게 보여야 함.
/**
 * 🔔 **경보 채널 실발사 확인** — `POST /api/admin/ads/alert-test`.
 *
 *   `/__ads/*` 는 서비스바인딩 전용이라 밖에서 못 부른다. 그래서 ur-ads 에 확인 라우트를 만들어도
 *   **부를 방법이 없으면 없는 것과 같다** — 2026-08-03 에 실제로 그렇게 만들었다가 바로 잡았다
 *   (오늘 종일 고친 "코드는 있는데 안 돎" 과 같은 클래스를 새로 만든 셈이었다).
 *
 *   ⚠️ **결과를 그대로 흘린다.** ur-ads 가 준 `status`(Discord 는 204 가 정상)를 삼키지 않는다 —
 *   `success:true` 만 주면 오타난 웹훅도 초록으로 보여 이 경로의 존재 이유가 사라진다.
 *   ⚠️ 웹훅 URL 은 응답에 없다(ur-ads 가 애초에 안 싣는다) — 자격증명이라 화면·로그로 새면 안 된다.
 */
app.post('/alert-test', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  try {
    const r = await ads.fetch(new Request('https://ur-ads/__ads/alert-test', { method: 'POST' }))
    const j = await r.json().catch(() => null) as { ok?: boolean; status?: number; ms?: number; error?: string; hint?: string } | null
    return c.json({ success: !!j?.ok, status: j?.status ?? null, ms: j?.ms ?? null, hint: j?.hint, error: j?.error }, j?.ok ? 200 : 400)
  } catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

app.post('/influencer-pool/sheets-sync', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  try {
    const r = await ads.fetch(new Request('https://ur-ads/__ads/sheets-sync', { method: 'POST' }))
    const j = await r.json().catch(() => null) as { ok?: boolean; rows?: number; error?: string } | null
    if (j?.ok) return c.json({ success: true, rows: j.rows || 0 })
    return c.json({ success: false, error: j?.error || '동기화 실패' }, 400)
  } catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/ads/influencer-pool/route-biz?apply=1 — 🔀 업체형 블로그/카페를 B2B 파트너풀로 라우팅.
//   **기본 dry-run**(저장 없이 표본만) — 대표가 표본을 확인한 뒤 apply=1 로 실제 이관.
//   ⚠️ 저장은 파트너풀(`ad_company_leads`)에만. 인플루언서 풀은 is_brand=1 숨김 태깅만(삭제 아님).
app.post('/influencer-pool/route-biz', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  const qs = new URLSearchParams()
  if (c.req.query('apply') === '1') qs.set('apply', '1')
  if (c.req.query('reset') === '1') qs.set('reset', '1')
  const max = intParam(c.req.query('max'), 3000)
  qs.set('max', String(Math.max(100, Math.min(20_000, max))))
  try {
    const r = await ads.fetch(new Request(`https://ur-ads/__ads/route-biz-blogs?${qs.toString()}`, { method: 'POST' }))
    const j = await r.json().catch(() => null) as { ok?: boolean; stats?: unknown; error?: string } | null
    if (j?.ok) return c.json({ success: true, stats: j.stats })
    return c.json({ success: false, error: j?.error || '라우팅 실패' }, 400)
  } catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

export { app as adminAdsPoolOpsRoutes }

/**
 * 📬 POST /api/admin/ads/outreach/status — 아웃리치 결과 유입(반응 루프 닫기).
 *
 *   body: `{ items: [{email, status, at?}] }` 또는 `{ csv: "email,status[,at]\n..." }`
 *   status: sent | opened | replied | bounced | complained | opt_out
 *
 *   ⚠️ 대표가 **외부 도구로 발송**하므로 이게 유일한 유입구다. 설계 근거·멱등성은
 *   `outreach-status-ingest.ts` docblock — 특히 "왜 sent 가 contacted_at 을 안 덮는가".
 *   ⚠️ 응답에 `unmatched` 를 반드시 담는다 — 조용한 0건은 "성공"과 구분이 안 된다.
 */
app.post('/outreach/status', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const fromCsv = typeof b.csv === 'string' ? parseOutreachCsv(b.csv) : null
  const parsed = fromCsv ?? normalizeOutreachItems(b.items)
  if (parsed.items.length > OUTREACH_INGEST_MAX) {
    return c.json({ success: false, error: `한 번에 ${OUTREACH_INGEST_MAX}건까지 — 나눠서 보내주세요` }, 400)
  }
  if (!parsed.items.length) {
    return c.json({ success: false, error: '반영할 행이 없습니다', invalid: parsed.invalid }, 400)
  }
  const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const r = await ingestOutreachStatuses(c.env.DB, parsed.items, nowIso)
  return c.json({ success: !r.error, ...r, invalid: parsed.invalid, error: r.error })
})
