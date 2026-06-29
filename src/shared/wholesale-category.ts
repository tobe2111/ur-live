/**
 * 🏭 2026-06-29 (대표 신고 — "업로드 제품 카테고리 배치가 안됨") 근본수정:
 *   도매 카탈로그는 고정 3종(food/living/health) 으로만 필터하는데, 상품 쓰기 경로(단건 등록·CSV
 *   대량·스토어 임포트·수정)가 카테고리를 3종으로 제한하지 않아 'lifestyle'·'beauty' 등 비표준 값이
 *   저장 → 카탈로그 칩 배치 깨짐(특히 스토어 임포트는 전부 'lifestyle' 하드코드 → food/living/health
 *   필터에 0건). 모든 쓰기 경로가 이 헬퍼로 정규화해 3종 밖 값이 저장되지 않게 한다.
 *
 *   SSOT: 프론트 표시 목록은 src/pages/wholesale/wholesale-theme.ts WHOLESALE_CATEGORIES (동일 3 id).
 */

export const WHOLESALE_CATEGORY_IDS = ['food', 'living', 'health'] as const
export type WholesaleCategoryId = (typeof WHOLESALE_CATEGORY_IDS)[number]

// 비표준 입력(레거시 id·한글 라벨·외부 스토어 분류)을 3종으로 흡수하는 키워드 매핑.
//   food/health 키워드에 걸리면 해당 버킷, 그 외(생활·리빙·lifestyle·home·뷰티·패션·잡화…)는 'living'(catch-all).
const FOOD_KEYS = ['food', '식품', '먹거리', '음료', '간식', 'snack', 'beverage', 'grocery', '농산', '수산', '축산', '가공식품', '신선']
const HEALTH_KEYS = ['health', '건강', '헬스', '영양', '보충', '비타민', 'vitamin', 'supplement', '건강기능', '의약', 'medical', '다이어트']

/** 입력을 도매 표준 3종(food/living/health)으로 정규화. 빈/불명은 'living'(catch-all). */
export function normalizeWholesaleCategory(raw: unknown): WholesaleCategoryId {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 'living'
  if ((WHOLESALE_CATEGORY_IDS as readonly string[]).includes(s)) return s as WholesaleCategoryId
  const hit = (keys: string[]) => keys.some((k) => s.includes(k.toLowerCase()))
  if (hit(FOOD_KEYS)) return 'food'
  if (hit(HEALTH_KEYS)) return 'health'
  return 'living'
}
