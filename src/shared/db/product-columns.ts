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
  // ⚠️ shipping_fee/base_shipping_fee 는 orders/sellers 컬럼 — products 에 존재하지 않음.
  //   2026-06-10 사고 정리 때 잘못 포함 → 모든 상세 쿼리가 'no such column' 1차 실패하던 진짜 원인.
  //   (검증: scripts/check-product-detail-fields-repairable.mjs 가 CI 에서 차단)
  'created_at', 'updated_at',
] as const

/** `p.id, p.name, ...` 형태로 alias prefix 부여. */
export function productDetailCols(alias = 'p'): string {
  return PRODUCT_DETAIL_FIELDS.map((c) => `${alias}.${c}`).join(', ')
}

// 🛡️ 2026-06-10 자가치유: 프로덕션 products 에 없는 컬럼이 목록에 섞이면 'no such column' 으로
//   상세가 통째로 500 (스모크가 검출). 환경별 스키마 편차를 추측하지 않고 — 에러에서 컬럼명을
//   추출해 목록에서 제외(모듈 캐시) 후 재시도. repair-schema 가 컬럼을 만들면 새 isolate 부터 전체 복귀.
const _missingCols = new Set<string>()

export function productDetailColsHealed(alias = 'p'): string {
  return PRODUCT_DETAIL_FIELDS.filter((c) => !_missingCols.has(c)).map((c) => `${alias}.${c}`).join(', ')
}

/** 'no such column' 에러면 해당 컬럼을 prune 하고 true(재시도 가능) 반환. */
export function pruneMissingProductColumn(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err)
  const m = msg.match(/no such column:?\s*(?:[A-Za-z_]+\.)?([A-Za-z_0-9]+)/i)
  if (!m) return false
  const col = m[1]
  if (!(PRODUCT_DETAIL_FIELDS as readonly string[]).includes(col) || _missingCols.has(col)) return false
  _missingCols.add(col)
  console.error('[product-columns] 프로덕션 미존재 컬럼 자동 제외:', col, '— repair-schema 등록 필요')
  return true
}

/** 컬럼 prune 재시도 래퍼 — fn 은 productDetailColsHealed() 로 SQL 을 만들 것. */
export async function withColumnPruning<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i <= PRODUCT_DETAIL_FIELDS.length; i++) {
    try { return await fn() } catch (e) { if (!pruneMissingProductColumn(e)) throw e }
  }
  return fn()
}
