/**
 * 🎨 **몰 대표 색 대비 불변식** 〔2026-08-02 — 시안 적용 세션〕
 *
 * `branding.ts` 가 *"다크 짝은 취향이 아니라 규격이다 — 두 모드 모두 WCAG AA"* 라고
 * **선언만 해 놓고 강제하는 코드가 0** 이었다. 운영자가 자기 색을 고르는 구조(`MallBranding.color`)라
 * 옅은 색 하나면 몰 홈의 흰 글자가 통째로 안 보인다.
 *
 * ## 🔴 이 테스트가 실제로 결함을 잡았다
 * 만들면서 `MallHomePage` 의 **다크 모드가 2.24:1** 인 것이 드러났다 — 몰 색 면 위에 흰 글자를
 * 두 모드 공통으로 얹고 있었는데, 다크 짝(`#5FBF95`)은 **밝은 색**이라 흰 글자가 묻힌다.
 * 눈으로는 "초록 위 흰 글씨"라 멀쩡해 보이고, 단위 테스트도 색을 안 보니 아무도 못 잡는다.
 * ⇒ 화면은 다크에서 **잉크 글자**로 고쳤고, 그 규칙을 아래 R2 가 고정한다.
 *
 * ⚠️ **못 막는 것**: 이 파일은 *색 값*만 본다. 화면이 그 값을 실제로 어느 자리에 쓰는지는
 *   안 본다(R3 가 문자열로 얕게 볼 뿐이다). 최종 판정은 실기기다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import {
  MALL_COLOR_LIGHT, MALL_COLOR_DARK,
  MALL_ON_COLOR_LIGHT, MALL_ON_COLOR_DARK, MALL_CONTRAST_MIN,
  contrastRatio, validateMallColor,
} from '@/shared/mall/branding'

describe('🔴 R1 — 기본 몰 색은 흰 글자를 받칠 수 있다 (라이트)', () => {
  it(`${MALL_COLOR_LIGHT} vs 흰 글자 ≥ ${MALL_CONTRAST_MIN}:1`, () => {
    const r = contrastRatio(MALL_COLOR_LIGHT, MALL_ON_COLOR_LIGHT)!
    expect(r).toBeGreaterThanOrEqual(MALL_CONTRAST_MIN)
  })
})

describe('🔴 R2 — 다크 짝은 잉크 글자를 받친다 (흰 글자가 아니다)', () => {
  it(`${MALL_COLOR_DARK} vs 잉크 글자 ≥ ${MALL_CONTRAST_MIN}:1`, () => {
    expect(contrastRatio(MALL_COLOR_DARK, MALL_ON_COLOR_DARK)!).toBeGreaterThanOrEqual(MALL_CONTRAST_MIN)
  })

  it('🔴 그리고 흰 글자로는 **안 된다** — 이 사실이 화면 규칙의 근거다', () => {
    // 이 기대가 깨지면(다크 짝이 어두워지면) 화면의 dark:text-[#1A1719] 도 함께 재검토해야 한다.
    expect(contrastRatio(MALL_COLOR_DARK, MALL_ON_COLOR_LIGHT)!).toBeLessThan(MALL_CONTRAST_MIN)
  })
})

describe('🔴 R3 — 화면이 다크에서 잉크 글자를 쓴다', () => {
  const page = readCode('src/pages/MallHomePage.tsx')
  it('몰 색 면 위 글자가 `dark:text-[#1A1719]` 로 뒤집힌다', () => {
    // ⚠️ 얕은 검사다(문자열). 자리까지는 못 본다 — 위 파일 주석의 "못 막는 것" 참조.
    const fills = page.match(/backgroundColor: 'var\(--mall\)'/g) || []
    expect(fills.length, '몰 색 면이 사라졌다면 이 규칙을 다시 확인할 것').toBeGreaterThanOrEqual(2)
    expect(page).toMatch(/text-white dark:text-\[#1A1719\]/)
  })
})

describe('validateMallColor — 저장 전 게이트', () => {
  it('형식이 아니면 거절한다', () => {
    for (const bad of ['', 'green', '#FFF', '#12345', 'rgb(0,0,0)']) {
      expect(validateMallColor(bad).ok, bad).toBe(false)
    }
  })

  it('기본 색은 통과한다', () => {
    expect(validateMallColor(MALL_COLOR_LIGHT).ok).toBe(true)
    expect(validateMallColor('#1A1719').ok).toBe(true)
  })

  it('🔴 옅은 색은 거절한다 — 이게 이 함수의 존재 이유다', () => {
    for (const pale of ['#FFFF00', '#7FE3B0', '#CCCCCC', '#FFFFFF']) {
      const r = validateMallColor(pale)
      expect(r.ok, pale).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/흰 글자/)
    }
  })

  it('`#` 유무를 가리지 않는다', () => {
    expect(validateMallColor('2E7D5B').ok).toBe(true)
  })
})
