/**
 * 🧭 **주문 한 건이 지금 어느 단계인가** — 셀러 주문 탭·"처리 대기" 숫자의 SSOT.
 *
 * ## 왜 생겼나 (2026-10-07 대표 *"남은 것들 다 이상적으로 진행해줘"* — 2026-10-06 제안의 이행)
 * 주문 탭이 **택배용**이었다: [처리 대기 → 준비 중 → 완료]. 이용권엔 배송이 없어서 사장님이
 * [주문 확인] 을 눌러 "준비 중"으로 옮길 이유도, "배송 완료"로 끝낼 길도 없다 ⇒ 이용권 주문이
 * **영원히 "처리 대기"** 에 쌓였다. 그 숫자가 홈 티켓·마이 판매 구역·매장 요약에 그대로 찍혀,
 * 할 일이 없는 사장님에게 매일 "처리 대기 N건" 이라고 재촉하고 있었다(에러가 안 나서 아무도 신고 안 함).
 *
 * ## 규칙
 * - **배송 주문**: 종전 그대로 — 결제 끝·확인 전 = `waiting` · 준비/발송 = `preparing` · 배송완료 = `done`.
 * - **이용권 주문**: 사장님이 할 일은 **매장에서 사용처리** 하나다 ⇒ 미사용 장이 남아 있으면 `unused`,
 *   다 썼으면 `done`. 발급 목록을 모르면(구 응답·조회 실패) `unused` — 결제는 끝났으니 "아직 안 씀"이 맞다.
 * - **교환권 주문**: 휴대폰으로 발송되면 끝이라 사장님 할 일이 없다 ⇒ `done`.
 * - 취소·환불은 종류 무관 `refunded`. 결제 전(PENDING 등)은 `other`.
 *
 * 🔴 **종류 판정은 여기서 하지 않는다** — 서버가 실어 보낸 `order_kind` 를 `orderKindOf` 로 읽기만 한다
 *    (`order-kind.ts` 가 그 이유를 적어 뒀다). 서버 집계 쪽 짝은 `db/shipping-order-sql.ts`.
 */
import { orderKindOf, isNoShippingOrder } from './order-kind'

export type OrderStage = 'waiting' | 'preparing' | 'unused' | 'done' | 'refunded' | 'other'

/** 결제 끝 · 셀러 확인 전. `seller-orders/statusHelpers.nextStatusOf` 가 PREPARING 으로 보내는 집합. */
export const PAID_AWAITING_CONFIRM: ReadonlySet<string> = new Set(['PAID', 'DONE', 'PAY_COMPLETE'])
const PREPARING: ReadonlySet<string> = new Set(['PREPARING', 'SHIPPING'])
const PAID_ANY: ReadonlySet<string> = new Set(['PAID', 'DONE', 'PAY_COMPLETE', 'PREPARING', 'SHIPPING', 'DELIVERED'])
const REFUNDED: ReadonlySet<string> = new Set(['CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_REQUIRED'])

export interface OrderStageInput {
  status?: string | null
  order_kind?: string | null
  vouchers?: Array<{ status?: string | null }> | null
}

export function orderStageOf(o: OrderStageInput): OrderStage {
  const status = String(o.status ?? '').toUpperCase()
  if (REFUNDED.has(status)) return 'refunded'
  const kind = orderKindOf(o.order_kind)

  if (isNoShippingOrder(kind)) {
    if (!PAID_ANY.has(status)) return 'other'
    if (kind === 'deal') return 'done'
    const vs = o.vouchers
    // 모르면(undefined/null) 또는 아직 0장이면 "안 씀" — 결제는 끝났다.
    if (!vs || vs.length === 0) return 'unused'
    return vs.some((v) => String(v.status ?? '') === 'unused') ? 'unused' : 'done'
  }

  if (PAID_AWAITING_CONFIRM.has(status)) return 'waiting'
  if (PREPARING.has(status)) return 'preparing'
  if (status === 'DELIVERED') return 'done'
  return 'other'
}

/** 사장님이 **지금 눌러야 하는** 주문인가(= "처리 대기"). 이용권·교환권은 여기에 들어오지 않는다. */
export function needsSellerConfirm(o: OrderStageInput): boolean {
  return orderStageOf(o) === 'waiting'
}
