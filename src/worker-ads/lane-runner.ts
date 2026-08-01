/**
 * 🏃 **레인 실행부** — 고른 레인을 실제로 띄운다.
 *
 * `dispatch-budget.ts` 가 *무엇을* 돌릴지 정하는 순수 로직이라면, 이 파일은 *어떻게* 띄우는가다.
 * 둘을 나눈 이유: 배정 규칙은 env 없이 유닛으로 전수 검증할 수 있어야 하고(굶는 레인 0 을
 * 기계가 증명해야 한다), 실행부는 `env.SELF`·하트비트 같은 런타임 결합을 갖기 때문이다.
 *
 * ⚠️ **동작은 종전과 byte-동일하다** — SELF 우선 · 폴백 인라인 · 성공/실패 양쪽 하트비트.
 *   달라진 건 `kick` 호출 시점에 바로 뜨지 않고 **모아 두었다가 선별 후 뜬다**는 것뿐이다.
 *   (게이트 평가는 동기라 실제 시작 시각 차이는 무시할 수 있다.)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { lanesPerTick, selectLanesForHour, dispatchSnapshot, resolvePlan, type LaneCandidate } from './dispatch-budget'

export interface RunnableLane extends LaneCandidate {
  path: string
  /** `env.SELF` 가 없을 때(로컬/테스트) 같은 일을 인라인으로 하는 경로. */
  fallback: () => Promise<unknown>
}

export interface LaneRunnerDeps {
  /** `env.SELF.fetch` — 없으면 폴백을 쓴다. */
  selfFetch?: (req: Request) => Promise<unknown>
  /** 레인 URL 생성기(이름·주기를 실어 레인이 **자기 하트비트를 스스로** 쓰게 한다). */
  laneUrl: (path: string, beat: string, gap?: number) => string
  /** 하트비트 기록. 부모 쪽 쓰기는 레인 self-beat 의 폴백으로 유지된다. */
  beat: (name: string, ok: boolean, ms: number, err?: unknown, gap?: number) => Promise<unknown>
  now?: () => number
}

/**
 * 한 레인을 띄우고 결과를 하트비트로 남긴다. **던지지 않는다** — 한 레인의 실패가 다른 레인의
 * 디스패치를 막으면 안 된다(그 순간 남은 레인은 '실패'가 아니라 '흔적 없음'이 되어 오진을 부른다).
 */
export function runLane(lane: RunnableLane, deps: LaneRunnerDeps): Promise<unknown> {
  const now = deps.now || (() => Date.now())
  return (async () => {
    const t0 = now()
    try {
      if (deps.selfFetch) await deps.selfFetch(new Request(deps.laneUrl(lane.path, lane.beat, lane.gapMin), { method: 'POST' }))
      else await lane.fallback()
      await deps.beat(lane.beat, true, now() - t0, undefined, lane.gapMin)
    } catch (err) {
      await deps.beat(lane.beat, false, now() - t0, err, lane.gapMin)
    }
  })()
}

/** 고른 레인을 동시에 띄운다(호출부가 각 프로미스를 `waitUntil` 로 감싼다). */
export function runLanes(lanes: RunnableLane[], deps: LaneRunnerDeps): Promise<unknown>[] {
  return lanes.map(l => runLane(l, deps))
}

/**
 * 🚦 **이번 정각의 디스패치 한 방** — 선별 → 실행 → 미룬 내역 기록까지.
 *
 * 호출부(`index.ts`)는 배선만 남기고 판단을 전부 여기로 내린다. 그래야 배정 규칙이 바뀌어도
 * 스케줄러 본문을 안 건드리고, 유닛이 규칙을 직접 겨눌 수 있다.
 *
 * @returns 띄운 프로미스들 — 호출부가 `waitUntil` + 마지막 하트비트 flush 에 쓴다.
 */
export function dispatchPendingLanes(opts: {
  pending: RunnableLane[]
  env: { SELF?: { fetch: (req: Request) => Promise<unknown> }; DB: D1Database; ADS_PLAN?: string; ADS_LANES_PER_TICK?: string }
  hourUTC: number
  laneUrl: LaneRunnerDeps['laneUrl']
  beat: LaneRunnerDeps['beat']
  waitUntil: (p: Promise<unknown>) => void
}): Promise<unknown>[] {
  const { pending, env, hourUTC, waitUntil } = opts
  const perTick = lanesPerTick(env)
  const sel = selectLanesForHour(pending, perTick, hourUTC)
  const self = env.SELF
  const kicked = runLanes(sel.run, {
    selfFetch: self?.fetch ? (req: Request) => self.fetch(req) : undefined,
    laneUrl: opts.laneUrl, beat: opts.beat,
  })
  for (const p of kicked) waitUntil(p)
  // 🧾 미룬 것과 죽은 것이 똑같이 "기록 없음"으로 보이면 오진한다 — 선별 결과를 남긴다.
  //   ⚠️ 미룬 게 없으면 안 쓴다(= 유료·소규모에선 D1 쓰기 0 — 부모 서브리퀘스트 천장이 빠듯하다).
  if (sel.deferred.length) {
    const snap = JSON.stringify(dispatchSnapshot(sel, resolvePlan(env), perTick, hourUTC, new Date().toISOString()))
    waitUntil(env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_dispatch_last', snap).run().catch(() => undefined))
  }
  return kicked
}
