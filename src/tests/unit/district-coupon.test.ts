/**
 * 🧾 상권 쿠폰 순수 헬퍼 유닛테스트 — 서버 권위 보상 계산·승인번호 정규화(부정방지 UNIQUE 정확도).
 *   불변식: 클라 금액을 신뢰하지 않고 서버가 tier 매칭 / 같은 승인번호의 표기 변형은 같은 키로 수렴.
 */
import { describe, it, expect } from 'vitest'
import { parseRewardTiers, matchTier, normalizeApprovalNo } from '@/features/district/district-shared'

describe('parseRewardTiers', () => {
  it('유효 구간만 통과 + 높은 기준액 우선 정렬', () => {
    const tiers = parseRewardTiers(JSON.stringify([
      { min_amount: 30000, face_value: 3000 },
      { min_amount: 50000, face_value: 10000 },
      { min_amount: -1, face_value: 5 },        // 무효(음수)
      { min_amount: 10000, face_value: 0 },     // 무효(액면 0)
      { min_amount: 'x', face_value: 1000 },    // 무효(NaN)
    ]))
    expect(tiers).toEqual([
      { min_amount: 50000, face_value: 10000 },
      { min_amount: 30000, face_value: 3000 },
    ])
  })
  it('깨진 JSON/비배열 → 빈 배열(크래시 0)', () => {
    expect(parseRewardTiers('not-json')).toEqual([])
    expect(parseRewardTiers('{"a":1}')).toEqual([])
    expect(parseRewardTiers(null)).toEqual([])
    expect(parseRewardTiers(undefined)).toEqual([])
  })
})

describe('matchTier — 서버 권위 액면 결정', () => {
  const tiers = parseRewardTiers(JSON.stringify([
    { min_amount: 30000, face_value: 3000 },
    { min_amount: 50000, face_value: 10000 },
  ]))
  it('구간 경계: 5만↑=1만 / 3만↑=3천 / 미달=null', () => {
    expect(matchTier(tiers, 50000)).toBe(10000)
    expect(matchTier(tiers, 49999)).toBe(3000)
    expect(matchTier(tiers, 30000)).toBe(3000)
    expect(matchTier(tiers, 29999)).toBeNull()
  })
  it('비정상 금액(0/음수/NaN) → null (지급 불가)', () => {
    expect(matchTier(tiers, 0)).toBeNull()
    expect(matchTier(tiers, -5000)).toBeNull()
    expect(matchTier(tiers, NaN)).toBeNull()
  })
  it('구간 없음 → 항상 null', () => {
    expect(matchTier([], 999999)).toBeNull()
  })
})

describe('normalizeApprovalNo — 영수증 돌려쓰기 UNIQUE 키', () => {
  it('하이픈/공백/특수문자 표기 변형이 같은 키로 수렴', () => {
    expect(normalizeApprovalNo('1234-5678')).toBe('12345678')
    expect(normalizeApprovalNo(' 1234 5678 ')).toBe('12345678')
    expect(normalizeApprovalNo('1234.5678')).toBe('12345678')
    expect(normalizeApprovalNo('ab12cd')).toBe('AB12CD')
  })
  it('빈/널 안전', () => {
    expect(normalizeApprovalNo('')).toBe('')
    expect(normalizeApprovalNo(undefined as unknown as string)).toBe('')
  })
})
