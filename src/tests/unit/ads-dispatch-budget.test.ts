/**
 * 🚦 **한 정각에 몇 개를 띄우는가** — 예산 분산 + 유료 전환 시 자동 확대.
 *
 * ## 이 가드가 존재하는 이유 (2026-08-01 라이브 실측, 14:00 UTC)
 * 부모가 레인 15개를 동시에 매달았고, 부모 예산(~10.5s)이 끝나는 순간 **진행 중이던 7개가
 * 한꺼번에 잘렸다**(10,505~10,663ms 에 나란히). 잘리는 건 늘 뒤쪽의 같은 레인들이라
 * 값을 만드는 `enrich-influencer-driver` 가 10시간째 차례를 못 받고 있었다.
 * ⇒ 분산으로 우회한다. **분산의 대가는 주기가 길어지는 것뿐이고, 굶는 레인이 생기면 안 된다.**
 *
 * ## 여기서 반드시 막아야 하는 사고
 * 이 레포가 이미 여러 번 만난 클래스다 — `MAINT_SCHEDULE` 주석의 경고 그대로:
 * **"이 표에서 빠진 단계는 영원히 안 돈다 — 침묵이 아니라 부재라 경보에도 안 잡힌다."**
 * 분산은 그 사고를 만들기 가장 쉬운 구조다. 그래서 커버리지를 전수로 증명한다.
 */
import { describe, it, expect } from 'vitest'
import {
  resolvePlan, lanesPerTick, isDeferrable, selectLanesForTick, dispatchSnapshot,
  FREE_LANES_PER_TICK, PAID_LANES_PER_TICK, assignKey, type LaneCandidate,
} from '@/worker-ads/dispatch-budget'

/** 2026-08-01 14:00 UTC 회차에 실제로 뜬 매시간 레인들(하트비트 실측) — 문구를 바꾸지 말 것. */
const HOURLY: LaneCandidate[] = [
  'collect', 'scheduled', 'consented-reminder', 'inbound-onboarding', 'social-maintenance',
  'maintenance?phase=reclassify', 'collect-maker', 'collect-store-kakao',
  'enrich-company', 'enrich-prospects', 'collect-neis', 'enrich-influencer-driver',
  'match-registry', 'reclassify-company?passes=5', 'collect-storeinfo',
].map(beat => ({ beat }))

/**
 * 🔴 **미룰 수 없는 레인 — 이 픽스처가 없어서 결함을 놓쳤다** (2026-08-02).
 *
 * 첫 판(#919)의 픽스처는 매시간 레인만 담고 있었다. 그래서 `always` 가 늘 빈 배열이었고
 * "한 회차가 예산을 넘지 않는다" 어서션이 **공허하게 참**이 됐다. 라이브에선 16:00 UTC 에
 * `dailyAt(16)` + `everyNHours(2)` 가 겹쳐 **예산 8 에 12개가 떴고** 꼬리 3개가 잘렸다.
 * ⇒ 이제 픽스처가 그 시간을 재현한다. 지우지 말 것.
 */
const ALWAYS: LaneCandidate[] = [
  { beat: 'collect-nps', gapMin: 1440 },       // dailyAt(16)
  { beat: 'collect-commerce', gapMin: 120 },   // everyNHours(2)
  { beat: 'collect-hira', gapMin: 1440 },
  { beat: 'sweep-nts', gapMin: 1440 },
]
const LIVE_LANES = HOURLY
/** 라이브 16:00 UTC 재현 — 매시간 15 + 미룰 수 없는 4. */
const HEAVY_HOUR: LaneCandidate[] = [...HOURLY, ...ALWAYS]

/** 커서를 이어가며 N회차 돌리고 각 레인이 몇 번 돌았는지 센다. */
function simulate(lanes: LaneCandidate[], perTick: number, ticks: number) {
  let cursor = 0
  const counts = new Map<string, number>()
  const runSizes: number[] = []
  for (let t = 0; t < ticks; t++) {
    const sel = selectLanesForTick(lanes, perTick, cursor)
    cursor = sel.nextCursor
    runSizes.push(sel.run.length)
    for (const l of sel.run) counts.set(l.beat, (counts.get(l.beat) || 0) + 1)
  }
  return { counts, runSizes }
}

describe('요금제 해석 — 모르는 값은 free(안전한 쪽)', () => {
  it('paid 만 paid 다', () => {
    expect(resolvePlan({ ADS_PLAN: 'paid' })).toBe('paid')
    expect(resolvePlan({ ADS_PLAN: ' PAID ' })).toBe('paid')
    expect(resolvePlan({ ADS_PLAN: 'pro' })).toBe('free')   // 오타/추측 값
    expect(resolvePlan(undefined)).toBe('free')
  })
})

