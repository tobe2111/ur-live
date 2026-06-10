/**
 * 🏭 플랫폼 기능 플래그 (SSOT).
 *
 * LIVE_COMMERCE_SUSPENDED — 라이브커머스 잠정 중단 (2026-06-04 사용자 결정).
 *   true: 셀러 대시보드에서 라이브 방송/송출/쇼츠/라이브분석/캐스팅/후원 등 라이브 메뉴·모드를
 *         전부 숨기고 공구·매장·소싱 경험으로 통일. 코드는 보존 — false 로 바꾸면 즉시 복원.
 */
export const LIVE_COMMERCE_SUSPENDED = true

/**
 * SHOPPING_TAB_HIDDEN — 쇼핑 탭 잠정 숨김 (2026-06-10 사용자 결정, 동네딜 집중 전략).
 *   true: 하단바/PC 탭에서 쇼핑(/browse) 진입을 숨기고 그 자리에 ➕(공구 제안/만들기).
 *         라우트(/browse·/cart·/my-orders)와 모든 쇼핑 코드는 보존 — false 로 바꾸면 즉시 복원.
 */
export const SHOPPING_TAB_HIDDEN = true
