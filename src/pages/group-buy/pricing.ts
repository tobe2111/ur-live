/**
 * 💰 이용권 상세 **가격 파생값 SSOT** (2026-08-19).
 *
 * ## 왜 분리했나
 * 같은 상품이 **홈 카드엔 `-26%`, 상세엔 할인 표시 없음**으로 갈려 있었다(실측: id 2846,
 * 정가 32,000 → 23,800). 카드(`GroupBuyFeedCard`)는 *선언 할인율과 정가-판매가 계산값 중 큰 쪽*을
 * 쓰는데, 상세는 `current_discount_pct`(티어 파생)만 봤기 때문이다. 화면마다 다른 할인율은
 * 단순 UI 불일치가 아니라 **가격 표시 신뢰 문제**다.
 *
 * ⚠️ `displayDiscountPct` 는 **표시 전용**이다 — 결제 금액(`unitPrice`)은 서버가 준
 * `current_discount_pct` 로만 계산한다(여기서 바꾸면 결제가가 바뀐다).
 */

export interface PricingInput {
  price: number
  original_price?: number
  current_discount_pct: number
}

export interface Pricing {
  /** 실제 결제 단가 — 서버 할인율만 반영(표시용 폴백을 절대 섞지 않는다). */
  unitPrice: number
  /** 비교 기준가 = 정가(있고 결제가보다 클 때) 또는 공구 기준가. */
  refPrice: number
  /** 1매당 절약액. */
  unitSaving: number
  /** 화면에 찍는 할인율 — 서버값이 0이면 정가 대비로 계산(카드와 같은 규칙). */
  displayDiscountPct: number
}

export function derivePricing(detail: PricingInput | null | undefined): Pricing {
  if (!detail) return { unitPrice: 0, refPrice: 0, unitSaving: 0, displayDiscountPct: 0 }
  const unitPrice = Math.round(detail.price * (1 - (detail.current_discount_pct || 0) / 100))
  const refPrice = detail.original_price && detail.original_price > unitPrice ? detail.original_price : detail.price
  const unitSaving = Math.max(0, refPrice - unitPrice)
  const computed = refPrice > unitPrice && refPrice > 0 ? Math.round(((refPrice - unitPrice) / refPrice) * 100) : 0
  return {
    unitPrice,
    refPrice,
    unitSaving,
    displayDiscountPct: detail.current_discount_pct > 0 ? detail.current_discount_pct : computed,
  }
}
