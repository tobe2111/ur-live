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
  resolvePlan, lanesPerTick, isDeferrable, selectLanesForHour, dispatchSnapshot,
  FREE_LANES_PER_TICK, PAID_LANES_PER_TICK, assignKey, type LaneCandidate,
} from '@/worker-ads/dispatch-budget'

/** 2026-08-01 14:00 UTC 회차에 실제로 뜬 레인들(하트비트 실측) — 문구를 바꾸지 말 것. */
const LIVE_LANES: LaneCandidate[] = [
  'collect', 'scheduled', 'consented-reminder', 'inbound-onboarding', 'social-maintenance',
  'maintenance?phase=reclassify', 'collect-maker', 'collect-store-kakao',
  'enrich-company', 'enrich-prospects', 'collect-neis', 'enrich-influencer-driver',
  'match-registry', 'reclassify-company?passes=5', 'collect-storeinfo',
].map(beat => ({ beat }))

describe('요금제 해석 — 모르는 값은 free(안전한 쪽)', () => {
  it('paid 만 paid 다', () => {
    expect(resolvePlan({ ADS_PLAN: 'paid' })).toBe('paid')
    expect(resolvePlan({ ADS_PLAN: ' PAID ' })).toBe('paid')
    expect(resolvePlan({ ADS_PLAN: 'free' })).toBe('free')
    expect(resolvePlan({ ADS_PLAN: 'pro' })).toBe('free')   // 오타/추측 값
    expect(resolvePlan({})).toBe('free')
    expect(resolvePlan(undefined)).toBe('free')
  })
})

