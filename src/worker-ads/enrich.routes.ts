/**
 * 📝 인플루언서 풀 **보강 레인** 트리거 — `src/worker-ads/index.ts` 에서 분리 (2026-07-29).
 *
 *   분리 이유: 드라이버(아래)를 더하면서 index.ts 가 다시 600줄(god 파일 래칫)에 닿았다.
 *   `public-data.routes.ts`(2026-07-28) 와 **같은 처방** — 래칫을 리베이스라인으로 우회하지 않고
 *   성격이 같은 핸들러群을 모듈로 뺀다. 여기 둘은 하나의 관심사다: *이미 가진 인플루언서 행을
 *   외부 공개 프로필로 보강한다.* 로직은 `features/marketing/api/influencer-enrich-lane.ts` 에 있고
 *   이 파일은 라우팅과 **라운드 오케스트레이션**만 한다.
 *
 *   ⚠️ 경로는 `/__ads/*` — 메인 프록시는 `/api/ads/*` · `/l/*` 만 위임하므로 외부 도달 불가.
 *   호출자는 크론(SELF)과 메인 어드민(서비스바인딩)뿐이다.
 *   ⚠️ 서비스 분리: `ad_influencer_leads` + `platform_settings` 만 접촉(소비자/도매 무관).
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'

export const enrichRoutes = new Hono<{ Bindings: Env }>()

// ✍ 발송 큐 상위 초안 미리 채우기 — 근거/안전장치는 `outreach-draft-prefill.ts` 헤더 참조.
//   ⚖️ [LEGAL] 생성만, 발송 없음. 게이트(ADS_OUTREACH_PREFILL_ENABLED)는 cron 쪽에서 — 여기(수동 호출)는
//   기존 `/outreach-drafts` 와 같은 취급(수동=의도)이라 게이트 무관.
enrichRoutes.post('/__ads/prefill-outreach-drafts', async (c) => {
  try {
    const { runOutreachDraftPrefill } = await import('@/features/marketing/api/outreach-draft-prefill')
    return c.json({ ok: true, stats: await runOutreachDraftPrefill(c.env) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
})

/** 라운드 상한 — env 로 조정(1~20). 기본값은 레인마다 다르다(인플루언서 12 · 파트너풀 8). */
/**
 * 🍰 **팬아웃 폭(K)** — 정각 1회에 동시에 띄울 자식 수. 처리량의 **두 노브 중 무료에서 돌리는 쪽**이다.
 *
 *   ```
 *   처리량 = (자식 수 K) × (자식당 예산)
 *             ↑ 무료에서 키움     ↑ 유료 전환 시 저절로 커짐(코드 변경 0)
 *   ```
 *   이렇게 갈라 두면 유료 전환이 **설정 하나 없이** 곱해진다. 반대로 지금의 릴레이(라운드 N+1이
 *   N을 기다림)를 그대로 두면 유료로 바꿔도 **체인 수명 벽이 그대로**라 효과가 안 난다.
 *
 *   ## 왜 K 를 크게 못 잡나 — 처리량이 아니라 **차단**이 상한이다
 *   자식 하나가 블로거를 동시 3명씩 처리하므로(`NAVER_CONCURRENCY`) 네이버로 나가는 동시 연결은 **3K** 다.
 *   K=8 이면 24 동시 — 한 출구(Cloudflare)에서 그만큼 때리면 차단·지연으로 되돌아온다.
 *   그건 처리량을 늘리는 게 아니라 **레인을 통째로 죽이는** 방향이다(같은 판단이 `NAVER_CONCURRENCY`
 *   주석에도 있다 — 거기서 3으로 보수적으로 잡은 이유와 동일하다).
 *   ⇒ **K=4 로 시작**(동시 12). 올리기 전에 스냅샷의 `naver.failed` 가 안 오르는지부터 확인할 것.
 *      추측으로 올리면 조용히 악화된다 — 실패가 늘어도 `measured` 만 보면 안 보인다.
 *
 *   ⚠️ `K<=1` 이면 **오늘과 완전히 같은 릴레이 동작**이다(롤백 = 값 하나).
 */
