/**
 * 🛡️ 2026-05-17: 카테고리 4종 통합 (이전 6종 → 4종).
 *
 * 이전: meal / beauty / health / pet / stay / activity (6종)
 * 지금: meal / beauty / stay / etc (4종)
 *   - health → beauty 로 통합 (둘 다 미용/웰니스 범주)
 *   - pet + activity + 기타 → etc 로 통합
 *
 * 대분류:
 *   - 오프라인 (offline)  — 매장 방문 voucher 4종 (이 파일이 다룸)
 *   - 온라인 (online)     — 일반 e-commerce 상품 (배송)
 *
 * 마이그레이션: migrations/0255_consolidate_categories.sql 가 기존 row 를 새 카테고리로 UPDATE.
 *
 * 사용:
 *   import { VOUCHER_CATEGORIES, isVoucherCategory, isOfflineProduct } from '@/shared/constants/voucher-categories'
 */

export const VOUCHER_CATEGORIES = [
  'meal_voucher',
  'beauty_voucher',
  'stay_voucher',
  'etc_voucher',
] as const

export type VoucherCategory = typeof VOUCHER_CATEGORIES[number]

export const VOUCHER_CATEGORY_SET: ReadonlySet<string> = new Set(VOUCHER_CATEGORIES)

/** 🛡️ 레거시 카테고리 호환 — 기존 row 가 마이그레이션 전이거나 임시 미반영 시 대비. */
export const LEGACY_CATEGORY_MAP: Record<string, VoucherCategory> = {
  health_voucher: 'beauty_voucher',
  pet_voucher: 'etc_voucher',
  activity_voucher: 'etc_voucher',
}

/** 레거시 카테고리도 voucher 로 인식 (마이그레이션 사이 graceful). */
export function isVoucherCategory(category: string | undefined | null): boolean {
  if (!category) return false
  return VOUCHER_CATEGORY_SET.has(category) || category in LEGACY_CATEGORY_MAP
}

/** 레거시 카테고리를 새 카테고리로 정규화. */
export function normalizeCategory(category: string | undefined | null): VoucherCategory | null {
  if (!category) return null
  if (VOUCHER_CATEGORY_SET.has(category)) return category as VoucherCategory
  return LEGACY_CATEGORY_MAP[category] ?? null
}

/** 🛡️ 대분류 — 오프라인 (voucher 4종) vs 온라인 (일반 상품). */
export function isOfflineProduct(category: string | undefined | null): boolean {
  return isVoucherCategory(category)
}
export function isOnlineProduct(category: string | undefined | null): boolean {
  return !!category && !isOfflineProduct(category)
}

/** SQL IN-clause 용 placeholder + bindings (legacy 포함 — 마이그레이션 사이 row 모두 매칭). */
export function voucherCategoriesSqlClause(): { placeholders: string; values: readonly string[] } {
  const all = [...VOUCHER_CATEGORIES, ...Object.keys(LEGACY_CATEGORY_MAP)]
  return {
    placeholders: all.map(() => '?').join(','),
    values: all,
  }
}

/** 카테고리 → 한글 라벨 + emoji (legacy 도 포함 — 정규화 안 된 row 도 표시 가능). */
export const VOUCHER_CATEGORY_LABEL: Record<string, { emoji: string; label: string; short: string }> = {
  // 새 카테고리 4종
  meal_voucher:   { emoji: '🍽️', label: '식사권 (음식점/카페)', short: '식사' },
  beauty_voucher: { emoji: '💇', label: '미용 (헬스/뷰티)',     short: '미용' },
  stay_voucher:   { emoji: '🏨', label: '숙소',                  short: '숙소' },
  etc_voucher:    { emoji: '🎯', label: '기타',                  short: '기타' },
  // 레거시 (마이그레이션 사이 graceful 표시용 — 새 라벨로 매핑)
  health_voucher:   { emoji: '💇', label: '미용 (헬스/뷰티)', short: '미용' },
  pet_voucher:      { emoji: '🎯', label: '기타',              short: '기타' },
  activity_voucher: { emoji: '🎯', label: '기타',              short: '기타' },
}

// 🛡️ 2026-05-21: 카테고리 short 라벨 (알림톡 / push 메시지용).
//   "식사권" hardcode 가 곳곳에 있었음 — 모든 voucher 카테고리에서 동작하려면 이 헬퍼로 통일.
//   fallback: '바우처' (알려지지 않은 카테고리도 graceful).
export function getVoucherShortLabel(category: string | null | undefined): string {
  if (!category) return '바우처'
  const m = VOUCHER_CATEGORY_LABEL[category]
  return m ? `${m.short}권` : '바우처'
}
