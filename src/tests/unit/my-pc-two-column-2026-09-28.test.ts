/**
 * 🖥️ **PC 마이는 판매 구역 아래를 두 열로 편다** (2026-09-28)
 *
 * 대표: *"지금 마이 페이지 PC 버전이나 모바일이나 너무 별로인데? 페이지 디자인 및 UI 퀄리티가 너무 허술해"*
 *
 * ## 실측 (1440px · 사장님 화면)
 * 블록 열한 개가 888px 한 줄에 세로로 **1,900px** 쌓이고, 좌측 내비는 **440px** 에서 끝나
 * 그 아래 **1,500px 가 빈 채로** 남았다. 시안 `PcFull1`(대표 추천안)의 핵심인 **우측 2열**이
 * 구현에서 빠져 있었던 것이다.
 *
 * 🩸 **같은 날 내가 "PC 2열 안 함" 으로 결재에 못 박았고, 그게 오판이었다.**
 *   근거였던 *"888px 를 쪼개면 한 칸 428px 로 폰보다 좁다"* 는 **시안을 안 보고** 한 계산이다.
 *   시안은 균등이 아니라 **1.25 : 1 비대칭**이고, 판매 목록이 넓은 쪽에 산다.
 *
 * ## 🔴 이 시험이 지키는 두 번째 것 — 내가 만들었다 고친 회귀
 * 첫 판은 좌석 유무와 무관하게 두 열로 쪼갰다. 그러자 **가게가 없는 손님**은 왼쪽 열이 통째로 비고
 * 손님 블록이 전부 좁은 오른쪽으로 몰렸다. ⇒ **판매가 있을 때만 쪼갠다.**
 *
 * ⚠️ **이 시험이 못 하는 것**: 실제 폭·줄바꿈은 jsdom 이 못 잰다(레이아웃이 없다).
 *   브라우저 판정: `node scripts/visual-preview.mjs --route=/user/profile --auth=user --stores=1 --pc --width=1440`
 *   (잘린 글자 0 · `412,000 원` 한 줄 · 좌측 내비 아래 빈 칸이 크게 줄었는지)
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/UserProfilePage.tsx')
const CSS = readCode('src/index.css')
const SELLER = readCode('src/pages/user-profile/SellerSection.tsx')

describe('PC 마이 — 두 열', () => {
  it('🔴 판매 구역 아래가 두 열로 배선돼 있다', () => {
    expect(PAGE).toContain('ur-account-cols')
    expect(PAGE).toContain('ur-account-col--narrow')
    expect(CSS).toContain('.ur-account-cols--split')
  })

  it('🔴 **좌석이 있을 때만** 쪼갠다 (없으면 왼쪽 열이 통째로 빈다)', () => {
    expect(PAGE).toMatch(/sellerSeats\.stores\.length > 0 \?\s*'ur-account-cols ur-account-cols--split'/)
  })

  it('🔴 균등 2열이 아니다 — 균등이면 한 칸이 폰보다 좁아진다', () => {
    const at = CSS.indexOf('.ur-account-cols--split')
    expect(at).toBeGreaterThan(0)
    const block = CSS.slice(at, at + 260)
    expect(block).toContain('1.25fr 1fr')
    // 짧은 열이 긴 열 높이로 늘어나면 카드가 붕 뜬다.
    expect(block).toContain('align-items: start')
  })

  it('🔴 모바일은 한 글자도 안 바뀐다 — 래퍼가 lg+ 안에만 있다', () => {
    const at = CSS.indexOf('.ur-account-cols--split')
    const before = CSS.slice(0, at)
    const mq = before.lastIndexOf('@media (min-width: 1024px)')
    expect(mq, 'lg+ 미디어쿼리 밖에 있다 — 모바일까지 2열이 된다').toBeGreaterThan(0)
    expect(before.slice(mq)).not.toContain('\n}\n\n')   // 그 사이에 닫히지 않았다
  })

  it('🔴 좁은 칸에서 안쪽 격자를 접는다 (안 접으면 글자가 잘린다)', () => {
    // 첫 판에서 알약 셋이 `내...` `내...` `찜.` 이 됐다.
    expect(CSS).toMatch(/\.ur-account-cols--split \.ur-account-col--narrow \.grid-cols-4/)
    expect(CSS).toMatch(/\.ur-account-cols--split \.ur-account-col--narrow \.grid-cols-3/)
  })

  it('🔴 금액이 두 줄로 갈라지지 않는다', () => {
    // 카드가 ≈340px 로 좁아지면서 `412,000` 과 `원` 이 갈라졌다.
    // 🔁 2026-09-28 재조준: 30px → 28px(여섯 단계 스케일). 불변식은 **금액이 안 갈라진다** 이고
    //   크기 숫자가 아니다. 크기 자체는 `my-type-scale-2026-09-28` 이 따로 지킨다.
    expect(SELLER).toMatch(/text-\[28px\][^"]*whitespace-nowrap/)
  })

  it('판매는 넓은 쪽에 산다 — 좁히면 설명이 먼저 잘린다', () => {
    const cols = PAGE.indexOf('ur-account-cols')
    const narrow = PAGE.indexOf('ur-account-col--narrow')
    const seller = PAGE.indexOf('<SellerSection state={sellerSeats} />', cols)
    expect(seller).toBeGreaterThan(cols)
    expect(seller, '판매가 좁은 오른쪽 열에 들어갔다').toBeLessThan(narrow)
  })
})