describe('💰 유료 전환 = 코드 변경 0 (대표 지시 2026-08-01)', () => {
  it('ADS_PLAN=paid 면 조가 1개 — 전 레인 매시간(오늘 이전 동작으로 복귀)', () => {
    const perTick = lanesPerTick({ ADS_PLAN: 'paid' })
    expect(perTick).toBe(PAID_LANES_PER_TICK)
    for (let h = 0; h < 24; h++) {
      const sel = selectLanesForHour(LIVE_LANES, perTick, h)
      expect(sel.groups).toBe(1)
      expect(sel.deferred).toHaveLength(0)
      expect(sel.run).toHaveLength(LIVE_LANES.length)
    }
  })

  it('free 는 나뉜다 — 15개가 8 예산이면 조 2개', () => {
    const sel = selectLanesForHour(LIVE_LANES, lanesPerTick({}), 0)
    expect(lanesPerTick({})).toBe(FREE_LANES_PER_TICK)
    expect(sel.groups).toBe(2)
    expect(sel.deferred.length).toBeGreaterThan(0)
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

describe('🔒 굶는 레인이 없다 — 전수 증명', () => {
  it('모든 레인이 groups 시간 안에 반드시 한 번 돈다', () => {
    for (const perTick of [1, 2, 3, 5, 8, 14, 15, 64]) {
      const seen = new Map<string, number>()
      const groups = selectLanesForHour(LIVE_LANES, perTick, 0).groups
      for (let h = 0; h < groups; h++) {
        for (const l of selectLanesForHour(LIVE_LANES, perTick, h).run) {
          seen.set(l.beat, (seen.get(l.beat) || 0) + 1)
        }
      }
      // 커버리지: 한 명도 빠지지 않는다
      expect(seen.size, `perTick=${perTick} 에서 누락 발생`).toBe(LIVE_LANES.length)
      // 중복: 한 바퀴에 정확히 한 번씩(= 낭비도 편중도 없다)
      for (const [beat, n] of seen) expect(n, `${beat} 가 한 바퀴에 ${n}번`).toBe(1)
    }
  })

  it('하루(24시간)를 돌려도 누락 0 — 자정 불연속에서 끊기지 않는다', () => {
    const perTick = FREE_LANES_PER_TICK
    const seen = new Set<string>()
    for (let h = 0; h < 24; h++) for (const l of selectLanesForHour(LIVE_LANES, perTick, h).run) seen.add(l.beat)
    expect(seen.size).toBe(LIVE_LANES.length)
  })

  it('한 회차가 예산을 넘지 않는다', () => {
    const perTick = FREE_LANES_PER_TICK
    for (let h = 0; h < 24; h++) {
      expect(selectLanesForHour(LIVE_LANES, perTick, h).run.length).toBeLessThanOrEqual(perTick)
    }
  })
})

describe('🔒 일 1회·N시간 레인은 절대 안 밀린다 (영원한 부재 방지)', () => {
  it('gap > 60 은 미룰 수 없다', () => {
    expect(isDeferrable({ beat: 'x', gapMin: 24 * 60 })).toBe(false)  // 일 1회
    expect(isDeferrable({ beat: 'x', gapMin: 180 })).toBe(false)      // 3시간마다
    expect(isDeferrable({ beat: 'x', gapMin: 60 })).toBe(true)        // 매시간
    expect(isDeferrable({ beat: 'x' })).toBe(true)                    // 미지정 = 매시간
  })

  it('일 1회 레인은 예산이 아무리 작아도 그 회차에 반드시 뜬다', () => {
    const lanes: LaneCandidate[] = [...LIVE_LANES, { beat: 'sweep-nts', gapMin: 24 * 60 }]
    for (let h = 0; h < 24; h++) {
      const sel = selectLanesForHour(lanes, 1, h)   // 예산 1 — 최악
      expect(sel.run.map(l => l.beat)).toContain('sweep-nts')
      expect(sel.deferred.map(l => l.beat)).not.toContain('sweep-nts')
    }
  })
})

describe('🔒 배정이 배열 순서에 의존하지 않는다', () => {
  /**
   * 왜 이게 중요한가: 일 1회 레인은 **그 시간에만** 목록에 나타난다. 배열 인덱스로 조를 정하면
   * 그 시간엔 뒤쪽 인덱스가 전부 한 칸씩 밀려 **다른 조로 튄다** → 어떤 레인은 두 시간 연속 돌고
   * 어떤 레인은 통째로 건너뛴다. 그래서 이름 정렬 기준으로 배정한다.
   */
  it('일 1회 레인이 끼어들어도 매시간 레인의 조 배정은 그대로다', () => {
    const withDaily: LaneCandidate[] = [{ beat: 'aa-daily', gapMin: 1440 }, ...LIVE_LANES]
    for (let h = 0; h < 24; h++) {
      const base = selectLanesForHour(LIVE_LANES, 8, h).run.map(l => l.beat).sort()
      const shifted = selectLanesForHour(withDaily, 8, h).run.map(l => l.beat).filter(b => b !== 'aa-daily').sort()
      expect(shifted).toEqual(base)
    }
  })

  /**
   * 🔒 조 배정 키는 **쿼리를 뗀 이름**이다(`assignKey`).
   *
   * ⚠️ **정직하게 적어 둔다: 현재 라이브 이름들로는 이 차이가 드러나지 않는다.**
   *    `maintenance?phase=X` 의 이웃(`inbound-onboarding` · `match-registry`)이 `?` 보다 앞에서
   *    이미 갈리므로, phase 값이 뭐든 정렬 위치가 안 변한다. 즉 **오늘의 라이브에는 무해한 선제 가드**다.
   *    (처음엔 "phase 이름을 바꿔 보면 잡힌다"고 썼는데, 주입해 보니 안 잡혔다 —
   *     실패할 수 없는 가드였다. 그래서 아래처럼 **실제로 순서가 갈리는 이름**으로 겨눈다.)
   *
   * ⚠️ 이 가드가 **막는 것**: 쿼리를 단 레인이 형제 이름과 `-` / `?` 로 갈리는 자리에 생기는 순간
   *    (`'-'`=45 < `'?'`=63) 조 배정이 통째로 재배열되는 것. 라이브엔 이미 `collect` · `collect-maker`
   *    · `collect-localdata?mode=backfill` 처럼 그 모양에 **한 글자 차이로 근접한** 이름들이 있다.
   */
  it('assignKey 는 쿼리를 뗀다', () => {
    expect(assignKey('maintenance?phase=merge')).toBe('maintenance')
    expect(assignKey('reclassify-company?passes=5')).toBe('reclassify-company')
    expect(assignKey('collect')).toBe('collect')
  })

  it('쿼리 달린 형제가 있어도 조 배정이 이름 기준으로 정해진다', () => {
    // 원시 정렬: maint < maint-extra < maint?p=a   ('-'=45 < '?'=63)
    // 키 정렬  : maint ≡ maint?p=a < maint-extra
    // ⇒ 두 방식의 0조 구성이 **다르다**. 쿼리를 안 떼면 이 기대가 깨진다.
    const lanes: LaneCandidate[] = [{ beat: 'maint' }, { beat: 'maint-extra' }, { beat: 'maint?p=a' }]
    expect(selectLanesForHour(lanes, 2, 0).run.map(l => l.beat).sort()).toEqual(['maint', 'maint-extra'])
    expect(selectLanesForHour(lanes, 2, 1).run.map(l => l.beat)).toEqual(['maint?p=a'])
  })

  it('입력 배열 순서를 바꿔도 결과가 같다(회전 — reverse 는 홀짝을 보존해 무의미)', () => {
    const rotated = [...LIVE_LANES.slice(1), LIVE_LANES[0]]
    for (let h = 0; h < 24; h++) {
      expect(selectLanesForHour(rotated, 8, h).run.map(l => l.beat).sort())
        .toEqual(selectLanesForHour(LIVE_LANES, 8, h).run.map(l => l.beat).sort())
    }
  })

  it('입력 배열을 변형하지 않는다(정렬이 호출부로 새지 않게)', () => {
    const input = [...LIVE_LANES]
    const before = input.map(l => l.beat)
    selectLanesForHour(input, 8, 3)
    expect(input.map(l => l.beat)).toEqual(before)
  })
})

describe('스냅샷 — 미룬 것과 죽은 것을 구분할 수 있게', () => {
  it('돌린 것/미룬 것을 이름으로 남긴다', () => {
    const sel = selectLanesForHour(LIVE_LANES, 8, 1)
    const snap = dispatchSnapshot(sel, 'free', 8, 1, '2026-08-01T15:00:00.000Z') as Record<string, unknown>
    expect(snap.plan).toBe('free')
    expect(snap.groups).toBe(2)
    expect(snap.hour).toBe(1)
    expect((snap.ran as string[]).length + (snap.deferred as string[]).length).toBe(LIVE_LANES.length)
  })
})

describe('🚧 배선 — 스케줄러가 실제로 예산 분산을 쓰는가', () => {
  /**
   * 순수 로직만 맞고 배선이 빠지면 **아무 일도 안 일어난다** — 예전처럼 15개를 그대로 매달고
   * 7개가 매시간 잘린다. 조용해서 더 위험하다.
   */
  it('index.ts 가 즉시 kick 하지 않고 모아서 dispatchPendingLanes 로 넘긴다', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker-ads/index.ts', 'utf8')
    expect(src).toMatch(/const kicked = dispatchPendingLanes\(\{/)
    // kick 은 '모으기'만 해야 한다 — 그 자리에서 SELF.fetch 를 하면 분산이 무력화된다.
    const kickBody = src.slice(src.indexOf('const kick = ('), src.indexOf('const gates = makeHourGates'))
    expect(kickBody).toContain('pending.push(')
    expect(kickBody).not.toContain('SELF')
    expect(kickBody).not.toContain('ctx.waitUntil')
  })
})
