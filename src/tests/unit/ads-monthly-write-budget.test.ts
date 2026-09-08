/**
 * 🗓️🕐 월 역산 예산(①) + 일중 페이싱(②) — 대표 지시 2026-09-08 "$0 으로 가야해 / 1,2번은 너가 해".
 *
 * ## 이 둘이 고치는 것
 * 요금은 **월** 단위인데 차단기는 **일** 단위였다. 그 사이엔 중간이 없어서, 폭주가 월초에 한도를
 * 태워도 남은 날들이 그걸 모른 채 과금 구간으로 걸어 들어갔다(2026-09-02: 하루 4,554만 행).
 * 그리고 하루치를 전속력으로 태우고 절벽처럼 멈춰서, 2026-09-07 은 12시간에 하루치를 다 쓰고
 * 나머지 12시간 수집이 0 이었다.
 *
 * ⚠️ **가장 위험한 항목은 ③ "0 을 안 돌려준다"** — 이 파일에서 0 은 "끔"(무제한)이라, 월 몫이
 *   소진됐을 때 0 을 돌려주면 차단기가 **꺼지고 무제한이 된다**. 정확히 정반대가 된다.
 *
 * ⚠️ **이 시험이 못 막는 것**: 원장은 유어애즈 자신의 쓰기만 센다(레인 보고값). 유어딜 본진 실적은
 *   상수 예약분으로만 반영되므로, 본진이 커지면 이 시험은 초록인데 계정은 넘을 수 있다.
 *   판정은 라이브 D1 rowsWritten 으로만 된다.
 */
import { describe, it, expect } from 'vitest'
import {
  applyRead, monthlyDerivedWriteBudget, pacedWriteOver, effectiveWriteBudget,
  utcDaysLeftInMonth, utcMonth,
  MONTHLY_WRITE_ALLOWANCE, URDEAL_MONTHLY_RESERVE, MONTH_SPENT_FLOOR, handleBudgetRequest,
  SEPT_2026_WRITE_THROTTLE, DEFAULT_DAILY_WRITE_BUDGET,
} from '@/worker-ads/read-budget'

const OCT1 = Date.parse('2026-10-01T06:00:00Z')   // 남은 31일
const OCT16 = Date.parse('2026-10-16T06:00:00Z')  // 남은 16일
const OCT31 = Date.parse('2026-10-31T06:00:00Z')  // 남은 1일

describe('① 월 역산 일일 예산', () => {
  it('달력 — 남은 일수는 오늘을 포함한다', () => {
    expect(utcDaysLeftInMonth(OCT1)).toBe(31)
    expect(utcDaysLeftInMonth(OCT16)).toBe(16)
    expect(utcDaysLeftInMonth(OCT31)).toBe(1)
    expect(utcMonth(OCT16)).toBe('2026-10')
  })

  it('월초엔 (포함분 − 본진예약) ÷ 31 이다', () => {
    const expected = Math.floor((MONTHLY_WRITE_ALLOWANCE - URDEAL_MONTHLY_RESERVE) / 31)
    expect(monthlyDerivedWriteBudget(0, OCT1)).toBe(expected)
    expect(expected).toBeGreaterThan(1_500_000)   // 하루 150만 이상은 나와야 수집이 산다
  })

  it('🩸 적게 쓴 날이 있으면 남은 날이 그만큼 더 쓴다 (용량을 안 버린다)', () => {
    // 15일이 지났는데 절반도 안 썼다면, 남은 16일치 예산은 월초보다 커야 한다.
    const early = monthlyDerivedWriteBudget(0, OCT1)
    const behind = monthlyDerivedWriteBudget(1_000_000, OCT16)
    expect(behind).toBeGreaterThan(early)
  })

  it('🩸 많이 쓴 날이 있으면 남은 날이 조여진다 (월을 못 터뜨린다)', () => {
    const ahead = monthlyDerivedWriteBudget(40_000_000, OCT16)
    expect(ahead).toBeLessThan(monthlyDerivedWriteBudget(0, OCT16))
    // 남은 16일을 다 써도 포함분을 못 넘는다 — 이게 $0 목표의 전부다.
    expect(40_000_000 + ahead * 16).toBeLessThanOrEqual(MONTHLY_WRITE_ALLOWANCE)
  })

  it('③ 월 몫이 소진돼도 절대 0 을 안 돌려준다 — 0 은 "끔"(무제한)이라 정반대가 된다', () => {
    expect(monthlyDerivedWriteBudget(MONTHLY_WRITE_ALLOWANCE, OCT16)).toBe(MONTH_SPENT_FLOOR)
    expect(monthlyDerivedWriteBudget(99_000_000, OCT16)).toBe(MONTH_SPENT_FLOOR)
    expect(MONTH_SPENT_FLOOR).toBeGreaterThan(0)
  })

  it('본진 몫을 먼저 뗀다 — 포함분은 DB 가 아니라 계정 단위다', () => {
    expect(monthlyDerivedWriteBudget(0, OCT31)).toBe(MONTHLY_WRITE_ALLOWANCE - URDEAL_MONTHLY_RESERVE)
    expect(URDEAL_MONTHLY_RESERVE).toBeGreaterThan(0)
  })
})

