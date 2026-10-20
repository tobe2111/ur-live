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
  // 🏠 2026-10-20 대표 확정 — 생활 서비스(이사·입주청소·에어컨 청소·인테리어). 매장 방문이 아니라
  //   업체가 집으로 오는 **방문형**이다: 기사가 현장에서 사장님 앱으로 손님 QR 을 스캔해 사용 처리.
  //   이사는 값이 짐 양마다 달라 **할인권**(예 "포장이사 10만원 할인권")으로만 팔고 견적은 업체가 낸다.
  'home_voucher',
  'etc_voucher',
] as const

export type VoucherCategory = typeof VOUCHER_CATEGORIES[number]

/**
 * 🧾 SQL `category IN (…)` 에 박는 이용권 카테고리 목록 — 현행 + 레거시(마이그레이션 사이 행).
 * 2026-10-20: 이 목록이 SQL 열네 곳에 **손으로** 적혀 있어 카테고리를 하나 더하면 그중 한 곳만 빠져도
 * 그 카테고리 상품이 구매·정산·통계에서 조용히 빠졌다. 이제 전부 이 문자열을 쓴다(값은 상수 — 사용자 입력 아님).
 */
export const ALL_VOUCHER_CATEGORY_KEYS: readonly string[] = [
  ...VOUCHER_CATEGORIES,
  'health_voucher', 'pet_voucher', 'activity_voucher',
]
export const VOUCHER_CATEGORY_SQL_IN: string = ALL_VOUCHER_CATEGORY_KEYS.map((c) => `'${c}'`).join(',')

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

/**
 * 💸 이용권 최소 판매가 (2026-10-11 대표 *"1000원 이상으로만 이용권 가격을 올릴 수 있게 … 최소가격을 정하는게 좋겠네"*)
 *
 * 이용권 1장이 팔리면 알림톡이 2통(손님 발급 + 사장님 판매, 약 16원) 나가고, 중개 매장의 남는 몫은
 * 판매가의 약 2.25%(수수료 5% − 결제대행 2.75%)다 ⇒ 1,000원 아래로는 팔수록 손해가 날 수 있다.
 * 교환권(딜 결제, `deal_only=1`)은 셀러가 만들지 않으므로 대상이 아니다.
 */
export const VOUCHER_MIN_PRICE = 1000

/** 이용권 카테고리인데 최소가 미만이면 안내 문구, 아니면 null. 서버·화면이 같이 쓴다. */
export function voucherMinPriceError(category: string | undefined | null, price: number): string | null {
  if (!isVoucherCategory(category) || price >= VOUCHER_MIN_PRICE) return null
  return `이용권 판매가는 ${VOUCHER_MIN_PRICE.toLocaleString('ko-KR')}원 이상이어야 합니다.`
}

/** 레거시 카테고리를 새 카테고리로 정규화. */
export function normalizeCategory(category: string | undefined | null): VoucherCategory | null {
  if (!category) return null
  if (VOUCHER_CATEGORY_SET.has(category)) return category as VoucherCategory
  return LEGACY_CATEGORY_MAP[category] ?? null
}

/**
 * 저장 직전 카테고리 정규화 — 이용권이면 canonical 로, 아니면 그대로.
 *
 * 🐛 2026-08-22: 셀러 이용권 등록 화면은 `health_voucher`·`pet_voucher`·`activity_voucher` 도
 * 고르게 해 주는데, 이 값들은 **레거시**라 소비자 피드 필터(`category IN VOUCHER_CATEGORIES`)와
 * 공구 활성화 판정(`VOUCHER_CATEGORY_SET.has`)에 둘 다 안 걸린다. 결과: 셀러는 "등록 완료"
 * 화면을 보는데 **유어딜 어디에도 안 뜬다**(에러 0 — 그래서 아무도 모른다).
 * ⚠️ 이용권이 아닌 카테고리(fashion 등)는 손대지 않는다.
 */
export function canonicalCategory(raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null
  return normalizeCategory(raw) ?? raw
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
  meal_voucher:   { emoji: '🍽️', label: '식사 (음식점/카페)', short: '식사' },
  beauty_voucher: { emoji: '💇', label: '미용 (헬스/뷰티)',     short: '미용' },
  stay_voucher:   { emoji: '🏨', label: '숙소',                  short: '숙소' },
  home_voucher:   { emoji: '🏠', label: '생활 (이사/청소)',      short: '생활' },
  etc_voucher:    { emoji: '🎯', label: '기타',                  short: '기타' },
  // 레거시 (마이그레이션 사이 graceful 표시용 — 새 라벨로 매핑)
  health_voucher:   { emoji: '💇', label: '미용 (헬스/뷰티)', short: '미용' },
  pet_voucher:      { emoji: '🎯', label: '기타',              short: '기타' },
  activity_voucher: { emoji: '🎯', label: '기타',              short: '기타' },
}

// 🛡️ 2026-05-21: 카테고리 short 라벨 (알림톡 / push 메시지용).
//   "식사권" hardcode 가 곳곳에 있었음 — 모든 voucher 카테고리에서 동작하려면 이 헬퍼로 통일.
// 🏷️ 2026-06-29 (대표 "이용권으로 일괄 정리"): 카테고리-종류 라벨을 "{카테고리} 이용권" 으로
//   (식사 이용권 / 미용 이용권 / 숙소 이용권 / 기타 이용권). "식사권/미용권/…" 옛 형태 제거 →
//   우산말 '이용권' 으로 통일하되 카테고리 구분은 보존. fallback 도 '이용권'.
export function getVoucherShortLabel(category: string | null | undefined): string {
  if (!category) return '이용권'
  const m = VOUCHER_CATEGORY_LABEL[category]
  return m ? `${m.short} 이용권` : '이용권'
}
