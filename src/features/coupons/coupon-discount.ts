/**
 * 💸 쿠폰 할인 계산 — 순수 SSOT (서버 권위).
 *
 * 배경: 쿠폰 할인은 두 곳에서 계산된다 — ① 결제 확정용 `POST /coupons/use`,
 * ② 주문 생성 시 total_amount 에 반영(`/api/orders`). 둘이 어긋나면 confirm 금액불일치
 * 또는 과다할인이 난다. 이 순수함수가 단일 진실원천 — 양쪽이 import 해 동일 규칙 사용.
 *
 * 규칙 (기존 /coupons/use 로직과 byte-동일):
 *  - percent: round(base × value/100), **반드시 max_discount 캡**(없으면 base 로 폴백 — 조작 방지).
 *  - fixed:   value, max_discount 있으면 그 이하로 캡.
 *  - 어떤 경우도 base(주문 기준액) 초과 불가, 음수 불가.
 *
 * ⚠️ 순수함수 — DB 접근/멱등/소유권 검증은 호출자 책임 (claim-before-credit, CLAUDE.md 머니 룰).
 */

export interface CouponDiscountInput {
  /** 'percent' | 'fixed' (그 외 타입은 fixed 로 취급) */
  type: string
  /** percent=비율(%), fixed=정액(원) */
  value: number
  /** 최대 할인액 캡 (percent 는 필수에 준함 — null 이면 base 로 폴백) */
  max_discount: number | null
}

/**
 * 쿠폰 행 + 기준금액 → 적용 할인액(원, 정수).
 * @param coupon 쿠폰 행 (type/value/max_discount)
 * @param baseAmount 할인 기준 금액 (보통 소계+배송비). 음수/NaN 은 0 처리.
 */
export function computeCouponDiscount(coupon: CouponDiscountInput, baseAmount: number): number {
  const base = Math.max(0, Math.floor(Number(baseAmount) || 0))
  if (base <= 0) return 0
  const value = Number(coupon.value)
  if (!Number.isFinite(value) || value <= 0) return 0

  let computed = coupon.type === 'percent'
    ? Math.round((base * value) / 100)
    : Math.round(value)

  // percent 는 반드시 캡 (없으면 base 로 폴백 — 큰 주문 과다할인 차단)
  if (coupon.type === 'percent') {
    const cap = coupon.max_discount ?? base
    if (computed > cap) computed = cap
  } else if (coupon.max_discount != null && computed > coupon.max_discount) {
    computed = coupon.max_discount
  }

  if (computed > base) computed = base
  if (!Number.isFinite(computed) || computed < 0) computed = 0
  return Math.round(computed)
}
