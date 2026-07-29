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
 * 🔁 라운드 체인 공통 실행부 — 드라이버 두 개(인플루언서·파트너풀)가 같은 규칙을 쓴다.
 *
 *   규칙은 셋뿐이고, 셋 다 실측에서 나왔다:
 *   ① **순차** — 각 라운드가 `*_checked_at` 도장을 찍어야 다음 라운드가 다음 구간을 집는다.
 *      동시 실행하면 같은 행을 중복 조회하고 예산만 태운다(선점이 아니라 정렬+LIMIT 이라서).
 *   ② **실패 즉시 중단** — 남은 라운드를 헛돌리지 않는다. 다음 정각이 이어받는다.
 *   ③ **SELF 미바인딩(로컬)이면 1회 직접 실행** — 체인이 불가능한 환경에서 조용히 0라운드가 되지 않게.
 */
async function runRoundChain(
  env: { SELF?: { fetch: (r: Request) => Promise<Response> } },
  path: string,
  rounds: number,
  local: () => Promise<unknown>,
): Promise<{ done: number; error?: string }> {
  let done = 0
  for (let i = 0; i < rounds; i++) {
    if (!env.SELF?.fetch) {
      try { await local(); done++ } catch (err) { return { done, error: `local: ${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 160)}` } }
      break
    }
    try {
      const r = await env.SELF.fetch(new Request(`https://ur-ads${path}`, { method: 'POST' }))
      if (!r.ok) return { done, error: `round${i + 1}: HTTP ${r.status}` }
      done++
    } catch (err) {
      return { done, error: `round${i + 1}: ${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 160)}` }
    }
  }
  return { done }
}

/**
 * 🔔 드라이버가 **자기 인보케이션에서 직접** 하트비트를 남긴다 (2026-07-29).
 *
 *   왜 부모(kick)의 기록만으로 부족한가: `kick` 은 체인 **응답을 기다린 뒤** 기록한다. 그래서
 *   *오래 걸리는 레인일수록 기록이 먼저 사라진다* — 부모가 예산/수명을 다 쓰면 하트비트 D1 쓰기조차 못 한다.
 *   라이브 증거: 07:00 에 인플루언서 수집·보강은 **실패 기록조차 없었고**, 31초짜리 `sweep-kakao-chain` 은
 *   레인이 실제로 돌았는데도(내부 기록 존재) 부모의 하트비트는 **한 번도 남은 적이 없다.**
 *   ⇒ 가장 관측이 필요한 레인이 가장 먼저 관측 밖으로 나가는 구조였다.
 *
 *   드라이버는 자기 예산이 있으므로 이 쓰기는 성사된다. 부모가 살아 있으면 부모 기록이 나중에 덮어쓰고
 *   (같은 이름·같은 진실), 부모가 죽으면 이 기록이 남는다 — **어느 쪽이든 기록이 남는다.**
 *   ⚠️ 이 보강이 있어야 메인 워커의 `cron-stale-watch` 가 이 레인의 정지를 알릴 수 있다
 *      (그 감시자는 **한 번도 기록이 없는 이름은 판정 대상으로 잡지 못한다**).
 */
async function driverBeat(env: unknown, name: string, ms: number, r: { done: number; error?: string }, planned: number): Promise<void> {
  try {
    const { recordCronBeat } = await import('@/worker/utils/cron-heartbeat')
    // 🔎 **왜 멈췄는지**까지 남긴다(2026-07-29 실측 후 보강) — 09:00 에 20라운드를 계획했는데 3~4라운드에서
    //   끝났고, 하트비트엔 ok/ms 만 있어 *중단 사유를 알 길이 없었다.* 라운드 수와 원문을 함께 남기면
    //   다음 사이클에 어드민 하트비트 한 줄로 판정된다(라이브 로그는 이 환경에서 wss 가 막혀 못 본다).
    await recordCronBeat(env as never, `ads:${name}`, !(!r.done && r.error), ms, '0 * * * *',
      { rounds: r.done, planned, ...(r.error ? { error: r.error.slice(0, 120) } : {}) })
  } catch { /* 관측 실패가 작업을 막지 않는다 */ }
}

/** 드라이버 응답 — 한 라운드도 못 돌았으면 500 으로 알린다(kick 의 하트비트가 ok:false 로 기록해야 관측된다). */
const driverJson = (c: { json: (b: unknown, s?: number) => Response }, r: { done: number; error?: string }, planned: number): Response =>
  (!r.done && r.error)
    ? c.json({ ok: false, rounds: r.done, planned, error: r.error }, 500)
    : c.json({ ok: true, rounds: r.done, planned, ...(r.error ? { error: r.error } : {}) })

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
  const t0 = Date.now()
  const rounds = resolveEnrichRounds((c.env as unknown as { ADS_INFLUENCER_ENRICH_ROUNDS?: string }).ADS_INFLUENCER_ENRICH_ROUNDS)
  const r = await runRoundChain(c.env, '/__ads/enrich-influencer', rounds, async () => {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    return runInfluencerEnrich(c.env)
  })
  await driverBeat(c.env, 'enrich-influencer-driver', Date.now() - t0, r, rounds)
  return driverJson(c, r, rounds)
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
  const t0 = Date.now()
  const rounds = resolveEnrichRounds((c.env as unknown as { ADS_ENRICH_ROUNDS?: string }).ADS_ENRICH_ROUNDS, 8)
  const r = await runRoundChain(c.env, '/__ads/enrich-company', rounds, async () => {
    const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect')
    return enrichHeldLeads(c.env)
  })
  await driverBeat(c.env, 'enrich-company', Date.now() - t0, r, rounds)
  return driverJson(c, r, rounds)
})
