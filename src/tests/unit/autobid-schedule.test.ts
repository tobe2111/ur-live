import { describe, it, expect } from 'vitest'
import { scheduleWeight, normalizeSchedule, parseCsvRules, kstWeekdayHour, clampWeight, planBid, SCHEDULE_PRESETS } from '../../features/marketing/api/autobid'

// 시간대·요일 입찰 전략 — 가중치는 추정가에만 곱하고 max_bid 하드캡은 planBid 가 그대로 강제.
describe('scheduleWeight — 시간대·요일 가중치', () => {
  it('스케줄 없으면 항상 1', () => {
    expect(scheduleWeight(null, 1, 10).weight).toBe(1)
    expect(scheduleWeight(undefined, 0, 0).weight).toBe(1)
  })

  it('피크 프리셋: 평일 9–18시 ×1.2, 그 외 1', () => {
    const j = normalizeSchedule('peak')!
    expect(scheduleWeight(j, 3, 10).weight).toBe(1.2)  // 수요일 10시
    expect(scheduleWeight(j, 3, 8).weight).toBe(1)     // 9시 전
    expect(scheduleWeight(j, 3, 18).weight).toBe(1)    // 18시(end 미포함)
    expect(scheduleWeight(j, 0, 10).weight).toBe(1)    // 일요일 → 매칭 안 됨
  })

  it('야간 절약: 0–7시 ×0.6', () => {
    const j = normalizeSchedule('night_save')!
    expect(scheduleWeight(j, 2, 3).weight).toBe(0.6)
    expect(scheduleWeight(j, 2, 7).weight).toBe(1)
  })

  it('자정 wrap(start>end) 지원: 22–2시', () => {
    const j = normalizeSchedule({ dayparts: [{ days: [0, 1, 2, 3, 4, 5, 6], start: 22, end: 2, weight: 1.5 }] })!
    expect(scheduleWeight(j, 1, 23).weight).toBe(1.5)
    expect(scheduleWeight(j, 1, 1).weight).toBe(1.5)
    expect(scheduleWeight(j, 1, 12).weight).toBe(1)
  })

  it('weight=0 은 일시정지 신호(엔진이 스킵)', () => {
    const j = normalizeSchedule({ dayparts: [{ days: [0], start: 0, end: 24, weight: 0 }] })!
    expect(scheduleWeight(j, 0, 12).weight).toBe(0)
  })

  it('가중치는 max_bid 하드캡을 깨지 못함(추정가에만 곱함)', () => {
    // est 5000 × 1.2 = 6000 이지만 max_bid 3000 → planBid 가 3000 으로 캡.
    const w = scheduleWeight(normalizeSchedule('peak')!, 3, 10).weight
    const plan = planBid(5000 * w, 3000, 1000)
    expect(plan.bid).toBe(3000)
  })
})

describe('normalizeSchedule — 검증·클램프', () => {
  it("'always'/빈값 → null", () => {
    expect(normalizeSchedule('always')).toBeNull()
    expect(normalizeSchedule('')).toBeNull()
    expect(normalizeSchedule(null)).toBeNull()
  })
  it('프리셋 키 → JSON', () => {
    expect(normalizeSchedule('peak')).toContain('dayparts')
    expect(normalizeSchedule('weekend')).toContain('1.25')
  })
  it('weight 는 0~2 로 클램프', () => {
    expect(clampWeight(9)).toBe(2)
    expect(clampWeight(-3)).toBe(0)
    const j = normalizeSchedule({ dayparts: [{ days: [1], start: 0, end: 24, weight: 99 }] })!
    expect(scheduleWeight(j, 1, 5).weight).toBe(2)
  })
  it('잘못된 입력 → null', () => {
    expect(normalizeSchedule('{not json')).toBeNull()
    expect(normalizeSchedule({ dayparts: [] })).toBeNull()
    expect(normalizeSchedule({ dayparts: [{ days: [], start: 0, end: 1, weight: 1 }] })).toBeNull()
  })
})

describe('parseCsvRules — CSV 일괄 등록 파서', () => {
  it('헤더 스킵 + 정상 행 파싱', () => {
    const rows = parseCsvRules('keyword_id,keyword_text,target_rank,max_bid,device\nkw-1,무선이어폰,2,3000,PC\nkw-2,블루투스,1,5000,MOBILE')
    expect(rows.length).toBe(2)
    expect(rows[0]).toMatchObject({ keyword_id: 'kw-1', keyword_text: '무선이어폰', target_rank: 2, max_bid: 3000, device: 'PC' })
    expect(rows[1].device).toBe('MOBILE')
  })
  it('숫자 아닌 행은 스킵', () => {
    expect(parseCsvRules('kw-x,텍스트,abc,xyz').length).toBe(0)
  })
  it('빈 입력 → 빈 배열', () => {
    expect(parseCsvRules('').length).toBe(0)
  })
})

describe('kstWeekdayHour — UTC→KST', () => {
  it('UTC 2026-06-28(일) 00:00 → KST 09시, 일요일', () => {
    const ms = Date.UTC(2026, 5, 28, 0, 0, 0)
    expect(kstWeekdayHour(ms)).toEqual({ weekday: 0, hour: 9 })
  })
  it('UTC 18:00 → KST 다음날 03시', () => {
    const ms = Date.UTC(2026, 5, 28, 18, 0, 0) // 일 18:00 UTC → 월 03:00 KST
    expect(kstWeekdayHour(ms)).toEqual({ weekday: 1, hour: 3 })
  })
})

describe('SCHEDULE_PRESETS', () => {
  it('always 는 schedule null', () => {
    expect(SCHEDULE_PRESETS.always.schedule).toBeNull()
  })
})
