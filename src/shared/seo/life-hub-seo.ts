/**
 * 🏠 생활 서비스 허브 메타 — 의존성 없는 상수만 (2026-10-25).
 * `consumer-surfaces.ts` 는 **모든 화면의 공용 코드**에 실린다. 업종 목록(`home-service-categories`)을
 * 거기서 import 하면 전 화면 첫 로딩이 4.3KB 늘었다(surface-budgets 실측). 그래서 허브 상수만 여기 두고,
 * 업종 페이지 메타는 워커가 `registerDynamicSurfaceSeo` 로 끼운다(`worker/utils/surface-list-jsonld.ts`).
 */
export const LIFE_HUB_PATH = '/life'

/** 허브 메타 — `CONSUMER_SURFACE_SEO['/life']` 와 `LifePage` 의 `<SEO>` 가 이 값을 쓴다. */
export const LIFE_HUB_SEO = {
  crumb: '생활 서비스',
  title: '사장님 생활 서비스 - 간판·방역·후드 청소·설비 수리 견적',
  description: '식당·카페·숙소 사장님을 위한 생활 서비스. 간판·방역·후드 청소·냉장 설비 수리까지 요청서 한 번이면 근처 업체가 견적을 보내 드려요.',
} as const
