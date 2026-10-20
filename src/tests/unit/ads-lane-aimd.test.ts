/**
 * 🎚️ **회차당 레인 수 학습기** — 손으로 잰 상수를 대체한 제어 루프의 불변식.
 *
 * ## 왜 이 테스트가 절대값을 못박나
 * 같은 날 **비교로 쓴 검사가 헛돈** 적이 있다: 두 픽스처를 *같은 코드* 아래서 비교하면
 * 전역 결함이 양쪽에 똑같이 실려 상쇄된다(정렬을 통째로 지워도 초록이었다).
 * ⇒ 여기서는 *"6 이 해로운 회차를 만나면 **4**"* 처럼 **결과 자체**를 고정한다.
 *
 * ⚠️ 이 테스트가 못 보는 것: 라이브에서 `fail`/`miss` 가 실제로 CPU 사망을 가리키는가.
 *   그건 어드민 `cron-heartbeats` 의 `err=…Worker exceeded CPU time limit` 로만 확인된다.
 */
import { describe, it, expect } from 'vitest'
import {
  BACKOFF_FACTOR, FREE_LANES_CEILING, HARM_MIN_LANES, LANE_LEARN_KEY, MIN_LANES_PER_TICK, PAID_LANES_CEILING,
  PROBE_AFTER_PINNED, RECOVER_CLEAN_TICKS, laneCeiling, learnLanes, missedTicks, readLaneLearn, tickHarmed,
  type LaneLearnState,
} from '../../worker-ads/lane-aimd'
import { FREE_LANES_PER_TICK, PAID_LANES_PER_TICK, lanesPerTick } from '../../worker-ads/dispatch-budget'
import type { TickSummary } from '../../worker-ads/tick-history'

const tick = (p: Partial<TickSummary>): TickSummary => ({
  at: '2026-08-02T13:00:00.000Z', h: 13, ran: 6, n: 6, ok: 6, fail: 0, miss: 0, off: 0,
  okMax: 4000, failMin: null, bad: [], ...p,
})
const CLEAN = tick({})
const DIED = tick({ ok: 2, fail: 4, bad: ['collect-company'], failMin: 3880 })
const SILENT = tick({ ran: 6, n: 4, ok: 4, miss: 2 })

describe('무엇이 해인가', () => {
  it('죽은 레인도 기록 없는 레인도 해다', () => {
    expect(tickHarmed(DIED)).toBe(true)
    expect(tickHarmed(SILENT)).toBe(true)
    expect(tickHarmed(CLEAN)).toBe(false)
  })

  /**
   * 🔴 라이브에 지금 실재하는 오탐: `enrich-influencer-fanout` 은 CPU 와 무관하게 **스스로**
   *   `ok=false ms=0` 을 남긴다. 문턱이 1 이면 이 자기신고 하나가 매 회차 함대를 깎는다.
   *   반대로 CPU 고갈은 떼로 죽인다(실측 5·2·4, ms 동일).
   */
  it('자기신고 1건은 해가 아니다 — 함대가 과하다는 신호가 아니다', () => {
    expect(HARM_MIN_LANES).toBe(2)
    expect(tickHarmed(tick({ ok: 5, fail: 1, bad: ['enrich-influencer-fanout'], failMin: 0 }))).toBe(false)
    expect(tickHarmed(tick({ ok: 5, miss: 1 }))).toBe(false)
    // 서로 다른 두 종류가 하나씩이어도 합쳐서 2 면 해다(같은 붕괴의 두 얼굴이다).
    expect(tickHarmed(tick({ ok: 4, fail: 1, miss: 1 }))).toBe(true)
  })

  it('자기신고 1건인 회차는 되찾기를 막지도 않는다', () => {
    const selfReport = tick({ ok: 5, fail: 1, bad: ['enrich-influencer-fanout'], failMin: 0 })
    expect(learnLanes({ cap: 6, clean: 1, pinned: 0 }, selfReport, FREE_LANES_CEILING, 6).cap).toBe(7)
  })

  /**
   * 🔴 오분류의 대가가 가장 큰 항목. `off` 는 **예산 밖 레인이 자기 하트비트를 남긴 것**
   *   (DO 알람·우회 레인의 정상 동작)이다. 라이브에서 실제로 `띄운 7 · 기록 9` 가 나왔다.
   *   이걸 해로 세면 학습기가 매 회차 물러나 **영원히 바닥에 눌린다**.
   */
  it('예산 밖 기록(off)은 해가 아니다 — 세면 영원히 바닥에 눌린다', () => {
    expect(tickHarmed(tick({ off: 3 }))).toBe(false)
    expect(learnLanes({ cap: 6, clean: 1, pinned: 0 }, tick({ off: 3 }), FREE_LANES_CEILING, 6).cap).toBe(7)
  })
})

