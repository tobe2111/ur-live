/**
 * 🎫 리뷰 자격 = 이용권은 "사용한 사람" (2026-09-02 — 대표 *"리뷰는 이용권 사용한 사람만 쓸 수 있게끔 되어있지?"*)
 *
 * ■ 무엇이 났나
 *   리뷰 등록 게이트가 '구매'(orders.status PAID/DONE…)만 봤다. 이용권은 결제 즉시 DONE 이라
 *   매장에 가기 전에도 리뷰가 되고 리워드(딜)까지 나갔다. 사용 기록(`vouchers.status='used'`)은
 *   이미 있었는데 리뷰가 안 봤을 뿐이다.
 *
 * ■ 2차 수정(같은 날) — 첫 판이 라이브 상품 8개를 잘못 걸렀다
 *   `group_buy_status` 는 migration 0146 이 **모든 상품에 DEFAULT 'active'** 를 박았다. 그래서
 *   배송되는 물건(한우 등심·참기름·명란젓·밀키트·쌀조청·갈치·Canvas Tote Bag)까지 '이용권'으로
 *   분류돼, 매장에서 쓸 일이 없는 그 상품들의 구매자가 리뷰를 **영영 못 쓰게** 돼 있었다.
 *
 * ■ 계약
 *   ① 종류 판정 = 결제수단 SSOT(`getProductFlow`) **AND** 수령 방식(`isVoucherCategory`)
 *   ② 이용권은 `status = 'used'` 이용권이 있어야 하고, 없으면 403 `VOUCHER_NOT_USED`
 *   ③ 조회는 발급과 **같은 정규화**(`resolveUserIdString`) — `String(user.id)` 직접 사용 금지
 *   ④ 조회 자체가 실패하면 자격 없음(403)이 아니라 시스템 오류(503 `REVIEW_ELIGIBILITY_UNAVAILABLE`)
 *   ⑤ 리워드 주문은 사용한 이용권의 order_id
 *   ⑥ 교환권·쇼핑의 구매 게이트(`NOT_PURCHASED`)는 그대로
 *
 * ⚠️ 못 잡는 것: 실제 SQL 실행 결과 · `isVoucherCategory` 목록이 라이브 카테고리와 맞는지
 *    (그건 D1 실측이라 이 파일 밖이다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../../features/reviews/api/reviews.routes.ts'), 'utf-8')
// 판정 본체는 2026-09-02 2차에서 모듈로 분리됐다(라우트 600줄 래칫). 두 파일을 다 본다 —
// 한쪽만 보면 "모듈은 멀쩡한데 라우트가 안 부른다"(또는 그 반대)를 놓친다.
const gate = readFileSync(resolve(__dirname, '../../features/reviews/api/review-eligibility.ts'), 'utf-8')
// 설명 주석이 스스로를 만족시키지 않도록 — 판정은 코드 줄만 본다.
const gateCode = gate.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('리뷰 자격 — 이용권은 사용한 사람만', () => {
  it('① 종류 판정 = 결제수단 SSOT(getProductFlow) AND 수령 방식(isVoucherCategory)', () => {
    expect(gate).toMatch(/import \{ getProductFlow, type ProductFlowInput \} from '@\/shared\/product-flow'/)
    expect(gate).toMatch(/import \{ isVoucherCategory \} from '@\/shared\/constants\/voucher-categories'/)
    // 두 조건이 한 표현식에서 AND 로 묶여야 한다 — 하나만 남으면 배송 상품이 다시 걸린다.
    expect(gateCode).toMatch(
      /getProductFlow\(prod\) === 'group_buy_toss'\s*&&\s*isVoucherCategory\(prod\.category\)/
    )
    expect(gateCode).toMatch(/SELECT deal_only, group_buy_status, category FROM products/)
  })

  it('② 이용권은 vouchers.status=used 가 있어야 하고, 없으면 403 VOUCHER_NOT_USED', () => {
    expect(gateCode).toMatch(/FROM vouchers WHERE product_id = \? AND user_id = \? AND status = 'used'/)
    expect(gateCode).toMatch(/status: 403,[\s\S]{0,200}error_code: 'VOUCHER_NOT_USED'/)
  })

  it('③ 조회는 발급과 같은 정규화(resolveUserIdString) — String(user.id) 직접 바인딩 금지', () => {
    expect(gate).toMatch(/import \{ resolveUserIdString \} from '@\/worker\/utils\/resolve-user-id'/)
    expect(gateCode).toMatch(/const voucherUserId = await resolveUserIdString\(DB, userId, isDbId\)/)
    // 바인딩이 정규화 값을 써야 한다.
    expect(gateCode).toMatch(/\.bind\(productId, voucherUserId\)/)
    // 이용권 조회 구간에 raw String(user.id) 가 남아 있으면 안 된다.
    const voucherBlock = gateCode.slice(
      gateCode.indexOf('resolveUserIdString'),
      gateCode.indexOf("error_code: 'VOUCHER_NOT_USED'"),
    )
    expect(voucherBlock).not.toMatch(/String\(user\.id\)/)
  })

  it('④ 조회 실패는 자격 없음이 아니라 503 REVIEW_ELIGIBILITY_UNAVAILABLE', () => {
    // `.catch(() => null)` 로 삼키면 "매장 다녀오세요" 를 잘못 말한다 — try/catch 로 갈라야 한다.
    expect(gateCode).toMatch(/status: 503,[\s\S]{0,200}error_code: 'REVIEW_ELIGIBILITY_UNAVAILABLE'/)
    // 503 분기가 403 분기보다 먼저 와야 한다(실패를 자격 판정에 흘리지 않는다).
    expect(gateCode.indexOf("REVIEW_ELIGIBILITY_UNAVAILABLE"))
      .toBeLessThan(gateCode.indexOf("error_code: 'VOUCHER_NOT_USED'"))
  })

  it('⑤ 리워드 주문은 사용한 이용권의 order_id', () => {
    expect(src).toMatch(/else if \(usedVoucherOrderId\) \{[\s\S]{0,300}rewardOrderId = usedVoucherOrderId/)
  })

  it('⑥ 라우트가 판정 모듈을 실제로 부르고 판정을 그대로 응답한다', () => {
    // 분리해 놓고 안 부르면 게이트가 통째로 사라진다 — 에러 없이.
    expect(src).toMatch(/import \{ checkReviewEligibility \} from '\.\/review-eligibility'/)
    expect(src).toMatch(/const verdict = await checkReviewEligibility\(/)
    expect(src).toMatch(/if \(!verdict\.ok\) \{[\s\S]{0,220}verdict\.status\)/)
    expect(src).toMatch(/usedVoucherOrderId = verdict\.rewardOrderId/)
    // admin 예외는 유지.
    expect(src).toMatch(/if \(user\.type !== 'admin'\) \{/)
  })

  it('⑦ 교환권·쇼핑의 구매 게이트는 그대로', () => {
    expect(gateCode).toMatch(/status: 403,[\s\S]{0,200}error_code: 'NOT_PURCHASED'/)
    expect(gateCode).toMatch(/o\.status IN \('PAID', 'DONE', 'DELIVERED', 'SHIPPING', 'COMPLETED'\)/)
  })
})
