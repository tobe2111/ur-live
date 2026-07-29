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

  let chained = false
  if (!error && depth + 1 < rounds && env.SELF?.fetch && c.executionCtx?.waitUntil) {
    chained = true
    // 다음 라운드는 **새 인보케이션**(새 예산·새 서브리퀘스트 한도). 응답을 막지 않게 waitUntil 로 건다.
    c.executionCtx.waitUntil(
      env.SELF.fetch(new Request(`https://ur-ads${path}?depth=${depth + 1}`, { method: 'POST' }))
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
    return c.json({ ok: true, stats: await runInfluencerEnrich(c.env) })
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
enrichRoutes.post('/__ads/enrich-influencer-driver', async (c) => {
  const rounds = resolveEnrichRounds((c.env as unknown as { ADS_INFLUENCER_ENRICH_ROUNDS?: string }).ADS_INFLUENCER_ENRICH_ROUNDS)
  // 🔢 depth 를 레인 스냅샷에 실어 보낸다 — 하트비트에 실으면 부모(`kick`)가 덮어써 안 보인다(실측 12:00).
  const d = parseInt(c.req.query('depth') || '0', 10)
  return dispatchRoundChain(c, 'enrich-influencer-driver', '/__ads/enrich-influencer-driver', rounds, async () => {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    // 🧱 계획 라운드 수를 함께 넘긴다 — 스냅샷의 `chain.rounds_planned` 와 실제 `rounds` 의 격차가
    //    **체인 수명 천장**을 드러낸다(실측 07-29: 계획 12 · 도달 3). 그 격차를 못 보면 다음 세션도
    //    "라운드를 늘렸으니 처리량이 늘었다"를 근거로 쓴다 — 늘린 라운드는 존재한 적이 없었다.
    return runInfluencerEnrich(c.env, Number.isFinite(d) && d > 0 ? d : 0, rounds)
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
