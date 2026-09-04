/**
 * 💸 딜을 섞어 산 주문의 환불 — **카드로 취소할 수 있는 건 카드로 긁은 만큼뿐이다.**
 *
 * 2026-09-04 실측 결함: 부분결제(딜 일부 + 카드 나머지)가 켜지자 `refundOrderFully` 가
 * Toss 에 **총액**을 취소 요청했다. `orders.total_amount` 에는 총액이 들어가고 카드 승인액은
 * 그보다 `deal_used` 만큼 적으므로 → `EXCEED_CANCEL_AMOUNT` 402 → 그 자리에서 return →
 * 상태 전이도 딜 복원도 도달 못 함. ⇒ **딜을 섞어 산 고객은 환불을 아예 못 받았다.**
 *
 * 같은 파일이 이미 같은 클래스의 사고를 겪고 `alreadyRefunded` 를 빼고 있었는데
 * (주석: *"Toss 에 전액 재요청 → EXCEED_CANCEL_AMOUNT → 잔여분 취소 영구 불능"*),
 * **딜 사용분은 안 빼고 있었다** — 쇼핑탭이 숨겨져 노출이 0이었을 뿐이다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 D1·Toss 응답은 안 본다(소스 불변식만).
 *   실제 분할 취소 동작은 staging 실결제(S12)로 확인해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { splitFullRefund, splitPartialRefund } from '@/features/group-buy/api/partial-deal'

const SRC = readFileSync('src/worker/utils/order-refund.ts', 'utf8')
/** 주석 제거 — 주석에만 남은 이름을 배선으로 오독하지 않는다. */
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('전액 환불 — 카드 몫과 딜 몫이 갈린다', () => {
  it('Toss 취소는 총액이 아니라 카드 몫을 요청한다', () => {
    const call = code.split('\n').find((l) => l.includes('tossCancelPayment('))
    expect(call, 'tossCancelPayment 호출을 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    // 마지막 인자가 취소 금액이다. `amount`(총액)를 그대로 넘기면 승인액을 넘는다.
    expect(call!, '총액을 그대로 취소 요청한다 — EXCEED_CANCEL_AMOUNT 로 환불이 통째로 막힌다')
      .not.toMatch(/opts\.reason,\s*amount\s*\)/)
    expect(call!, '카드 몫(cardAmount)을 안 쓴다').toContain('cardAmount')
  })

  it('카드 몫 = 잔여 환불액 − 미복원 딜', () => {
    expect(code, 'SSOT 를 안 쓴다').toContain('splitFullRefund({ remainingDeal: pendingDealUsed, refundAmount: amount })')
  })

  it('딜 복원은 잔여 환불액을 넘지 않는다 (부분반품 뒤 과다 환불 차단)', () => {
    // 클램프는 이제 SSOT 안에 있고 위 실행 테스트가 그걸 직접 확인한다.
    expect(code, 'SSOT 에서 딜 몫을 안 받는다').toMatch(/deal: dealToRestore/)
  })

  it('카드에서 뺀 금액과 딜로 되돌린 금액이 같은 값에서 나온다', () => {
    // 두 번 읽으면 그 사이 값이 갈릴 수 있고, 차액은 조용한 미수/과다환불이 된다.
    expect(code, '3b 가 deal_used 를 다시 조회한다 — 카드에서 뺀 값과 갈릴 수 있다')
      .toMatch(/const dealUsed = dealToRestore/)
    expect((code.match(/SELECT deal_used FROM orders/g) || []).length,
      'deal_used 조회가 2회 이상 — 한 번 읽어 둘 다 쓸 것').toBe(1)
  })

  it('전부-딜 주문은 카드를 안 건드린다 (조회 자체를 안 한다)', () => {
    // `payment_method='deal_points'` 는 애초에 승인된 카드가 없다.
    expect(code, '전부-딜에서도 deal_used 를 읽는다').toMatch(/if \(!isDeal\) \{[\s\S]{0,200}SELECT deal_used/)
  })
})

const RET = readFileSync('src/features/returns/api/returns.routes.ts', 'utf8')
const retCode = RET.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('반품 환불 — 환불액을 카드와 딜로 나눈다', () => {
  it('Toss 취소는 refund_amount 가 아니라 카드 몫을 요청한다', () => {
    const call = retCode.slice(retCode.indexOf('tossCancelPayment('), retCode.indexOf('tossCancelPayment(') + 320)
    expect(call, 'tossCancelPayment 호출을 못 찾았다 — 이 검사가 헛돈다').toContain('TOSS_SECRET_KEY')
    expect(call, '총액 기준 환불액을 카드에 그대로 요청한다').not.toContain('returnRecord.refund_amount ||')
    expect(call, '카드 몫을 안 쓴다').toContain('refundSplit.card')
  })

  it('카드 몫 = 환불액 − 딜 몫 (합이 곧 환불액이다)', () => {
    expect(retCode, 'SSOT 를 안 쓴다').toContain('splitPartialRefund({')
  })

  it('딜 몫은 비례 + 잔여 딜로 클램프 (이중 복원 차단)', () => {
    // 비례식은 SSOT 안에 있고 위 실행 테스트가 확인한다. 여기서는 **전액용을 잘못 쓰지 않는지**만 본다.
    expect(retCode, '반품 경로가 전액용 계산을 쓴다 — 남은 딜을 통째로 돌려주게 된다').not.toContain('splitFullRefund')
  })

  it('복원 블록이 그 값을 재계산하지 않는다', () => {
    expect(retCode, '복원 블록이 다시 계산한다 — 카드에서 뺀 값과 갈릴 수 있다')
      .toMatch(/const restore = refundSplit\.deal/)
    expect((retCode.match(/SELECT deal_used FROM orders/g) || []).length,
      'deal_used 조회가 2회 이상 — 한 번 읽어 둘 다 쓸 것').toBe(1)
  })

  it('카드 몫이 0 이면 Toss 를 부르지 않는다 (딜로만 돌려주는 경우)', () => {
    expect(retCode, '카드 몫 0 에도 Toss 를 부른다 — 0원 취소는 거절된다')
      .toMatch(/if \(paymentKey && refundSplit\.card > 0\)/)
  })
})

describe('계산 SSOT — 실제로 돌려 본다 (소스 검사가 아니라)', () => {
  it('전액 환불: 카드 몫 + 딜 몫 = 환불액, 항상', () => {
    for (const [remainingDeal, refundAmount] of [[2000, 10000], [0, 10000], [9900, 10000], [12000, 10000], [2000, 0]]) {
      const r = splitFullRefund({ remainingDeal, refundAmount })
      expect(r.card + r.deal, `${remainingDeal}딜 / ${refundAmount}원`).toBe(refundAmount)
      expect(r.deal).toBeLessThanOrEqual(remainingDeal)
      expect(r.card).toBeGreaterThanOrEqual(0)
    }
  })

  it('전액 환불: 대표 예시 — 총액 10,000 · 딜 2,000 → 카드 8,000 + 딜 2,000', () => {
    expect(splitFullRefund({ remainingDeal: 2000, refundAmount: 10000 })).toEqual({ card: 8000, deal: 2000 })
  })

  it('전액 환불: 남은 딜을 **다** 돌려준다 (비례를 또 곱하면 과소 복원)', () => {
    // 반품이 이미 일부를 복원해 deal_used 가 줄어 있는 상태에서 전액 환불이 들어온 경우.
    expect(splitFullRefund({ remainingDeal: 1000, refundAmount: 5000 })).toEqual({ card: 4000, deal: 1000 })
  })

  it('전액 환불: 잔여 환불액보다 많은 딜은 클램프 (과다 환불 차단)', () => {
    expect(splitFullRefund({ remainingDeal: 8000, refundAmount: 3000 })).toEqual({ card: 0, deal: 3000 })
  })

  it('부분 환불: 이번 몫만 비례로 — 절반 환불이면 딜도 절반', () => {
    expect(splitPartialRefund({ remainingDeal: 2000, refundAmount: 5000, orderTotal: 10000 }))
      .toEqual({ card: 4000, deal: 1000 })
  })

  it('부분 환불: 합이 언제나 환불액이다', () => {
    for (const [d, r, tot] of [[2000, 5000, 10000], [2000, 10000, 10000], [0, 5000, 10000], [3333, 7777, 10000]]) {
      const out = splitPartialRefund({ remainingDeal: d, refundAmount: r, orderTotal: tot })
      expect(out.card + out.deal, `${d}/${r}/${tot}`).toBe(r)
    }
  })

  it('부분 환불: 총액 0/음수 같은 이상값에도 무너지지 않는다', () => {
    expect(splitPartialRefund({ remainingDeal: 2000, refundAmount: 5000, orderTotal: 0 }).card + splitPartialRefund({ remainingDeal: 2000, refundAmount: 5000, orderTotal: 0 }).deal).toBe(5000)
    expect(splitPartialRefund({ remainingDeal: -5, refundAmount: -5, orderTotal: -5 })).toEqual({ card: 0, deal: 0 })
  })

  it('딜이 0 이면 카드가 전액 — 종전 동작과 같다', () => {
    expect(splitFullRefund({ remainingDeal: 0, refundAmount: 10000 })).toEqual({ card: 10000, deal: 0 })
    expect(splitPartialRefund({ remainingDeal: 0, refundAmount: 5000, orderTotal: 10000 })).toEqual({ card: 5000, deal: 0 })
  })
})
