/**
 * ⏳ **부모 꼬리를 무한정 기다리지 않는다** (2026-08-03, 대표 확정 "c")
 *
 * ## 왜 필요한가 — 라이브 실측
 *
 * 회차 요약과 **학습기 상태는 같은 배치에서** 쓰이고(`tick-history-write.ts`), 그 호출은 부모 꼬리에 있다:
 *
 * ```ts
 * ctx.waitUntil(Promise.allSettled(kicked).then(async () => {
 *   await beats.flush(); await writeTickSummary(...)     // ← cap/clean/pinned 갱신의 유일한 자리
 * }))
 * ```
 *
 * **띄운 레인이 전부 끝나기를 기다린다.** 부모가 그때까지 못 살면 flush 도 요약도 실행되지 않는다.
 * 08-03 실측: `ads_tick_history` 가 **09:00 KST 에서 5시간 정지**, 그동안 `ads_dispatch_last` 는
 * 매 회차 정상 기록, `cron_failures` 는 0(예외 없이 잘린 것이라 실패로도 안 남는다).
 *
 * ## 🔒 그리고 자가치유가 막혀 있었다
 *
 * #983 이 빈자리를 해 신호로 쓰면서 *"오탐의 대가는 한 칸 물러났다 **깨끗한 2회차에 되찾기**"* 라 적었다.
 * 그 되찾기가 성립하려면 꼬리가 두 번 돌아야 하는데, **못 도는 게 바로 그 꼬리다.**
 * 빈자리가 배포 때문이면 일시적이지만, 실제로는 **측정하려는 고장이 측정 자체를 지운다.**
 *
 * ## ⚠️ 상한만 넣으면 반대쪽 함정에 빠진다
 *
 * `tickHarmed` 는 `fail + miss >= HARM_MIN_LANES` 이고 `miss` 는 *띄웠는데 하트비트가 없는* 레인이다.
 * 그냥 잘라 버리면 아직 도는 레인이 전부 `miss` 로 잡혀 **모든 회차가 항상 해로움** → 영영 회복 불가.
 * 지금 고치려는 것과 **부호만 반대인 같은 고장**이다.
 *
 * ⇒ 그래서 **판정 대상에서 빼는 것**이지 실패로 세는 것이 아니다. 끝난 레인만 판정하고,
 *   못 기다린 레인은 *"모름"* 으로 남긴다(그 수는 `ads_tail_bound_last` 에 남겨 눈에 보이게 한다 —
 *   "잘렸다"와 "원래 없다"가 또 똑같이 생기면 안 된다).
 *
 * ## 못 하는 것 (과신 금지)
 * - **부모가 왜 죽는지는 여전히 모른다**(CPU · 대기시간 · `waitUntil` 자체 한도 중 무엇인지 미확정).
 *   이 상한은 원인을 고치는 게 아니라 **기록이 반드시 남게** 만든다. 원인 규명은 별건이다.
 * - 상시 느린 레인은 계속 판정에서 빠진다 — 그 사실은 `cut` 수치로 드러나므로 다음 세션이 본다.
 */

/** 회차 꼬리에서 레인 완료를 기다리는 상한(무료). 레인 마감선(12~20s)보다 넉넉하게. */
export const TAIL_WAIT_MS = 25_000
/** 유료는 부모 수명이 길고 레인 마감선도 길다(24~60s). */
export const TAIL_WAIT_MS_PAID = 60_000
/** 관측 스탬프 키 — 잘린 회차를 눈에 보이게 남긴다. */
export const TAIL_BOUND_KEY = 'ads_tail_bound_last'

export interface TailWaitResult {
  /** 상한 안에 끝난 항목의 **인덱스**(`ranNames` 와 같은 순서로 정렬돼 있다). */
  settled: number[]
  /** 못 기다린 개수. 0 이면 예전과 동일하게 전부 기다린 것이다. */
  cut: number
}