describe('물러나기 — 곱셈', () => {
  it('해로운 회차 하나면 즉시 줄인다 (6 → 4)', () => {
    expect(learnLanes({ cap: 6, clean: 0, pinned: 0 }, DIED, FREE_LANES_CEILING, 6))
      .toEqual({ cap: 4, clean: 0, pinned: 0 })
  })

  /**
   * ⚠️ **반올림이 학습을 멈출 수 있다**: `×0.75` 만 쓰면 base=3 에서 `round(2.25)=2` 는 괜찮지만
   *   `Math.round` 를 쓰는 순간 base=2 → 2 로 **제자리**가 되어 물러남이 사라진다.
   *   그래서 "최소 1 은 반드시 줄인다"를 코드가 보장한다. 그 보장을 여기서 고정한다.
   */
  it('작은 값에서도 반드시 1 이상 줄어든다 (제자리 금지)', () => {
    for (const base of [3, 4, 5, 6, 8, 12]) {
      const next = learnLanes({ cap: base, clean: 0, pinned: 0 }, DIED, FREE_LANES_CEILING, 6).cap
      expect(next, `${base} 에서 줄지 않았다`).toBeLessThan(base)
      expect(next).toBeGreaterThanOrEqual(MIN_LANES_PER_TICK)
    }
    expect(BACKOFF_FACTOR).toBeLessThan(1)
  })

  it('바닥 아래로는 안 간다 — 1 이면 도메인 3개가 회차마다 굶는다', () => {
    expect(learnLanes({ cap: 2, clean: 0, pinned: 0 }, DIED, FREE_LANES_CEILING, 6).cap).toBe(MIN_LANES_PER_TICK)
  })
})

describe('되찾기 — 덧셈', () => {
  it('한 번 깨끗해도 아직 안 올린다 (톱니를 줄인다)', () => {
    expect(RECOVER_CLEAN_TICKS).toBe(2)
    expect(learnLanes({ cap: 4, clean: 0, pinned: 0 }, CLEAN, FREE_LANES_CEILING, 6))
      .toEqual({ cap: 4, clean: 1, pinned: 0 })
  })

  it('연속 2회 깨끗하면 한 칸 올린다 (4 → 5)', () => {
    expect(learnLanes({ cap: 4, clean: 1, pinned: 0 }, CLEAN, FREE_LANES_CEILING, 6))
      .toEqual({ cap: 5, clean: 0, pinned: 0 })
  })

  it('천장을 넘지 않는다', () => {
    expect(learnLanes({ cap: FREE_LANES_CEILING, clean: 1, pinned: 0 }, CLEAN, FREE_LANES_CEILING, 6).cap)
      .toBe(FREE_LANES_CEILING)
  })
})

/**
 * 🕳️ **학습기가 원래 못 보던 최악의 경우.** 부모가 flush 전에 죽으면 그 회차는 요약이 없어
 *   학습기 입력에서 통째로 빠진다 — 가장 심하게 무너진 회차일수록 안 보인다.
 *   실측(08-03 00:45 KST): `ads_dispatch_last` 는 15:00:35Z 디스패치를 기록했는데
 *   그 회차의 요약도 `ads:scheduled` 하트비트도 둘 다 없었다(관측된 회차 5중 2꼴).
 */
describe('빈 회차 = 가장 강한 해 신호', () => {
  it('한 시간 간격은 정상 — 빠진 회차 0', () => {
    expect(missedTicks('2026-08-03T01:00:00.000Z', '2026-08-03T02:00:00.000Z')).toBe(0)
    expect(missedTicks('2026-08-03T01:00:00.000Z', '2026-08-03T02:20:00.000Z')).toBe(0) // 지연 여유
  })

  it('두 시간 넘게 비면 그 사이 회차가 죽은 것이다', () => {
    expect(missedTicks('2026-08-02T23:00:00.000Z', '2026-08-03T01:00:00.000Z')).toBe(1)
    expect(missedTicks('2026-08-02T19:00:00.000Z', '2026-08-03T01:00:00.000Z')).toBe(5)
  })

  it('첫 회차·깨진 값은 해가 아니다 — 이력이 없다고 물러나면 안 된다', () => {
    expect(missedTicks(undefined, '2026-08-03T01:00:00.000Z')).toBe(0)
    expect(missedTicks('', '2026-08-03T01:00:00.000Z')).toBe(0)
    expect(missedTicks('그런거없음', '2026-08-03T01:00:00.000Z')).toBe(0)
    expect(missedTicks('2026-08-03T02:00:00.000Z', '2026-08-03T01:00:00.000Z')).toBe(0) // 역순
  })

  /** 🔴 이 회차가 **깨끗해도** 빈자리가 있으면 물러난다 — 편향을 메우는 지점이 정확히 여기다. */
  it('회차 자체가 깨끗해도 빈자리가 있으면 물러난다 (6 → 4)', () => {
    expect(learnLanes({ cap: 6, clean: 1, pinned: 0 }, CLEAN, FREE_LANES_CEILING, 6, 2))
      .toEqual({ cap: 4, clean: 0, pinned: 0 })
  })

  it('빈자리가 없으면 종전대로 되찾는다 (기본값이 해를 만들지 않는다)', () => {
    expect(learnLanes({ cap: 6, clean: 1, pinned: 0 }, CLEAN, FREE_LANES_CEILING, 6, 0).cap).toBe(7)
    expect(learnLanes({ cap: 6, clean: 1, pinned: 0 }, CLEAN, FREE_LANES_CEILING, 6).cap).toBe(7)
  })
})

