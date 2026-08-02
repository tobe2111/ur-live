/**
 * 💸 **부분환불 금액 판정** — 세션 ④-c (머니 경로 · 게이트 뒤)
 *
 * ## 🔴 이 파일이 없어서 무슨 일이 있었나
 * `returns.refund_amount` 는 **반품 신청 시점에 주문 총액으로 한 번 박히고**
 * (`returns.routes.ts` POST `/request`), **그 값을 바꾸는 엔드포인트가 하나도 없었다**
 * (`approve` 는 `status` 만 UPDATE). 환불 실행기는 그 값을 충실히 쓰므로
 * **실질적으로 전액 환불만 가능**했다.
 *
 * 재미있는 것은 **실행기는 이미 부분환불을 전제로 쓰여 있었다**는 점이다 —
 * 딜 사용분 복원이 `refunded / paidCash` **비례**이고, Toss 취소도 `amount` 를 넘긴다.
 * 즉 빠진 것은 계산이 아니라 **값을 정할 입구** 하나였다.
 *
 * ## 🔴 이 함수가 지키는 것
 * 1. **결제액을 넘지 않는다** — 넘으면 과다환불(플랫폼 손실)
 * 2. **음수가 아니다** — 음수 환불은 소비자에게서 돈을 빼앗는 것이다
 * 3. **정수(원)** — 소수점은 PG 가 거부하거나 반올림 차이로 원장이 어긋난다
 *
 * ⚠️ **얼마가 옳은지는 정하지 않는다.** 그건 사람(운영자/어드민)의 판단이고,
 *   보관구분별 자동 판정은 ④-b(`pickup-refund.ts`)의 몫이다. 여기는 **경계만** 본다.
 */

export interface RefundAmountInput {
  /** 사람이 입력한 값. 문자열·null·NaN 무엇이든 올 수 있다. */
  requested: unknown
  /** 이 주문으로 실제 결제된 금액(원). 상한. */
  orderPaidAmount: number
}

export type RefundAmountVerdict =
  | { ok: true; amount: number; clamped: boolean }
  | { ok: false; error: string }

/**
 * 입력값을 환불 가능한 금액으로 판정.
 *
 * 🔴 **조용히 잘라내지 않는다** — 상한을 넘겼으면 `clamped: true` 로 알린다.
 *   말없이 깎으면 운영자는 자기가 입력한 금액이 나간 줄 안다.
 */
export function resolveRefundAmount(i: RefundAmountInput): RefundAmountVerdict {
  const cap = Math.max(0, Math.floor(Number(i.orderPaidAmount) || 0))
  if (cap <= 0) return { ok: false, error: '이 주문의 결제 금액을 확인할 수 없습니다' }

  // 🔴 숫자·문자열만 받는다. `Number([])` 은 **0** 이라, 타입을 안 보면 `{amount: []}` 같은
  //   망가진 body 가 **0원 환불**로 통과한다(테스트가 실제로 이걸 잡았다).
  if (typeof i.requested !== 'number' && typeof i.requested !== 'string') {
    return { ok: false, error: '환불 금액을 숫자로 입력해주세요' }
  }
  const raw = typeof i.requested === 'string' ? i.requested.trim().replace(/,/g, '') : i.requested
  const n = Number(raw)

  // 빈 값·문자·Infinity 는 **0 이 아니다.** `Number('')` 이 0 이라 이 가드가 없으면
  // 입력칸을 비운 채 저장했을 때 환불이 0원이 된다(④-b 에서 실제로 났던 버그와 같은 모양).
  if (raw === '' || !Number.isFinite(n)) {
    return { ok: false, error: '환불 금액을 숫자로 입력해주세요' }
  }
  if (n < 0) return { ok: false, error: '환불 금액은 0원 이상이어야 합니다' }

  const floored = Math.floor(n)
  const amount = Math.min(cap, floored)
  return { ok: true, amount, clamped: floored > cap }
}

/** 환불 금액을 **바꿀 수 있는** 반품 상태. 환불이 나간 뒤엔 못 바꾼다. */
export const REFUND_AMOUNT_EDITABLE_STATUSES = ['requested', 'approved', 'received', 'inspected'] as const

export function canEditRefundAmount(status: string | null | undefined): boolean {
  return (REFUND_AMOUNT_EDITABLE_STATUSES as readonly string[]).includes(String(status ?? ''))
}
