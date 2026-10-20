/**
 * 🖼️ 사진 기본 화질 85 → 75 · 상세 히어로는 85 유지 〔2026-10-18〕
 *
 * 대표 *"다 이상적으로 해줘"*(첫 방문 홈 사진 470KB 보고 뒤). 실측: 홈 카드 사진 8장(폭 400) avif 합계
 * 59.8 → 46.0KB(−23%) · webp 한 장 29.7 → 19.5KB(−34%). 카드 크기에서 나란히 봐도 차이가 안 보였다.
 *
 * 지키는 것 셋:
 *   ① 기본값이 75 이고 cdn-cgi 주소에 실제로 그 값이 박힌다(상수만 바꾸고 조립이 85 를 박으면 헛돈다)
 *   ② 상세 히어로(상품의 큰 사진)는 85 를 명시한다 — 기본값을 낮춘 것이지 모든 사진을 낮춘 게 아니다
 *   ③ 데이터 절약 모드는 높게 명시한 사진(히어로 85)도 65 로 내린다
 *
 * ⚠️ 못 보는 것: 사진이 **보기 좋은지**(눈으로만 판정) · Save-Data 사용자가 서버 preload 와 주소가
 *   달라 히어로를 한 번 더 받는 것(2026-07-02 부터 안고 있는 같은 트레이드오프).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const MEDIA = 'https://media.ur-team.com/uploads/a.jpg'

afterEach(() => { vi.resetModules(); vi.unstubAllGlobals() })

describe('① 기본 화질 75', () => {
  it('상수와 주소가 같다 — 카드 사진은 quality=75', async () => {
    const { cfImage, CF_IMAGE_DEFAULT_QUALITY } = await import('@/utils/cf-image')
    expect(CF_IMAGE_DEFAULT_QUALITY).toBe(75)
    expect(cfImage(MEDIA, { width: 400 })).toContain('quality=75')
    expect(cfImage('/api/media/uploads/a.jpg', { width: 400 })).toContain('quality=75')
    expect(cfImage(MEDIA, { width: 400, quality: 90 }), '명시한 값은 그대로').toContain('quality=90')
  })
})

describe('② 상세 히어로는 명시한 75 (2026-10-20 85 → 75)', () => {
  it('크롭·평면 둘 다', async () => {
    const { detailHeroMobileUrl, detailPlainUrl, DETAIL_HERO_QUALITY } = await import('@/shared/detail-hero-image')
    expect(DETAIL_HERO_QUALITY).toBe(75)
    expect(detailHeroMobileUrl(MEDIA)).toContain('quality=75')
    expect(detailPlainUrl(MEDIA, 1200)).toContain('quality=75')
  })
})

describe('③ 데이터 절약 모드', () => {
  it('기본·명시 85 모두 65 로 — 명시한 65 이하는 그대로', async () => {
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    vi.resetModules()
    const { cfImage } = await import('@/utils/cf-image')
    const { detailHeroMobileUrl } = await import('@/shared/detail-hero-image')
    expect(cfImage(MEDIA, { width: 400 })).toContain('quality=65')
    expect(detailHeroMobileUrl(MEDIA), '명시한 히어로 화질이 데이터 절약을 우회한다').toContain('quality=65')
    expect(cfImage(MEDIA, { width: 400, quality: 50 })).toContain('quality=50')
  })
})
