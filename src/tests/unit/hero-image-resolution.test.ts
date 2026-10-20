/**
 * 🔍 홈 히어로 이미지 해상도 (2026-08-22 대표 "이미지 화질이 깨지는 문제")
 *
 * 히어로는 PC 에서 **1,037px 폭**으로 그려진다. 레티나(DPR 2)면 2,074px 이 필요한데
 * `width: 900` **한 장만** 요청하고 있었다 → 실효 0.43배. 눈에 띄게 흐렸다.
 *
 * ⚠️ 리사이저는 정상이었다(요청한 폭 그대로 준다 — width=1200 → 1080×607 실측).
 *    **우리가 작게 요청한 것**이 원인이라 quality 를 올려도 안 고쳐진다.
 *
 * ## 🩸 화질을 잴 때 `naturalWidth` 를 그대로 믿지 말 것
 *
 * 이 조사에서 카드도 흐린 줄 알고 두 번 잘못 보고했다. 페이지 안 `<img>.naturalWidth` 가
 * 400 이었는데, **같은 URL 을 독립 `new Image()` 로 로드하면 800×449** 였다 — Chrome 이
 * AVIF 를 메모리 절약을 위해 **축소 디코드**한 값이었다. 카드는 처음부터 정상이었다.
 *   ⇒ 판정은 반드시 `currentSrc` 를 **독립 로드**해서 재라(측정 스크립트는 인계 문서에).
 *
 * 이 테스트가 **못 막는 것**: 실제 픽셀·표시 폭. 레이아웃이 바뀌면 다시 브라우저로 재야 한다.
 * 여기서 고정하는 것은 "DPR 후보를 주는가"라는 **배선**뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'
import { HOME_HERO_REQUEST_WIDTH } from '@/shared/home-hero-image'

const HERO = 'src/components/home/HomeHeroDefault.tsx'
const read = () => readFileSync(HERO, 'utf-8')
/** 주석 제거 — 설명 주석이 판정을 통과시키는 함정(오늘 실제로 겪었다). */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('히어로가 레티나에서 흐리지 않다', () => {
  it('DPR 후보(srcSet)를 준다 — 단일 폭이면 레티나에서 반드시 부족하다', () => {
    const s = code(read())
    expect(s, 'srcSet 이 사라졌다 — 레티나에서 다시 0.43배로 흐려진다').toMatch(/srcSet=\{cfSrcSet\(photoSrc/)
    // base 는 **표시 폭(1,037px) 이상**이어야 DPR2 후보(2x)가 필요 해상도를 채운다.
    // ⚠️ `cfSrcSet` 은 x-디스크립터(1x/2x/3x)를 낸다 — 그래서 `sizes` 는 브라우저가 **무시**한다.
    //    (처음엔 sizes 를 요구했는데, 무의미한 속성을 강제하는 검사였다.)
    // 🔁 2026-08-23: base 가 리터럴에서 `BANNER_SLOT_SPECS` 로 옮겨졌다(어드민 안내와 같은 값을
    //    쓰게 하려고). 그때 이 검사가 리터럴을 찾다 빨간불이 떴다 — 가드가 제 역할을 한 것이다.
    //    이제 값은 상수에서 읽고, 배선(그 상수를 실제로 쓰는지)만 파일에서 본다.
    expect(s, 'base 를 상수에서 읽지 않는다 — 어드민 권장 규격과 갈린다').toMatch(
      /cfSrcSet\(photoSrc,\s*BANNER_SLOT_SPECS\.hero\.srcSetBase/,
    )
    expect(
      BANNER_SLOT_SPECS.hero.srcSetBase,
      'base 가 표시 폭(1,037px)보다 작다 — 2x 후보가 레티나에 부족해진다',
    ).toBeGreaterThanOrEqual(1024)
  })

  it('기본 src 도 표시 폭 이상이다 (srcSet 미지원 폴백)', () => {
    // ⚠️ 2026-08-29: 폭·품질이 **리터럴에서 상수로** 빠졌다 — 워커 preload 가 같은 값을 써야
    //   byte-일치하기 때문이다(`shared/home-hero-image`). 그래서 여기서도 상수를 본다.
    const s = code(read())
    expect(s, 'cfImage 호출이 사라졌다').toMatch(/cfImage\(photoSrc,\s*\{\s*width:\s*HOME_HERO_REQUEST_WIDTH/)
    // PC 표시 1,037px — 폴백이라도 그보다 작으면 안 된다.
    expect(HOME_HERO_REQUEST_WIDTH, 'src 폭이 표시 폭(1,037px)보다 작다').toBeGreaterThanOrEqual(1037)
  })

  it('quality 를 화질이 무너질 만큼 낮추지 않는다', () => {
    const s = code(read())
    const m = s.match(/cfImage\(photoSrc,\s*\{[^}]*quality:\s*(\d+)/)
    if (m) expect(Number(m[1]), 'quality 가 너무 낮다 — 해상도를 올려도 뭉개진다').toBeGreaterThanOrEqual(70)
  })
})