export function resolveEnrichFanout(raw: string | undefined, fallback = 4): number {
  return Math.min(12, Math.max(1, parseInt(raw || '', 10) || fallback))
}

export function resolveEnrichRounds(raw: string | undefined, fallback = 12): number {
  return Math.min(20, Math.max(1, parseInt(raw || '', 10) || fallback))
}

/**
 * 🔁 **즉시 응답 + self-chain 1라운드** — 두 세션의 진단을 하나로 합친 형태(2026-07-29).
 *
 * ## 두 가지가 동시에 문제였다
 * **(A) 부모의 수명**(#847 진단): `kick` 은 `await env.SELF.fetch(...)` 라 드라이버가 응답할 때까지
 *   부모가 살아 있어야 한다. 07:00 틱 실측 — 발화한 8개는 전부 빠른 레인(D1 전용), 빠진 것은 전부
 *   느린 레인(외부 크롤). 부모 수명이 천장이었다.
 * **(B) 드라이버 인보케이션의 용량**(이 세션 진단): 라운드를 한 인보케이션에서 `for` 로 돌리자
 *   20 계획 중 **1~2라운드**에서 멈췄다(총측정 08:00 +17 = 1라운드 · 09:00 +54 = 2라운드).
 *   하트비트가 `ok` 였으니 취소가 아니라 **정상 반환** — 체인이 스스로 끊긴 것이다.
 *
 * (A)만 고치면 루프는 여전히 한 인보케이션 안이라 (B)가 남고, (B)만 고치면 depth 0 의 라운드를
 * 부모가 기다려 (A)가 남는다. ⇒ **둘 다** 한다.
 *
 * ## 형태
 * ① 라운드 작업을 **응답 전에** 끝낸다 — 부모의 kick 은 *한 라운드*(실측 ~16초)만 잡는다.
 * ② 끝나면 **다음 라운드를 새 인보케이션으로** spawn 하고 응답한다 — 한 인보케이션이 N라운드를
 *    이고 가지 않는다((B) 해소). 부모가 잡히는 시간은 전체 체인이 아니라 1라운드다((A) 완화).
 * ③ 하트비트는 **라운드마다** 남기고 `depth` 를 실어 보낸다(마지막 기록 = 그 틱이 도달한 최대 깊이).
 *
 * ## 🩸 왜 "즉시 응답"을 되돌렸나 (2026-07-29 11:00 라이브 실측 — 내가 낸 회귀)
 * 첫 판은 ①을 "핸들러가 **즉시 응답**하고 라운드는 `waitUntil` 에서 돈다"로 썼다. 그러면 부모의
 * kick 이 곧바로 풀리니 (A)가 완전히 사라진다고 봤다. **틀렸다.**
 *   실측: 11:00 틱에 `ads:enrich-influencer-driver`(11:00:02, ok, result=null) 와
 *   `ads:collect`(11:00:02, "started=true") 가 **둘 다 즉시** 기록됐는데, 9분 뒤까지
 *   `enrich_lane.last_run` 은 10:00:18, `run.last_run` 은 09:00:04 그대로였다 — **라운드가 한 번도
 *   완료되지 않았다.** 직전(구 코드) 10:00 틱은 최소 1라운드를 돌렸다. 즉 "즉시 응답"이 0라운드를 만들었다.
 *   이유: 서비스 바인딩 피호출자는 **호출자보다 오래 살 수 없다.** 즉시 응답 → `kick` 의 await 이 풀림
 *   → 부모 인보케이션 종료 → 피호출자의 `waitUntil` 작업이 취소. 응답을 앞당길수록 더 빨리 죽는다.
 * ⇒ 작업은 **호출자가 살아 있는 동안**(응답 전에) 해야 한다. 즉시 응답은 (A)를 고치는 게 아니라
 *   작업을 지우는 것이었다.
 *
 * ⚠️ 아직 확실히 모르는 것: spawn 을 `waitUntil` 로 걸었을 때 **체인이 depth 1 너머로 이어지는지**.
 *   이어지면 계획대로 N라운드, 안 이어지면 틱당 1라운드(구 동작과 동일 — 최악도 회귀는 아니다).
 *   판정은 **레인 스냅샷의 `enrich_lane.depth`** 로 한다. 0 이면 체인이 안 이어지는 것이고, 그때 처방은
 *   "라운드를 체인이 아니라 cron 이 직접 N번 kick"(루트가 수명을 쥔다)이다.
 *
 * 🕳️ **하트비트로는 못 본다**(2026-07-29 12:00 실측 — 내 계측 설계 결함). 같은 이름
 *   `ads:enrich-influencer-driver` 에 부모(`kick` 의 `adsBeat`)와 자식(아래 `driverBeat`)이 **둘 다** 쓰는데,
 *   부모는 자식 응답 *뒤에* 쓰므로 **언제나 부모가 마지막 writer** 다. 실측에서 `result: null` 로 찍혔다 —
 *   내가 실은 `{planned, depth, chained}` 가 통째로 덮인 것이다. `ads:collect` 의 `"started=true"` 가
 *   살아남은 건 그 부모가 아직 응답을 기다리는 중이라 못 덮었기 때문이지, 구조가 달라서가 아니다.
 *   ⇒ 깊이는 이름을 다투지 않는 곳(레인 스냅샷)에 싣는다. `driverBeat` 은 그대로 두되(부모가 죽었을 때의
 *     유일한 기록이라 가치가 있다) **판정 근거로 삼지 않는다.**
 *
 * ⚠️ 순차성 유지: 다음 라운드는 이번 **작업이 끝난 뒤** spawn 되므로 `perf_checked_at` 도장 이후에
 *   다음 구간을 집는다(동시 실행 아님). 💥 실패하면 다음을 안 낳는다 — 다음 정각이 이어받는다.
 */
