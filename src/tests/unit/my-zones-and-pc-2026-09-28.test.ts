/**
 * 🧭 **구역 이름 E + PC 1안** (2026-09-28 대표 확정 — "이름 e", "끝까지 해줘")
 *
 * ## 이름 E 가 하는 일
 * 후보 다섯 중 E 는 **2구역(손님)의 큰 제목을 없애는 것**이다. 대칭 이름(파는 쪽/사는 쪽 …)을 찾으려니
 * 두 문제가 생겼었다 — ① "내 쇼핑" 은 그 구역의 절반(소개 수익)을 설명 못 한다 ② 일반 유저에겐
 * 1구역이 없어 2구역 이름이 **혼자 서야** 한다. 덮지 않으면 둘 다 사라진다.
 * ⇒ 읽는 규칙은 하나다: **제목이 붙은 구역이 파는 쪽.**
 *
 * ## 🔴 이 파일이 로케일까지 보는 이유
 * 라벨은 `t(key, { defaultValue })` 라 **코드만 고치면 화면은 안 바뀐다** — `public/locales/ko` 값이
 * 이긴다(CLAUDE.md 가 명시한 함정, 2026-09-01 결제 문구에서 실제로 밟았다). 코드와 ko 로케일을
 * **같이** 고정한다.
 *
 * ⚠️ **못 보는 것**: 실제 렌더 결과(jsdom 엔 레이아웃이 없다). 25px 제목이 두 줄로 접히는지,
 * PC 히어로가 1200px 에서 정말 한 줄인지는 **브라우저 프레임 캡처**가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { readCode } from '../helpers/source-text'

const SELLER = readCode('src/pages/user-profile/SellerSection.tsx')
const PAGE = readCode('src/pages/UserProfilePage.tsx')
const ko = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))

describe('이름 E — 제목이 붙은 구역이 파는 쪽', () => {
  it('판매 구역에 25px 구역 제목이 있다 (본문 라벨과 구별돼야 규칙이 선다)', () => {
    expect(SELLER).toMatch(/text-\[25px\][^"]*">내 가게<\/h2>/)
  })

  it('판매 구역에만 브랜드 띠가 있다 (구역 전체 길이)', () => {
    expect(SELLER).toMatch(/absolute[^"]*w-\[3px\][^"]*bg-brand/)
  })

  it('판매 구역 끝에 경계선이 있다 — 그 아래가 손님 쪽', () => {
    expect(SELLER).toMatch(/h-px bg-black\/\[0\.08\]/)
  })

  it('🔴 경계선은 **이 컴포넌트 안**에 있다 (좌석 0 이면 섹션째 사라진다)', () => {
    // 페이지가 `stores.length` 로 따로 판정해 그리면 "위에 아무것도 없는 선" 이 뜨는 날이 온다.
    expect(PAGE).not.toMatch(/h-px bg-black\/\[0\.08\]/)
  })
})

describe('구역 2 — 큰 제목 없이 그룹 라벨 셋', () => {
  const cases: [string, string, string][] = [
    ['src/pages/user-profile/ShoppingGroup.tsx', 'shopping.sectionTitle', '내가 산 것'],
    ['src/pages/user-profile/EarningsGroup.tsx', 'my.earningsGroupTitle', '내가 소개한 것'],
    ['src/pages/user-profile/SettingsGroup.tsx', 'my.settingsGroupTitle', '설정 · 계정'],
  ]
  for (const [file, key, label] of cases) {
    it(`${label} — 코드의 defaultValue 와 ko 로케일이 **둘 다** 그 값이다`, () => {
      expect(readCode(file)).toContain(`defaultValue: '${label}'`)
      const [a, b] = key.split('.')
      expect(ko[a]?.[b]).toBe(label) // 로케일이 코드를 이긴다 — 여기가 진짜 화면 값이다
    })
  }

  it('🔴 2구역에는 큰 제목이 없다 (E 의 핵심 — 덮는 단어를 만들지 않는다)', () => {
    // 손님 쪽 블록 어디에도 25px 급 제목이 새로 생기면 E 가 깨진다.
    for (const f of ['ShoppingGroup', 'EarningsGroup', 'SettingsGroup']) {
      expect(readCode(`src/pages/user-profile/${f}.tsx`)).not.toMatch(/text-\[2[0-9]px\]/)
    }
  })
})

describe('PC 1안 — 오늘이 머리', () => {
  it('PC 칸에서 판매가 프로필 카드보다 **먼저** 그려진다', () => {
    const iSell = PAGE.indexOf('<SellerSection state={sellerSeats} />')
    const iPane = PAGE.indexOf('<AccountPcPane')
    expect(iSell).toBeGreaterThan(-1)
    expect(iPane).toBeGreaterThan(-1)
    expect(iSell).toBeLessThan(iPane)
  })

  it('🔴 프로필 카드를 지우지 않았다 — 09-28 "PC가 심플하다" 가 바로 그 실수였다', () => {
    expect(PAGE).toContain('<AccountPcPane')
  })

  it('lg+ 에서 [오늘 카드 | 사용처리] 가 한 줄이다', () => {
    expect(SELLER).toContain('lg:flex lg:items-stretch lg:gap-3')
    expect(SELLER).toMatch(/lg:mt-0 lg:w-\[290px\]/)
  })

  it('🔴 폰은 안 건드렸다 — 가로 배치는 `lg:` 접두사에만 걸려 있다', () => {
    // `flex` 가 접두사 없이 붙으면 폰에서도 옆으로 눕는다(30px 숫자 + 버튼이 한 줄에 끼인다).
    expect(SELLER).not.toMatch(/className="flex items-stretch gap-3"/)
  })

  it('🔴 이 시험이 헛돌지 않는다 — 대상이 실제로 읽혔다', () => {
    expect(SELLER.length).toBeGreaterThan(8000)
    expect(PAGE.length).toBeGreaterThan(5000)
  })
})
