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

/**
 * 업체 모집 랜딩(`/life/pro`, 로그인 전 화면) — 2026-10-25 대표 "1~3 다 하자".
 * 종전엔 로그인 안내 한 장뿐이라 색인하지 않았다(robots). 이제 모집 문구·흐름·조건을 그리므로 색인한다.
 * 로그인한 사장님에겐 같은 주소가 요청함을 그린다(색인 대상은 로그인 전 화면).
 */
export const LIFE_PRO_PATH = '/life/pro'
export const LIFE_PRO_SEO = {
  crumb: '업체 등록',
  title: '생활 서비스 업체 등록 - 근처 사장님 견적 요청 받기',
  description: '방역·후드 청소·설비 수리·간판·인테리어 업체라면 근처 식당·카페·숙소 사장님의 견적 요청을 알림톡으로 받아 보세요. 처음 등록하면 참여권을 드려요.',
} as const
