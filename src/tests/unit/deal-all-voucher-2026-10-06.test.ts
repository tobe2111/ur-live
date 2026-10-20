/**
 * 🪙 이용권을 딜 100% 로 산다 (2026-10-06 대표)
 *
 *   *"왜 딜 포인트 100%로 이용권 구매가 안되는거디?"* → *"오롯이 100%로 딜로 이용권을 구매할 수 있어야 한다는거야."*
 *
 * 막혀 있던 게 아니라 **구조적으로 도달하지 못했다**. 라이브 실측(주문 90): 7,500 = 딜 7,400 + 카드 100,
 * 구매 전 잔액 12,100. 기본 경로(부분결제)는 `MIN_CARD_AMOUNT`(100) 때문에 딜 상한이 `총액 − 100` 이다
 * (0원 카드 결제는 PG 거절). 전부-딜(`payment_method='deal'`)은 주 버튼 아래 보조 버튼이었고 PC 엔 없었다.
 *
 * 지키는 것:
 *   ① 다 덮을 수 있으면 기본값이 **전부**다(`defaultDealUse`) — 큰 버튼을 누르면 카드 0원
 *   ② 고른 딜이 총액을 덮으면 **전부-딜 흐름**으로 간다(`coversAll` → `payment_method:'deal'`)
 *   ③ 고르는 칸이 [전부 딜로] 를 낸다 · 모바일·PC 버튼이 "N딜로 결제하기" 라고 말한다
 *   ④ 딜 전액 결제도 카드와 **같은 완료 화면**으로 간다 — 그 화면은 승인을 부르지 않는다(표시 전용)
 *
 * ⚠️ 못 막는 것: 실제 결제(staging 실결제로 판정) · 서버 게이트 `voucher_deal_payment_enabled` 가 꺼진 날의 화면
 *   (그날은 서버가 `DEAL_PAYMENT_NOT_ALLOWED` 로 막고 `deal-join-error` 가 안내한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { defaultDealUse, coversAll, type DealPlan } from '@/pages/group-buy/DealUseChooser'

const plan = (o: Partial<DealPlan> = {}): DealPlan => ({
  enabled: true, balance: 12_100, total_amount: 7_500, max_deal_usable: 7_400,
  default_deal_used: 7_400, default_card_amount: 100, can_pay_all_with_deal: true, min_card_amount: 100, ...o,
})
const R = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('① 기본값', () => {
  it('다 덮을 수 있으면 전부(카드 0원) — 라이브 주문 90 의 "카드 100원" 이 다시 안 생긴다', () => {
    expect(defaultDealUse(plan())).toBe(7_500)
  })
  it('못 덮으면 종전대로 최대(총액 − 카드최소)', () => {
    expect(defaultDealUse(plan({ balance: 4_700, can_pay_all_with_deal: false, max_deal_usable: 4_700 }))).toBe(4_700)
  })
  it('게이트 OFF / 계획 없음이면 0', () => {
    expect(defaultDealUse(plan({ enabled: false }))).toBe(0)
    expect(defaultDealUse(null)).toBe(0)
  })
})

describe('② 전부-딜 판정', () => {
  it('안 골랐고 다 덮을 수 있으면 전부-딜', () => {
    expect(coversAll(plan(), null)).toBe(true)
  })
  it('사용자가 일부만 고르면 부분결제로 남는다(카드 탄다)', () => {
    expect(coversAll(plan(), 3_000)).toBe(false)
    expect(coversAll(plan(), 0)).toBe(false)
  })
  it('잔액이 모자라면 무엇을 골라도 전부-딜이 아니다', () => {
    expect(coversAll(plan({ can_pay_all_with_deal: false }), 99_999)).toBe(false)
  })
  it('게이트 OFF 면 전부-딜로 보내지 않는다', () => {
    expect(coversAll(plan({ enabled: false }), 7_500)).toBe(false)
  })
})

describe('③④ 배선', () => {
  const DETAIL = R('src/pages/GroupBuyDetailPage.tsx')
  it('상세: 덮으면 딜 흐름으로 간다', () => {
    expect(DETAIL).toMatch(/if \(flow === 'voucher_deal' \|\| payWithDeal \|\| \(canPayWithDeal && coversAll\(dealPlan, dealUse\)\)\)/)
  })
  it('상세: PC 구매 박스에 allDeal 을 넘긴다(종전엔 PC 에 전부-딜 길이 없었다)', () => {
    expect(DETAIL).toMatch(/allDeal=\{canPayWithDeal && !isPrelaunch && isJoinable && coversAll\(dealPlan, dealUse\)\}/)
  })
  it('고르는 칸이 [전부 딜로] 를 낸다', () => {
    expect(R('src/pages/group-buy/DealUseChooser.tsx')).toMatch(/canAll \? btn\('all', '전부 딜로'\)/)
  })
  it('모바일·PC 버튼이 "N딜로 결제하기" 라고 말한다', () => {
    expect(R('src/pages/group-buy/DealBottomBar.tsx')).toMatch(/allDeal \? `\$\{formatNumber\(total\)\}딜로 결제하기`/)
    expect(R('src/pages/group-buy/DealPurchaseBox.tsx')).toMatch(/allDeal \? `\$\{formatNumber\(total\)\}딜로 결제하기`/)
  })
  it('완료 화면: deal=1 이면 승인(confirm-toss)을 부르기 전에 끝난다', () => {
    const page = R('src/pages/GroupBuyConfirmPaymentPage.tsx')
    const dealAt = page.indexOf('if (isDealOnly && productId && amount > 0)')
    const confirmAt = page.indexOf("api.post('/api/group-buy/confirm-toss'")
    expect(dealAt).toBeGreaterThan(-1)
    expect(confirmAt).toBeGreaterThan(dealAt)
    expect(page.slice(dealAt, page.indexOf('return', dealAt) + 6)).not.toMatch(/api\./)
  })
})
