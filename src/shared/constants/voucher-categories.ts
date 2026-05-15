/**
 * 🛡️ 2026-05-15: voucher 카테고리 단일 source (TD-G03 해결).
 *
 * 이전: group-buy.routes.ts / seller-orders.routes.ts / disputes.routes.ts /
 *        og-image.routes.ts / affiliate.routes.ts / sitemap.routes.ts /
 *        SellerMealVoucherNewPage.tsx / GroupBuyDetailPage.tsx 등 8+ 파일에서
 *        ['meal_voucher', 'beauty_voucher', ...] 6개 배열 반복 선언 → 누락 위험.
 *
 * 사용:
 *   import { VOUCHER_CATEGORIES, isVoucherCategory } from '@/shared/constants/voucher-categories'
 *   if (isVoucherCategory(p.category)) { ... }
 */

export const VOUCHER_CATEGORIES = [
  'meal_voucher',
  'beauty_voucher',
  'health_voucher',
  'pet_voucher',
  'stay_voucher',
  'activity_voucher',
] as const

export type VoucherCategory = typeof VOUCHER_CATEGORIES[number]

export const VOUCHER_CATEGORY_SET: ReadonlySet<string> = new Set(VOUCHER_CATEGORIES)

export function isVoucherCategory(category: string | undefined | null): category is VoucherCategory {
  return !!category && VOUCHER_CATEGORY_SET.has(category)
}

/** SQL IN-clause 용 placeholder + bindings */
export function voucherCategoriesSqlClause(): { placeholders: string; values: readonly string[] } {
  return {
    placeholders: VOUCHER_CATEGORIES.map(() => '?').join(','),
    values: VOUCHER_CATEGORIES,
  }
}

/** 카테고리 → 한글 라벨 + emoji */
export const VOUCHER_CATEGORY_LABEL: Record<VoucherCategory, { emoji: string; label: string; short: string }> = {
  meal_voucher:     { emoji: '🍽️', label: '식사 공구권',     short: '식사' },
  beauty_voucher:   { emoji: '💇', label: '뷰티 공구권',     short: '뷰티' },
  health_voucher:   { emoji: '💪', label: '헬스 공구권',     short: '헬스' },
  pet_voucher:      { emoji: '🐶', label: '반려 공구권',     short: '펫' },
  stay_voucher:     { emoji: '🏨', label: '숙박 공구권',     short: '숙박' },
  activity_voucher: { emoji: '🎯', label: '액티비티 공구권', short: '액티비티' },
}
