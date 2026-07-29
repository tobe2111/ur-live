/**
 * ⏱️ ur-ads 레인 주기 신고 — 불변식 고정.
 *
 * 배경(실측): `adsBeat` 이 모든 레인에 워커 cron(`0 * * * *`, 매시간)을 붙여 기록해,
 * 일 1회/N시간/단계순환 레인이 **정상 동작 중에도** `stale` 로 찍혔다. 그 판정은
 * `/api/_healthcheck/cron` → uptime.yml → 이슈+메일로 나간다. 2026-07-29 라이브에서
 * `ads:maintenance?phase=quality` 가 age 167분·stale 이었다(5단계 순환이라 정상인데도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  staleGapMinutes, dailyGapMinutes, everyNHoursGapMinutes,
  maxPhaseGapHours, phaseGapMinutes, makeHourGates,
} from '../../worker-ads/lane-cadence'
import { expectedMaxAgeMinutes } from '../../worker/utils/cron-heartbeat'

describe('staleGapMinutes — cron-heartbeat 와 같은 공식', () => {
  it('기대주기 × 2 + 30', () => {
    expect(staleGapMinutes(60)).toBe(150)
    expect(staleGapMinutes(24 * 60)).toBe(2910)
  })

  it('매시간 주기는 expectedMaxAgeMinutes("0 * * * *") 와 동치 — 공식이 갈라지면 실패한다', () => {
    expect(staleGapMinutes(60)).toBe(expectedMaxAgeMinutes('0 * * * *'))
  })

  it('일 1회는 expectedMaxAgeMinutes("0 16 * * *") 와 동치', () => {
    expect(dailyGapMinutes()).toBe(expectedMaxAgeMinutes('0 16 * * *'))
  })

  it('0/음수는 최소 1분으로 클램프 — 0 을 넘겨도 즉시-stale 이 되지 않는다', () => {
    expect(staleGapMinutes(0)).toBe(32)
    expect(everyNHoursGapMinutes(0)).toBe(150)
  })
})

describe('maxPhaseGapHours — 자정 불연속까지 센다', () => {
  it('5단계: 단계 4 는 19시 다음이 다음날 4시 → 9시간(5가 아니다)', () => {
    expect(maxPhaseGapHours(5)).toBe(9)
  })

  it('24 의 약수면 정확히 그 값 — 단계를 6개로 늘리면 자동으로 6이 된다', () => {
    expect(maxPhaseGapHours(4)).toBe(4)
    expect(maxPhaseGapHours(6)).toBe(6)
    expect(maxPhaseGapHours(8)).toBe(8)
    expect(maxPhaseGapHours(1)).toBe(1)
  })

  it('약수가 아니면 항상 실제 최대 간격 ≥ 단계 수', () => {
    for (const p of [5, 7, 9, 10, 11]) expect(maxPhaseGapHours(p)).toBeGreaterThanOrEqual(p)
  })

  it('현행 5단계 순환의 stale 기준은 매시간 기준(150분)보다 확실히 크다 — 이게 오탐의 원인이었다', () => {
    expect(phaseGapMinutes(5)).toBeGreaterThan(staleGapMinutes(60))
    expect(phaseGapMinutes(5)).toBe(9 * 60 * 2 + 30)
  })
})

describe('makeHourGates — 발화 조건과 주기 신고가 같은 자리에서 나온다', () => {
  const spy = () => {
    const calls: Array<{ path: string; gap?: number }> = []
    const kick = (path: string, _fn: () => Promise<unknown>, gap?: number) => { calls.push({ path, gap }) }
    return { calls, kick }
  }
  const noop = async () => undefined

  it('dailyAt: 지정 시각에만 발화하고, 그때 일 1회 주기를 신고한다', () => {
    const s = spy()
    makeHourGates(16, s.kick).dailyAt(16, '/__ads/collect-nps', noop)
    makeHourGates(15, s.kick).dailyAt(16, '/__ads/collect-nps', noop)
    expect(s.calls).toEqual([{ path: '/__ads/collect-nps', gap: dailyGapMinutes() }])
  })

  it('everyNHours: 조건이 맞는 시각에만, N시간 주기를 신고한다', () => {
    const s = spy()
    for (const h of [0, 1, 2, 3]) makeHourGates(h, s.kick).everyNHours(2, 0, '/__ads/collect-storeinfo', noop)
    expect(s.calls).toHaveLength(2)                       // 0시·2시
    expect(s.calls.every(c => c.gap === everyNHoursGapMinutes(2))).toBe(true)
  })

  it('하루 24시간을 돌려도 일 1회 레인은 정확히 한 번', () => {
    const s = spy()
    for (let h = 0; h < 24; h++) makeHourGates(h, s.kick).dailyAt(20, '/__ads/collect-localdata', noop)
    expect(s.calls).toHaveLength(1)
  })
})

/**
 * 🛡️ 회귀 차단 — 시각 게이트가 `kick` 을 **직접** 호출하면 주기 신고가 빠진다.
 *
 * 이게 정확히 원래 버그의 모양이었다: 조건은 `hourUTC === 16` 인데 하트비트는 매시간으로 기록.
 * 조건과 주기를 따로 적을 수 있는 한 언젠가 또 어긋나고, 어긋나도 **조용하다**(경보만 늘 뿐).
 * ⚠️ 이 테스트가 못 막는 것: `gates.*` 를 쓰되 잘못된 시각/N 을 넣는 경우(값의 정합은 못 본다).
 */
describe('worker-ads/index.ts — 시각 게이트는 반드시 gates 헬퍼를 쓴다', () => {
  const src = readFileSync(join(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')

  it('hourUTC 조건 블록 안에서 raw kick( 을 호출하지 않는다', () => {
    // `if (... hourUTC ...) {` 바로 뒤 몇 줄 안에 kick( 이 오면 위반.
    const offenders = [...src.matchAll(/if \([^\n]*hourUTC[^\n]*\) \{\n(?:[^\n]*\n){0,4}?[^\n]*\bkick\(/g)]
      .map(m => m[0].split('\n')[0].trim())
    expect(offenders).toEqual([])
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과(측정 대상 없음)를 성공으로 오인하지 않게', () => {
    expect(src).toContain('makeHourGates')
    expect((src.match(/gates\.(dailyAt|everyNHours)\(/g) || []).length).toBeGreaterThanOrEqual(10)
  })

  it('단계 순환 레인은 단계 수에서 유도한 주기를 신고한다(리터럴 하드코딩 금지)', () => {
    expect(src).toMatch(/phaseGapMinutes\(PHASES\.length\)/)
  })
})