async function dispatchRoundChain(
  c: {
    env: Env
    executionCtx?: { waitUntil: (p: Promise<unknown>) => void }
    req: { query: (k: string) => string | undefined }
    json: (b: unknown, s?: number) => Response
  },
  beatName: string,
  path: string,
  rounds: number,
  local: () => Promise<unknown>,
): Promise<Response> {
  const t0 = Date.now()
  const raw = parseInt(c.req.query('depth') || '0', 10)
  const depth = Number.isFinite(raw) && raw > 0 ? raw : 0
  const env = c.env as unknown as { SELF?: { fetch: (r: Request) => Promise<Response> } }

  // 🩸 라운드는 **응답 전에** 돈다 — 호출자가 살아 있는 동안이어야 취소되지 않는다(위 실측 참조).
  let error: string | undefined
  try { await local() } catch (err) { error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 200)}` }

  // 🤝 `sync=1`(수동 실행) 이면 **릴레이를 걸지 않는다** — 호출자가 응답을 받는 즉시 이 인보케이션이
  //   끝나므로 그 릴레이는 태어나자마자 취소된다. 없는 자식을 낳느라 fetch 한 번을 버리는 셈이고,
  //   `chained: true` 로 찍혀 **관측까지 오염**시킨다(실제론 0라운드인데 이어진 것처럼 보인다).
  const sync = c.req.query('sync') === '1'
  let chained = false
  if (!sync && !error && depth + 1 < rounds && env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    // 다음 라운드는 **새 인보케이션**(새 예산·새 서브리퀘스트 한도). 응답을 막지 않게 waitUntil 로 건다.
    c.executionCtx.waitUntil(
      // ⚠️ `?` 로 무조건 잇지 않는다 — 팬아웃 이후의 path 는 이미 `?slice=..&k=..` 를 달고 있어
      //   `?depth=` 를 또 붙이면 URL 이 깨지고(물음표 2개) 그 자식은 조각 없이 돌아 **중복 측정**한다.
      env.SELF.fetch(new Request(`https://ur-ads${path}${path.includes('?') ? '&' : '?'}depth=${depth + 1}`, { method: 'POST' }))
        .then(() => undefined).catch(() => undefined),
    )
  }
  // 라운드마다 기록 — 마지막 기록의 `depth` 가 그 틱이 실제로 도달한 깊이다(체인 생존 여부의 유일한 관측점).
  await driverBeat(c.env, beatName, Date.now() - t0, { chained, error, depth }, rounds)
  return error ? c.json({ ok: false, depth, error }, 500) : c.json({ ok: true, depth, planned: rounds, chained })
}

