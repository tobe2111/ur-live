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
    // 🔁 2026-09-28 재조준: 25 → 24px(여섯 단계 스케일 · 4의 배수). 불변식은 *본문 라벨(12·13·15)과
    //   확실히 구별되는 큰 제목* 이고 25 라는 값이 아니다 — 24 는 그 아래 단계(17)와도 한참 벌어진다.
    expect(SELLER).toMatch(/text-\[24px\][^"]*">내 가게<\/h2>/)
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

/**
 * 🩸 2026-09-28 — **하네스로 눈으로 보고서야 드러난 것 둘.** 코드만 읽어선 안 보였다.
 *   (`node scripts/visual-preview.mjs --route=/user/profile --auth=user --stores=2 --width=1200`)
 *
 * ⚠️ 이 시험들이 **못 막는 것**: 여기서 재는 건 *클래스 문자열*이지 실제 픽셀이 아니다.
 *   jsdom 에는 레이아웃이 없어 "띠가 카드를 덮는가" 를 단위시험으로는 판정할 수 없다.
 *   조판을 바꿀 때는 위 명령으로 **그림을 볼 것**. 이 시험은 *알려진 답으로 되돌아가는 것*만 막는다.
 */
describe('조판 — 하네스 실측으로 잡은 두 결함', () => {
  it('🔴 PC 에서 구역 띠는 **음수** 오프셋이다 (양수면 카드를 관통한다)', () => {
    // 마이의 PC 우측 칸은 `.ur-account-pane .ur-content-medium` 이 좌우 패딩을 0 으로 지운다
    // (index.css — "마이페이지 PC 2단"). 거터가 없으니 `lg:left-3` 은 카드 **안쪽** 12px 이고,
    // 띠가 일감 카드들의 왼쪽을 세로로 갈랐다. 음수여야 `.ur-account-pc` 의 **좌우 패딩(2rem)** 안에 뜬다.
    // 🔁 2026-09-28: 근거가 gap(32px, 내비와 칸 사이) → 패딩으로 바뀌었다 — 내비를 걷어냈다.
    //   값(-12px)은 그대로 맞고, 짝인 CSS 규칙(아래 시험)도 그대로다.
    expect(SELLER).toContain('left-1.5 lg:-left-3')
    expect(SELLER).not.toMatch(/left-1\.5 lg:left-\d/)
  })

  it('🔴 그 짝인 CSS 가 아직 패딩을 지우고 있다 (지워졌다면 띠 오프셋도 다시 판단할 것)', () => {
    // 위 음수 값의 **근거**는 이 규칙이다. 규칙이 사라지면 음수는 근거를 잃는다 —
    // 한쪽만 바뀌면 조용히 어긋나는 짝이라 여기서 함께 잠근다.
    const css = readCode('src/index.css')
    expect(css).toMatch(/\.ur-account-pane \.ur-content-medium \{[^}]*padding-left: 0/s)
  })

  it('🔴 가게 개수는 말줄임에 안 먹힌다 — 이름과 다른 span 이다', () => {
    // 한 span 에 붙여 두면 긴 이름에서 `… 본점 · …` 처럼 **개수부터** 잘린다.
    // 그런데 이 줄이 눌리는 이유가 그 개수다(2곳 이상일 때만 전환 버튼).
    expect(SELLER).toContain('<span className="truncate">{store.name}</span>')
    expect(SELLER).toContain('<span className="shrink-0">· {stores.length}곳</span>')
    expect(SELLER).not.toContain('{store.name} · {stores.length}곳')
  })

  it('라틴 약어 뒤 조사는 붙여 쓴다', () => {
    expect(SELLER).toContain('손님 QR을 찍으세요')
  })
})
