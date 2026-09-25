/**
 * 🔗 **'가게 소개' 탭과 섹션은 같은 판정을 쓴다** — 2026-09-25 라이브 판정(E4)에서 잡은 결함의 가드.
 *
 * ## 무엇이 틀렸었나
 * 대표 문서 ①(#1543)로 '가게 소개' 블록을 신설하면서 **탭은 무조건** 그리고 **섹션은 조건부**로 뒀다.
 * 그래서 설명·소개·사장님 말이 전부 빈 상품에서는 **눌러도 아무 데도 안 가는 탭**이 남았다.
 * 에러가 안 나고 대부분 상품에는 설명이 있어서 화면으로도 잘 안 보인다 —
 * 이 레포가 반복해 당한 "실패가 아니라 조용한 부재".
 * 실측(2026-09-25 라이브 D1): 활성 이용권 2,620건 중 설명이 비었거나 제목과 같은 것이 **23건**.
 *
 * ## 이 시험이 **못 하는 것**
 * 탭은 PC 전용(`hidden lg:flex`)이라 jsdom 에는 레이아웃이 없어 "PC 에서만 보인다"는 판정하지 못한다.
 * 여기서 고정하는 것은 **두 판정이 한 함수에서 나온다**는 것과 그 함수의 진리표다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { hasStoreIntro } from '@/pages/group-buy/StoreIntro'

const DETAIL = 'src/pages/GroupBuyDetailPage.tsx'
const INTRO = 'src/pages/group-buy/StoreIntro.tsx'

describe('판정은 한 곳에서만 나온다', () => {
  it('탭이 `hasStoreIntro` 를 보고 뜰지 정한다 — 무조건 그리지 않는다', () => {
    const d = readCode(DETAIL)
    /* 🩸 첫 판이 헛돌았다: "옛 한 줄 모양이 아니다" 로만 봤더니, else 가지에 같은 탭을 넣어
       **항상 뜨게** 만드는 변형(`? [탭] : [탭]`)을 그대로 통과시켰다(주입이 잡았다).
       ⇒ 모양을 부정하지 말고 **있어야 할 구조를 긍정**한다 — 탭은 딱 한 번 나오고,
       그 자리는 `hasStoreIntro(…) ? [탭] : []` 여야 한다(빈 else 가 핵심). */
    expect((d.match(/id: 'gb-sec-store'/g) || []).length, '가게 소개 탭이 한 곳에서만 나와야 한다').toBe(1)
    expect(d).toMatch(/hasStoreIntro\(\{[\s\S]{0,400}?\?\s*\[\{ id: 'gb-sec-store'[^\]]*\}\]\s*:\s*\[\]\)/)
  })

  it('섹션도 같은 함수로 사라질지 정한다 — 조건을 손으로 다시 쓰지 않는다', () => {
    const s = readCode(INTRO)
    expect(s).toMatch(/if \(!hasStoreIntro\(/)
  })
})

describe('진리표 — 무엇이 있으면 뜨는가', () => {
  it('아무것도 없으면 안 뜬다', () => {
    expect(hasStoreIntro({})).toBe(false)
    expect(hasStoreIntro({ description: '   ', longDescription: '', sellerBio: null })).toBe(false)
  })

  it('설명이 제목과 같은 말이면 안 뜬다 (상품명 중복 방지 — 2026-09-14 규칙 승계)', () => {
    expect(hasStoreIntro({ description: '치즈돈가스', productName: '치즈돈가스' })).toBe(false)
    expect(hasStoreIntro({ description: '  치즈돈가스  ', productName: '치즈돈가스' })).toBe(false)
  })

  it('설명·가게소개·사장님 말 중 하나만 있어도 뜬다', () => {
    expect(hasStoreIntro({ description: '두툼한 삼겹살 500g', productName: '삼겹살 2인' })).toBe(true)
    expect(hasStoreIntro({ longDescription: '1978년부터 한자리에서' })).toBe(true)
    expect(hasStoreIntro({ sellerBio: '맛있게 해 드릴게요' })).toBe(true)
  })
})
