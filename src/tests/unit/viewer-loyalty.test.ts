/**
 * Viewer Loyalty 4단계 — Phase 2-3 단위 테스트
 *
 * computeViewerLoyalty 의 등급 분류 로직 검증.
 */

import { describe, it, expect } from 'vitest'
import { computeViewerLoyalty, VIEWER_LOYALTY_LABEL } from '../../shared/utils/viewer-loyalty'

describe('viewer-loyalty: computeViewerLoyalty', () => {
  it('첫 방문 → newbie', () => {
    expect(computeViewerLoyalty({ visits: 1, payments: 0, totalSpent: 0 })).toBe('newbie')
    expect(computeViewerLoyalty({ visits: 0, payments: 0, totalSpent: 0 })).toBe('newbie')
  })

  it('2회 방문 → newbie (3회 미만)', () => {
    expect(computeViewerLoyalty({ visits: 2, payments: 0, totalSpent: 0 })).toBe('newbie')
  })

  it('3회 방문 → regular', () => {
    expect(computeViewerLoyalty({ visits: 3, payments: 0, totalSpent: 0 })).toBe('regular')
    expect(computeViewerLoyalty({ visits: 4, payments: 0, totalSpent: 0 })).toBe('regular')
  })

  it('5회 방문 → loyal', () => {
    expect(computeViewerLoyalty({ visits: 5, payments: 0, totalSpent: 0 })).toBe('loyal')
    expect(computeViewerLoyalty({ visits: 100, payments: 0, totalSpent: 0 })).toBe('loyal')
  })

  it('1회 결제 → loyal (방문 무관)', () => {
    expect(computeViewerLoyalty({ visits: 0, payments: 1, totalSpent: 1000 })).toBe('loyal')
    expect(computeViewerLoyalty({ visits: 1, payments: 2, totalSpent: 5000 })).toBe('loyal')
  })

  it('3회 결제 → vip', () => {
    expect(computeViewerLoyalty({ visits: 5, payments: 3, totalSpent: 1000 })).toBe('vip')
  })

  it('누적 50,000 사용 → vip', () => {
    expect(computeViewerLoyalty({ visits: 1, payments: 1, totalSpent: 50_000 })).toBe('vip')
    expect(computeViewerLoyalty({ visits: 1, payments: 1, totalSpent: 100_000 })).toBe('vip')
  })

  it('VIP 조건 둘 다 만족 → vip', () => {
    expect(computeViewerLoyalty({ visits: 100, payments: 10, totalSpent: 200_000 })).toBe('vip')
  })

  it('VIP 우선순위 (결제 ≥ 3 가 totalSpent < 50000 보다 우선)', () => {
    expect(computeViewerLoyalty({ visits: 0, payments: 3, totalSpent: 100 })).toBe('vip')
  })
})

describe('viewer-loyalty: 라벨 매핑', () => {
  it('4단계 모두 한국어 라벨 정의됨', () => {
    expect(VIEWER_LOYALTY_LABEL.newbie).toBe('신규')
    expect(VIEWER_LOYALTY_LABEL.regular).toBe('단골')
    expect(VIEWER_LOYALTY_LABEL.loyal).toBe('충성')
    expect(VIEWER_LOYALTY_LABEL.vip).toBe('VIP')
  })
})