/**
 * `tasks` 가 전부 끝나기를 기다리되 `ms` 를 넘기면 **거기서 그만 기다린다**(작업을 취소하지는 않는다 —
 * 취소할 방법도 없고, 레인은 자기 인보케이션에서 계속 돌아 자기 하트비트를 남긴다).
 *
 * @returns 끝난 항목의 인덱스와 못 기다린 개수. 인덱스로 돌려주는 이유는 호출부가
 *   `ranNames[i]` 로 **어느 레인을 판정해도 되는지** 정확히 가려내기 위해서다.
 */
export async function settleWithin(tasks: readonly Promise<unknown>[], ms: number): Promise<TailWaitResult> {
  if (!tasks.length) return { settled: [], cut: 0 }
  const settled: number[] = []
  const tracked = tasks.map((p, i) =>
    Promise.resolve(p).then(() => { settled.push(i) }, () => { settled.push(i) }),
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => { timer = setTimeout(resolve, Math.max(0, ms)) })
  await Promise.all(tracked)
  if (timer !== undefined) clearTimeout(timer)   // 남겨 두면 그 회차 isolate 가 그만큼 더 붙잡힌다
  return { settled: [...settled].sort((a, b) => a - b), cut: tasks.length - settled.length }
}

/**
 * 상한 안에 끝난 레인 이름만 고른다 — **이게 판정 대상**이다.
 * 못 기다린 레인을 넣으면 `miss` 로 잡혀 회차가 늘 해로움이 된다(위 헤더 참조).
 */
export function judgedLaneNames(ranNames: readonly string[], settled: readonly number[]): string[] {
  const keep = new Set(settled)
  return ranNames.filter((_, i) => keep.has(i))
}

/** 요금제까지 반영해 한 번에 — 호출부가 상한 계산을 다시 쓰지 않게. */
export async function settleWithinPlan(
  tasks: readonly Promise<unknown>[], env: Record<string, unknown>,
): Promise<TailWaitResult & { waited: number }> {
  const { envPlanValue } = await import('@/features/marketing/api/collect-budget')
  const waited = envPlanValue(undefined, TAIL_WAIT_MS, TAIL_WAIT_MS_PAID, env as never)
  return { ...(await settleWithin(tasks, waited)), waited }
}

/**
 * 잘린 회차를 눈에 보이게 남긴다 — **"잘렸다"와 "원래 없다"가 똑같이 생기면 또 오진한다.**
 * 회차당 D1 쓰기 1회. 실패해도 삼킨다(관측이 회차를 막으면 안 된다).
 */
export async function stampTailBound(
  DB: { prepare: (s: string) => { bind: (...a: unknown[]) => { run: () => Promise<unknown> } } },
  at: string, ran: number, r: TailWaitResult & { waited: number },
): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(TAIL_BOUND_KEY, JSON.stringify({ at, ran, judged: r.settled.length, cut: r.cut, waited_ms: r.waited }))
    .run().catch(() => undefined)
}

/**
 * 회차 꼬리 한 덩어리 — **상한 대기 → flush → 요약/학습 → 잘린 수 스탬프**.
 * 호출부(`index.ts`)가 이 순서를 다시 쓰지 않게 여기 모은다(순서가 갈리면 조용히 어긋난다).
 */
export async function closeTick(o: {
  DB: unknown; env: Record<string, unknown>; kicked: readonly Promise<unknown>[]
  ranNames: readonly string[]; at: string; hourUTC: number
  beats: { flush: () => Promise<unknown>; seenBeats: ReadonlyArray<{ name: string; ok: boolean; ms: number }> }
}): Promise<void> {
  const r = await settleWithinPlan(o.kicked, o.env)
  await o.beats.flush()
  const { writeTickSummary } = await import('./tick-history-write')
  await writeTickSummary(o.DB as never, o.at, o.hourUTC, judgedLaneNames(o.ranNames, r.settled), o.beats.seenBeats, o.env as never)
  await stampTailBound(o.DB as never, o.at, o.ranNames.length, r)
}
