/**
 * Seller Transfer 로직 단위 테스트 — Phase 3-5
 */

import { describe, it, expect } from 'vitest'
import {
  isInTransferCooldown,
  nextStatusForToResponse,
  nextStatusForSellerApproval,
  validateTransferRequest,
} from '../../shared/utils/seller-transfer-logic'

describe('transfer: 30일 cooldown', () => {
  it('이전 완료 X → cooldown 아님', () => {
    expect(isInTransferCooldown(null)).toBe(false)
  })

  it('29일 전 완료 → 여전히 cooldown', () => {
    const now = new Date('2026-01-30T00:00:00Z')
    const completedAt = new Date('2026-01-01T00:00:00Z').toISOString() // 29일 전
    expect(isInTransferCooldown(completedAt, now)).toBe(true)
  })

  it('정확히 30일 전 → cooldown 종료', () => {
    const now = new Date('2026-01-31T00:00:00Z')
    const completedAt = new Date('2026-01-01T00:00:00Z').toISOString() // 30일 전
    expect(isInTransferCooldown(completedAt, now)).toBe(false)
  })

  it('31일 전 → cooldown 아님', () => {
    const now = new Date('2026-02-01T00:00:00Z')
    const completedAt = new Date('2026-01-01T00:00:00Z').toISOString()
    expect(isInTransferCooldown(completedAt, now)).toBe(false)
  })
})

describe('transfer: 다음 status 결정', () => {
  it('to_agency accept → accepted_by_to', () => {
    expect(nextStatusForToResponse('accept')).toBe('accepted_by_to')
  })

  it('to_agency reject → rejected', () => {
    expect(nextStatusForToResponse('reject')).toBe('rejected')
  })

  it('seller approve → completed', () => {
    expect(nextStatusForSellerApproval(true)).toBe('completed')
  })

  it('seller reject → rejected', () => {
    expect(nextStatusForSellerApproval(false)).toBe('rejected')
  })
})

describe('transfer: 요청 검증', () => {
  it('valid 요청', () => {
    expect(validateTransferRequest({
      fromAgencyId: 1, toAgencyId: 2, sellerId: 100,
    })).toEqual({ valid: true })
  })

  it('동일 에이전시 → invalid', () => {
    expect(validateTransferRequest({
      fromAgencyId: 1, toAgencyId: 1, sellerId: 100,
    })).toEqual({ valid: false, reason: 'same_agency' })
  })

  it('필수 누락 → invalid', () => {
    expect(validateTransferRequest({
      fromAgencyId: 0, toAgencyId: 2, sellerId: 100,
    })).toEqual({ valid: false, reason: 'missing_params' })
  })
})
