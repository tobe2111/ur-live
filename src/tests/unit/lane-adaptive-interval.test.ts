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

  it('🔒 신규율이 낮으면(중복이 많아지는 중) 조이지 않는다', () => {
    // ⚠️ 절대량은 있는데 신규율만 낮은 형상이어야 한다 — 절대량까지 0 이면 그건 **마름**이고
    //   아래 별도 절이 담당한다(주기를 늘린다). 두 상태를 한 픽스처로 재면 무엇을 검사하는지 흐려진다.
    const stale = { t: 'x', ok: true, n: 5, f: 500 } as LaneRunEntry
    expect(recentNovelty(many(TIGHTEN_CLEAN_RUNS, stale))!).toBeLessThan(TIGHTEN_MIN_NOVELTY)
    expect(adaptiveIntervalHours(2, many(TIGHTEN_CLEAN_RUNS, stale))).toBe(2)
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
    // 🔄 상한(`!retryable`)이 붙어 앵커를 갱신했다 — 지키는 것은 여전히 "성공한 회차만 자리를 먹는다".
    expect(src).toContain('if (runs < cap && due && (!entry || entry.ok || !retryable)) put.lastRunAt = t0')
  })
  it('🔒 skip 은 여전히 안 찍는다 — 찍으면 간격이 안 차서 레인이 스스로 멎는다', () => {
    const line = src.split('\n').find(l => l.includes('put.lastRunAt = t0'))!
    expect(line).toContain('due')
  })
})

describe('🛑 실패 재시도 상한 — 영구 장애를 영원히 두드리지 않는다', () => {
  const src = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
  it('연속 실패가 상한을 넘으면 재시도를 접고 기본 주기로 돌아간다', () => {
    expect(src).toContain('const retryable = nextFail <= RETRY_MAX_FAIL_STREAK')
    expect(src).toContain('(!entry || entry.ok || !retryable)')
  })
  it('상한은 일시적 장애와 구분될 만큼은 크다(1회는 즉시 재시도해야 한다)', async () => {
    const { RETRY_MAX_FAIL_STREAK } = await import('@/worker-ads/lane-adaptive-interval')
    expect(RETRY_MAX_FAIL_STREAK).toBeGreaterThanOrEqual(2)
    expect(RETRY_MAX_FAIL_STREAK).toBeLessThanOrEqual(6)
  })
})

describe('🌵 마른 레인은 늦춘다 — 조이기와 대칭', () => {
  const dry = (): LaneRunEntry => ({ t: '2026-08-18T00:00', ok: true, n: 0, f: 50 })
  it('🩸 라이브 형상(storeinfo: found 50 · saved 0)이 반복되면 주기를 늘린다', async () => {
    const { isBarren, BARREN_INTERVAL_MULT, BARREN_RUNS } = await import('@/worker-ads/lane-adaptive-interval')
    expect(isBarren(many(BARREN_RUNS, dry()))).toBe(true)
    expect(adaptiveIntervalHours(2, many(BARREN_RUNS, dry()))).toBe(2 * BARREN_INTERVAL_MULT)
  })
  it('🔒 한 번이라도 제대로 수확하면 마른 게 아니다 — 늦추지 않는다', async () => {
    const { isBarren, BARREN_RUNS } = await import('@/worker-ads/lane-adaptive-interval')
    const h = [ok(982, 1000), ...many(BARREN_RUNS, dry())]
    expect(isBarren(h)).toBe(false)
    // 늦추지 않는다는 것이 요점이다(최근 창에 큰 수확이 남아 있으면 오히려 조여질 수 있다).
    expect(adaptiveIntervalHours(2, h)).toBeLessThanOrEqual(2)
  })
  it('🔒 실패(고장)를 마름으로 세지 않는다 — 처방이 정반대다', async () => {
    const { isBarren, BARREN_RUNS } = await import('@/worker-ads/lane-adaptive-interval')
    expect(isBarren(many(BARREN_RUNS, bad()))).toBe(false)
    expect(adaptiveIntervalHours(2, many(BARREN_RUNS, bad()))).toBe(2)
  })
  it('🔒 근거가 얇으면 안 늦춘다', async () => {
    const { BARREN_RUNS } = await import('@/worker-ads/lane-adaptive-interval')
    expect(adaptiveIntervalHours(2, many(BARREN_RUNS - 1, dry()))).toBe(2)
  })
  it('🔒 마른 레인을 끄지는 않는다 — 소스에 새 항목이 들어오면 스스로 돌아와야 한다', async () => {
    const { BARREN_INTERVAL_MULT } = await import('@/worker-ads/lane-adaptive-interval')
    expect(BARREN_INTERVAL_MULT).toBeGreaterThan(1)
    expect(Number.isFinite(adaptiveIntervalHours(2, many(20, dry())))).toBe(true)
  })
})
