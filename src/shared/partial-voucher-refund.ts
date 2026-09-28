/**
 * 💸 이용권 **일부 환불** — 몇 장을 무를지 정하고, 그만큼의 금액을 계산한다 (2026-09-28 대표 *"일부 환불 가능하게 해줘"*).
 *
 * ## 왜 "금액"이 아니라 "장수"인가 (설계 결정)
 *
 * 종전 부분 취소는 사람이 **금액을 직접 입력**했다. 배송 상품이라면 "포장이 찢어졌으니 5,000원만"
 * 이 말이 되지만, **이용권에서는 말이 안 된다**:
 *   - 45,000원짜리 3장 주문에서 7,000원을 돌려주면 **몇 장을 회수해야 하는가?** 답이 없다.
 *   - 답이 없으니 종전 코드는 **한 장도 회수하지 않았다** → 총액에서 1원만 뺀 금액을 넣으면
 *     거의 전액을 돌려받고 **이용권 3장을 그대로 쓴다**. (지금은 이용권 주문이 결제키를 못 찾아
 *     422 로 막혀 있어서 이 구멍이 안 열려 있을 뿐이다 — 키만 채워 길을 열면 그날 열린다.)
 *
 * ⇒ 이용권은 **장 단위**로만 무른다. 사용자가 장수를 고르면 **금액은 서버가 계산**한다.
 *   금액이 입력이 아니라 결과이므로 위 구멍이 **구조적으로** 생길 수 없다.
 *
 * ## 무엇을 못 무르나
 * **이미 쓴 이용권은 못 무른다**(`status='used'`). 매장이 이미 음식을 내줬다 — 그걸 셀프로
 * 환불하면 매장이 손해를 본다. 그건 분쟁이고 사람이 판단할 일이다(반품·고객센터).
 *
 * 이 파일은 **순수 계산만** 한다. DB 쓰기·토스 취소·이용권 무효화는 호출부(`order.routes.ts`).
 */

export interface RefundableVoucher {
  id: number
  /** 'unused' | 'used' | 'refunded' | 'expired' … */
  status: string
  /** 실제 결제가. 없으면 주문 총액을 장수로 나눠 쓴다. */
  applied_price: number | null
}

export interface PartialVoucherPlanInput {
  /** 이 주문의 이용권 전부(상태 무관). */
  vouchers: RefundableVoucher[]
  /** 사용자가 고른 장수. */
  requestedQty: number
  /** 주문 총액(원). */
  orderTotal: number
  /** 이미 환불된 금액(원). */
  alreadyRefunded?: number
}

export type PartialVoucherPlan =
  | {
      ok: true
      /** 무효화할 이용권 id — **정확히 이 장들만** 회수한다. */
      voucherIds: number[]
      /** 돌려줄 금액(원). 사용자가 입력한 값이 아니라 **여기서 계산된 값**이다. */
      amount: number
      /** 남은 것을 전부 무르는 경우 → 호출부는 전액 환불 경로(`refundOrderFully`)로 보낸다. */
      isFull: boolean
    }
  | { ok: false; code: 'NOT_A_VOUCHER_ORDER' | 'NO_REFUNDABLE_VOUCHER' | 'INVALID_QTY'; error: string }

/** 이 주문이 이용권 주문인가 — 장 단위 규칙을 적용할지 가르는 기준. */
export function isVoucherOrder(vouchers: RefundableVoucher[]): boolean {
  return vouchers.length > 0
}

export function planPartialVoucherRefund(input: PartialVoucherPlanInput): PartialVoucherPlan {
  const { vouchers, orderTotal } = input
  const alreadyRefunded = Math.max(0, Math.round(Number(input.alreadyRefunded ?? 0)))

  if (!isVoucherOrder(vouchers)) {
    return { ok: false, code: 'NOT_A_VOUCHER_ORDER', error: '이용권 주문이 아닙니다' }
  }

  const qty = Math.floor(Number(input.requestedQty))
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, code: 'INVALID_QTY', error: '환불할 장수를 1장 이상으로 골라 주세요' }
  }

  // **미사용만** 무를 수 있다. 정렬은 id — 어느 장을 회수하는지가 실행마다 달라지면 안 된다.
  const refundable = vouchers
    .filter(v => String(v.status || '').toLowerCase() === 'unused')
    .sort((a, b) => a.id - b.id)

  if (refundable.length === 0) {
    return {
      ok: false,
      code: 'NO_REFUNDABLE_VOUCHER',
      error: '환불할 수 있는 이용권이 없습니다. 이미 사용했거나 환불된 이용권입니다',
    }
  }

  // 고른 장수가 남은 것보다 많으면 **남은 만큼만**. 에러로 되돌리는 것보다 낫다
  // (사용자는 "3장 무를래" 라고 했고 2장이 남았으면 2장을 무르는 것이 의도에 가깝다).
  const k = Math.min(qty, refundable.length)
  const picked = refundable.slice(0, k)

  // 남은 미사용을 **전부** 무르고, 쓴 장이 하나도 없으면 = 주문 전체 취소다.
  const isFull = k === refundable.length && refundable.length === vouchers.length

  const remaining = Math.max(0, Math.round(orderTotal) - alreadyRefunded)

  // 전액이면 장당 단가를 합치지 않고 **잔액 그대로** — 반올림으로 몇 원이 남는 일이 없게.
  if (isFull) {
    return { ok: true, voucherIds: picked.map(v => v.id), amount: remaining, isFull: true }
  }

  const fallbackUnit = vouchers.length > 0 ? Math.round(Math.round(orderTotal) / vouchers.length) : 0
  const amount = picked.reduce((sum, v) => {
    const p = Math.round(Number(v.applied_price ?? 0))
    return sum + (p > 0 ? p : fallbackUnit)
  }, 0)

  return {
    ok: true,
    voucherIds: picked.map(v => v.id),
    // 잔액을 넘을 수는 없다 — 넘으면 이미 어딘가 어긋난 것이고, 넘겨 주는 쪽이 더 나쁘다.
    amount: Math.max(0, Math.min(amount, remaining)),
    isFull: false,
  }
}
