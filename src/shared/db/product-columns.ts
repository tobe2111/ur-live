/**
 * 🛡️ 2026-06-10 (프로덕션 사고 — D1 "too many columns in result set"):
 *   products 테이블이 누적 ALTER 로 D1 결과셋 컬럼 한도(100)를 넘어 `SELECT p.*` 가
 *   조인 시(때로는 단독으로도) 전부 실패. → 소비자 경로는 반드시 이 명시 목록 사용.
 *
 *   ⚠️ 새 컬럼을 클라이언트에 노출하려면 여기에 '추가' (p.* 복귀 금지 — 재발).
 *   ⚠️ store_verify_pin / store_owner_token 은 의도적으로 제외 — p.* 시절 공개 응답에
 *      매장 검증 PIN 이 누출되고 있었음(보안 fix 동반).
 */
export const PRODUCT_DETAIL_FIELDS = [
  'id', 'seller_id', 'name', 'description', 'price', 'original_price', 'discount_rate',
  'image_url', 'thumbnail', 'images', 'category', 'stock', 'stock_quantity', 'is_active',
  'deal_only', 'sold_count', 'review_count', 'avg_rating', 'dominant_color',
  'group_buy_target', 'group_buy_current', 'group_buy_status', 'group_buy_deadline', 'group_buy_tiers',
  'restaurant_name', 'restaurant_address', 'restaurant_phone', 'restaurant_lat', 'restaurant_lng',
  'voucher_expiry', 'voucher_terms', 'referral_commission_rate',
  'shipping_fee', 'base_shipping_fee',
  'created_at', 'updated_at',
] as const

/** `p.id, p.name, ...` 형태로 alias prefix 부여. */
export function productDetailCols(alias = 'p'): string {
  return PRODUCT_DETAIL_FIELDS.map((c) => `${alias}.${c}`).join(', ')
}