describe('💰 유료 전환 = 코드 변경 0 (대표 지시 2026-08-01)', () => {
  it('ADS_PLAN=paid 면 아무도 안 밀린다 — 미룰 수 없는 레인이 섞여 있어도', () => {
    const perTick = lanesPerTick({ ADS_PLAN: 'paid' })
    expect(perTick).toBe(PAID_LANES_PER_TICK)
    const sel = selectLanesForTick(HEAVY_HOUR, perTick, 0)
    expect(sel.deferred).toHaveLength(0)
    expect(sel.run).toHaveLength(HEAVY_HOUR.length)
  })

  it('free 는 나뉜다', () => {
    expect(lanesPerTick({})).toBe(FREE_LANES_PER_TICK)
    expect(selectLanesForTick(HEAVY_HOUR, FREE_LANES_PER_TICK, 0).deferred.length).toBeGreaterThan(0)
  })

  it('중간값도 준다 — ADS_LANES_PER_TICK 이 요금제보다 우선', () => {
    expect(lanesPerTick({ ADS_LANES_PER_TICK: '12' })).toBe(12)
    expect(lanesPerTick({ ADS_PLAN: 'paid', ADS_LANES_PER_TICK: '5' })).toBe(5)
  })

  it('🔒 오타 하나로 파이프라인이 멈추지 않는다 — 잘못된 값은 무시하고 기본값', () => {
    for (const bad of ['0', '-3', 'abc', '', '   ', 'null']) {
      expect(lanesPerTick({ ADS_LANES_PER_TICK: bad })).toBe(FREE_LANES_PER_TICK)
    }
  })
})

describe('🔴 예산을 실제로 지킨다 — 08-02 라이브 결함의 회귀 가드', () => {
  /**
   * 라이브 16:00 UTC: 예산 8 인데 12개가 떴고 꼬리 3개가
   * `Worker exceeded CPU time limit` 로 잘렸다. 원인은 `run = 항상돌것 + 예산만큼` 이었던 것.
   */
  it('미룰 수 없는 레인이 겹쳐도 총 실행 수가 예산을 넘지 않는다', () => {
    for (let c = 0; c < 20; c++) {
      const sel = selectLanesForTick(HEAVY_HOUR, 8, c)
      expect(sel.run.length, `cursor=${c} 에서 ${sel.run.length}개 실행(예산 8)`).toBeLessThanOrEqual(8)
    }
  })

  it('매시간 레인의 몫이 항상돌것 만큼 줄어든다', () => {
    expect(selectLanesForTick(HOURLY, 8, 0).cap).toBe(8)          // always 0 → 몫 8
    expect(selectLanesForTick(HEAVY_HOUR, 8, 0).cap).toBe(4)      // always 4 → 몫 4
    expect(selectLanesForTick(HEAVY_HOUR, 8, 0).always).toBe(4)
  })

  it('🔒 항상돌것이 예산을 통째로 먹어도 매시간 레인 1개는 전진한다 — 0 이면 커서가 영원히 안 움직인다', () => {
    const sel = selectLanesForTick(HEAVY_HOUR, 2, 0)   // 예산 2 < always 4
    expect(sel.cap).toBe(1)
    expect(sel.nextCursor).not.toBe(0)
    // 그리고 그 사실이 스냅샷에 남아 사람이 볼 수 있어야 한다(분산으로는 해결 불가란 신호).
    expect(dispatchSnapshot(sel, 'free', 2, 16, 'x').over_budget).toBe(true)
  })
})

describe('🔒 굶는 레인이 없다 — 커서 라운드로빈 전수 증명', () => {
  it('몫이 들쭉날쭉해도 모든 레인이 돈다(48회차)', () => {
    for (const perTick of [2, 3, 5, 8, 14, 64]) {
      const { counts } = simulate(HEAVY_HOUR, perTick, 48)
      expect(counts.size, `perTick=${perTick} 에서 누락`).toBe(HEAVY_HOUR.length)
      for (const l of ALWAYS) expect(counts.get(l.beat)).toBe(48)   // 미룰 수 없는 건 매번
    }
  })

  it('공평하다 — 가장 많이 돈 레인과 가장 적게 돈 레인의 차가 1 이하', () => {
    const { counts } = simulate(HOURLY, 8, 60)
    const v = [...counts.values()]
    expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(1)
  })

  it('예산 상한이 매 회차 지켜진다(48회차 전부)', () => {
    const { runSizes } = simulate(HEAVY_HOUR, 8, 48)
    expect(Math.max(...runSizes)).toBeLessThanOrEqual(8)
  })

  it('커서가 없거나 망가져도 터지지 않는다(fail-soft)', () => {
    for (const c of [NaN, -5, 1e9, 0]) {
      const sel = selectLanesForTick(HEAVY_HOUR, 8, c)
      expect(sel.run.length).toBeLessThanOrEqual(8)
      expect(sel.run.length).toBeGreaterThan(0)
    }
  })
})

