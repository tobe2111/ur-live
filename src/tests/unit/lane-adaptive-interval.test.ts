import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  adaptiveIntervalHours, cleanStreak, recentNovelty,
  TIGHTEN_CLEAN_RUNS, TIGHTEN_MIN_NOVELTY, MIN_INTERVAL_HOURS,
} from '@/worker-ads/lane-adaptive-interval'
import type { LaneRunEntry } from '@/worker-ads/lane-run-history'
import { ALARM_LANES } from '@/worker-ads/lane-alarm-runners'

/**
 * 🔁 **주기 자가조율** — B2B 수집을 자동으로 유지·확대하는 손잡이.
 *
 * ## 왜 이 형태인가 (라이브 실측 2026-08-18)
 * 업체 수집 −70%(13,409 → 4,223)인데 **회차당 수확은 ~990 으로 안정**이고 **신규율 98%**.
 * 즉 소스가 마른 게 아니라 회차가 안 돈 것이다. 그런데 회차당 건수는 CPU 사망을 겪고 내려잡은
 * 값이라 못 올린다 ⇒ 남은 손잡이는 주기뿐. 그런데 공공 API 일일 한도를 **모른다**.
 * 그래서 고정 상향이 아니라 제어 루프다 — 한도에 부딪히면 오류로 나타나 스스로 물러난다.
 *
 * ## 못 막는 것
 * - 실제로 수집량이 느는지 — 라이브 추이로만 안다.
 * - 공공 API 가 한도 초과를 **오류 없이 빈 응답**으로 주는 경우: 그건 `ok` 라 조임이 유지된다.
 *   그때는 신규율 게이트가 대신 잡는다(빈 응답 → found 0 → 신규율 근거 없음 → 조이지 않음).
 */
const ok = (n = 900, f = 1000): LaneRunEntry => ({ t: '2026-08-18T00:00', ok: true, n, f })
const bad = (): LaneRunEntry => ({ t: '2026-08-18T00:00', ok: false, n: 0, f: 0, e: '네트워크 오류' })
const many = (k: number, e = ok()) => Array.from({ length: k }, () => e)

describe('cleanStreak', () => {
  it('최신부터 세고 첫 사고에서 멈춘다', () => {
    expect(cleanStreak([ok(), ok(), bad(), ok(), ok()])).toBe(2)
  })
  it('🔒 저장 0 은 사고가 아니다 — 소진된 소스는 정상적으로 0을 낸다', () => {
    expect(cleanStreak(many(3, ok(0, 50)))).toBe(3)
  })
})

describe('recentNovelty', () => {
  it('최근 회차 합으로 신규율을 낸다', () => {
    expect(recentNovelty([ok(982, 1000), ok(990, 1000)])).toBeCloseTo(0.986, 3)
  })
  it('🔒 근거가 없으면 null — 모르면 조이지 않는다', () => {
    expect(recentNovelty([{ t: 'x', ok: true, n: 5 }])).toBeNull()
    expect(recentNovelty([])).toBeNull()
  })
})

describe('adaptiveIntervalHours — 조이기는 어렵게, 풀기는 쉽게', () => {
  it('🩸 라이브 형상 — 깨끗하고 신규율 98%면 2h → 1h (하루 12회 → 24회)', () => {
    expect(adaptiveIntervalHours(2, many(TIGHTEN_CLEAN_RUNS, ok(982, 1000)))).toBe(1)
  })

  it('증거가 부족하면 조이지 않는다', () => {
    expect(adaptiveIntervalHours(2, many(TIGHTEN_CLEAN_RUNS - 1, ok()))).toBe(2)
  })

  it('🔒 사고 한 번이면 즉시 기본으로 — 비대칭은 의도다', () => {
    const h = [bad(), ...many(TIGHTEN_CLEAN_RUNS + 20, ok())]
    expect(adaptiveIntervalHours(2, h)).toBe(2)
  })

  it('🔒 신규율이 낮으면(소스가 마르는 중) 조이지 않는다 — 중복만 는다', () => {
    const dry = { t: 'x', ok: true, n: 1, f: 50 } as LaneRunEntry // storeinfo 실측 형상(found 50 · saved 0~1)
    expect(recentNovelty(many(TIGHTEN_CLEAN_RUNS, dry))!).toBeLessThan(TIGHTEN_MIN_NOVELTY)
    expect(adaptiveIntervalHours(2, many(TIGHTEN_CLEAN_RUNS, dry))).toBe(2)
  })

  it('🔒 하한 아래로는 절대 안 간다', () => {
    expect(adaptiveIntervalHours(MIN_INTERVAL_HOURS, many(50, ok()))).toBe(MIN_INTERVAL_HOURS)
    expect(adaptiveIntervalHours(2, many(50, ok()))).toBeGreaterThanOrEqual(MIN_INTERVAL_HOURS)
  })

  it('🔒 간격 게이트가 없는 레인(0)은 건드리지 않는다 — 손잡이 자체가 다른 레인이다', () => {
    expect(adaptiveIntervalHours(0, many(50, ok()))).toBe(0)
  })

  it('🔒 홀수 간격도 두 배를 안 넘는다 — 3h 는 1h 가 아니라 2h 로만 조인다', () => {
    // ⚠️ 지금 모든 레인이 base 2 라 floor/ceil 이 같은 값을 준다. 그래서 **라이브 레인만 훑는
    //   아래 테스트로는 이 결함이 안 보인다**(실제로 주입해 보니 초록이었다). 가상 base 로 직접 고정한다.
    expect(adaptiveIntervalHours(3, many(TIGHTEN_CLEAN_RUNS, ok(982, 1000)))).toBe(2)
    expect(adaptiveIntervalHours(5, many(TIGHTEN_CLEAN_RUNS, ok(982, 1000)))).toBe(3)
  })

  it('🔒 외부 호출 상한이 두 배를 넘지 않는다 — cap(시간당) × 24 / 조인 간격', () => {
    for (const lane of Object.values(ALARM_LANES)) {
      const base = lane.minIntervalHours ?? 0
      if (!base) continue
      const tightened = adaptiveIntervalHours(base, many(50, ok(982, 1000)))
      const perDayBase = (lane.runsPerHour ?? 1) * 24 / base
      const perDayTight = (lane.runsPerHour ?? 1) * 24 / tightened
      expect(perDayTight).toBeLessThanOrEqual(perDayBase * 2)
    }
  })
})

describe('🔌 DO 배선', () => {
  const src = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
  it('간격 판정이 자가조율을 거친다(고정 상수로 되돌아가지 않는다)', () => {
    expect(src).toContain('adaptiveIntervalHours(lane.minIntervalHours ?? 0, prevHistory)')
    expect(src).not.toMatch(/dueByElapsed\(lastRunAt, t0, lane\.minIntervalHours \?\? 0\)/)
  })
  it('🕳️ 실패한 회차는 lastRunAt 을 안 찍는다(슬롯을 버리지 않는다)', () => {
    expect(src).toContain('if (runs < cap && due && (!entry || entry.ok)) put.lastRunAt = t0')
  })
  it('🔒 skip 은 여전히 안 찍는다 — 찍으면 간격이 안 차서 레인이 스스로 멎는다', () => {
    const line = src.split('\n').find(l => l.includes('put.lastRunAt = t0'))!
    expect(line).toContain('due')
  })
})
