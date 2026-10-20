/**
 * 🧭 **정렬이 사라지는 상태를 만들지 않는다** (2026-09-09 — 대표 신고 "거리순인데 정렬이 안 되어 있다")
 *
 * ## 무엇이 틀렸었나
 * 목록은 정렬을 두 곳에서 한다 — **서버**(`sort` / 거리순은 `near`)와 **클라**(로드된 것 재정렬).
 * 그런데 둘 다 위치를 전제로 갈라져 있었고, **위치가 없을 때 둘 다 아무것도 안 하는 구멍**이 있었다:
 *
 * ```
 * sort = sortBy === 'distance' ? '' : sortBy      → 거리순이면 서버 sort 를 **비운다**
 * near = sortBy === 'distance' ? userLoc : null   → 위치가 없으면 near 도 **없다**
 * 클라 정렬: if (sortBy === 'distance' && userLoc) → 위치가 없으면 **건너뛴다**
 * ```
 * ⇒ 위치 없이 '가까운 순'을 고르면 **서버 기본 순서 그대로**가 나오는데 화면엔 "거리순"이라고 떠 있다.
 *   에러도 빈 화면도 없다 — **화면이 거짓말을 한다.** 실측(2026-09-09): 동탄에서 거리순인데
 *   서울 송파·서초가 먼저 떴다. 서버는 멀쩡하다(`near` 를 주면 0.1km→1.1km 로 정확히 정렬된다).
 *
 * 🕳️ 헤더의 동네 이름(`ur_near_dong_v1`)은 **localStorage 에 따로 남아** 위치가 없어도 계속 보인다.
 *   그래서 사용자는 위치가 잡힌 줄 안다 — 이 구멍이 눈에 안 띈 이유다.
 *
 * ## 규칙
 * **위치 없이 거리순은 존재할 수 없다.** 그런 상태가 되면 정렬을 비우지 말고 다른 정렬로 내려간다.
 * 서버 요청과 클라 재정렬이 **같은 함수**를 쓰게 해서 둘이 갈리지 않게 한다
 * (2026-09-03 에 서버 정렬 정의와 클라 `discountOf` 가 갈려 "인기순"이 인기순이 아니었던 그 클래스).
 *
 * ⚠️ 이 함수가 하지 않는 것: 위치를 **요청**하지 않는다. 그건 선택 시점의 일이고
 *   (`RestaurantMapPage` 의 `chooseSort` → `requestNearMe`), 여기는 마지막 안전망이다.
 */
import type { SortBy } from './types'

/** 위치가 없으면 '가까운 순'은 성립하지 않는다 — 할인율 순으로 내려간다. */
export const NO_LOCATION_FALLBACK: SortBy = 'discount'

export function effectiveSort(sortBy: SortBy, hasLocation: boolean): SortBy {
  return sortBy === 'distance' && !hasLocation ? NO_LOCATION_FALLBACK : sortBy
}
