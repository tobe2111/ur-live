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


/**
 * 🚀 라운드를 **응답 뒤로** 돌린다 — 드라이버의 핵심.
 *
 * ## 왜 (2026-07-29 라이브 실측으로 드러난 #835 의 미완)
 * 부모의 `kick` 은 `await env.SELF.fetch(...)` 다 — **응답을 기다린다.** 그런데 드라이버가
 * 라운드를 전부 돌고 나서 응답하면, 부모는 그 12라운드(각 라운드가 외부 크롤) 내내 살아 있어야 한다.
 * #835 는 라운드를 부모의 *서브리퀘스트 예산*에서 뺐지만 부모의 *수명*에서는 못 뺐다.
 *
 * 실측(07:00 틱): 발화한 8개는 전부 **빠른 레인**(D1 전용)이고, 빠진 것은 전부 **느린 레인**
 * (외부 크롤)이었다. `enrich_lane.last_run` 은 05:02 에서 멈춰 두 틱을 통째로 걸렀다.
 * 즉 부모의 수명이 천장이었고, 느린 레인은 일도 못 하고 하트비트도 못 남겼다.
 *
 * ## 처방
 * 드라이버는 **즉시 응답**하고(부모의 kick 은 곧바로 풀린다) 라운드는 자기 인보케이션의
 * `waitUntil` 에서 돈다. 부모는 다음 레인을 바로 디스패치한다.
 *
 * ⚠️ 관측을 잃지 않는다 — 라운드 결과를 **자기 하트비트**(`ads:{lane}-rounds`)로 남긴다.
 *   즉시 응답만 하고 결과를 안 남기면 "돌긴 했나"를 다시 알 수 없게 된다(고치려던 그 병).
 */
async function runRoundsDetached(
  c: { env: Env; executionCtx?: { waitUntil(p: Promise<unknown>): void } },
  lane: string,
  rounds: number,
  once: () => Promise<unknown>,
  roundPath: string,
): Promise<{ ok: boolean; rounds: number; planned: number; error?: string }> {
  const env = c.env
  const work = async () => {
    const t0 = Date.now()
    let done = 0
    let error: string | undefined
    for (let i = 0; i < rounds; i++) {
      if (!env.SELF?.fetch) { // SELF 미바인딩(로컬) — 체인 불가라 1회 직접 실행
        try { await once(); done++ } catch (err) { error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 200)}` }
        break
      }
      try {
        const r = await env.SELF.fetch(new Request(`https://ur-ads${roundPath}`, { method: 'POST' }))
        if (!r.ok) { error = `round${i + 1}: HTTP ${r.status}`; break }
        done++
      } catch (err) {
        error = `round${i + 1}: ${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 160)}`
        break
      }
    }
    try {
      const { recordCronBeat } = await import('@/worker/utils/cron-heartbeat')
      // 매시간 도는 레인이라 기대 간격은 매시간 기준(cron 식 대신 명시 — lane-cadence.ts 참조).
      await recordCronBeat(env as never, `ads:${lane}-rounds`, !!done, Date.now() - t0, undefined,
        { rounds: done, planned: rounds, ...(error ? { error } : {}) }, 150)
    } catch { /* 관측 실패가 라운드를 망치지 않는다 */ }
    return { ok: !!done, rounds: done, planned: rounds, ...(error ? { error } : {}) }
  }

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(work())
    return { ok: true, rounds: 0, planned: rounds } // 디스패치 성공(결과는 위 하트비트로)
  }
  return work() // 로컬/미지원 — 기존처럼 동기 실행
}

/** 라운드 상한 — env 로 조정(1~20). 기본 12: 아래 드라이버 주석의 실측 근거 참조. */
export function resolveEnrichRounds(raw: string | undefined): number {
  return Math.min(20, Math.max(1, parseInt(raw || '', 10) || 12))
}

/** 파트너풀(회사) 이메일 보강 라운드 — 기존 부모 루프의 기본값 8 을 그대로 승계(행동 변화 0). */
export function resolveCompanyEnrichRounds(raw: string | undefined): number {
  return Math.min(20, Math.max(1, parseInt(raw || '', 10) || 8))
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
  const r = await runRoundsDetached(c, 'enrich-influencer', rounds, async () => {
    const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
    return runInfluencerEnrich(c.env)
  }, '/__ads/enrich-influencer')
  return c.json(r, r.ok ? 200 : 500)
})

/**
 * 📧 파트너풀 **이메일 보강 라운드 드라이버** — 2026-07-29 신설.
 *
 * ## 왜 (라이브 실측)
 * 이 레인만 아직 라운드 루프를 **부모 cron 인보케이션에서** 돌리고 있었다:
 * `for (i < 8) await env.SELF.fetch('/__ads/enrich-company')` — 8회 **순차** 왕복이고,
 * 한 라운드는 실제로 외부 사이트를 크롤한다. 부모는 그동안 살아 있어야 한다.
 *
 * 2026-07-29 07:00 틱 실측: 발화한 레인이 **8개에서 잘렸다**(05:00 엔 15개+). 실패 기록조차
 * 없는 **조용한 절단** — `kick` 의 하트비트는 SELF fetch 가 *끝난 뒤* 찍히므로, 부모가 먼저
 * 회수되면 그 레인들은 기록도 안 남긴다. 직전 06:00 틱에는 5개 레인이
 * `Worker exceeded CPU time limit.` 으로 실패했다.
 *
 * 이건 #830(수집 러너)·#831(kick 격리)·#835(인플루언서 보강 드라이버)에서 세 번 고친 것과
 * **정확히 같은 실패 양식**이고, #830 커밋도 "남은 공유 블록은 같은 방식으로 떼면 된다"고
 * 인계에 남겼다. 남은 마지막 하나가 이것이다.
 *
 * ## 처방 (인플루언서 드라이버와 동일)
 * 라운드를 **자기 인보케이션**으로 옮긴다. 부모가 내는 비용은 언제나 kick 1개(SELF fetch + 하트비트).
 * 드라이버는 자기 예산·자기 시간 안에서 라운드를 돌고, 부모는 즉시 다음 레인을 디스패치한다.
 *
 * ⚠️ 라운드는 **순차**여야 한다 — 각 라운드가 `enrich_checked_at` 도장을 찍어야 다음 라운드가
 *   다음 백로그 구간을 집는다(동시 실행하면 같은 행을 중복 크롤하고 예산만 태운다).
 * 💥 실패하면 그 자리에서 멈추고 원문을 돌려준다 — 남은 라운드를 헛돌리지 않고 다음 정각이 이어받는다.
 */
enrichRoutes.post('/__ads/enrich-company-driver', async (c) => {
  const rounds = resolveCompanyEnrichRounds((c.env as unknown as { ADS_ENRICH_ROUNDS?: string }).ADS_ENRICH_ROUNDS)
  const r = await runRoundsDetached(c, 'enrich-company', rounds, async () => {
    const { enrichHeldLeads } = await import('@/features/marketing/api/company-collect')
    return enrichHeldLeads(c.env)
  }, '/__ads/enrich-company')
  return c.json(r, r.ok ? 200 : 500)
})
