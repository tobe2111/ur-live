/**
 * 🏨 상세 합치기 1단계 — 숙소 예약 부품 분리 + 한국 날짜 (2026-11-03, 대표 "합쳐줘")
 * 종전 기본 체크인은 UTC 날짜라 한국 밤 12시~오전 9시엔 **어제**였다(실측). 분리하며 같이 고쳤다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { kstYmd } from '@/pages/stay-detail/stay-detail-types'

describe('숙소 기본 날짜는 한국 날짜', () => {
  it('UTC 18:00(한국 다음날 03:00) → 한국 날짜', () => {
    const t = Date.parse('2026-11-03T18:00:00Z')
    expect(kstYmd(0, t)).toBe('2026-11-04')
    expect(kstYmd(1, t)).toBe('2026-11-05')
  })
  it('페이지가 UTC 날짜를 다시 만들지 않는다', () => {
    const page = readFileSync('src/pages/StayDetailPage.tsx', 'utf-8')
    expect(page).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/)
    expect(page).toContain("from './stay-detail/stay-detail-types'")
  })
  it('예약 창은 분리된 부품을 쓴다', () => {
    expect(readFileSync('src/pages/stay-detail/StayBookingModals.tsx', 'utf-8')).toMatch(/export function MultiBookingModal\(/)
  })
})