/**
 * 🔔 **드라이버가 자기 인보케이션에서 하트비트를 남긴다**(depth 0 에서만).
 *
 *   왜 부모(kick)의 기록만으로 부족한가: 부모가 예산/수명을 다 쓰면 하트비트 D1 쓰기조차 못 한다 —
 *   라이브 07:00 에 인플루언서 레인들이 **실패 기록조차 못 남겼다.** 여기서 쓰면 성사된다.
 *   ⚠️ 이 보강이 있어야 메인 워커 `cron-stale-watch` 가 이 레인의 정지를 알린다
 *      (그 감시자는 **한 번도 기록이 없는 이름은 판정 대상으로 잡지 못한다**).
 *   📊 `planned/chained/error` 동봉 — "몇 라운드에서 왜 멈췄나"를 어드민 한 줄로 판정하기 위해
 *      (이 환경은 wss 가 막혀 라이브 로그를 못 본다).
 */
async function driverBeat(env: unknown, name: string, ms: number, r: { chained: boolean; error?: string; depth: number }, planned: number): Promise<void> {
  try {
    const { recordCronBeat } = await import('@/worker/utils/cron-heartbeat')
    await recordCronBeat(env as never, `ads:${name}`, !r.error, ms, '0 * * * *',
      { planned, depth: r.depth, chained: r.chained, ...(r.error ? { error: r.error.slice(0, 120) } : {}) })
  } catch { /* 관측 실패가 작업을 막지 않는다 */ }
}

