/**
 * 💸 **할인으로 판매가 정하기** — 이용권 등록에서 [원 / %] 를 골라 할인을 넣으면 판매가가 채워진다.
 *
 * 대표 2026-10-07: *"3000원 할인 이렇게도 선택해서 할 수 있게끔"* → 1번(등록 입력만) 확정.
 *
 * ## 진실은 판매가 하나다
 * 할인 칸은 **판매가를 쓰는 손잡이**일 뿐 따로 저장하지 않는다. 할인 칸에 보이는 값은 언제나
 * `(정가, 판매가)` 에서 **다시 계산한 값**이다 — 두 칸이 각자 값을 들고 있으면 반드시 갈린다
 * (`seller-product-edit/PriceStockFields.tsx` 가 같은 이유로 할인율을 입력받지 않는다).
 * 그래서 사장님이 판매가를 직접 고쳐도 할인 칸이 그대로 따라온다.
 *
 * ⚠️ 손님 화면의 할인 표시는 바뀌지 않는다(늘 % — `shared/price-display.ts`). % 표시 값도
 *   그 SSOT 로 계산해, 등록 화면과 손님 화면이 같은 숫자를 말하게 한다.
 */
import { priceDisplay } from '@/shared/price-display'

export type DiscountMode = 'won' | 'pct'

/** % 할인이 만드는 판매가는 10원 단위로 맞춘다 — 7,333원 같은 값은 사장님도 손님도 원하지 않는다. */
const ROUND_TO = 10
/** 100% 할인은 0원 이용권이 된다(결제가 성립하지 않는다). */
const MAX_PCT = 99

/** 정가와 할인 입력으로 판매가를 만든다. 정가가 없으면 0(할인 칸이 잠겨 있어야 하는 상태). */
export function priceFromDiscount(original: number, mode: DiscountMode, raw: number): number {
  const o = Math.max(0, Math.floor(Number(original) || 0))
  if (o <= 0) return 0
  const v = Math.max(0, Number(raw) || 0)
  if (mode === 'won') return o - Math.min(Math.floor(v), o - 1)
  const pct = Math.min(v, MAX_PCT)
  // 반올림이 정가를 넘기면 안 된다(정가 12,345원 · 0% → 12,350원 같은 역전).
  return Math.min(o, Math.max(ROUND_TO, Math.round((o * (1 - pct / 100)) / ROUND_TO) * ROUND_TO))
}

/** 할인 칸에 보여 줄 값 — 정가·판매가에서 다시 계산한다. 할인이 없으면 0. */
export function discountFromPrices(original: number, price: number, mode: DiscountMode): number {
  const o = Number(original) || 0
  const p = Number(price) || 0
  if (o <= 0 || p <= 0 || p >= o) return 0
  return mode === 'won' ? o - p : priceDisplay({ price: p, original_price: o }).discount
}
