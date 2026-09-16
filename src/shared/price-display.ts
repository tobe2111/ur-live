/**
 * 💸 **가격 표시 규칙 SSOT** — 정가 · 할인율 · 판매가를 한 곳에서 정한다.
 *
 * ## 왜 SSOT 인가
 * 같은 상품이 화면마다 다른 할인율을 보이면 그건 버그가 아니라 **거짓말**이다.
 * 홈 딜 카드가 "30%" 라고 한 상품이 유어쇼츠 구매 바에서 "0%" 로 보이면, 둘 중 하나는 틀렸는데
 * 에러가 안 나서 아무도 모른다. 이 레포는 정의가 갈려서 이미 한 번 당했다
 * (2026-09-03: 서버 정렬 정의와 클라 `discountOf` 가 달라 "인기순"이 인기순이 아니었다).
 *
 * ## 규칙 — `Math.max(선언값, 계산값)`
 * 🐛 2026-08-19 (대표 신고 *"할인율도 나타나야 할 것 같다"*): 이전엔 `discount_rate ?? 계산` 이라
 * 서버가 **0 을 내려주면**(컬럼 기본값 0) `??` 가 그 0 을 채택해 계산식에 못 갔다 →
 * 38,000 → 30,100 처럼 명백한 할인에도 배지가 안 떴다. 그래서 **둘 중 큰 값**을 쓴다.
 *
 * ⚠️ 이 함수는 **표시만** 정한다. 실제 청구액은 서버가 정하고 결제 경로가 재검증한다 —
 * 여기 값을 금액 계산에 쓰지 말 것.
 */

export interface PriceDisplayInput {
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
}

export interface PriceDisplay {
  /** 실제로 파는 값. */
  price: number
  /** 정가(0 이면 없음). */
  originalPrice: number
  /** 표시할 할인율 %. 0 이면 안 보인다. */
  discount: number
  /** 정가 취소선을 그릴지 — 정가가 판매가보다 **실제로 클 때만**. */
  showOriginal: boolean
  /** 할인 줄(할인율·정가) 자체를 그릴지. 둘 다 없으면 줄을 만들지 않는다. */
  hasDiscountLine: boolean
}

export function priceDisplay(p: PriceDisplayInput): PriceDisplay {
  const price = Number(p.price) || 0
  const originalPrice = Number(p.original_price) || 0
  const declared = Number(p.discount_rate) || 0
  const showOriginal = originalPrice > price && originalPrice > 0
  const computed = showOriginal ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0
  const discount = Math.max(declared, computed)
  return { price, originalPrice, discount, showOriginal, hasDiscountLine: discount > 0 || showOriginal }
}
