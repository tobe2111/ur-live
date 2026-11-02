/**
 * 🎟️ 이용권 상세 D안 (2026-10-11 대표 확정)
 *
 * 대표: *"더 세련되고 심플해져야 해. 지금은 부연설명도 많고 그래."* → 시안 C·D·E 중
 * *"D안으로 진행해주더라도, C안의 이용안내 형태를 따르기. 하지만 이용안내 부분의 디자인도 더 고도화가 필요."*
 *
 * ## 지키는 것
 * ① 걷어낸 부연설명이 돌아오지 않는다("결제 즉시 교환권 발급" · "발급 후 사용 기간 적용")
 * ② 모바일 섹션은 같은 상수 `PASS_CARD`(2026-10-25 E안 — 폭 전체 흰 섹션 + 8px 띠, PC 는 카드)
 * ③ 바는 [가격][구매하기], 결제는 **구매 창 안**에서만 — 바에서 바로 결제로 새지 않는다
 * ④ 이용 안내는 늘 펼친 STEP 타일 3장
 *
 * ## 못 막는 것
 * - 카드가 보기 좋은지 · 겹치는 머리 카드가 사진을 얼마나 가리는지 → 그려서 본다
 *   (`node scripts/visual-preview.mjs --route=/pass/9000 --deals --height=2600`).
 * - 구매 창이 실제로 열리고 결제까지 가는지 → staging 결제(잠금 audit log 참조).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/GroupBuyDetailPage.tsx')
const BAR = readCode('src/pages/group-buy/DealBottomBar.tsx')
const USAGE = readCode('src/pages/group-buy/UsageGuide.tsx')
const HOWTO = readCode('src/pages/group-buy/RedeemHowTo.tsx')
const HEAD = readCode('src/pages/group-buy/PassHeadCard.tsx')

describe('① 부연설명이 돌아오지 않는다', () => {
  it('"결제 즉시 교환권 발급" — 용어도 틀렸고(이용권) 정보도 없다', () => {
    expect(PAGE + HEAD).not.toContain('결제 즉시 교환권 발급')
  })
  it('"발급 후 사용 기간 적용" — 유효기간이 없을 때의 빈 폴백', () => {
    expect(USAGE).not.toContain('발급 후 사용 기간 적용')
    expect(USAGE, '유효기간은 값이 있을 때만 말한다').toMatch(/\{expiry && \(/)
  })
  it('모바일 셀러 카드는 걷었다 — 가게로 가는 입구는 매장 카드 머리에 있다', () => {
    expect(PAGE).toContain('<div className={`hidden lg:block ${PASS_CARD}`}><SellerCard')
    expect(PAGE).toMatch(/<StoreLocation onProfile=\{goStore\}/)
    expect(readCode('src/pages/group-buy/StoreLocation.tsx')).toContain('가게 보기')
  })
})

describe('② 모바일 섹션은 같은 카드 상수를 쓴다', () => {
  it('정보·소개·메뉴·매장·리뷰·다른 이용권 — 6곳', () => {
    expect((PAGE.match(/PASS_CARD/g) || []).length - 1, 'import 1줄을 뺀 사용처').toBeGreaterThanOrEqual(6)
  })
  it('배경색 하나 — 폰·PC 모두 같은 색 위 가는 선(대표 2026-10-31 "배경색 하나로 통일하자")', () => {
    const src = readCode('src/shared/pass-head.ts')
    const cls = /PASS_CARD = '([^']+)'/.exec(src)![1].split(/\s+/)
    for (const t of ['border-t', 'border-rule']) expect(cls, `섹션 구분선이 사라졌다(${t})`).toContain(t)
    // 2026-10-25 E안의 회색 띠 · PC 그림자 카드는 이 결정이 대체했다 — 되살아나면 바탕이 두 색이 된다.
    for (const t of ['border-t-8', 'border-gray-100', 'lg:shadow-lift', 'lg:rounded-2xl']) expect(cls, `두 톤으로 돌아갔다(${t})`).not.toContain(t)
    expect(/PASS_PAGE_BG = '([^']+)'/.exec(src)![1], '페이지 바탕이 카드색과 갈렸다').toBe('bg-[var(--gbd-card)]')
  })

  /**
   * 🔁 2026-10-12 대표 확정 **C안** — *"왜 사진을 가리고 있고, 더 투박해졌지?"*
   *
   * D안(2026-10-11)의 머리 카드는 `-mt-7` 로 **사진을 28px 덮는 판**이었다. 라이브 실측으로 확인:
   * 히어로 `[0,0,390,260]` ↔ 카드 위끝 `232`. 히어로 크롭이 `gravity=auto` 라 피사체가 아래쪽에
   * 앉으면 **그 피사체가 가려진다**(대표 스크린샷의 돈가스 접시가 정확히 그 자리였다).
   * 시안 A(현재)·B(안 가림)·C(판까지 없앤 평면) 중 **C**.
   *
   * ⚠️ 이 시험이 **못 막는 것**: 보기 좋은지는 그려서 봐야 한다(jsdom 에 레이아웃이 없다).
   *   여기서는 **겹침을 만드는 클래스가 없는지**와 **판을 만드는 클래스가 없는지**만 본다.
   */
  it('C안 — 머리는 사진을 덮지 않고, 판(배경·그림자)이 없다', () => {
    const src = readCode('src/shared/pass-head.ts')
    const card = (src.match(/card:\s*'([^']+)'/) || [])[1] || ''
    expect(card, "PASS_HEAD.card 를 못 찾았다 — 이 검사가 헛돈다").not.toBe('')
    expect(card, '음수 위 여백이 돌아왔다 = 사진을 다시 덮는다(대표 지적 "왜 사진을 가리고 있고")').not.toMatch(/-mt-/)
    expect(card, '머리에 판이 돌아왔다(배경) — C안은 평면이다').not.toContain('bg-[var(--gbd-card)]')
    expect(card, '머리에 판이 돌아왔다(그림자) — C안은 평면이다').not.toContain('shadow-lift')
    // 평면이어도 좌우는 페이지 거터(16px)와 맞아야 한다 — mx-3(12) + px-1(4)
    expect(card, '좌우 여백이 페이지 거터와 어긋난다').toContain('mx-3')
    expect(card, '좌우 여백이 페이지 거터와 어긋난다').toContain('px-1')
  })

  it("C안 — '1장당 N원 아껴요' 상자가 돌아오지 않았다 (같은 말을 세 번 한다)", () => {
    const head = readCode('src/pages/group-buy/PassHeadCard.tsx')
    expect(
      head,
      "'아껴요' 틴트 상자가 돌아왔다. 바로 윗줄의 `48%` 와 정가 취소선이 이미 같은 말을 하고,\n" +
        '   그 상자는 판 안의 또 다른 상자라 🎫 규칙 ①(카드 테두리 0)·⑥(색깔 정보상자 0)에도 걸린다.\n' +
        '   2026-10-12 실측: 그 화면 하나에 가격이 여섯 번 나왔다.',
    ).not.toContain('아껴요')
    // 할인율·판매가·정가 한 줄은 남아 있어야 한다(지운 것은 상자이지 가격이 아니다)
    // 🔁 2026-10-25 E안: 옵션 카드를 걷어 가격은 머리 한 곳 — 취소선도 거기서 본다.
    expect(head, '정가 취소선이 사라졌다 — 할인폭을 말할 방법이 없어진다').toMatch(/line-through|ur-strike/) // 2026-11-02: 그어지는 취소선(.ur-strike) 허용
  })
})

