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
  FREE_LANES_PER_TICK, PAID_LANES_PER_TICK, assignKey, laneRole, readCursors,
  splitCapByRole, resolveMeasureShare, MEASURE_SHARE_DEFAULT,
  type LaneCandidate, type LaneCursors, type LaneSelection,
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
  // 첫 회차는 구 포맷(숫자)으로 시작해 **하위호환 경로까지 매 시뮬레이션이 지나가게** 한다.
  // 이후엔 역할별 커서를 그대로 이어받는다.
  let cursor: number | LaneCursors = 0
  const counts = new Map<string, number>()
  const runSizes: number[] = []
  for (let t = 0; t < ticks; t++) {
    // ⚠️ 반환 타입을 명시해야 한다 — `cursor` 가 `sel.nextCursor` 를 받으면서 제어흐름 narrowing 이
    //    `cursor → sel → cursor` 로 순환해 TS7022(암시적 any)가 난다.
    const sel: LaneSelection<LaneCandidate> = selectLanesForTick(lanes, perTick, cursor)
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
    // ⚠️ 커서가 객체가 된 뒤로 `not.toBe(0)` 은 **항상 참**이라 공허하다(객체 !== 0).
    //    실제로 전진했는지를 봐야 한다 — 안 그러면 이 가드가 헛돈다.
    expect(sel.nextCursor.measure + sel.nextCursor.other).toBeGreaterThan(0)
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

  /**
   * ⚠️ **이 어서션은 2026-08-02 에 의도적으로 바뀌었다.** 원래는 "모든 레인의 회차 차이 ≤ 1"
   * (=완전 균등)이었는데, 그 균등이 바로 대표가 재설계를 지시한 결함이다 — 수집 13 : 측정 1 이라
   * 균등 배분이면 **몫이 등록된 레인 개수로 정해진다**. 균등은 이제 불변식이 아니다.
   * 대신 **역할 안에서의 공평성**을 지킨다(역할 내부에선 여전히 아무도 안 굶는다).
   */
  it('공평하다 — 같은 역할 안에서는 회차 차이가 1 이하', () => {
    const { counts } = simulate(HOURLY, 8, 60)
    const of = (role: 'measure' | 'other') => HOURLY
      .filter(l => laneRole(l) === role).map(l => counts.get(l.beat) || 0)
    for (const role of ['measure', 'other'] as const) {
      const v = of(role)
      expect(Math.max(...v) - Math.min(...v), `${role} 안에서 불공평`).toBeLessThanOrEqual(1)
    }
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

/**
 * 🎭 **몫을 역할로 나눈다** (2026-08-02 대표 확정 "무료 유지 — 배분 정책 재설계").
 *
 * ## 왜 이 가드가 필요한가 — 라이브 실측 (08-02 20:32 UTC)
 * 커서 라운드로빈은 모든 레인을 동등하게 돌린다. 그런데 레인은 동등하지 않다:
 * **수집은 백로그를 만들고 보강은 백로그를 줄인다.** 동등 배분이면 각 기능의 몫이
 * "누가 레인을 몇 개 등록했나"로 정해진다 — 실측 `collect-* 13개 : 측정 1개`,
 * `nb_unmeasured` 20,497 → 21,192 **상승**. 게다가 데이터 소스를 붙일 때마다
 * 수집 레인이 하나 늘어 측정의 몫이 **자동으로 깎인다**(한 방향 드리프트).
 */
describe('🎭 몫은 레인 개수가 아니라 역할이 정한다', () => {
  const drv = 'enrich-influencer-driver'

  it('측정 레인이 수집 레인보다 자주 돈다', () => {
    const { counts } = simulate(HEAVY_HOUR, 8, 48)
    const collect = HOURLY.filter(l => l.beat.startsWith('collect'))
      .map(l => counts.get(l.beat) || 0)
    const avgCollect = collect.reduce((a, b) => a + b, 0) / collect.length
    expect(counts.get(drv)!).toBeGreaterThan(avgCollect)
  })

  /**
   * 🔒 **이게 이 describe 의 핵심이다.** 위 어서션은 균등 배분에서도 아슬아슬하게 통과할 수 있다
   * (실측: 역할 판정을 무력화했더니 13 vs 13.0 으로 겨우 걸렸다). 드리프트를 직접 재현하는
   * 아래 것이 진짜 가드다 — 되돌려-검증에서 13 → 7 로 확실히 빨강이 떴다.
   */
  it('🔒 수집 레인을 12개 더 등록해도 측정 회차가 안 깎인다 — 한 방향 드리프트 차단', () => {
    const before = simulate(HEAVY_HOUR, 8, 48).counts.get(drv)
    const flooded = [...HEAVY_HOUR, ...Array.from({ length: 12 }, (_, i) => ({ beat: `collect-new-${i}` }))]
    const after = simulate(flooded, 8, 48).counts.get(drv)
    expect(after).toBe(before)
  })

  it('🔒 cap 이 1 이어도 양쪽 역할이 다 전진한다 — 한쪽을 영구히 굶기면 안 된다', () => {
    const { counts } = simulate(HEAVY_HOUR, 2, 48)   // cap = max(1, 2−4) = 1
    for (const l of HOURLY) expect(counts.get(l.beat), `${l.beat} 가 한 번도 안 돌았다`).toBeGreaterThan(0)
  })

  it('역할 판정 — enrich-* 는 measure, 명시 role 이 이름을 이긴다', () => {
    expect(laneRole({ beat: drv })).toBe('measure')
    expect(laneRole({ beat: 'enrich-company' })).toBe('measure')
    expect(laneRole({ beat: 'collect-neis' })).toBe('other')
    expect(laneRole({ beat: 'collect', role: 'measure' })).toBe('measure')
  })

  it('몫을 다 쓴다 — 남는 건 상대 역할에 넘기고, 레인보다 크면 안 쓴다', () => {
    const a = splitCapByRole(4, 3, 12, 0.5, 0)
    expect(a.measure + a.other).toBe(4)
    const b = splitCapByRole(10, 3, 2, 0.5, 0)         // 몫 10 > 레인 5
    expect(b.measure + b.other).toBe(5)
    const c = splitCapByRole(6, 1, 20, 0.5, 0)         // 측정 레인 1개뿐
    expect(c).toEqual({ measure: 1, other: 5 })
  })

  it('🔒 비율은 무배포 조정 — 오타·범위 밖은 기본값(파이프라인이 멈추면 안 된다)', () => {
    expect(resolveMeasureShare({ ADS_MEASURE_SHARE: '0.3' })).toBe(0.3)
    expect(resolveMeasureShare({ ADS_MEASURE_SHARE: '오타' })).toBe(MEASURE_SHARE_DEFAULT)
    expect(resolveMeasureShare({ ADS_MEASURE_SHARE: '5' })).toBe(MEASURE_SHARE_DEFAULT)
    expect(resolveMeasureShare({})).toBe(MEASURE_SHARE_DEFAULT)
  })
})

describe('🔒 커서 — 배포 시점에 라이브엔 구 포맷(숫자 하나)이 들어 있다', () => {
  it('구 포맷을 받아준다 — 못 읽으면 그 회차 배분이 0 에서 시작한다', () => {
    expect(readCursors('7')).toEqual({ measure: 0, other: 7, tick: 0 })
    expect(readCursors(7)).toEqual({ measure: 0, other: 7, tick: 0 })
  })
  it('신 포맷 왕복 + 깨진 값은 0(fail-soft)', () => {
    const c = { measure: 2, other: 5, tick: 9 }
    expect(readCursors(JSON.stringify(c))).toEqual(c)
    expect(readCursors('쓰레기')).toEqual({ measure: 0, other: 0, tick: 0 })
    expect(readCursors(undefined)).toEqual({ measure: 0, other: 0, tick: 0 })
  })
})

describe('스냅샷 — 미룬 것과 죽은 것을 구분할 수 있게', () => {
  it('돌린 것/미룬 것/다음 커서를 남긴다', () => {
    const sel = selectLanesForTick(HEAVY_HOUR, 8, 3)
    const snap = dispatchSnapshot(sel, 'free', 8, 16, '2026-08-01T16:00:00.000Z')
    expect((snap.ran as string[]).length + (snap.deferred as string[]).length).toBe(HEAVY_HOUR.length)
    expect(snap.cursor_next).toEqual(sel.nextCursor)
    expect(snap.over_budget).toBe(false)
  })

  /** 🎭 배분이 의도대로 됐는지 **다음 세션이 추측 없이** 읽을 수 있어야 한다(이 레포의 반복 오진 클래스). */
  it('역할별 몫과 실제 실행을 남긴다 — 안 남기면 "왜 이 배분이 됐지"를 못 푼다', () => {
    const sel = selectLanesForTick(HEAVY_HOUR, 8, 3)
    const snap = dispatchSnapshot(sel, 'free', 8, 16, '2026-08-02T16:00:00.000Z')
    expect(snap.cap_measure as number).toBeGreaterThan(0)
    expect((snap.cap_measure as number) + (snap.cap_other as number)).toBe(sel.cap)
    expect(snap.ran_measure as string[]).toContain('enrich-influencer-driver')
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
    // 🔁 2026-08-02: 띄운 레인 **이름**도 함께 받는다(회차 요약이 이름으로 miss 를 센다).
    //   가드의 의도는 그대로 — "즉시 kick 하지 않고 **모아서 한 번에** 넘긴다".
    expect(src).toMatch(/const (?:kicked|\{ kicked, ranNames \}) = await dispatchPendingLanes\(\{/)
    const kickBody = src.slice(src.indexOf('const kick = ('), src.indexOf('const gates = makeHourGates'))
    expect(kickBody).toContain('pending.push(')
    expect(kickBody).not.toContain('SELF')
    expect(kickBody).not.toContain('ctx.waitUntil')
  })

  /**
   * 🔴 **모든 회차에 분모를 남긴다** (2026-08-02 라이브에서 막혀서 넣었다).
   *   예전엔 미룬 게 있을 때만 스냅샷을 썼다 → 미룬 게 없는 회차는 **띄운 레인 수가 어디에도 없다**.
   *   06:00Z 에 하트비트 4건 + 스냅샷 없음 이라 "4개를 띄웠나 / 8개 띄우고 절반이 기록도 못 남기고
   *   죽었나" 를 가릴 수 없었다 — 붕괴 판정의 분모가 사라진 것이다.
   *   ⚠️ 커서 쓰기는 반대로 **조건부여야** 한다(전부 돌았으면 회전 안 함). 둘을 한 조건에 묶으면 안 된다.
   */
  it('🔒 스냅샷은 매 회차, 커서는 미룬 게 있을 때만 쓴다', async () => {
    const raw = (await import('node:fs')).readFileSync('src/worker-ads/lane-runner.ts', 'utf8')
    // ⚠️ **주석을 걷어내고 본다.** 첫 판은 이 검사가 빨간불이었는데 원인이 코드가 아니라 *설명 주석*
    //   안의 `if (sel.deferred.length)` 였다 — 이 레포가 잠금표에서 겪은 "주석이 판정을 뒤집는" 클래스의
    //   반대 방향(주석 때문에 멀쩡한 코드가 위반으로 잡힘). 소스 검사 가드는 항상 주석을 지우고 볼 것.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
    const snapAt = src.indexOf("bind('ads_dispatch_last', snap)")
    const guardAt = src.indexOf('if (sel.deferred.length)')
    // ⚠️ **쓰기 형태로** 찾는다 — `bind(DISPATCH_CURSOR_KEY)` 만 보면 파일 위쪽의 **읽기**(커서 SELECT)에
    //   먼저 걸려 순서 판정이 뒤집힌다(첫 판이 실제로 그랬다).
    const cursorAt = src.indexOf('bind(DISPATCH_CURSOR_KEY, JSON.stringify')
    expect(snapAt, '스냅샷 쓰기를 못 찾았다 — 코드가 옮겨갔다(통과가 아니라 실패)').toBeGreaterThan(-1)
    expect(guardAt).toBeGreaterThan(-1)
    expect(cursorAt).toBeGreaterThan(-1)
    // 스냅샷은 가드 **앞**(무조건), 커서는 가드 **뒤**(조건부).
    expect(snapAt, '스냅샷이 deferred 가드 안으로 들어갔다 — 미룬 게 없는 회차의 분모가 다시 사라진다').toBeLessThan(guardAt)
    expect(cursorAt, '커서가 가드 밖으로 나갔다 — 전부 돈 회차에도 커서가 돌아 공평성이 깨진다').toBeGreaterThan(guardAt)
  })

  it('🔒 커서를 읽고 쓴다 — 안 그러면 매 회차 같은 레인만 돈다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/lane-runner.ts', 'utf8')
    // 🔁 2026-08-02: 읽기가 **커서 + 학습된 레인 수** 두 키를 한 왕복으로 가져온다(`lane-aimd.ts`).
    //   SQL 문자열만 겨누면 형태가 바뀔 때마다 검사가 낡으므로, **커서 키가 실제로 읽기에 묶이는지**를 본다
    //   — 그게 이 검사가 지키려는 사실이다(안 묶이면 매 회차 같은 레인만 돈다).
    expect(src).toMatch(/SELECT key, value FROM platform_settings WHERE key IN \(\?, \?\)/)
    expect(src, '커서 키가 읽기 바인딩에 없으면 커서는 영원히 초기값이다').toMatch(/\.bind\(DISPATCH_CURSOR_KEY, LANE_LEARN_KEY\)/)
    // 🔁 2026-08-02: 커서가 **도메인별**로 바뀌었다(`nextCursors`). 의도는 그대로 — 숫자 하나로는 못 남긴다.
    //   String() 으로 되돌아가면 tick·measure·도메인이 통째로 사라진다.
    expect(src).toMatch(/bind\(DISPATCH_CURSOR_KEY, JSON\.stringify\(sel\.nextCursors\)\)/)
    expect(src).toContain('readDomainCursors(')
  })

  /**
   * 🔒 **배선 안 하면 노브가 조용히 죽는다.** `ADS_MEASURE_SHARE` 를 대시보드에 넣어도
   * 호출부가 안 넘기면 언제나 기본값으로 돈다 — 에러도 경고도 없다(이 레포의 "실패가 아니라
   * 조용한 부재" 클래스). 그래서 넘기는지를 직접 겨눈다.
   */
  it('🔒 측정 비율을 실제로 넘긴다 — 안 넘기면 env 노브가 무음으로 죽는다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/lane-runner.ts', 'utf8')
    // 🔁 도메인 분리 후 진입점이 `selectLanesByDomain` 이다. **비율을 끝까지 넘기는지**가 이 검사의 요점이라
    //   인자 위치가 바뀌어도 그 사실만 겨눈다(이름만 갈아끼우고 검사를 약화시키지 않는다).
    expect(src).toMatch(/selectLanesByDomain\(pending, perTick, cursors, hourUTC, resolveMeasureShare\(env\)\)/)
    expect(src).toMatch(/ADS_MEASURE_SHARE\?: string/)   // env 타입에 없으면 대시보드 값이 안 들어온다
  })
})

/**
 * 🔻 **몫은 실측값이다** — 8 은 2026-08-01 값이었고 08-02 에 틀렸다(풀이 42k 로 커지며 레인이 무거워짐).
 *
 *   KST 16:00 실측: 디스패치 8 → 완주 2 · 사망 4(CPU 한도, ms 3,880~4,152 로 **값이 같다** =
 *   같은 순간에 끊겼다 = 개별 실패가 아니라 **부모가 죽은 것**) · 기록조차 없음 2.
 *   원인: 자식 CPU 가 호출자 몫이라 부모 CPU = 동시 레인 수 × 각자의 시간 ≈ 8×4초 = 32초 > 30초.
 *
 *   ⚠️ 이 테스트가 못 막는 것: **값의 타당성**(라이브 수율은 코드 밖 사실이다).
 *     여기서 고정하는 건 "동시 실행이 무료 cron CPU 한도 안에 드는 범위"라는 **의도**뿐이다.
 *     레인이 더 무거워지면 또 내려야 한다 — 재측정은 어드민 `cron-heartbeats` 의 ok=true 개수.
 */
describe('회차 몫 — 무료 CPU 한도 안에 드는 범위', () => {
  it('🔒 동시 레인 × 레인당 시간이 cron CPU 한도(30s)를 넘지 않는다', () => {
    const LANE_SECONDS = 4      // 실측: 사망 시점 ms 3,880~4,152
    const CRON_CPU_LIMIT = 30   // 무료 플랜
    expect(FREE_LANES_PER_TICK * LANE_SECONDS).toBeLessThan(CRON_CPU_LIMIT)
  })

  it('🔒 그래도 1 이상 — 0 이면 파이프라인이 통째로 멈춘다', () => {
    expect(FREE_LANES_PER_TICK).toBeGreaterThanOrEqual(1)
  })

  it('🔒 유료는 조를 1개로 만들 만큼 크다 — 전환에 코드 변경이 없어야 한다', () => {
    expect(PAID_LANES_PER_TICK).toBeGreaterThan(FREE_LANES_PER_TICK * 4)
  })
})
