/**
 * 🏠 홈 주소의 `?category=` 판정 SSOT (2026-11-10).
 *
 * 🩸 라이브 실측(폰 4G · CPU 4배): `/?category=meal_voucher` **CLS 0.83** — `/meal-vouchers` 리다이렉트와 홈 칩·링크 11곳이 이 주소를 쓴다.
 *   워커는 쿼리를 안 보고 "전체" 홈 첫 화면(지역 사진 머리 + 첫 섹션 카드)을 그렸는데, 앱은 카테고리를 고르면 그 편성을 **숨기고**
 *   그 카테고리 목록을 맨 위에 올린다(`MobileHomePage`: `category === 'all'` 일 때만 편성) → 마운트 때 화면이 통째로 바뀐다.
 *   ⇒ 화면이 받아들이는 카테고리(`useHomeQuerySync` 와 같은 목록)가 쿼리에 있으면 워커는 홈 첫 화면을 그리지 않는다(로더 → 앱).
 *   `?sort=`·추적 쿼리(utm 등)는 배치를 안 바꾼다(실측 CLS 0.0001) — 그건 종전대로 그린다.
 */
export const HOME_CATEGORY_KEYS = ['all', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'home_voucher', 'etc_voucher'] as const
export type HomeCategoryKey = (typeof HOME_CATEGORY_KEYS)[number]

/** 쿼리가 고른 **전체가 아닌** 카테고리. 없거나 모르는 값이면 null(= 전체 홈 — 화면도 'all' 로 되돌린다). */
export function homeCategoryOf(search: string): Exclude<HomeCategoryKey, 'all'> | null {
  try {
    const c = new URLSearchParams(search).get('category')
    return c && c !== 'all' && (HOME_CATEGORY_KEYS as readonly string[]).includes(c) ? (c as Exclude<HomeCategoryKey, 'all'>) : null
  } catch { return null }
}