describe('③ 결제는 구매 창 안에서만', () => {
  it('바의 버튼은 창을 연다 — 바로 결제하지 않는다(사전 응모만 예외)', () => {
    const sheetAt = BAR.indexOf('aria-label="구매 옵션"')
    expect(sheetAt).toBeGreaterThan(0)
    const bar = BAR.slice(0, sheetAt)
    // 2026-10-26: 추첨 여부를 모르는 틈엔 열지 않는다(`fcfs.pending`) — 여는 것 자체는 그대로.
    expect(bar).toMatch(/\(\) => \{ if \(!fcfs\.pending\) setOpen\(true\) \}/)
    expect(bar, '바에서 onJoin 을 바로 부른다 — 수량을 못 고르고 결제된다').not.toMatch(/onJoin\(/)
  })
  it('창 안 결제 버튼이 종전과 같은 onJoin 을 부르고, 딜 대체·담기도 창 안에 있다', () => {
    const sheet = BAR.slice(BAR.indexOf('aria-label="구매 옵션"'))
    expect(sheet).toContain('onClick={() => onJoin()}')
    expect(sheet).toContain('<DealPayButton')
    expect(sheet).toContain('<AddToCartButton')
  })
  it('창은 시트 z-index SSOT 를 쓴다 — 하단 네비(9999)·바(10002) 위', () => {
    expect(BAR).toContain('Z.SHEET_BACKDROP')
    expect(BAR).toContain('Z.SHEET_BODY')
  })
})

describe('④ 이용 안내 — 세로 타임라인 (대표 시안 6종 중 "1번", 2026-10-11)', () => {
  it('세 단계 + 예외는 2단계(스캔) 바로 아래 갈래', () => {
    expect((HOWTO.match(/\{ n: '\d'/g) || []).length).toBe(3)
    expect(HOWTO, '예외 갈래가 2단계에 안 붙어 있다').toMatch(/n === '2' && \([\s\S]{0,300}스캔이 안 되면\?[\s\S]{0,80}\{REDEEM_FALLBACK\}/)
  })
  it('단계는 접지 않는다 — 접히는 건 유의사항뿐', () => {
    const line = USAGE.split('\n').find((l) => l.includes('<RedeemHowTo />'))
    expect(line, '단계가 안 그려진다').toBeTruthy()
    expect(line!, '단계가 조건부가 됐다 — 눌러야 보이는 절차는 매장 앞에서 안 열린다').not.toContain('&&')
    expect(USAGE).toMatch(/<details[\s\S]{0,400}유의사항/)
  })
})
