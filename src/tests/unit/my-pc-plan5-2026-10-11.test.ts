/**
 * 🖥️ **PC 마이 안 5** — "일 먼저 · 판은 파는 쪽에만" (2026-10-11 대표 확정 *"안 5로 진행하자"*)
 *
 * 대표: *"PC버전에서 보는 마이페이지 형태가 너무 옹졸해.. 전체적인 PC버전의 UI 변경도 필요해"*
 * → 시안 넷(안 2 2열 균형 / 안 3 3열 / 안 4 좌측 내비 / 안 5) 중 **안 5** 확정.
 *
 * ## 🔴 '옹졸함' 의 실체는 디자인이 아니라 **CSS 한 줄**이었다 (브라우저 실측)
 *
 * | | 고치기 전 | 고친 뒤 |
 * |---|---|---|
 * | 1440px 화면에서 본문 폭 | **644px** | 1136px |
 * | 양옆 빈 칸 | 약 800px | 304px(정상 여백) |
 *
 * `.ur-account-pc` 는 `max-width: 1200px; margin: 0 auto` 를 갖고 있었는데 **`width: 100%` 가 없었다.**
 * 부모(`UserProfilePage` 루트)가 `flex flex-col` 이라 가로축이 **교차축**이고, 교차축의 `auto` 마진은
 * `align-self: stretch` 를 **무력화한다**(Flexbox §8.1). 그러면 박스가 내용 폭으로 줄고 `max-width` 는
 * 영영 안 걸린다. 즉 1200px 는 **한 번도 쓰인 적이 없었다.**
 *
 * 🩸 이 레포는 **같은 함정을 이미 밟고 고쳤다** — `.ur-content-*` 의 2026-05-03 주석이 토씨까지 같은
 *   설명을 달고 `width: 100%` 를 명시한다. 이 블록만 그 짝을 빠뜨렸고, 에러가 안 나서 몇 달을 갔다.
 *
 * ## 이 시험이 **못 하는 것** (먼저 적는다)
 * jsdom 에는 레이아웃이 없어 **픽셀을 여기서 못 잰다.** 위 표는 브라우저 실측이고
 * (`node scripts/visual-preview.mjs --route=/user/profile --pc --dark --stores=1`), 여기서는
 * **그 실측이 성립하게 만든 조건이 되돌아가지 않는 것**만 지킨다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))

const CSS = read('src/index.css')
const PAGE = read('src/pages/UserProfilePage.tsx')
const BAND = read('src/pages/user-profile/AccountPcBand.tsx')
const PANE = read('src/pages/user-profile/AccountPcPane.tsx')
const STATS = read('src/pages/user-profile/MyStats.tsx')

/** `.ur-account-pc { … }` 선언 블록만 떼어 낸다(다른 규칙의 값에 걸리지 않게). */
function ruleBody(selector: string): string {
  const at = CSS.indexOf(`${selector} {`)
  expect(at, `${selector} 규칙을 못 찾았다 — 이 시험이 헛돌고 있다`).toBeGreaterThan(-1)
  return CSS.slice(at, CSS.indexOf('}', at))
}

