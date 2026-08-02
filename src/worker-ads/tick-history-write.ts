/**
 * 📼 회차 요약 1줄 저장 + 🎚️ **다음 회차의 레인 수 학습** — `tick-history.ts`/`lane-aimd.ts`(순수 로직)의 I/O 짝.
 *
 * 둘을 한 함수에 둔 이유는 **같은 사실을 두 번 읽지 않기 위해서**다. 학습기의 입력은 방금 만든
 * 회차 요약 그 자체이므로, 여기서 이어서 계산하면 D1 왕복이 늘지 않는다(읽기 1 · 쓰기 1 batch).
 *
 * ⚠️ **절대 던지지 않는다.** 관측이 실패해서 회차가 죽으면 본말전도다.
 * ⚠️ **읽기 1 + 쓰기 1, 회차당 1회.** 여기서 회차마다 여러 번 쓰면 무료 D1 예산을 갉는다.
 * ⚠️ **부모가 여기까지 못 오면 그 회차는 요약이 없다.** 그래서 학습기는 *살아남은 회차만* 보게 되고,
 *   그건 정의상 덜 해로운 회차들이다 — **물러나야 할 때 신호를 못 받는 편향**이다(실측: 관측된 회차 5중 2).
 *   ⇒ 2026-08-03: 다음 회차가 **이력의 빈자리를 세어**(`missedTicks`) 그 붕괴를 대신 신고한다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { TICK_HISTORY_KEY, appendTick, readTickHistory, summarizeTick } from './tick-history'
import { LANE_LEARN_KEY, laneCeiling, learnLanes, missedTicks, readLaneLearn } from './lane-aimd'
import { FREE_LANES_PER_TICK, PAID_LANES_PER_TICK, resolvePlan, type DispatchEnv } from './dispatch-budget'

export async function writeTickSummary(
  DB: D1Database, at: string, hourUTC: number, ranNames: readonly string[],
  beats: ReadonlyArray<{ name: string; ok: boolean; ms: number }>,
  /** 요금제 판정용 env. 생략하면 free 로 본다(안전한 쪽). */
  env?: DispatchEnv | null,
): Promise<void> {
  try {
    const rows = await DB.prepare('SELECT key, value FROM platform_settings WHERE key IN (?, ?)')
      .bind(TICK_HISTORY_KEY, LANE_LEARN_KEY).all<{ key: string; value: string }>().catch(() => null)
    const pick = (k: string) => rows?.results?.find(r => r.key === k)?.value

    const tick = summarizeTick(at, hourUTC, ranNames, beats)
    // 🕳️ **빈 회차를 세는 건 이력을 덧붙이기 *전*이어야 한다** — 덧붙인 뒤 마지막 항목을 보면
    //   그건 방금 만든 이 회차라 간격이 항상 0 이 된다(검사가 통째로 헛돈다).
    const prevAt = readTickHistory(pick(TICK_HISTORY_KEY)).at(-1)?.at
    const next = appendTick(pick(TICK_HISTORY_KEY), tick)

    const plan = resolvePlan(env ?? null)
    const learned = learnLanes(
      readLaneLearn(pick(LANE_LEARN_KEY)), tick, laneCeiling(plan),
      plan === 'paid' ? PAID_LANES_PER_TICK : FREE_LANES_PER_TICK,
      missedTicks(prevAt, at),
    )

    const put = DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    await DB.batch([
      put.bind(TICK_HISTORY_KEY, next),
      put.bind(LANE_LEARN_KEY, JSON.stringify(learned)),
    ]).catch(() => undefined)
  } catch { /* 관측 실패가 회차를 막지 않는다 */ }
}
