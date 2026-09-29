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

  /**
   * 🔁 2026-09-29 재조준(안 C) — **표시자가 띠·경계선에서 판으로 옮겨갔다.**
   * 안 C 는 모든 구역에 24px 제목을 주므로 *"제목이 붙은 구역이 파는 쪽"* 규칙이 성립하지 않는다.
   * 대신 판(흰 카드 + 파란 사용처리 줄)을 **파는 쪽에만** 둔다. 띠까지 남기면 표면 규칙 ②
   * (*"강조색 하나, 자리 셋"*)도 깨진다 — 이 구역의 파란 자리는 이미 셋이다.
   */
  it('🔵 판은 파는 쪽에만 있다 (표시자가 띠 → 판으로 옮겨갔다)', () => {
    expect(SELLER, '판매 구역에 판이 없다 — 표시자가 사라졌다').toContain('<div className={LIST_PLATE_CLS}>')
    for (const f of ['ShoppingGroup', 'EarningsGroup', 'SettingsGroup', 'RoleCtaGrid']) {
      const src = readCode(`src/pages/user-profile/${f}.tsx`)
      expect(src, `${f} 에 판이 생겼다 — 파는 쪽 표시가 무의미해진다`).not.toMatch(/shadow-lift/)
    }
  })

  it('🔴 옛 표시자(띠·경계선)가 되살아나지 않았다 — 둘이 되면 규칙 ②가 깨진다', () => {
    expect(SELLER).not.toMatch(/absolute[^"]*w-\[3px\][^"]*bg-brand/)
    expect(SELLER).not.toMatch(/h-px bg-black\/\[0\.08\]/)
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

  /**
   * 🔁 2026-09-29 — **이 검사는 뒤집혔다.** 대표가 코레일톡 전체메뉴를 보내며 안 C 를 고르면서
   * 09-28 의 '이름 E'(손님 구역엔 큰 제목을 두지 않는다)를 대체했다. 안 C 에서는 **모든 구역**이
   * 24px 제목으로 시작하고, 파는 쪽 표시는 판이 한다(위 검사).
   * ⚠️ 제목을 각자 손으로 적으면 크기가 다시 갈린다 — `SectionTitle` **한 부품**으로만.
   */
  it('🔵 모든 구역이 같은 부품으로 제목을 단다 (손으로 적지 않는다)', () => {
    for (const f of ['ShoppingGroup', 'EarningsGroup', 'SettingsGroup', 'RoleCtaGrid']) {
      const src = readCode(`src/pages/user-profile/${f}.tsx`)
      expect(src, `${f} 에 구역 제목이 없다`).toContain('<SectionTitle>')
      expect(src, `${f} 이 제목 크기를 손으로 적었다`).not.toMatch(/text-\[2[0-9]px\]/)
    }
    // 판매 구역만 예외다 — 제목 옆에 가게 전환 버튼이 붙어 한 줄을 이룬다.
    expect(SELLER).toMatch(/text-\[24px\][^"]*">내 가게<\/h2>/)
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

  /**
   * 🔁 2026-09-29 재조준(안 C): [오늘 | 사용처리] 가로 배치를 걷고 **같은 판 안에 세로로** 쌓았다.
   * "오늘이 머리" 라는 09-28 결정의 내용은 그대로다 — 오늘 숫자가 판의 첫 블록이다.
   */
  it('🔵 오늘 숫자가 판의 머리이고, 사용처리가 바로 다음이다', () => {
    const iPlate = SELLER.indexOf('<div className={LIST_PLATE_CLS}>')
    const iToday = SELLER.indexOf('오늘</span>')
    const iScan = SELLER.indexOf('이용권 사용처리')
    expect(iPlate, '판을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    expect(iToday).toBeGreaterThan(iPlate)
    expect(iScan, '사용처리가 오늘 숫자보다 앞이다').toBeGreaterThan(iToday)
  })

  it('🔴 숫자 한 줄이 페이지 맨 위에 있다 (2열 래퍼 밖)', () => {
    const iStats = PAGE.indexOf('<MyStats ')
    const iCols = PAGE.indexOf("'ur-account-cols ur-account-cols--split'")
    expect(iStats, 'MyStats 를 못 찾았다').toBeGreaterThan(-1)
    expect(iStats, '숫자 줄이 2열 안으로 들어갔다 — 한쪽 칸에만 뜬다').toBeLessThan(iCols)
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
  /**
   * 🔁 2026-09-29(안 C): 띠가 사라져 오프셋 결함이 성립하지 않는다. 그 자리에서 지킬 것은
   * **PC 숫자 카드 넷이 되살아나지 않는 것**이다 — 실측상 그중 셋이 0 이었고 우측 칸의 절반을 먹었다.
   */
  it('🔵 PC 우측 칸에 숫자 카드 넷이 되살아나지 않았다', () => {
    const pane = readCode('src/pages/user-profile/AccountPcPane.tsx')
    expect(pane, 'PC 가 숫자를 다시 큰 카드 넷으로 그린다').not.toMatch(/grid-cols-4/)
    expect(pane, 'PC 가 잔액을 또 조회한다 — 한 화면이 두 번 묻는다').not.toContain('/api/points/balance\'')
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
    // 🔁 2026-09-29(안 C): 사용처리 줄이 평면 행이 되며 문구가 짧아졌다("손님 QR").
    //   지킬 것은 문장 하나가 아니라 **규칙**이므로, 조사가 붙는 자리를 전수로 본다.
    expect(SELLER, 'QR 뒤 조사를 띄어 썼다').not.toMatch(/QR (을|이|로|은|과)\b/)
  })
})