describe('🔴 폭 — 1200px 가 실제로 걸린다', () => {
  it('`.ur-account-pc` 가 폭을 명시한다 (auto 마진이 stretch 를 무력화한다)', () => {
    const body = ruleBody('.ur-account-pc')
    expect(body, 'max-width 가 사라졌다 — 그러면 이 검사의 전제가 바뀐다').toContain('max-width: 1200px')
    expect(body, 'margin: 0 auto 가 사라졌다').toContain('margin: 0 auto')
    expect(body, '`width: 100%` 가 없다 — 세로 flex 안에서 박스가 내용 폭(실측 644px)으로 줄어든다')
      .toContain('width: 100%')
  })

  it('🔴 `align-self: stretch` 로 대신하지 않았다 — auto 마진이 그걸 이긴다', () => {
    // 고치는 방법이 둘처럼 보이지만 하나뿐이다. stretch 를 적어 두면 "고쳤다" 고 착각하게 된다.
    expect(ruleBody('.ur-account-pc')).not.toContain('align-self: stretch')
  })

  it('빵부스러기가 칸 **안**에 있다 (칸이 좁아져도 같은 왼쪽 끝에 선다)', () => {
    // 종전엔 칸 바깥에서 자기 1200px 를 따로 잡아, 비셀러 화면(820px)에서 홀로 왼쪽에 남았다.
    const iPane = PAGE.indexOf("'ur-account-pane min-w-0'")
    const iCrumb = PAGE.indexOf('내 계정</span>')
    const iCols = PAGE.indexOf("'ur-account-cols ur-account-cols--split'")
    expect(iPane, '칸을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    expect(iCrumb, '빵부스러기가 칸 밖으로 나갔다').toBeGreaterThan(iPane)
    expect(iCrumb, '빵부스러기가 본문 아래로 내려갔다').toBeLessThan(iCols)
    expect(PAGE, '빵부스러기가 자기 폭을 따로 잡는다 — 칸이 좁아지면 어긋난다')
      .not.toMatch(/hidden lg:block[^"]*max-w-\[1200px\]/)
  })

  it('🔴 `.ur-content-*` 의 짝이 그대로다 — 이 수리의 선례이자 근거다', () => {
    // 그쪽이 `width: 100%` 를 잃으면 같은 사고가 다른 표면에서 되살아난다.
    for (const sel of ['.ur-content-narrow', '.ur-content-medium', '.ur-content-wide']) {
      expect(ruleBody(sel), `${sel} 가 width: 100% 를 잃었다`).toContain('width: 100%')
    }
  })
})

describe('📐 두 열 — 왼쪽이 넓다 (안 5: 7:5)', () => {
  it('비율이 확정 시안 그대로이고, 균등이 아니다', () => {
    const body = ruleBody('.ur-account-cols--split')
    const m = body.match(/grid-template-columns:\s*([\d.]+)fr\s+([\d.]+)fr/)
    expect(m, '두 열 비율을 못 찾았다 — 이 검사가 헛돌고 있다').not.toBeNull()
    const [l, r] = [Number(m![1]), Number(m![2])]
    expect(l, '균등으로 쪼갰다 — 왼쪽 판매 목록의 설명이 먼저 잘린다').toBeGreaterThan(r)
    expect(l / r, '안 5 의 7:5 에서 벗어났다').toBeCloseTo(7 / 5, 2)
  })
})

describe('📖 한 칸일 때는 읽을 수 있는 폭까지만', () => {
  it('비셀러 칸에 상한이 걸린다 (1136px 짜리 평면 줄을 만들지 않는다)', () => {
    const body = ruleBody('.ur-account-pane--single')
    expect(body, '상한이 없다 — 줄이 1136px 가 돼 라벨과 값 사이가 1,000px 벌어진다')
      .toMatch(/max-width:\s*\d+px/)
    expect(body, '가운데 정렬이 빠졌다').toContain('margin-left: auto')
  })

  it('🔴 좁히는 조건과 두 열로 쪼개는 조건이 **글자 그대로 같다**', () => {
    // 갈리면 한쪽은 좁고 한쪽은 넓어져 띠·목록·푸터의 왼쪽 끝이 어긋난다.
    const COND = 'sellerSeats.stores.length > 0'
    const pane = PAGE.match(new RegExp(`className=\\{${COND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\? 'ur-account-pane`))
    expect(pane, '칸 좁히기가 좌석 수를 안 본다').not.toBeNull()
    expect(PAGE, '두 열 래퍼가 다른 조건을 쓴다')
      .toContain(`${COND} ? 'ur-account-cols ur-account-cols--split'`)
  })
})

describe('🎗️ 머리 띠 — 사람과 숫자가 한 줄', () => {
  it('PC 에서만 띠를 그리고, 폰은 종전 숫자 줄 그대로다', () => {
    expect(PAGE).toMatch(/\{isPc \? \(\s*<AccountPcBand/)
    expect(PAGE, '폰에서 숫자 한 줄이 사라졌다').toMatch(/\) : \(\s*<MyStats voucher=/)
  })

  it('🔢 숫자는 **같은 부품**이다 — 두 호출부가 같은 prop 을 넘긴다', () => {
    const props = (src: string) => {
      const at = src.indexOf('<MyStats ')
      expect(at, 'MyStats 호출을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
      const tag = src.slice(at, src.indexOf('/>', at))
      return [...tag.matchAll(/\b(voucher|gifticon|coupon)=\{([^}]+)\}/g)]
        .map(m => `${m[1]}=${m[2].replace(/^counts\./, '')}`)
        .sort()
    }
    const a = props(PAGE)
    const b = props(BAND)
    // 🔁 2026-10-18: 셋 → 둘(교환권 칸을 뺐다 — 폰·PC 같은 세 칸, 딜은 부품이 직접 읽는다).
    expect(a.length, '폰 호출부에서 prop 둘을 못 찾았다').toBe(2)
    expect(b, `PC 띠와 폰이 다른 값을 넘긴다: ${a.join(' ')} vs ${b.join(' ')}`).toEqual(a)
  })

  it('띠가 숫자를 손으로 그리거나 잔액을 또 조회하지 않는다', () => {
    expect(BAND).toContain('<MyStats inline')
    expect(BAND, '같은 화면이 잔액을 두 번 묻는다').not.toContain('/api/points/balance')
  })

  it('🔔 띠의 벨은 **시트**를 연다 — 알림 페이지로 떠나지 않는다 (같은 날 대표 지시)', () => {
    expect(BAND, "띠의 벨이 다시 페이지로 떠난다").not.toContain("navigate('/notifications')")
    expect(BAND).toContain('onClick={onBell}')
    expect(PAGE, '페이지가 띠에 시트 열기를 안 넘긴다').toContain('onBell={bell.open}')
  })

  /**
   * 🔁 **2026-10-14 재조준 — 대표 확정 PC 마이 B**(*"PC 마이는 B"*). 안 5 의 *"띠는 카드가 아니다"* 가
   *   **뒤집혔다**: B 는 머리를 포함해 모든 블록을 카드에 담고 같은 왼쪽 선을 쓴다(대표 *"정돈된 느낌이
   *   부족해"*). 불변식은 *"카드 모양은 한 곳(`ur-pc-card`)에서 온다"* 로 옮겨간다 — 손으로 적은
   *   `shadow-lift`/`rounded-2xl` 은 여전히 금지(한 칸만 다른 그림자가 되는 그 클래스).
   */
  it('🗂️ 띠는 카드다 — 모양은 공용 `ur-pc-card` 에서만 온다 (손으로 적지 않는다)', () => {
    expect(BAND, '머리가 카드가 아니다 — B 가 되돌아갔다').toMatch(/className="ur-pc-card /)
    expect(BAND, '카드 모양을 손으로 적었다 — 다른 블록과 갈린다').not.toMatch(/shadow-lift|rounded-2xl/)
    expect(BAND, '옛 hairline 띠가 남았다').not.toContain('border-b border-rule')
  })
})

describe('🧾 오른쪽 칸 — 판을 걷고 폰과 같은 목록을 쓴다', () => {
  it('PC 칸에서 프로필 카드와 타일이 사라졌다 (둘 다 판이었다)', () => {
    // 🔁 2026-10-14 B: 칸 자체가 카드(`ur-pc-card`)다 — 손으로 적은 그림자만 금지.
    expect(PANE, 'PC 칸 카드 모양을 손으로 적었다').not.toMatch(/shadow-lift/)
    expect(PANE, 'PC 칸이 카드가 아니다').toContain('className="ur-pc-card"')
    expect(PANE, '손으로 적은 타일 목록이 돌아왔다').not.toContain('const tiles = [')
  })

  it('🔴 PC 에서 갈 길이 없던 목적지 넷이 이제 닿는다', () => {
    // 종전 PC 타일은 셋(숙소·단골·찜)뿐이라 아래 넷은 **PC 에서 문이 아예 없었다.**
    const SHOP = read('src/pages/user-profile/ShoppingGroup.tsx')
    for (const p of ['/my-coupons', '/mypage/addresses', '/my-reviews']) {
      expect(SHOP, `${p} 이 공용 목록에서 빠졌다 — PC 가 다시 그 문을 잃는다`).toContain(`path: '${p}'`)
    }
    // 🧾 2026-10-20: 주문 내역은 줄이 아니라 같은 부품의 구역 제목 링크('결제 내역 ›')다 — 문은 그대로 PC 에도 있다.
    expect(SHOP, '/my-orders 로 가는 문이 공용 목록에서 빠졌다').toMatch(/onClick: \(\) => navigate\('\/my-orders'\)/)
    /**
     * 🩸 **첫 판이 헛돌았다 — 주입 러너가 잡았다.** 아래 `toContain` 과 위치 검사만 있었는데,
     *   `{!isPc && <ShoppingGroup counts={counts} />}` 로 바꾸는 주입에 **둘 다 통과**했다:
     *   문자열은 중괄호 **안에 그대로 남고** 위치도 안 변하기 때문이다. 즉 "PC 가 이 목록을
     *   잃는다" 는 결함을 **하나도 못 보고 있었다.**
     * ⇒ 조건으로 감싸는 것 자체를 본다 — 줄머리에서 **조건 없이** 렌더돼야 한다.
     */
    expect(PAGE, 'ShoppingGroup 이 조건으로 감싸였다 — 한쪽 기기가 손님 목록을 통째로 잃는다')
      .toMatch(/\n {6}<ShoppingGroup counts=\{counts\} \/>/)
    // 🔁 2026-10-19: 이용권 현황 바를 걷어 `statusBar` prop 이 사라졌다. 목록은 여전히 조건 없이 두 기기 모두에 선다.
  })
})

describe('⚙️ 설정 — 한 벌을 자리만 바꿔 건다', () => {
  it('정의가 하나다 (복붙하면 반드시 갈린다)', () => {
    expect(PAGE.match(/<SettingsGroup>/g) ?? [], '설정 블록이 두 벌이 됐다').toHaveLength(1)
    expect(PAGE).toContain('const settingsBlock = (')
  })

  it('두 열일 때만 왼쪽, 아니면 종전 자리 — 둘 다 걸려 있다', () => {
    expect(PAGE, '왼쪽 자리가 없다').toContain('{pcSplit ? settingsBlock : null}')
    expect(PAGE, '종전 자리가 없다 — 폰에서 설정이 통째로 사라진다').toContain('{pcSplit ? null : settingsBlock}')
  })

  it('🔴 `pcSplit` 가 좌석 수를 본다 — `isPc` 만이면 설정이 본문보다 먼저 그려진다', () => {
    // 좌석 0곳이면 `ur-account-cols` 는 평범한 블록이라 두 칸이 그냥 세로로 이어진다.
    expect(PAGE).toMatch(/const pcSplit = isPc && sellerSeats\.stores\.length > 0/)
  })

  it('🔴 그 짝인 CSS 조건이 그대로다 — 한쪽만 바뀌면 조용히 어긋난다', () => {
    expect(PAGE, '두 열 래퍼의 조건이 좌석 수에서 바뀌었다')
      .toContain("sellerSeats.stores.length > 0 ? 'ur-account-cols ur-account-cols--split'")
  })
})

describe('📱 폰은 한 글자도 안 바뀐다', () => {
  it('🔴 390px 에서 확정된 칸 여백이 그대로다 (띠 모드가 그 값을 안 건드렸다)', () => {
    // 2026-09-30 실측값. 띠 모드는 **다른 분기**로 가고 이 문자열은 그대로 남아야 한다.
    expect(STATS).toContain("'flex-1 min-w-0 px-3 first:pl-4 last:pr-4'")
  })

  it('🔴 띠 모드와 폰 모드가 `flex-1` / `flex-none` 을 한 문자열에 섞지 않는다', () => {
    // 섞으면 어느 쪽이 이기는지는 클래스 순서가 아니라 **생성된 CSS 순서**가 정한다 — 조용히 뒤집힌다.
    const m = STATS.match(/const box = compact\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/)
    expect(m, '칸 폭 분기를 못 찾았다 — 이 검사가 헛돌고 있다').not.toBeNull()
    expect(m![1], '띠 모드 칸에 flex-1 이 섞였다').not.toContain('flex-1')
    expect(m![2], '폰 칸에 shrink-0 이 섞였다').not.toContain('shrink-0')
  })

  it('🔴 줄 밖 안내문은 폰에서만 — 띠에서는 값 아래 한 줄이다', () => {
    // 🔁 2026-10-12 재조준: 띠 모드가 칸 옆에 **환급 신청 버튼**을 함께 돌려준다(칸은 링크라 그 안에
    //   버튼을 못 넣는다). 불변식은 그대로 — 띠는 **줄 밖 안내문 없이** 일찍 돌아간다.
    const at = STATS.indexOf('if (inline) return (')
    expect(at, '띠 모드가 일찍 돌아가지 않는다 — 줄 밖 안내문까지 그려 띠가 두 줄이 된다').toBeGreaterThan(-1)
    const early = STATS.slice(at, STATS.indexOf('\n  )\n', at))
    expect(early, '띠 안에 줄 밖 안내문이 들어갔다').not.toContain('showNote')
    expect(STATS).toContain('무상 리워드 {formatNumber(freeBalance)}딜 포함')
  })
})

describe('🧪 이 시험이 헛돌지 않는다', () => {
  it('대상이 실제로 읽혔다', () => {
    expect(CSS.length).toBeGreaterThan(20000)
    expect(PAGE.length).toBeGreaterThan(5000)
    expect(BAND.length).toBeGreaterThan(1000)
    expect(PANE.length).toBeGreaterThan(1000)
    expect(STATS.length).toBeGreaterThan(2000)
  })
})
