/**
 * 🏭 2026-06-29 (대표 신고 — "업로드 제품 카테고리 배치가 안됨") 근본수정:
 *   도매 카탈로그는 고정 3종(food/living/health) 으로만 필터하는데, 상품 쓰기 경로(단건 등록·CSV
 *   대량·스토어 임포트·수정)가 카테고리를 3종으로 제한하지 않아 'lifestyle'·'beauty' 등 비표준 값이
 *   저장 → 카탈로그 칩 배치 깨짐. 모든 쓰기 경로가 이 헬퍼로 정규화해 표준 밖 값이 저장되지 않게 한다.
 *
 * 🏥 2026-07-03 (대표 — 의료용품 도매몰 신설): 카테고리 레지스트리를 **전역 확장**(의료기기/위생/간병 추가).
 *   몰별 노출 카테고리는 wholesale_malls.categories_json 이 결정(몰=도메인=카테고리 세트) — 이 파일은
 *   *유효 id 전집합 + 정규화 + 라벨 + 코드접두어의 SSOT*. 기존 몰(유통스타트=food/living/health)은
 *   드롭다운이 그 3종만 노출하므로 동작 byte-불변(의료 id 는 의료몰 입력에만 등장).
 */

/** 도매 카테고리 유효 id 전집합(전 몰 합집합). 몰별 노출 subset 은 categories_json 이 정함. */
export const WHOLESALE_CATEGORY_IDS = ['food', 'living', 'health', 'medical_device', 'hygiene', 'care'] as const
export type WholesaleCategoryId = (typeof WHOLESALE_CATEGORY_IDS)[number]

/** id → 한글 라벨 SSOT (프론트/서버 공용 — 몰 categories_json 이 label 을 안 주면 이걸로 폴백). */
export const WHOLESALE_CATEGORY_LABELS: Record<string, string> = {
  food: '식품',
  living: '리빙',
  health: '건강',
  medical_device: '의료기기',
  hygiene: '위생용품',
  care: '간병용품',
}
export function wholesaleCategoryLabel(id: string | null | undefined): string {
  return WHOLESALE_CATEGORY_LABELS[String(id || '').toLowerCase()] || String(id || '')
}

// 비표준 입력(레거시 id·한글 라벨·외부 스토어 분류)을 표준 id 로 흡수하는 키워드 매핑.
//   ⚠️ 순서 중요: 더 구체적(의료/간병/위생)을 generic(health/food) 보다 먼저 검사.
const MEDICAL_DEVICE_KEYS = ['의료기기', '의료용', '메디컬', 'medical device', 'medical_device', '체온계', '혈압계', '주사기', '붕대', '밴드', '깁스', '부목', '진료']
const CARE_KEYS = ['간병', '간호', '케어', '재활', '휠체어', '보행', '요양', 'care', 'nursing']
const HYGIENE_KEYS = ['위생', '소독', '방역', '살균', 'sanitiz', 'hygiene', '물티슈', '기저귀', '마스크', 'kf94', 'kf80', '손소독']
const FOOD_KEYS = ['food', '식품', '먹거리', '음료', '간식', 'snack', 'beverage', 'grocery', '농산', '수산', '축산', '가공식품', '신선']
const HEALTH_KEYS = ['health', '건강', '헬스', '영양', '보충', '비타민', 'vitamin', 'supplement', '건강기능', '의약', 'medical', '다이어트']

/**
 * 입력을 도매 표준 id 로 정규화. 빈/불명은 'living'(catch-all).
 * @param allowed 지정 시(몰의 categories_json id 집합) 그 몰의 카테고리로만 좁혀 정규화 —
 *   전역 결과가 그 집합 밖이면 집합의 첫 id 로 폴백(크로스-몰 카테고리 누수 방지). 미지정=전역(기존 동작).
 */
export function normalizeWholesaleCategory(raw: unknown, allowed?: readonly string[] | null): WholesaleCategoryId {
  const s = String(raw ?? '').trim().toLowerCase()
  const global = ((): WholesaleCategoryId => {
    if (!s) return 'living'
    if ((WHOLESALE_CATEGORY_IDS as readonly string[]).includes(s)) return s as WholesaleCategoryId
    const hit = (keys: string[]) => keys.some((k) => s.includes(k.toLowerCase()))
    // 구체적 의료/간병/위생 먼저 — '건강기능식품'(보충제) food/health 오분류 & 의료 키워드 우선.
    if (hit(MEDICAL_DEVICE_KEYS)) return 'medical_device'
    if (hit(CARE_KEYS)) return 'care'
    if (hit(HYGIENE_KEYS)) return 'hygiene'
    if (hit(HEALTH_KEYS)) return 'health'
    if (hit(FOOD_KEYS)) return 'food'
    return 'living'
  })()
  // 몰 스코프 지정 시 — 그 몰 카테고리로 클램프(전역 결과가 몰 밖이면 몰 첫 카테고리).
  if (allowed && allowed.length) {
    const set = allowed.map((x) => String(x).toLowerCase())
    if (set.includes(global)) return global
    const first = set.find((x) => (WHOLESALE_CATEGORY_IDS as readonly string[]).includes(x))
    return (first as WholesaleCategoryId) || global
  }
  return global
}
