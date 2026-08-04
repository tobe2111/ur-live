/**
 * 🏠 2026-08-04 (대표 시안 승인 "좋다 이렇게 가자"): 홈 쇼케이스 SSOT —
 *   ④ 히어로 배너 · ① 카테고리 섹션 · ③ 중간 배너.
 *
 * 여기어때 메인에서 차용한 것만 골라 현재 PC 홈 위에 얹는다. 시안:
 * `docs/design/home-showcase-2026-08.md`
 *
 * ## 왜 SSOT 인가
 * 배너 종류(`banner_type`)와 섹션 소스(`source`)는 **DB 값 · 서버 쿼리 · 어드민 select ·
 * 클라이언트 렌더** 네 곳이 같은 문자열을 알아야 한다. 네 벌로 두면 반드시 갈라지고,
 * 갈라지는 순간 증상은 "어드민에서 등록했는데 홈에 안 뜬다" 하나로 뭉뚱그려진다.
 *
 * ⚠️ 워커(esbuild)에서도 로드되므로 이 파일은 **의존성 0**을 유지할 것.
 */

/** 배너가 놓이는 자리. DB `banners.banner_type` 값과 1:1. */
export const BANNER_TYPES = ['hero', 'inline', 'wide'] as const
export type BannerType = typeof BANNER_TYPES[number]

export const BANNER_TYPE_LABELS: Record<BannerType, string> = {
  hero: '히어로 (홈 최상단 · 배경 이미지/영상)',
  inline: '중간 배너 (3열)',
  wide: '와이드 배너 (가로 전체)',
}

/**
 * 기본값이 `'inline'` 인 이유: 이 컬럼이 생기기 **전에 등록된 배너**는 값이 NULL 인데,
 * 그걸 히어로로 승격시키면 옛 배너가 갑자기 홈 최상단을 덮는다. 중간 배너가 안전한 기본이다.
 */
export const DEFAULT_BANNER_TYPE: BannerType = 'inline'

export function isBannerType(v: unknown): v is BannerType {
  return typeof v === 'string' && (BANNER_TYPES as readonly string[]).includes(v)
}
export function normalizeBannerType(v: unknown): BannerType {
  return isBannerType(v) ? v : DEFAULT_BANNER_TYPE
}

/**
 * 섹션이 상품을 고르는 방식.
 *
 * - `manual`  — 어드민이 상품을 하나씩 담는다(`section_products`). **기존 동작이고 기본값이다.**
 * - 그 외      — 규칙(쿼리). 어드민이 손대지 않아도 최신 상태를 유지한다.
 *
 * ⚠️ 규칙 기반을 추가한 이유: 시안의 "지금 인기 / 오늘 마감 임박 / 주말에 떠나는 숙소"는
 *   목록이 아니라 **질의**다. 이걸 수동 큐레이션으로 만들면 어드민이 매일 손봐야 하고,
 *   안 손보는 순간 홈 최상단이 낡은 채로 방치된다(그게 이 회사 규모에서 가장 자주 나는 사고다).
 */
export const SECTION_SOURCES = ['manual', 'popular', 'deadline', 'newest', 'category'] as const
export type SectionSource = typeof SECTION_SOURCES[number]

export const SECTION_SOURCE_LABELS: Record<SectionSource, string> = {
  manual: '직접 고름 (상품을 하나씩 담기)',
  popular: '인기순 (많이 팔린 순)',
  deadline: '마감 임박순',
  newest: '최신 등록순',
  category: '카테고리별 (아래에서 선택)',
}

export const DEFAULT_SECTION_SOURCE: SectionSource = 'manual'

export function isSectionSource(v: unknown): v is SectionSource {
  return typeof v === 'string' && (SECTION_SOURCES as readonly string[]).includes(v)
}
export function normalizeSectionSource(v: unknown): SectionSource {
  return isSectionSource(v) ? v : DEFAULT_SECTION_SOURCE
}

/** 섹션 한 줄에 보여줄 상품 수. 홈 그리드가 4열이라 기본 4. */
export const SECTION_DEFAULT_LIMIT = 4
/** 어드민이 아무리 크게 잡아도 홈 한 줄이 페이로드를 삼키지 않게. */
export const SECTION_MAX_LIMIT = 12

export function clampSectionLimit(v: unknown): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n <= 0) return SECTION_DEFAULT_LIMIT
  return Math.min(SECTION_MAX_LIMIT, n)
}