// 📝 보강 1라운드(블로거 활동성·연락처 + 링크인바이오 + YT 성과) — 수집과 **분리된 인보케이션**.
//   왜 분리했는지는 `influencer-enrich-lane.ts` 헤더(라이브 실측: 수집에 얹혀 있어 한 건도 못 돌았음).
//   💥 원문 릴레이 — 'FAILED' 로 뭉개면 라운드가 왜 안 도는지 라이브에서 알 길이 없다(파트너풀 레인과 동일).
enrichRoutes.post('/__ads/enrich-influencer', async (c) => {
  try {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    // 🔢 `depth` 전달 — 선두 교대가 depth 홀짝으로 갈리므로, 수동 실행이 양쪽을 다 시험할 수 있어야 한다.
    //   안 읽으면 파라미터가 **조용히 무시**돼 "시험했는데 왜 같지?" 가 된다(오늘 반복해 만난 형태).
    const raw = parseInt(c.req.query('depth') || '0', 10)
    return c.json({ ok: true, stats: await runInfluencerEnrich(c.env, Number.isFinite(raw) && raw > 0 ? raw : 0) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 500)
  }
})

/**
 * 🔁 보강 라운드 **드라이버** — 라운드 루프를 부모 cron 에서 여기로 옮긴다.
 *
 *   왜: 부모 scheduled 는 매시간 11개 레인을 kick 하는데 `kick()` 하나가
 *   [SELF fetch 1 + 하트비트 D1 쓰기 1] = **2 서브리퀘스트**라 이미 ~31/50 을 쓴다(2026-07-29 실측).
 *   라운드를 부모에서 돌리면 그 위에 라운드 수만큼 얹힌다 — 6라운드면 ~37, 12로 올리면 ~43, 일일 레인이
 *   겹치는 시간대엔 50 에 닿아 **뒤쪽 waitUntil(=이 레인과 시트 미러)부터 굶는다.** 그건 #831 에서
 *   고친 것과 정확히 같은 실패 양식이라, 처방도 같아야 한다: **루프를 자기 인보케이션으로 격리.**
 *   드라이버는 자기 50 예산 안에서 라운드를 돌고, 부모가 내는 비용은 언제나 kick 1개다.
 *
 *   ⚠️ 라운드는 **순차**여야 한다 — 각 라운드가 `perf_checked_at` 도장을 찍어야 다음 라운드가 다음 구간을
 *   집는다(`enrichNaverActivity` 의 SELECT 는 선점(claim)이 아니라 정렬+LIMIT 이라, 동시 실행하면
 *   같은 행을 중복 조회하고 예산만 태운다).
 *   💥 실패하면 그 자리에서 멈추고 원문을 돌려준다 — 남은 라운드를 헛돌리지 않고, 다음 정각이 이어받는다.
 */
/** 팬아웃 자기신고 기록 키 — `enrich-fanout-health.ts` 의 `FanoutStamp` 가 이 값의 스키마다. */
const FANOUT_KEY = 'ads_enrich_fanout_last'

/**
 * 🪂 팬아웃 자기신고 — 직전 회차의 착지 여부를 판정해 하트비트에 싣고, 이번 회차의 비교 기준을 남긴다.
 * **던지지 않는다** — 관측이 작업을 막으면 안 된다(이 파일의 다른 관측도 전부 같은 규약).
 */
async function reportFanout(env: { DB: D1Database }, k: number, planned: number): Promise<void> {
  try {
    const { judgeFanout, fanoutBeatResult } = await import('@/features/marketing/api/enrich-fanout-health')
    const { INFLUENCER_ENRICH_SNAPSHOT_KEY } = await import('@/features/marketing/api/enrich-telemetry')
    const rows = await env.DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN ('${FANOUT_KEY}','${INFLUENCER_ENRICH_SNAPSHOT_KEY}')`,
    ).all<{ key: string; value: string }>().catch(() => null)
    const pick = (kk: string) => { try { return JSON.parse(rows?.results?.find(r => r.key === kk)?.value || 'null') } catch { return null } }
    const laneNow = (pick(INFLUENCER_ENRICH_SNAPSHOT_KEY) as { last_run?: string } | null)?.last_run ?? null
    const verdict = judgeFanout(pick(FANOUT_KEY), laneNow)
    const { ok, result } = fanoutBeatResult(k, planned, verdict)
    const { recordCronBeat } = await import('@/worker/utils/cron-heartbeat')
    await recordCronBeat(env as never, 'ads:enrich-influencer-fanout', ok, 0, '0 * * * *', result)
    await env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(FANOUT_KEY, JSON.stringify({ at: new Date().toISOString(), k, planned, lane_before: laneNow }))
      .run().catch(() => undefined)
  } catch { /* 관측 실패가 팬아웃을 막지 않는다 */ }
}

enrichRoutes.post('/__ads/enrich-influencer-driver', async (c) => {
  const env = c.env as unknown as { ADS_INFLUENCER_ENRICH_ROUNDS?: string; ADS_INFLUENCER_ENRICH_FANOUT?: string; SELF?: { fetch: (r: Request) => Promise<Response> } }
  const rounds = resolveEnrichRounds(env.ADS_INFLUENCER_ENRICH_ROUNDS)
  // 🔢 depth 를 레인 스냅샷에 실어 보낸다 — 하트비트에 실으면 부모(`kick`)가 덮어써 안 보인다(실측 12:00).
  const d = parseInt(c.req.query('depth') || '0', 10)

  /**
   * 🍰 **팬아웃 진입점**(2026-07-29) — 조각을 안 받은 최초 호출이면, 릴레이 대신 **자식 K개를 한 번에** 띄운다.
   *
   *   ## 왜 바꾸나 (실측)
   *   릴레이는 라운드 N+1이 N을 기다린다. 그래서 12라운드를 계획하고도 **실측 도달 depth 2(3라운드)** 에서
   *   끝났다 — 라운드당 ~10~20초라 30~60초면 체인 수명이 다한다. 계획한 9라운드는 존재한 적이 없다.
   *
   *   ## 왜 안전한가 (같은 날 실측으로 확인)
   *   `kick` 의 레인 디스패치는 **이미 병렬로 돌고 있었다** — 정각 3틱 모두 [소요합계 > 벽시계 스팬]이었다
   *   (틱0: 24.4s/6.0s · 틱1: 27.5s/8.3s · 틱2: 9.4s/5.8s). 즉 무료 플랜에서도 SELF.fetch 자식은
   *   겹쳐 돈다. 새 코드를 배포해 재 볼 필요가 없었고, 하트비트의 `at`·`ms` 로 판정했다.
   *
   *   ## 겹치면 안 되는 것 — 같은 사람을 두 번 재는 것
   *   이 큐의 SELECT 는 **선점이 아니라 정렬+LIMIT** 이라, 조각 없이 병렬로 돌리면 자식들이 전부 같은
   *   앞머리를 집는다. 그래서 자식 i 는 `id % K = i` 만 맡는다(`sliceClause` 주석 참조).
   *
   *   ⚠️ 부모 비용은 자식 수만큼 늘어난다(fetch K개). K 상한 12 는 그래서다 — 부모가 다른 레인도
   *   kick 해야 하므로 여기서 예산을 다 쓰면 **뒤에 선 레인이 굶는다**(이 파일이 고쳐 온 실패 양식 그대로).
   */
  const sliceRaw = c.req.query('slice')
  const K = resolveEnrichFanout(env.ADS_INFLUENCER_ENRICH_FANOUT)
  /**
   * 🤝 **`sync=1` — 자식을 `await` 한다**(2026-08-02, 라이브 실측으로 되돌린 회귀).
   *
   *   ## 무슨 일이 있었나
   *   08-02 에 수동 버튼을 드라이버로 돌렸더니(#930) 버튼이 **0건을 처리하게 됐다.**
   *   실측: 킥 응답 `{fanout:4}` 즉시 반환 → 30초 뒤 `nb_unmeasured` **변화 0**.
   *   그 전(단발 경로)엔 한 번에 22명이 줄었다. 즉 버튼이 *더 많이*가 아니라 *아무것도* 안 하게 됐다.
   *
   *   ## 왜 — 이 파일이 이미 적어 둔 규칙을 내가 어겼다
   *   위 `dispatchRoundChain` docblock: **"서비스 바인딩 피호출자는 호출자보다 오래 살 수 없다."**
   *   cron 경로는 부모 scheduled 인보케이션이 다른 레인을 kick 하느라 살아 있어 자식이 돌 시간이 있지만,
   *   **어드민 버튼은 응답을 받는 순간 메인 워커 요청이 끝난다** → ur-ads 의 `waitUntil` 자식이 통째로 취소.
   *   같은 코드가 호출자에 따라 다르게 죽는다 — cron 에선 depth 3 까지 갔는데 버튼은 0 이었던 이유다.
   *
   *   ⇒ 수동 경로는 **기다린다.** 자식 K개가 각자 한 라운드를 돌고 돌아올 때까지(실측 라운드 ~7초)
   *     응답을 붙잡는다. 버튼 한 번 = K라운드(옛 단발의 K배)이고, 무엇보다 **실제로 돈다.**
   *   ⚠️ 자식에게도 `sync=1` 을 넘겨 **릴레이를 걸지 않게** 한다 — 어차피 취소될 자식이라 fetch 낭비다.
   *   ⚠️ cron 경로(`sync` 없음)는 **동작 불변** — 거긴 waitUntil 이 맞다(부모가 살아 있다).
   */
  const syncFanout = c.req.query('sync') === '1'
  // ⚠️ `typeof … === 'function'` — Hono 타입상 `executionCtx.waitUntil` 은 '항상 정의됨'이라
  //   truthy 검사를 `||` 안에 두면 TS2774 가 난다(런타임엔 미제공 환경이 있어 검사 자체는 필요하다).
  const canDefer = typeof c.executionCtx?.waitUntil === 'function'
  if (sliceRaw === undefined && K > 1 && env.SELF?.fetch && (syncFanout || canDefer)) {
    const kids = Array.from({ length: K }, (_, i) => env.SELF!.fetch(
      new Request(`https://ur-ads/__ads/enrich-influencer-driver?slice=${i}&k=${K}${syncFanout ? '&sync=1' : ''}`, { method: 'POST' })))
    if (syncFanout) {
      const slices = await Promise.all(kids.map(p => p.then(r => r.json()).catch(() => null)))
      return c.json({ ok: true, fanout: K, sync: true, slices })
    }
    // 🪂 자식들이 각자 자기 하트비트/스냅샷을 남긴다 — 이 응답은 '띄웠다'만 뜻한다.
    //   🔴 그런데 그 즉시 응답으로 부모가 `ok=true 0ms` 하트비트를 찍어, **자식이 전멸해도 화면은 초록**이었다
    //   (2026-08-02 실측: 하트비트 ok / 레인 스냅샷 6시간 정지 / total_measured 6시간에 +132).
    //   ⇒ **직전 팬아웃이 착지했는지**를 여기서 스스로 신고한다. 전멸이면 이번 하트비트가 빨강이 되어
    //     기존 stale-watch·경보가 잡는다. 근거·한계: `enrich-fanout-health.ts`.
    //   🤝 두 수리는 **짝이다**(다른 세션의 관측 + 이 브랜치의 수리): 여기 `reportFanout` 은 *cron 경로에서*
    //     전멸을 보이게 하고, 위 `sync` 분기는 *수동 경로에서* 전멸 자체를 없앤다. 하나만 남기면
    //     "빨간불은 뜨는데 고칠 방법이 없다" 또는 "고쳤는데 다시 죽어도 모른다" 가 된다.
    for (const p of kids) c.executionCtx!.waitUntil(p.then(() => undefined).catch(() => undefined))
    await reportFanout(c.env as never, K, rounds)
    return c.json({ ok: true, fanout: K, planned: rounds })
  }
  const kRaw = parseInt(c.req.query('k') || '', 10)
  const slice = sliceRaw !== undefined && Number.isFinite(kRaw) && kRaw > 1
    ? { i: parseInt(sliceRaw, 10) || 0, k: kRaw }
    : null

  return dispatchRoundChain(c, 'enrich-influencer-driver', `/__ads/enrich-influencer-driver${slice ? `?slice=${slice.i}&k=${slice.k}` : ''}`, rounds, async () => {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    // 🧱 계획 라운드 수를 함께 넘긴다 — 스냅샷의 `chain.rounds_planned` 와 실제 `rounds` 의 격차가
    //    **체인 수명 천장**을 드러낸다(실측 07-29: 계획 12 · 도달 3). 그 격차를 못 보면 다음 세션도
    //    "라운드를 늘렸으니 처리량이 늘었다"를 근거로 쓴다 — 늘린 라운드는 존재한 적이 없었다.
    return runInfluencerEnrich(c.env, Number.isFinite(d) && d > 0 ? d : 0, rounds, slice)
  })
})

