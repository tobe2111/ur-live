/**
 * 📼 회차 요약 1줄 저장 + 🎚️ **다음 회차의 레인 수 학습** — `tick-history.ts`/`lane-aimd.ts`(순수 로직)의 I/O 짝.
 *
 * 둘을 한 함수에 둔 이유는 **같은 사실을 두 번 읽지 않기 위해서**다. 학습기의 입력은 방금 만든
 * 회차 요약 그 자체이므로, 여기서 이어서 계산하면 D1 왕복이 늘지 않는다(읽기 1 · 쓰기 1 batch).
 *
 * ⚠️ **절대 던지지 않는다.** 관측이 실패해서 회차가 죽으면 본말전도다.
 * ⚠️ **읽기 1 + 쓰기 1, 회차당 1회.** 여기서 회차마다 여러 번 쓰면 무료 D1 예산을 갉는다.
 * ⚠️ **부모가 여기까지 못 오면 학습도 못 한다** — 그 회차는 가장 심하게 무너진 회차인데 신호가 없다.
 *   그건 결함이 아니라 이 구조의 한계이고, 다음 회차가 (기록이 남는다면) 대신 물러난다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { TICK_HISTORY_KEY, appendTick, summarizeTick } from './tick-history'
import { LANE_LEARN_KEY, laneCeiling, learnLanes, readLaneLearn } from './lane-aimd'
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
    const next = appendTick(pick(TICK_HISTORY_KEY), tick)

    const plan = resolvePlan(env ?? null)
    const learned = learnLanes(
      readLaneLearn(pick(LANE_LEARN_KEY)), tick, laneCeiling(plan),
      plan === 'paid' ? PAID_LANES_PER_TICK : FREE_LANES_PER_TICK,
    )

    const put = DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    await DB.batch([
      put.bind(TICK_HISTORY_KEY, next),
      put.bind(LANE_LEARN_KEY, JSON.stringify(learned)),
    ]).catch(() => undefined)
  } catch { /* 관측 실패가 회차를 막지 않는다 */ }
}
