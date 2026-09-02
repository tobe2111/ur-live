/**
 * 🎫 리뷰 자격 = 이용권은 "사용한 사람" (2026-09-02 — 대표 *"리뷰는 이용권 사용한 사람만 쓸 수 있게끔 되어있지?"*)
 *
 * ■ 무엇이 났나
 *   리뷰 등록 게이트가 '구매'(orders.status PAID/DONE…)만 봤다. 이용권은 결제 즉시 DONE 이라
 *   매장에 가기 전에도 리뷰가 되고 리워드(딜)까지 나갔다. 사용 기록(`vouchers.status='used'`)은
 *   이미 있었는데 리뷰가 안 봤을 뿐이다.
 *
 * ■ 계약
 *   ① 종류 판정은 결제수단과 같은 SSOT(`getProductFlow`) — 카테고리 이름으로 갈라 쓰지 않는다
 *   ② 이용권(group_buy_toss)은 `status = 'used'` 이용권이 있어야 하고, 없으면 403 `VOUCHER_NOT_USED`
 *   ③ 리워드 주문은 사용한 이용권의 order_id
 *   ④ 교환권·쇼핑의 구매 게이트(`NOT_PURCHASED`)는 그대로
 *
 * ⚠️ 못 잡는 것: 실제 SQL 실행 결과 · vouchers.user_id 가 TEXT 인데 숫자로 바인딩되는 경우
 *    (그래서 소스가 `String(user.id)` 를 쓰는지도 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../../features/reviews/api/reviews.routes.ts'), 'utf-8')
const gate = src.slice(src.indexOf("if (user.type !== 'admin') {"), src.indexOf('셀러 자기 상품 self-review'))

describe('리뷰 자격 — 이용권은 사용한 사람만', () => {
  it('① 종류 판정이 결제수단 SSOT(getProductFlow) 다', () => {
    expect(src).toMatch(/import \{ getProductFlow, type ProductFlowInput \} from '@\/shared\/product-flow'/)
    expect(gate).toMatch(/getProductFlow\(prod\)/)
    expect(gate).toMatch(/flow === 'group_buy_toss'/)
  })

  it('② 이용권은 vouchers.status=used 가 있어야 하고, 없으면 403 VOUCHER_NOT_USED', () => {
    expect(gate).toMatch(/FROM vouchers WHERE product_id = \? AND user_id = \? AND status = 'used'/)
    expect(gate).toMatch(/String\(user\.id\)/)
    expect(gate).toMatch(/error_code: 'VOUCHER_NOT_USED'/)
    expect(gate).toMatch(/\}, 403\)/)
  })

  it('③ 리워드 주문은 사용한 이용권의 order_id', () => {
    expect(src).toMatch(/else if \(usedVoucherOrderId\) \{[\s\S]{0,300}rewardOrderId = usedVoucherOrderId/)
  })

  it('④ 교환권·쇼핑의 구매 게이트는 그대로', () => {
    expect(gate).toMatch(/error_code: 'NOT_PURCHASED'/)
    expect(gate).toMatch(/o\.status IN \('PAID', 'DONE', 'DELIVERED', 'SHIPPING', 'COMPLETED'\)/)
  })
})
