import { describe, it, expect } from 'vitest'
import { expectedMaxAgeMinutes } from '@/worker/utils/cron-heartbeat'

/**
 * 💓 cron 멈춤 판정 — 순수함수 회귀 고정 (2026-07-28).
 *
 * 이 함수가 틀리면 두 방향 모두 나쁘다:
 *   - 너무 짧게 잡으면 → 정상인데 매시간 경보 → 곧 아무도 안 본다(오늘 고친 무음 정지와 같은 결말)
 *   - 너무 길게 잡으면 → 멈춰도 며칠간 조용
 * 그래서 실제 등록된 cron 식(scheduled.ts 의 10종)을 기준값으로 못박는다.
 */
describe('expectedMaxAgeMinutes — cron 식별 기대주기(분)', () => {
  it('N분마다: 기대주기 = N (×2 + 30분 여유)', () => {
    expect(expectedMaxAgeMinutes('*/2 * * * *')).toBe(2 * 2 + 30)
    expect(expectedMaxAgeMinutes('*/5 * * * *')).toBe(5 * 2 + 30)
    expect(expectedMaxAgeMinutes('*/10 * * * *')).toBe(10 * 2 + 30)
  })

  it('매시(분 고정): 60분 기준', () => {
    expect(expectedMaxAgeMinutes('0 * * * *')).toBe(60 * 2 + 30)
    expect(expectedMaxAgeMinutes('30 * * * *')).toBe(60 * 2 + 30)
  })

  it('매일: 1440분 기준', () => {
    expect(expectedMaxAgeMinutes('0 18 * * *')).toBe(60 * 24 * 2 + 30)
    expect(expectedMaxAgeMinutes('0 3 * * *')).toBe(60 * 24 * 2 + 30)
    expect(expectedMaxAgeMinutes('0 0 * * *')).toBe(60 * 24 * 2 + 30)
  })

  it('주간(요일 지정): 일 단위보다 길게', () => {
    expect(expectedMaxAgeMinutes('0 0 * * 1')).toBe(60 * 24 * 7 * 2 + 30)
    expect(expectedMaxAgeMinutes('0 20 * * 0')).toBe(60 * 24 * 7 * 2 + 30)
  })

  it('월간(일자 지정)', () => {
    expect(expectedMaxAgeMinutes('0 21 1 * *')).toBe(60 * 24 * 31 * 2 + 30)
  })

  it('⚠️ 해석 불가하면 null — 경보하지 않는다(모르면 조용한 편이 오탐보다 낫다)', () => {
    expect(expectedMaxAgeMinutes('bad')).toBeNull()
    expect(expectedMaxAgeMinutes('')).toBeNull()
    expect(expectedMaxAgeMinutes(undefined)).toBeNull()
    expect(expectedMaxAgeMinutes(null)).toBeNull()
    expect(expectedMaxAgeMinutes('0 0 * *')).toBeNull()      // 4필드
    expect(expectedMaxAgeMinutes('0 0 * * * *')).toBeNull()  // 6필드
  })

  it('여유폭이 항상 기대주기보다 커야 한다(한 번 밀렸다고 울리면 안 된다)', () => {
    for (const [expr, period] of [['*/5 * * * *', 5], ['0 * * * *', 60], ['0 18 * * *', 1440]] as const) {
      const limit = expectedMaxAgeMinutes(expr)!
      expect(limit).toBeGreaterThan(period)
    }
  })
})
