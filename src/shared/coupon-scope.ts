/**
 * 🎟️🔐 2026-11-18 (대표 승인 "5건 모두 지금 수정") — 쿠폰이 **어느 상품에 통하는가** · 사업자가 만드는 쿠폰의 값 범위.
 *
 * 종전: 결제 경로 두 곳(딜 결제 `/api/points/pay` · 카드 주문 `/api/orders`)이 쿠폰을 **번호로만** 찾았다.
 *   `coupons.seller_id`(만든 매장)를 안 봐서 아무 사업자나 만든 쿠폰이 모든 매장 상품에 통했고,
 *   만들 때 값 검사가 없어 "정액 100만 원" 쿠폰으로 교환권(기프티콘)을 0딜에 살 수 있었다.
 *
 * 규칙(순수 함수 — 서버 두 경로와 시험이 같은 것을 읽는다):
 *   - 매장 쿠폰(seller_id 있음)은 **주문의 모든 상품이 그 매장 것**일 때만 통한다.
 *   - 플랫폼 쿠폰(seller_id 없음 — 어드민 발행)은 종전대로.
 *   - 아직 시작 전(starts_at 미래)이면 안 통한다.
 *   - 사업자가 만드는 쿠폰: 정률은 1~90%, 정액은 1~1,000,000원, 수량은 1~100,000.
 *
 * ## 못 막는 것
 * - 사장님이 **자기 매장** 상품에 큰 쿠폰을 뿌리는 것 — 그건 본인 매출을 깎는 정상 행위다.
 * - 플랫폼 쿠폰의 값(어드민 발행분)은 여기서 안 본다.
 */

export interface CouponScopeRow {
  seller_id?: number | string | null
  starts_at?: string | null
}

/** 이 쿠폰이 이 주문(상품들의 매장 id 목록)에 통하는가. */
export function couponAppliesToOrder(
  coupon: CouponScopeRow,
  itemSellerIds: ReadonlyArray<number | string | null | undefined>,
  nowMs: number = Date.now(),
): boolean {
  if (coupon.starts_at) {
    const t = Date.parse(coupon.starts_at)
    if (Number.isFinite(t) && t > nowMs) return false
  }
  const owner = Number(coupon.seller_id)
  if (!Number.isInteger(owner) || owner <= 0) return true // 플랫폼 쿠폰
  if (itemSellerIds.length === 0) return false
  return itemSellerIds.every((s) => Number(s) === owner)
}

export const SELLER_COUPON_MAX_PERCENT = 90
export const SELLER_COUPON_MAX_FIXED = 1_000_000
export const SELLER_COUPON_MAX_COUNT = 100_000

export type SellerCouponInput = {
  type?: unknown; value?: unknown; min_order?: unknown; max_discount?: unknown; total_count?: unknown
}
export type SellerCouponClean =
  | { ok: true; type: 'percent' | 'fixed'; value: number; minOrder: number; maxDiscount: number | null; totalCount: number }
  | { ok: false; error: string }

/** 사업자가 만드는 쿠폰의 값 검사 — 통과하면 저장할 값을 돌려준다. */
export function cleanSellerCoupon(input: SellerCouponInput): SellerCouponClean {
  const type = input.type === undefined || input.type === null || input.type === '' ? 'fixed' : input.type
  if (type !== 'percent' && type !== 'fixed') return { ok: false, error: '할인 방식이 올바르지 않습니다' }
  const value = Number(input.value)
  if (!Number.isInteger(value) || value <= 0) return { ok: false, error: '할인 값은 1 이상의 정수여야 합니다' }
  if (type === 'percent' && value > SELLER_COUPON_MAX_PERCENT) return { ok: false, error: `정률 쿠폰은 최대 ${SELLER_COUPON_MAX_PERCENT}%까지 가능합니다` }
  if (type === 'fixed' && value > SELLER_COUPON_MAX_FIXED) return { ok: false, error: '정액 쿠폰은 최대 100만 원까지 가능합니다' }
  const minOrder = input.min_order === undefined || input.min_order === null || input.min_order === '' ? 0 : Number(input.min_order)
  if (!Number.isInteger(minOrder) || minOrder < 0) return { ok: false, error: '최소 주문금액이 올바르지 않습니다' }
  let maxDiscount: number | null = null
  if (!(input.max_discount === undefined || input.max_discount === null || input.max_discount === '' || input.max_discount === 0)) {
    const md = Number(input.max_discount)
    if (!Number.isInteger(md) || md <= 0 || md > SELLER_COUPON_MAX_FIXED) return { ok: false, error: '최대 할인액이 올바르지 않습니다' }
    maxDiscount = md
  }
  const totalCount = input.total_count === undefined || input.total_count === null || input.total_count === '' ? 100 : Number(input.total_count)
  if (!Number.isInteger(totalCount) || totalCount <= 0 || totalCount > SELLER_COUPON_MAX_COUNT) return { ok: false, error: '발행 수량이 올바르지 않습니다' }
  return { ok: true, type, value, minOrder, maxDiscount, totalCount }
}

/**
 * 교환권(deal_only = 현금성)은 쿠폰으로 깎지 않는다 — 쿠폰 할인은 **교환권이 아닌 상품의 합**을 넘지 못한다.
 * 종전엔 일반 상품 하나를 끼워 넣으면 쿠폰이 교환권 값까지 지웠다.
 */
export function capCouponToCouponable(
  computed: number, items: ReadonlyArray<{ deal_only: boolean; price: number; quantity: number }>,
): number {
  const couponable = items.filter((i) => !i.deal_only).reduce((sum, i) => sum + i.price * i.quantity, 0)
  return Math.max(0, Math.min(computed, couponable))
}

/** 결제 수량 — 1 이상 999 이하의 **정수**만. (0.01 개를 사면 값은 1% 인데 교환권은 한 장이 나갔다.) */
export function isValidPurchaseQty(qty: unknown): boolean {
  return typeof qty === 'number' && Number.isInteger(qty) && qty >= 1 && qty <= 999
}

/** 🔐 광고 보상 지급 스위치 — 광고망의 서버 검증(시청 증명) 없이 켜지 말 것. 종전엔 호출만 하면 딜이 나갔다(라이브 지급 0건). */
export const AD_REWARD_DISABLED = true
