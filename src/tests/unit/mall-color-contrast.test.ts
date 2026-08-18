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
  contrastRatio, validateMallColor, deriveMallColorDark, resolveMallBranding,
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

describe('🔴 R4 — 게이트가 **실제로 배선돼 있다**', () => {
  // 순수함수만 있고 아무도 안 부르면 아무것도 못 막는다 — 이 레포가 반복해 만난 클래스
  // (`check-guard-registry`: *"가드가 있는데 안 돎"*).
  const route = readCode('src/features/supply/api/wholesale-malls-admin.routes.ts')

  it('몰 생성 경로가 부른다', () => {
    expect(route).toContain('validateMallColor')
  })

  it('🔴 수정 경로도 부른다 — 한쪽만 막으면 수정으로 우회된다', () => {
    // `brand_color` 를 쓰는 블록 안에서 호출돼야 한다(파일 어딘가에 있는 것으로는 부족).
    const i = route.indexOf("'brand_color' in body")
    expect(i, 'brand_color 수정 블록을 못 찾았다').toBeGreaterThan(-1)
    expect(route.slice(i, i + 400)).toContain('validateMallColor')
  })

  it('어드민 폼이 제출 전에 보여준다', () => {
    expect(readCode('src/pages/admin/AdminWholesaleMallsPage.tsx')).toContain('validateMallColor')
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

/**
 * 🌗 **다크 짝 파생 — 색상 공간 전체를 쓸어 본다** (2026-08-12)
 *
 * 주석이 *"임의 파생이 AA 를 깨면 확정을 어긴다"* 고 파생을 미뤄 뒀었다. 맞는 경계였지만,
 * 그건 파생 금지가 아니라 **증명하며 파생하라**는 뜻이다. 여기서 그 증명을 한다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 화면에서 그 색이 *예쁜지*. 여기서 고정하는 것은
 *   "잉크 글자가 읽히는가" 하나뿐이다(규격).
 */
describe('deriveMallColorDark — 다크에서도 글자가 읽힌다', () => {
  const sweep: string[] = []
  for (let h = 0; h < 360; h += 15) {
    // HSL→RGB 를 쓰지 않고 채도·명도 조합을 직접 만든다(의존 없이 넓게 쓸기).
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const a = 0.5 * Math.min(0.4, 1)     // s=0.4 고정 대역
      return Math.round(255 * (0.45 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
    }
    sweep.push(`#${[f(0), f(8), f(4)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`)
  }
  const extremes = ['#000000', '#000080', '#2E7D5B', '#7A1F1F', '#FFFFFF', '#FFE082', '#123456']

  it('🔴 파생색은 예외 없이 잉크 글자 대비 AA 를 만족한다', () => {
    for (const c of [...sweep, ...extremes]) {
      const dark = deriveMallColorDark(c)
      const ratio = contrastRatio(dark, MALL_ON_COLOR_DARK)
      expect(ratio, `${c} → ${dark}`).not.toBeNull()
      expect(ratio as number, `${c} → ${dark} 대비 ${(ratio as number).toFixed(2)}`).toBeGreaterThanOrEqual(MALL_CONTRAST_MIN)
    }
  })

  it('형식이 틀리면 추측하지 않고 기본값', () => {
    for (const bad of ['', '   ', 'red', '#12345', null, undefined]) {
      expect(deriveMallColorDark(bad as string)).toBe(MALL_COLOR_DARK)
    }
  })

  it('결과는 결정적이다 — 같은 입력이면 같은 색', () => {
    expect(deriveMallColorDark('#2E7D5B')).toBe(deriveMallColorDark('#2E7D5B'))
  })

  it('🔴 저장 가능한 색(라이트 AA 통과)은 다크에서도 **운영자 색 계열**로 남는다', () => {
    // 규격 때문에 매번 기본 딥그린으로 물러나면 "색 승계"라는 말이 무의미해진다.
    const ok = ['#2E7D5B', '#7A1F1F', '#123456', '#3B4A6B']
    for (const c of ok) {
      expect(validateMallColor(c).ok, `${c} 는 저장 가능해야 이 검사가 의미 있다`).toBe(true)
      expect(deriveMallColorDark(c), `${c} 가 기본값으로 물러났다`).not.toBe(MALL_COLOR_DARK)
    }
  })

  it('resolveMallBranding 이 그 파생을 실제로 쓴다 — 함수만 있고 안 쓰면 소용없다', () => {
    const r = resolveMallBranding({ name: '방배마트', color: '#7A1F1F' })
    expect(r.colorDark).toBe(deriveMallColorDark('#7A1F1F'))
    expect(r.colorDark).not.toBe(MALL_COLOR_DARK)
    // 색 미지정이면 종전대로 기본 짝
    expect(resolveMallBranding({ name: '방배마트' }).colorDark).toBe(MALL_COLOR_DARK)
  })
})
