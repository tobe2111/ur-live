/**
 * 📉 홈 상단 배너(폰 홈의 LCP)는 2배까지만 받는다(2026-10-20).
 *   카드 사진의 `HOME_CARD_MAX_DPR = 2` 와 같은 규칙 — 362px 칸에 1,100px 를 받아 LCP 사진이 27KB 였다.
 * ⚠️ 못 보는 것: 실제 바이트(리사이저가 정한다 — 라이브 실측 26,986 → 16,473B) · 화질이 충분한지(눈으로).
 */
import { describe, it, expect } from 'vitest'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'
import { HOME_CARD_MAX_DPR } from '@/shared/home-card-image'
import { stripBannerImageUrl } from '@/shared/home-strip-banners'

const PHONE_CARD_W = 390 - 28 // `100vw − 28`

describe('홈 상단 배너 요청 폭', () => {
  it('폰 칸 × 2배를 넘지 않는다(카드 사진과 같은 상한)', () => {
    expect(HOME_CARD_MAX_DPR).toBe(2)
    expect(BANNER_SLOT_SPECS.strip.requestWidth).toBeLessThanOrEqual(Math.ceil((PHONE_CARD_W * HOME_CARD_MAX_DPR) / 20) * 20 + 20)
  })
  it('2배는 채운다(흐려지지 않게)', () => {
    expect(BANNER_SLOT_SPECS.strip.requestWidth).toBeGreaterThanOrEqual(PHONE_CARD_W * 2)
  })
  it('서버 첫 화면·미리받기·화면이 같이 쓰는 주소가 그 폭이다', () => {
    expect(stripBannerImageUrl('https://media.ur-team.com/a.jpg', 'strip')).toContain(`width=${BANNER_SLOT_SPECS.strip.requestWidth},`)
  })
  it('교환권 머리 배너(높이 196 에 맞춰 4:1 을 자른다)는 1600 그대로', () => {
    expect(BANNER_SLOT_SPECS.vouchers.requestWidth).toBe(1600)
  })
})