describe('🔒 일 1회·N시간 레인은 절대 안 밀린다 (영원한 부재 방지)', () => {
  it('gap > 60 은 미룰 수 없다', () => {
    expect(isDeferrable({ beat: 'x', gapMin: 24 * 60 })).toBe(false)
    expect(isDeferrable({ beat: 'x', gapMin: 180 })).toBe(false)
    expect(isDeferrable({ beat: 'x', gapMin: 60 })).toBe(true)
    expect(isDeferrable({ beat: 'x' })).toBe(true)            // 미지정 = 매시간
  })

  it('예산이 아무리 작아도 그 회차에 반드시 뜬다', () => {
    for (let c = 0; c < 10; c++) {
      const names = selectLanesForTick(HEAVY_HOUR, 1, c).run.map(l => l.beat)
      for (const l of ALWAYS) expect(names).toContain(l.beat)
    }
  })
})

describe('🔒 배정이 배열 순서에 의존하지 않는다', () => {
  it('assignKey 는 쿼리를 뗀다', () => {
    expect(assignKey('maintenance?phase=merge')).toBe('maintenance')
    expect(assignKey('reclassify-company?passes=5')).toBe('reclassify-company')
  })

  it('쿼리 달린 형제가 있어도 이름 기준으로 정해진다', () => {
    // 원시 정렬: maint < maint-extra < maint?p=a  ('-'=45 < '?'=63)
    // 키 정렬  : maint ≡ maint?p=a < maint-extra  ⇒ 커서 0 에서 집히는 2개가 다르다.
    const lanes: LaneCandidate[] = [{ beat: 'maint' }, { beat: 'maint-extra' }, { beat: 'maint?p=a' }]
    expect(selectLanesForTick(lanes, 2, 0).run.map(l => l.beat)).toEqual(['maint', 'maint?p=a'])
  })

  it('입력 배열 순서를 바꿔도 결과가 같다(회전 — reverse 는 홀짝을 보존해 무의미)', () => {
    const rotated = [...HEAVY_HOUR.slice(1), HEAVY_HOUR[0]]
    for (let c = 0; c < 12; c++) {
      expect(selectLanesForTick(rotated, 8, c).run.map(l => l.beat).sort())
        .toEqual(selectLanesForTick(HEAVY_HOUR, 8, c).run.map(l => l.beat).sort())
    }
  })

  it('입력 배열을 변형하지 않는다', () => {
    const input = [...HEAVY_HOUR]
    const before = input.map(l => l.beat)
    selectLanesForTick(input, 8, 3)
    expect(input.map(l => l.beat)).toEqual(before)
  })
})

describe('스냅샷 — 미룬 것과 죽은 것을 구분할 수 있게', () => {
  it('돌린 것/미룬 것/다음 커서를 남긴다', () => {
    const sel = selectLanesForTick(HEAVY_HOUR, 8, 3)
    const snap = dispatchSnapshot(sel, 'free', 8, 16, '2026-08-01T16:00:00.000Z')
    expect((snap.ran as string[]).length + (snap.deferred as string[]).length).toBe(HEAVY_HOUR.length)
    expect(snap.cursor_next).toBe(sel.nextCursor)
    expect(snap.over_budget).toBe(false)
  })

  it('🚧 진단 API 가 실제로 이 스냅샷을 내보낸다 — 안 그러면 판정에서 못 본다', async () => {
    const src = (await import('node:fs')).readFileSync('src/features/marketing/api/ads-pool-diag.ts', 'utf8')
    expect(src).toContain("'ads_dispatch_last'")
    expect(src).toMatch(/dispatch: parseJson\(find\('ads_dispatch_last'\)\)/)
  })
})

describe('🚧 배선 — 스케줄러가 실제로 예산 분산을 쓰는가', () => {
  it('index.ts 가 즉시 kick 하지 않고 모아서 dispatchPendingLanes 로 넘긴다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/index.ts', 'utf8')
    expect(src).toMatch(/const kicked = await dispatchPendingLanes\(\{/)
    const kickBody = src.slice(src.indexOf('const kick = ('), src.indexOf('const gates = makeHourGates'))
    expect(kickBody).toContain('pending.push(')
    expect(kickBody).not.toContain('SELF')
    expect(kickBody).not.toContain('ctx.waitUntil')
  })

  it('🔒 커서를 읽고 쓴다 — 안 그러면 매 회차 같은 레인만 돈다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/lane-runner.ts', 'utf8')
    expect(src).toMatch(/SELECT value FROM platform_settings WHERE key = \?/)
    expect(src).toMatch(/bind\(DISPATCH_CURSOR_KEY, String\(sel\.nextCursor\)\)/)
  })
})
