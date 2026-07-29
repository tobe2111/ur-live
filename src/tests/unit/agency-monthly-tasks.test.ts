/**
 * agency-monthly-tasks.ts 의 순수 함수 단위 테스트.
 *
 * 검증:
 *   - TIER_DEFAULTS 등급별 목표값
 *   - taskProgress 진행률 계산 (pct, completed, label)
 *
 * 작성: 2026-04-26 (W2)
 */

import { describe, it, expect } from 'vitest'
import { TIER_DEFAULTS, taskProgress } from '../../worker/cron/agency-monthly-tasks'

describe('agency-monthly-tasks: TIER_DEFAULTS', () => {
  it('new 등급은 가장 낮은 목표', () => {
    expect(TIER_DEFAULTS.new.creator_growth).toBe(2)
    expect(TIER_DEFAULTS.new.sales_quota).toBe(1_000_000)
    expect(TIER_DEFAULTS.new.activation).toBe(1)
  })

  it('junior 는 new 보다 높음', () => {
    expect(TIER_DEFAULTS.junior.creator_growth).toBeGreaterThan(TIER_DEFAULTS.new.creator_growth)
    expect(TIER_DEFAULTS.junior.sales_quota).toBeGreaterThan(TIER_DEFAULTS.new.sales_quota)
    expect(TIER_DEFAULTS.junior.activation).toBeGreaterThan(TIER_DEFAULTS.new.activation)
  })

  it('senior 는 junior 보다 높음', () => {
    expect(TIER_DEFAULTS.senior.creator_growth).toBeGreaterThan(TIER_DEFAULTS.junior.creator_growth)
    expect(TIER_DEFAULTS.senior.sales_quota).toBeGreaterThan(TIER_DEFAULTS.junior.sales_quota)
    expect(TIER_DEFAULTS.senior.activation).toBeGreaterThan(TIER_DEFAULTS.junior.activation)
  })

  it('senior sales_quota = 1000만원 (TikTok 기준)', () => {
    expect(TIER_DEFAULTS.senior.sales_quota).toBe(10_000_000)
  })
})

describe('agency-monthly-tasks: taskProgress', () => {
  describe('pct 계산', () => {
    it('0/N = 0%', () => {
      expect(taskProgress('creator_growth', 0, 5).pct).toBe(0)
    })
    it('정확히 100% (목표 달성)', () => {
      expect(taskProgress('creator_growth', 5, 5).pct).toBe(100)
    })
    it('초과해도 100% 캡', () => {
      expect(taskProgress('creator_growth', 10, 5).pct).toBe(100)
    })
    it('절반 = 50%', () => {
      expect(taskProgress('sales_quota', 5_000_000, 10_000_000).pct).toBe(50)
    })
    it('round 처리', () => {
      // 1/3 = 33.33% → 33
      expect(taskProgress('creator_growth', 1, 3).pct).toBe(33)
      // 2/3 = 66.67% → 67
      expect(taskProgress('creator_growth', 2, 3).pct).toBe(67)
    })
    it('target=0 도 안전 (divide-by-zero 방어)', () => {
      // safeTarget = max(1, target)
      expect(taskProgress('creator_growth', 5, 0).pct).toBe(100)
    })
  })

  describe('completed 판정', () => {
    it('actual >= target 이면 true', () => {
      expect(taskProgress('activation', 5, 5).completed).toBe(true)
      expect(taskProgress('activation', 10, 5).completed).toBe(true)
    })
    it('actual < target 이면 false', () => {
      expect(taskProgress('activation', 4, 5).completed).toBe(false)
      expect(taskProgress('activation', 0, 5).completed).toBe(false)
    })
  })

  describe('label 형식', () => {
    it('sales_quota 는 만원 단위', () => {
      expect(taskProgress('sales_quota', 5_000_000, 10_000_000).label).toBe('500만원 / 1000만원')
    })
    it('creator_growth 는 명 단위', () => {
      expect(taskProgress('creator_growth', 3, 5).label).toBe('3명 / 5명')
    })
    it('activation 도 명 단위', () => {
      expect(taskProgress('activation', 2, 3).label).toBe('2명 / 3명')
    })
    it('소수점 절삭 (만원)', () => {
      // 1,234,567 → 123만원
      expect(taskProgress('sales_quota', 1_234_567, 5_000_000).label).toBe('123만원 / 500만원')
    })
  })

  describe('실 시나리오', () => {
    it('senior 에이전시 매출 80% 달성', () => {
      const r = taskProgress('sales_quota', 8_000_000, 10_000_000)
      expect(r.pct).toBe(80)
      expect(r.completed).toBe(false)
      expect(r.label).toBe('800만원 / 1000만원')
    })
    it('new 에이전시 영입 완료', () => {
      const r = taskProgress('creator_growth', 2, 2)
      expect(r.pct).toBe(100)
      expect(r.completed).toBe(true)
      expect(r.label).toBe('2명 / 2명')
    })
  })
})
