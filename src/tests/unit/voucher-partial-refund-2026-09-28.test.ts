/**
 * 🎟️ 이용권 일부 환불 (2026-09-28 대표 *"일부 환불 가능하게 해줘"*) — 머니 경로 가드.
 *
 * 이 기능의 위험은 "안 된다"가 아니라 **"돈은 돌려주고 물건은 그대로 남는다"** 다.
 * 그래서 시험의 무게중심도 거기에 둔다: 무른 장수와 돌려준 금액과 회수한 장이 **셋 다 같은가**.
 *
 * ⚠️ **이 시험이 못 하는 것**: 토스가 실제로 부분취소를 받아 주는지는 못 잰다(외부 PG).
 *   그래서 이 변경은 게이트 뒤에 있고 staging 실결제가 필수다 — `docs/STAGING_CHECKLIST.md` P17.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { planPartialVoucherRefund, isVoucherOrder } from '@/shared/partial-voucher-refund'
import { stripComments } from '../helpers/source-text'

const V = (id: number, status = 'unused', applied_price: number | null = 15000) => ({ id, status, applied_price })

describe('장수 → 금액 계산 (금액은 입력이 아니라 결과다)', () => {
  it('🔴 "총액 −1원" 으로 거의 전액을 받고 이용권을 지키는 길이 없다', () => {
    // 금액을 아예 안 받는다. 장수만 받고 금액은 여기서 만든다 — 그게 이 설계의 전부다.
    const p = planPartialVoucherRefund({ vouchers: [V(1), V(2), V(3)], requestedQty: 1, orderTotal: 45000 })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.amount).toBe(15000)          // 44,999 같은 값을 만들 방법이 없다
    expect(p.voucherIds).toEqual([1])     // 그리고 정확히 그 한 장만 회수된다
  })

  it('이미 쓴 이용권은 못 무른다 (매장이 이미 내줬다)', () => {
    const p = planPartialVoucherRefund({ vouchers: [V(1, 'used'), V(2, 'used')], requestedQty: 1, orderTotal: 30000 })
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.code).toBe('NO_REFUNDABLE_VOUCHER')
  })

  it('쓴 장이 섞여 있으면 **안 쓴 장만** 고른다', () => {
    const p = planPartialVoucherRefund({ vouchers: [V(1, 'used'), V(2), V(3)], requestedQty: 5, orderTotal: 45000 })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.voucherIds).toEqual([2, 3])  // 1번은 안 건드린다
    expect(p.amount).toBe(30000)
    expect(p.isFull, '쓴 장이 남아 있으므로 전체 취소가 아니다').toBe(false)
  })

  it('고른 장수가 남은 것보다 많으면 남은 만큼만', () => {
    const p = planPartialVoucherRefund({ vouchers: [V(1), V(2)], requestedQty: 99, orderTotal: 30000 })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.voucherIds).toHaveLength(2)
  })

  it('전부 미사용인데 전부 무르면 isFull — 호출부가 전액 경로로 보낸다', () => {
    const p = planPartialVoucherRefund({ vouchers: [V(1), V(2)], requestedQty: 2, orderTotal: 30000 })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.isFull).toBe(true)
    expect(p.amount, '전액은 반올림 합이 아니라 잔액 그대로여야 1원이 안 남는다').toBe(30000)
  })

  it('applied_price 가 없으면 총액을 장수로 나눈다', () => {
    const p = planPartialVoucherRefund({ vouchers: [V(1, 'unused', null), V(2, 'unused', null), V(3, 'unused', null)], requestedQty: 1, orderTotal: 30000 })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.amount).toBe(10000)
  })

  it('이미 환불된 금액이 있으면 잔액을 못 넘는다', () => {
    const p = planPartialVoucherRefund({ vouchers: [V(1, 'used'), V(2, 'unused', 15000)], requestedQty: 1, orderTotal: 30000, alreadyRefunded: 29000 })
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.amount).toBe(1000)
  })

  it('장수가 0·음수·소수면 거절', () => {
    for (const q of [0, -1, 0.5, NaN]) {
      const p = planPartialVoucherRefund({ vouchers: [V(1)], requestedQty: q, orderTotal: 15000 })
      expect(p.ok, `qty=${q}`).toBe(false)
    }
  })

  it('이용권이 없는 주문(배송 상품)은 이 규칙 대상이 아니다', () => {
    expect(isVoucherOrder([])).toBe(false)
    const p = planPartialVoucherRefund({ vouchers: [], requestedQty: 1, orderTotal: 10000 })
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.code).toBe('NOT_A_VOUCHER_ORDER')
  })

  it('어느 장을 회수하는지가 실행마다 달라지지 않는다 (id 오름차순 고정)', () => {
    const a = planPartialVoucherRefund({ vouchers: [V(9), V(3), V(7)], requestedQty: 2, orderTotal: 45000 })
    const b = planPartialVoucherRefund({ vouchers: [V(7), V(9), V(3)], requestedQty: 2, orderTotal: 45000 })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.voucherIds).toEqual([3, 7])
    expect(b.voucherIds).toEqual(a.voucherIds)
  })
})

describe('배선 — 모듈만 맞고 라우트가 안 부르면 라이브는 그대로다', () => {
  const route = stripComments(fs.readFileSync('src/worker/routes/order.routes.ts', 'utf8'))
  const impl = stripComments(fs.readFileSync('src/worker/utils/voucher-partial-refund.ts', 'utf8'))
  const clawback = stripComments(fs.readFileSync('src/worker/utils/voucher-settlement-clawback.ts', 'utf8'))

  it('취소 엔드포인트가 cancel_qty 를 받아 넘긴다', () => {
    expect(route).toMatch(/cancel_qty\?: number/)
    expect(route).toMatch(/tryVoucherPartialRefund\(c, order, body\.cancel_qty, reason\)/)
    expect(route).toMatch(/if \(vPartial\) return vPartial/)
  })

  it('🔴 게이트가 기본 OFF — 켜기 전에는 403 이고 나머지 경로는 그대로다', () => {
    // ⚠️ 함수가 **존재하는지**가 아니라 **불리는지**를 본다. 정의만 보면 호출을 지워도 초록이다
    //   (주입 러너가 정확히 그걸 잡았다).
    expect(impl).toMatch(/if \(!\(await isVoucherPartialRefundEnabled\(DB\)\)\) \{/)
    expect(impl).toMatch(/VOUCHER_PARTIAL_REFUND_DISABLED/)
    expect(impl).toMatch(/String\(row\?\.value \?\? 'false'\) === 'true'/)
  })

  it('🔴 돈보다 **먼저** 잔액을 선점한다 (claim-before-credit)', () => {
    // ⚠️ SQL 문자열의 **위치**만 보면 결과를 안 쓰는 변수에 담아도 초록이다(주입 러너가 잡았다).
    //   예약 결과가 `reserve` 이고, 그 `changes` 로 실제 분기하는지까지 본다.
    expect(impl).toMatch(/const reserve = await DB\.prepare\(/)
    expect(impl).toMatch(/if \(!reserve \|\| \(reserve\.meta\?\.changes \?\? 0\) === 0\)/)
    const casAt = impl.indexOf('const reserve = await DB.prepare(')
    const tossAt = impl.indexOf('tossCancelPayment(')
    expect(casAt, 'CAS 예약이 없다').toBeGreaterThan(0)
    expect(tossAt, '토스 호출이 없다').toBeGreaterThan(0)
    expect(casAt, '토스보다 뒤에 예약하면 동시 요청이 이중 환불된다').toBeLessThan(tossAt)
    // 토스가 거절하면 예약을 되돌려야 한다 — 안 되돌리면 실패한 환불이 잔액을 갉아먹는다.
    expect(impl).toMatch(/rollback\('toss'\)/)
  })

  it('🔴 결제키는 두 칸을 다 본다 (이용권 주문이 막혀 있던 이유)', () => {
    expect(impl).toMatch(/toss_payment_key \|\| pay\?\.payment_key/)
  })

  it('🔴 무른 장만 회수한다 — 주문 전체를 넘기지 않는다', () => {
    expect(impl).toMatch(/clawbackVoucherSettlementOnRefund\(DB, orderId, [^,]+, plan\.voucherIds\)/)
    // 회수 헬퍼는 빈 배열을 "전체" 로 넓히면 안 된다 — 그 실수가 제일 비싸다.
    expect(clawback).toMatch(/if \(onlyVoucherIds && onlyVoucherIds\.length === 0\) return out/)
    expect(clawback).toMatch(/AND v\.id IN \(/)
  })

  it('🔴 커미션 전액 역전 헬퍼를 부분 환불에 부르지 않는다 (과다 역전 = 남의 돈)', () => {
    expect(impl).not.toMatch(/reverseOrderAncillaryOnRefund/)
    expect(impl).not.toMatch(/refundOrderFully/)
  })

  it('남은 것을 전부 무르면 전액 경로로 넘긴다(여기서 처리하지 않는다)', () => {
    expect(impl).toMatch(/if \(plan\.isFull\) return null/)
  })
})
