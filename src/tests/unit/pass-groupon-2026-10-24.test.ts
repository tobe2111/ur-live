/**
 * 🛍️ 이용권 상세 — 구매하기는 **하나** (2026-10-24 그루폰식 → 2026-10-25 대표 확정 E안)
 *
 * 대표: *"구매하기 버튼이 2개가 동시에 있어"* — 본문 '옵션 선택' 카드의 [구매하기]와 하단 바의 [구매하기]가
 * 한 화면에 함께 섰다. E안은 본문 카드를 걷고 **모바일 하단 바 하나 · PC 우측 구매 상자 하나**만 남긴다.
 *
 * 지키는 것:
 *  ① 본문(페이지 파일)에 구매 버튼이 없다 — 구매는 `DealBottomBar`(모바일)·`DealPurchaseBox`(PC)만 부른다.
 *  ② 걷은 카드가 돌아오지 않는다(`PassOptionCard`).
 *  ③ 하단 바는 여전히 수량을 고르는 구매 창을 연다(수량 스테퍼가 그 창 안에 있다).
 * ⚠️ 못 보는 것: 실제로 보기 좋은지(렌더로 본다) · 구매 창이 열린 뒤의 결제(기존 시험 몫).
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { readCode } from '../helpers/source-text'

const BAR = 'src/pages/group-buy/DealBottomBar.tsx'
const PAGE = 'src/pages/GroupBuyDetailPage.tsx'

describe('이용권 상세 — 구매하기는 하나', () => {
  it('① 페이지 본문이 결제를 직접 부르는 자리는 PC 구매 상자와 하단 바 둘뿐이다', () => {
    const page = readCode(PAGE)
    const calls = page.match(/handleJoin\b/g) || []
    // 정의 1 + 바깥 배선 onBuy(PC 상자) · onJoin(하단 바) 두 자리.
    expect(page).toContain('onBuy={() => handleJoin()}')
    expect(page).toContain('onJoin={handleJoin}')
    expect(calls.length, 'handleJoin 을 부르는 자리가 늘었다 — 두 번째 구매 버튼이 생겼는가').toBeLessThanOrEqual(3)
    expect(page, '페이지 본문에 구매하기 글자가 돌아왔다(두 번째 구매 버튼)').not.toMatch(/>\s*구매하기\s*</)
  })

  it('② 걷은 옵션 카드가 돌아오지 않는다', () => {
    expect(existsSync('src/pages/group-buy/PassOptionCard.tsx')).toBe(false)
    expect(readCode(PAGE)).not.toContain('PassOptionCard')
  })

  it('③ 하단 바는 수량을 고르는 구매 창을 연다', () => {
    const bar = readCode(BAR)
    expect(bar).toMatch(/setOpen\(true\)/)
    expect(bar).toMatch(/setQuantity/)
  })
})
