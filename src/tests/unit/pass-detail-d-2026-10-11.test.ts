/**
 * 🎟️ 이용권 상세 D안 (2026-10-11 대표 확정)
 *
 * 대표: *"더 세련되고 심플해져야 해. 지금은 부연설명도 많고 그래."* → 시안 C·D·E 중
 * *"D안으로 진행해주더라도, C안의 이용안내 형태를 따르기. 하지만 이용안내 부분의 디자인도 더 고도화가 필요."*
 *
 * ## 지키는 것
 * ① 걷어낸 부연설명이 돌아오지 않는다("결제 즉시 교환권 발급" · "발급 후 사용 기간 적용")
 * ② 모바일 섹션은 회색 바탕 위 **카드**(같은 상수 `PASS_CARD`)
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
  it('PC 도 같은 카드다 (대표 "PC도 해야하는거 아니야?") — 좌측 열 폭에 맞춰 바깥 여백만 푼다', () => {
    const cls = /PASS_CARD = '([^']+)'/.exec(readCode('src/shared/pass-head.ts'))![1].split(/\s+/)
    expect(cls).toContain('lg:mx-0')
    for (const t of ['lg:rounded-none', 'lg:shadow-none']) expect(cls, `PC 에서 카드가 다시 풀렸다(${t})`).not.toContain(t)
    expect(readCode('src/shared/pass-head.ts'), 'PC 바탕이 다시 흰색이 됐다 — 흰 카드가 안 보인다').not.toContain('lg:bg-[var(--gbd-card)]')
  })
})

describe('③ 결제는 구매 창 안에서만', () => {
  it('바의 버튼은 창을 연다 — 바로 결제하지 않는다(사전 응모만 예외)', () => {
    const sheetAt = BAR.indexOf('aria-label="구매 옵션"')
    expect(sheetAt).toBeGreaterThan(0)
    const bar = BAR.slice(0, sheetAt)
    expect(bar).toContain('() => setOpen(true)')
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

describe('④ 이용 안내 — 늘 펼친 STEP 타일 3장', () => {
  it('타일 3장 + 스캔이 안 될 때의 길 한 줄', () => {
    expect((HOWTO.match(/\{ n: '\d'/g) || []).length).toBe(3)
    expect(HOWTO).toContain('grid grid-cols-3')
    expect(HOWTO).toContain('{REDEEM_FALLBACK}')
  })
  it('접기가 되살아나지 않는다', () => {
    expect(USAGE).not.toContain('useState')
    expect(USAGE).toContain('<RedeemHowTo />')
  })
})
