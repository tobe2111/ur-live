/**
 * 🛡️ 2026-05-21: 모든 voucher 카테고리 결제 흐름 + 알림톡 라벨 회귀.
 *
 * 경위:
 *   이전엔 group-buy.routes.ts:80 SQL 가 `category = 'meal_voucher'` hardcode →
 *   다른 카테고리 (beauty/health/pet/activity) 결제 시 404.
 *
 * 영구 fix:
 *   IN 절로 7개 카테고리 모두 허용 + 알림톡 메시지 라벨 동적 (getVoucherShortLabel).
 *
 * 본 테스트는 라벨 함수의 모든 카테고리 명시 응답 검증.
 */
import { describe, it, expect } from 'vitest'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'

describe('getVoucherShortLabel — 모든 카테고리 명시 라벨', () => {
  it('식사권 / 미용 / 숙소 / 기타 — 신규 4종', () => {
    expect(getVoucherShortLabel('meal_voucher')).toBe('식사권')
    expect(getVoucherShortLabel('beauty_voucher')).toBe('미용권')
    expect(getVoucherShortLabel('stay_voucher')).toBe('숙소권')
    expect(getVoucherShortLabel('etc_voucher')).toBe('기타권')
  })

  it('legacy 카테고리 — graceful 매핑', () => {
    expect(getVoucherShortLabel('health_voucher')).toBe('미용권')
    expect(getVoucherShortLabel('pet_voucher')).toBe('기타권')
    expect(getVoucherShortLabel('activity_voucher')).toBe('기타권')
  })

  it('미지 카테고리 — 바우처 fallback', () => {
    expect(getVoucherShortLabel('unknown_xyz')).toBe('바우처')
    expect(getVoucherShortLabel('')).toBe('바우처')
    expect(getVoucherShortLabel(null)).toBe('바우처')
    expect(getVoucherShortLabel(undefined)).toBe('바우처')
  })
})
