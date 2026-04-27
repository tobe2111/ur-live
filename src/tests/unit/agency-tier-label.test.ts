/**
 * Agency Tier Label — Phase 1-1 단위 테스트
 *
 * tier 라벨 매핑 (DB enum new/junior/senior → 브론즈/실버/골드).
 */

import { describe, it, expect } from 'vitest'
import {
  tierLabel,
  tierBadgeClass,
  AGENCY_TIER_LABEL,
  AGENCY_TIER_ORDER,
} from '../../shared/utils/agency-tier'

describe('agency-tier: tierLabel', () => {
  it('new → 브론즈', () => {
    expect(tierLabel('new')).toBe('브론즈')
  })

  it('junior → 실버', () => {
    expect(tierLabel('junior')).toBe('실버')
  })

  it('senior → 골드', () => {
    expect(tierLabel('senior')).toBe('골드')
  })

  it('null → 브론즈 (기본)', () => {
    expect(tierLabel(null)).toBe('브론즈')
    expect(tierLabel(undefined)).toBe('브론즈')
  })

  it('빈 문자열 → 브론즈', () => {
    expect(tierLabel('')).toBe('브론즈')
  })

  it('알 수 없는 tier → 그대로 반환 (fallback)', () => {
    expect(tierLabel('unknown')).toBe('unknown')
  })
})

describe('agency-tier: tierBadgeClass', () => {
  it('각 등급에 다른 색상 배지', () => {
    const newBadge = tierBadgeClass('new')
    const juniorBadge = tierBadgeClass('junior')
    const seniorBadge = tierBadgeClass('senior')

    expect(newBadge).toContain('amber')        // 브론즈
    expect(juniorBadge).toContain('slate')      // 실버
    expect(seniorBadge).toContain('yellow')     // 골드
  })

  it('null → 브론즈 (기본)', () => {
    expect(tierBadgeClass(null)).toContain('amber')
  })
})

describe('agency-tier: 상수', () => {
  it('AGENCY_TIER_ORDER 는 신규 → 시니어 순서', () => {
    expect(AGENCY_TIER_ORDER).toEqual(['new', 'junior', 'senior'])
  })

  it('AGENCY_TIER_LABEL 모두 정의됨', () => {
    expect(Object.keys(AGENCY_TIER_LABEL)).toHaveLength(3)
  })
})