/**
 * 🕳️ 하트비트를 **아예 안 남기는 레인**이 하나 있으면 `miss` 가 영구히 1 이다. 그러면 학습기는
 *   매 회차 물러나 바닥에 눌리고, 처리량을 스스로 반으로 깎아 놓고 아무도 모른다
 *   (이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 의 새 변종).
 */
describe('바닥 고착 탈출', () => {
  it('바닥에서 계속 해로우면 원인이 부하가 아니다 — 한 칸 올려 본다', () => {
    let st: LaneLearnState = { cap: 2, clean: 0, pinned: 0 }
    for (let i = 1; i < PROBE_AFTER_PINNED; i++) {
      st = learnLanes(st, SILENT, FREE_LANES_CEILING, 6)
      expect(st.cap, `${i}회차에 벌써 탐색하면 안 된다`).toBe(MIN_LANES_PER_TICK)
      expect(st.pinned).toBe(i)
    }
    st = learnLanes(st, SILENT, FREE_LANES_CEILING, 6)
    expect(st).toEqual({ cap: MIN_LANES_PER_TICK + 1, clean: 0, pinned: 0 })
  })
})

/**
 * 💰 **이 절이 대표 요구사항의 핵심이다** — *"유료로 전환하더라도 자동으로 이상적으로 쓰게"*.
 *
 * 이 축의 한도는 요금제가 아니라 **인보케이션당 CPU** 이고, 유료 기본값도 30초다. 서비스 바인딩
 * 피호출자의 CPU 는 호출자 몫이므로, 요금제를 바꿨다고 시작값을 64 로 올리면 **첫 정각에 무너진다**.
 * ⇒ 요금제는 **천장만** 바꾸고, 값은 배운 자리에서 이어 올라간다.
 */
describe('요금제 — 천장만 바꾸고 시작값은 안 바꾼다', () => {
  it('천장이 요금제로 갈린다', () => {
    expect(laneCeiling('free')).toBe(FREE_LANES_CEILING)
    expect(laneCeiling('paid')).toBe(PAID_LANES_CEILING)
    expect(PAID_LANES_CEILING).toBe(PAID_LANES_PER_TICK)
  })

  it('🔴 유료로 바꿔도 배운 자리(6)에서 이어간다 — 64 로 점프하지 않는다', () => {
    const st = learnLanes({ cap: 6, clean: 1, pinned: 0 }, CLEAN, laneCeiling('paid'), PAID_LANES_PER_TICK)
    expect(st.cap).toBe(7)
    expect(st.cap).toBeLessThan(PAID_LANES_PER_TICK)
  })

  it('유료에서는 free 천장 위로도 올라갈 수 있다 (12 는 무료의 한계일 뿐)', () => {
    expect(learnLanes({ cap: FREE_LANES_CEILING, clean: 1, pinned: 0 }, CLEAN, laneCeiling('paid'), 6).cap)
      .toBe(FREE_LANES_CEILING + 1)
  })
})

describe('배선 — 학습값이 실제로 회차 수를 정한다', () => {
  it('우선순위: 명시 env > 학습값 > 요금제 기본값', () => {
    expect(lanesPerTick({ ADS_LANES_PER_TICK: '9' }, 4)).toBe(9)   // 킬 스위치가 학습을 이긴다
    expect(lanesPerTick({}, 4)).toBe(4)
    expect(lanesPerTick({})).toBe(FREE_LANES_PER_TICK)
    expect(lanesPerTick({ ADS_PLAN: 'paid' })).toBe(PAID_LANES_PER_TICK)
  })

  it('깨진 학습값은 무시하고 기본값 — 오타 하나로 파이프라인이 멈추면 안 된다', () => {
    expect(lanesPerTick({}, 0)).toBe(FREE_LANES_PER_TICK)
    expect(lanesPerTick({}, Number.NaN)).toBe(FREE_LANES_PER_TICK)
    expect(lanesPerTick({}, null)).toBe(FREE_LANES_PER_TICK)
  })

  it('저장값을 되읽는다 (구 포맷 숫자 하나도 받아준다)', () => {
    expect(readLaneLearn(JSON.stringify({ cap: 5, clean: 1, pinned: 0 }))).toEqual({ cap: 5, clean: 1, pinned: 0 })
    expect(readLaneLearn('6')).toEqual({ cap: 6, clean: 0, pinned: 0 })
    expect(readLaneLearn('그런거없음')).toBeNull()
    expect(readLaneLearn(undefined)).toBeNull()
    expect(readLaneLearn('')).toBeNull()
    expect(LANE_LEARN_KEY).toBe('ads_lanes_learned')
  })
})