/**
 * 📧 파트너풀 이메일 보강 라운드 **드라이버** — 위와 같은 처방을 마지막 남은 부모 루프에 적용(2026-07-29).
 *
 *   왜 지금인가: 라이브 하트비트가 이 루프의 대가를 그대로 보여줬다.
 *     06:00 — 늦게 킥된 4개 레인이 전부 FAIL(인플루언서 수집 포함), 전부 6초 안에 끝남.
 *     07:00 — 인플루언서 수집·보강은 **실패 기록조차 못 남겼다**(부모가 하트비트 D1 쓰기마저 못 함).
 *   부모는 매시간 11개 레인을 kick 하는데, 여기서 라운드를 직접 도느라 **8개(기본)~20개(env 상향)**를
 *   더 얹는다. 그게 천장을 넘기는 마지막 한 삽이었다. 다른 레인들이 이미 드라이버로 옮겨간 이유와 동일하다.
 *
 *   ⚠️ 위 주석의 "SELF fetch 는 1개씩이라 20라운드도 안전" 은 **틀렸다.** 부모 인보케이션의 서브리퀘스트는
 *   *합계*로 세므로 라운드 수만큼 부모가 비싸진다 — 20으로 올린 순간 뒤쪽 레인이 통째로 굶는다.
 *   드라이버로 옮기면 부모 비용은 라운드 수와 **무관하게** kick 1개로 고정된다.
 *
 *   덤: 이 레인은 생 `waitUntil` 이라 **하트비트가 없었다**(조용히 멈춰도 아무도 모름). kick 으로 넘기면
 *   `ads:enrich-company` 이름으로 관측 대상이 된다.
 */
enrichRoutes.post('/__ads/enrich-company-driver', async (c) => {
  const rounds = resolveEnrichRounds((c.env as unknown as { ADS_ENRICH_ROUNDS?: string }).ADS_ENRICH_ROUNDS, 8)
  return dispatchRoundChain(c, 'enrich-company', '/__ads/enrich-company-driver', rounds, async () => {
    const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect')
    return enrichHeldLeads(c.env)
  })
})