describe('② 일중 페이싱', () => {
  const st = (written: number, day = '2026-10-16') => ({ day, used: 0, written })
  const at = (h: number) => Date.parse(`2026-10-16T${String(h).padStart(2, '0')}:30:00Z`)

  it('시간이 지난 만큼만 쓴다 — 0시엔 하루치의 1/24', () => {
    expect(pacedWriteOver(st(0), 240_000, at(0))).toBe(false)
    expect(pacedWriteOver(st(10_001), 240_000, at(0))).toBe(true)   // 10,000 초과
  })

  it('🩸 절벽이 사라진다 — 12시간에 하루치를 다 써도 그 시점에 멈추고 다음 시간에 다시 열린다', () => {
    const dayBudget = 240_000
    expect(pacedWriteOver(st(dayBudget), dayBudget, at(11))).toBe(true)   // 12시간째: 막힌다
    expect(pacedWriteOver(st(dayBudget), dayBudget, at(23))).toBe(true)   // 하루치는 하루치다
    // 페이스대로면 안 막힌다 — 같은 총량이 하루 내내 고르게 나간다.
    //   ⚠️ 경계는 `>=` 다: 11시(12번째 시간)의 허용치는 정확히 절반이고, 그 값에 **닿으면**
    //   그 시간 몫을 다 쓴 것이라 막힌다. 다음 시간에 다시 열린다.
    expect(pacedWriteOver(st(119_999), dayBudget, at(11))).toBe(false)
    expect(pacedWriteOver(st(120_000), dayBudget, at(11))).toBe(true)
    expect(pacedWriteOver(st(120_000), dayBudget, at(12))).toBe(false)   // 한 시간 뒤 열린다
  })

  it('따라잡기를 허용한다 — 조용한 시간대가 손실이 되면 안 된다', () => {
    // 20시까지 하루치의 10%만 썼다면, 지금 한 번에 더 쓸 수 있어야 한다.
    expect(pacedWriteOver(st(24_000), 240_000, at(20))).toBe(false)
  })

  it('날이 바뀌면 자동 해제된다', () => {
    expect(pacedWriteOver(st(999_999, '2026-10-15'), 240_000, at(3))).toBe(false)
  })

  it('예산이 0(끔)이면 페이싱도 안 막는다', () => {
    expect(pacedWriteOver(st(999_999), 0, at(3))).toBe(false)
  })
})

describe('원장 — 월 누적', () => {
  it('같은 달이면 누적, 달이 바뀌면 0 에서 다시', () => {
    const a = applyRead(null, 0, Date.parse('2026-10-30T00:00:00Z'), 100)
    expect(a.writtenMonth).toBe(100)
    const b = applyRead(a, 0, Date.parse('2026-10-31T00:00:00Z'), 50)
    expect(b.writtenMonth).toBe(150)   // 날은 바뀌어도 달은 같다
    expect(b.written).toBe(50)         // 일 누적은 리셋
    const c = applyRead(b, 0, Date.parse('2026-11-01T00:00:00Z'), 7)
    expect(c.writtenMonth).toBe(7)     // 달이 바뀌면 리셋
    expect(c.month).toBe('2026-11')
  })
})

