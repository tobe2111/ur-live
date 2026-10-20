/**
 * 📐 배너 규격 안내가 실제 렌더와 어긋나지 않는다 (2026-08-23)
 *
 * ## 왜 이 가드가 생겼나
 * 대표가 히어로 사진을 올리려는데, 어드민 화면의 권장 규격 안내가 **손으로 적은 문장**이라
 * 2026-08-19 히어로 개편([전면 300px] → [통합형 190px · 우측 54%]) 때 **안내만 옛 값으로 남았다.**
 * 실측하니 6줄 중 대부분이 사실과 달랐다:
 *
 *   "1600 × 500 px 권장"      → 레티나 필요 폭은 2,074px. 그대로 올리면 0.77배로 흐리다.
 *   "최대 500KB 이하"          → 리사이저가 변환하므로 **원본은 커야** 선명하다(거꾸로 된 조언).
 *   "여러 개면 dots 로 전환"   → `HomeHeroBanner` 는 첫 번째 하나만 쓴다(캐러셀 없음).
 *   "없으면 그라디언트 4종"    → 실제로는 홈 SSR 시드에서 딜 사진을 고른다.
 *
 * 틀린 안내는 **사진 올리는 사람을 헛수고시키고**, 코드 리뷰로는 절대 안 걸린다(문장이니까).
 *
 * ⇒ 숫자를 `BANNER_SLOT_SPECS` 한 곳에 두고 **렌더가 그 값을 실제로 쓰게** 했다.
 *   이 테스트는 그 배선이 유지되는지 + 권장값이 필요 해상도를 실제로 충족하는지 본다.
 *
 * 이 테스트가 **못 막는 것**: 실제 표시 픽셀(1037 × 190). 레이아웃을 바꾸면 `renderedNote` 와
 *   `recommendedWidth` 를 브라우저로 다시 재야 한다 — 여기서 고정하는 건 배선과 산술뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BANNER_SLOTS, BANNER_SLOT_SPECS, BANNER_MAX_UPLOAD_MB } from '@/shared/constants/home-showcase'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석 제거 — 설명 주석이 배선 검사를 통과시키는 함정(이 레포에서 실제로 겪었다). */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

const HERO = 'src/components/home/HomeHeroDefault.tsx'
const STRIP = 'src/components/home/HomeBannerStrip.tsx'
const ADMIN = 'src/pages/AdminBannersPage.tsx'

describe('규격 상수가 실제 렌더에 배선돼 있다', () => {
  it('히어로 srcSet base 를 상수에서 읽는다 (숫자를 직접 쓰면 또 갈라진다)', () => {
    const s = code(read(HERO))
    expect(s, '히어로가 상수 대신 리터럴 폭을 쓰고 있다').toMatch(
      /cfSrcSet\(photoSrc,\s*BANNER_SLOT_SPECS\.hero\.srcSetBase/,
    )
  })

  it('중간·와이드 배너 폭을 상수에서 읽는다', () => {
    const s = code(read(STRIP))
    expect(s).toMatch(/width:\s*BANNER_SLOT_SPECS\.inline\.requestWidth/)
    expect(s).toMatch(/width:\s*BANNER_SLOT_SPECS\.wide\.requestWidth/)
  })

  it('어드민 안내가 상수에서 렌더된다 (손으로 적은 규격 문장 금지)', () => {
    const s = code(read(ADMIN))
    expect(s, '어드민이 BANNER_SLOT_SPECS 를 안 읽는다 — 안내가 다시 문장으로 굳었다').toMatch(
      /BANNER_SLOT_SPECS\[/,
    )
    expect(s).toMatch(/BANNER_MAX_UPLOAD_MB/)
  })
})

describe('권장값이 실제 필요 해상도를 충족한다', () => {
  it('히어로 권장 원본이 DPR2 후보(base × 2) 이상이다', () => {
    const h = BANNER_SLOT_SPECS.hero
    expect(h.srcSetBase, '히어로엔 srcSetBase 가 있어야 한다').toBeTruthy()
    expect(h.requestWidth, 'requestWidth 는 base × 2(DPR2 후보)여야 한다').toBe(h.srcSetBase! * 2)
    expect(
      h.recommendedWidth,
      `권장 ${h.recommendedWidth}px 가 요청 폭 ${h.requestWidth}px 보다 작다 — 리사이저는 원본보다 크게 못 늘린다`,
    ).toBeGreaterThanOrEqual(h.requestWidth)
  })

  it('모든 자리에서 권장 원본 ≥ 요청 폭', () => {
    for (const slot of BANNER_SLOTS) {
      const s = BANNER_SLOT_SPECS[slot]
      expect(s.recommendedWidth, `${slot}: 권장이 요청 폭보다 작다`).toBeGreaterThanOrEqual(s.requestWidth)
      expect(s.recommendedHeight, `${slot}: 높이가 비었다`).toBeGreaterThan(0)
      expect(s.renderedNote.length, `${slot}: 실제 표시 설명이 비었다`).toBeGreaterThan(0)
    }
  })

  it('용량 안내가 "작게 줄여라"로 되돌아가지 않는다', () => {
    // 500KB 시절 조언이 화질을 망쳤다 — 리사이저가 변환하므로 원본은 커야 한다.
    expect(BANNER_MAX_UPLOAD_MB, '용량 상한이 1MB 미만이면 고해상 원본을 올릴 수 없다').toBeGreaterThanOrEqual(2)
  })
})

describe('사실과 다른 옛 안내가 되살아나지 않는다', () => {
  const stale: Array<[RegExp, string]> = [
    [/1600\s*×\s*500/, '옛 전면 배너 규격(1600×500) — 지금은 필요 폭이 2,074px 다'],
    [/500KB\s*이하/, '"500KB 이하" — 원본을 줄이면 오히려 흐려진다'],
    [/dots\s*클릭으로\s*전환/, '히어로는 첫 번째 하나만 쓴다 — 캐러셀이 없다'],
    [/그라디언트\s*\(?4종/, '사진이 없으면 홈 시드의 딜 사진을 쓴다 — 그라디언트가 아니다'],
    [/28:5|max-h\s*280px/, '옛 히어로 aspect — 지금은 우측 54% 영역이다'],
  ]
  it.each(stale)('어드민 화면에 %s 가 없다', (re, why) => {
    // ⚠️ 반드시 주석을 벗기고 본다. 처음엔 raw 로 검사했다가 **이 테스트를 설명하는 주석**이
    //    옛 문구를 인용한 것에 걸려 빨간불이 떴다(화면 문구가 아니라 주석이었다).
    //    이 레포가 반복해 겪은 "주석이 판정을 통과시킨다"의 정반대 방향이다.
    expect(code(read(ADMIN)), why).not.toMatch(re)
  })
})