/**
 * 🩸 **배선 시험이 없어서 헛돌았다** (2026-09-08, 주입 검증이 잡았다).
 *   위 시험들은 `pacedWriteOver` 를 **순수함수로만** 확인한다. 그래서 그 함수를
 *   `handleBudgetRequest` 의 판정에서 빼 버려도 전부 초록이었다 — 함수는 멀쩡히 있고
 *   아무도 안 부르는 상태. 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 다.
 *   ⇒ 원장을 실제로 불러서 판정이 나오는지 본다.
 */
describe('배선 — 원장이 실제로 페이싱과 월 역산을 쓴다', () => {
  const mem = (init?: unknown) => {
    let v = init
    return { async get<T>() { return v as T }, async put(_k: string, val: unknown) { v = val } }
  }
  const url = new URL('https://x/budget')

  it('🔒 페이스를 넘으면 막는다 — 일일 상한엔 한참 못 미쳐도', async () => {
    const at3 = Date.parse('2026-10-16T03:30:00Z')   // 4번째 시간 → 하루치의 1/6 허용
    // 하루 예산의 절반을 새벽에 다 썼다: 일일 상한(>=)엔 안 걸리지만 페이스엔 걸려야 한다.
    const day = monthlyDerivedWriteBudget(0, at3)
    const st = mem({ day: '2026-10-16', used: 0, written: Math.floor(day / 2), month: '2026-10', writtenMonth: Math.floor(day / 2) })
    const v = await handleBudgetRequest(url, st, {}, at3)
    expect(v.writeOver, '페이싱이 배선에서 빠지면 이 판정이 false 가 된다').toBe(true)
    expect(v.written).toBeLessThan(v.writeBudget)   // 일일 상한만으로는 안 걸린다는 증명
  })

  it('🔒 페이스 안이면 안 막는다 (차단기가 늘 켜져 있으면 그것도 고장이다)', async () => {
    const at12 = Date.parse('2026-10-16T12:30:00Z')
    const day = monthlyDerivedWriteBudget(0, at12)
    const st = mem({ day: '2026-10-16', used: 0, written: Math.floor(day / 4), month: '2026-10', writtenMonth: Math.floor(day / 4) })
    expect((await handleBudgetRequest(url, st, {}, at12)).writeOver).toBe(false)
  })

  it('🔒 월 누적이 예산에 반영된다 — 많이 쓴 달은 오늘 예산이 작아진다', async () => {
    const at = Date.parse('2026-10-16T06:00:00Z')
    const fresh = await handleBudgetRequest(url, mem({ day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 0 }), {}, at)
    const spent = await handleBudgetRequest(url, mem({ day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 40_000_000 }), {}, at)
    expect(spent.writeBudget).toBeLessThan(fresh.writeBudget)
    expect(spent.writtenMonth).toBe(40_000_000)   // 화면에 보여야 설명이 된다
    expect(spent.daysLeft).toBe(16)
  })
})

describe('우선순위 — env > 9월 스로틀 > 월 역산', () => {
  it('env 를 명시하면 그 값이 이긴다 (배포 없이 되돌릴 손잡이)', () => {
    expect(effectiveWriteBudget({ ADS_DAILY_WRITE_BUDGET: '777000' }, null, OCT16)).toBe(777_000)
  })

  it('9월 안에서는 한시 스로틀이 천장이다 — 그 달 원장엔 9/2 폭주 이력이 없어 역산이 과대평가한다', () => {
    const sep = Date.parse('2026-09-20T00:00:00Z')
    expect(effectiveWriteBudget({}, null, sep)).toBe(SEPT_2026_WRITE_THROTTLE)
  })

  it('10월부터는 월 역산이 단독으로 지배한다 (기본값 상수가 아니다)', () => {
    const v = effectiveWriteBudget({}, null, OCT1)
    expect(v).toBe(monthlyDerivedWriteBudget(0, OCT1))
    expect(v).not.toBe(DEFAULT_DAILY_WRITE_BUDGET)
  })

  it('원장의 달이 지금과 다르면 그 누적을 안 쓴다 (지난달 값으로 이번 달을 조이면 안 된다)', () => {
    const stale = { day: '2026-09-30', used: 0, written: 0, month: '2026-09', writtenMonth: 49_000_000 }
    expect(effectiveWriteBudget({}, stale, OCT1)).toBe(monthlyDerivedWriteBudget(0, OCT1))
  })
})
