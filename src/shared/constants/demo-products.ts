/**
 * 🎭 데모 상품 판정 — **SSOT**
 *
 * ## 왜 이 파일이 생겼나 (2026-08-03 실측)
 *
 * 대표 룰: *"데모로 만들어진 상품은 소비자가 봤을 때 **추첨 형태**로 보여져야 한다."*
 * 그런데 판정이 `'demo-deal-'` 접두사로 **6군데에 각각 하드코딩**돼 있었고, 그 뒤에 생긴
 * `demo-stay-*`(숙박 72개)·`demo-linkshop-*`(8개)는 **어디에도 안 걸렸다.** 결과:
 *
 * - 숙박 데모 72개에 **추첨 설정이 0** → 배지가 안 뜨고(`{fcfs && <FcfsBadge/>}`)
 *   소비자 눈엔 **89,000원짜리 진짜 숙박권**으로 보였다
 * - "데모는 항상 후순위" 정렬(2026-07-04 대표 지시)에도 안 걸려 **피드 첫 50건을 전부 점유**했다
 *   (같은 시점 실상품은 3개뿐이었다)
 *
 * ⇒ 접두사를 나열하는 방식이 원인이다. **`demo-` 하나로 판정**하면 다음 데모 종류는 자동 적용된다.
 *
 * ## 추첨을 붙이는 범위 — 전부가 아니다
 *
 * 추첨(응모→당첨→구매)은 **매장 방문 이용권**의 흐름이다. 배송 상품에 "응모"를 붙이면
 * 소비자가 무엇을 하는 화면인지 알 수 없다. 그래서 **voucher 카테고리 데모만** 대상으로 한다
 * (`demo-linkshop-*` 중 `food` 6개는 유어샵 배송 예시라 제외 — 동네딜 피드에도 안 뜬다).
 */
import { VOUCHER_CATEGORY_SET } from './voucher-categories'

/** 모든 데모 상품 slug 의 공통 접두사. 종류(`deal`/`stay`/`linkshop`)는 그 뒤에 온다. */
export const DEMO_SLUG_PREFIX = 'demo-'

/** SQL 용 — `LIKE` 패턴. 바인딩해서 쓸 것(문자열 결합 금지). */
export const DEMO_SLUG_LIKE = `${DEMO_SLUG_PREFIX}%`

/**
 * SQL 조각 — "이 행은 데모인가".
 * ⚠️ `slug` 가 NULL 인 상품이 있으므로 `COALESCE` 없이 `slug LIKE` 만 쓰면 **NULL 행이 조용히 빠진다**
 * (2026-08-03 에 이 함정으로 실상품 개수를 10 으로 잘못 셌다 — 실제 3).
 */
export const DEMO_SLUG_SQL = `COALESCE(slug,'') LIKE '${DEMO_SLUG_LIKE}'`

/** 컬럼 alias 가 붙는 JOIN 쿼리용. 예: `demoSlugSql('p')` → `COALESCE(p.slug,'') LIKE 'demo-%'` */
export function demoSlugSql(alias: string): string {
  return `COALESCE(${alias}.slug,'') LIKE '${DEMO_SLUG_LIKE}'`
}

export function isDemoSlug(slug: string | null | undefined): boolean {
  return typeof slug === 'string' && slug.startsWith(DEMO_SLUG_PREFIX)
}

/**
 * 이 상품이 **추첨으로 보여야 하는 데모**인가 — 데모 ∧ 매장 이용권 카테고리.
 * 배송 데모(유어샵 food 예시)는 false.
 */
export function isRaffleDemo(
  product: { slug?: string | null; category?: string | null } | null | undefined,
): boolean {
  if (!product || !isDemoSlug(product.slug)) return false
  return VOUCHER_CATEGORY_SET.has(String(product.category || ''))
}

/**
 * 추첨 설정 기본값 — **이용권 데모와 같은 규칙**(대표 2026-08-03 "같은 규칙으로 맞춰줘").
 * 정원 3~8명 · 표시 응모자 = 정원 × 3~6배 · 마감 5~10일 뒤.
 *
 * `rand` 를 주입받는 이유: 테스트가 결정론으로 범위를 검사할 수 있어야 하기 때문이다
 * (`Math.random` 을 직접 부르면 "3~8 사이인가"를 확인할 방법이 없다).
 */
export function demoRaffleDefaults(rand: () => number = Math.random): {
  spots: number
  appliedSeed: number
  deadlineMs: number
} {
  const spots = 3 + Math.floor(rand() * 6)               // 3~8
  const appliedSeed = spots * (3 + Math.floor(rand() * 4)) // ×3~6
  const days = 5 + Math.floor(rand() * 6)                 // 5~10일
  return { spots, appliedSeed, deadlineMs: days * 24 * 60 * 60 * 1000 }
}

/**
 * 🙈 공개 응답에서 **데모 식별자를 지운다** — 대표 2026-10-12 *"데모인 것을 티내지마"*.
 *
 * ## 무엇이 새고 있었나 (라이브 실측, Googlebot UA 로 서버 HTML 을 받아 셌다)
 *
 *     홈   `demo-deal` 43회 · `"demo"` 48회      ← __SSR_INITIAL_MAIN__ 시드 50건 중 48건이 데모
 *     지도 `demo-deal` 48회 · `"demo"` 48회
 *     데모 상세(/pass/2914) `demo-deal` 1회      ← __SSR_INITIAL_DETAIL__
 *
 * 페이지 소스를 열면 누구나, 그리고 모든 크롤러가 **어느 것이 데모인지 바로** 안다.
 * 결정적으로 **실상품은 `slug` 가 NULL** 이다(실측: 2919 `달빛한스푼` → null) — 즉 `slug` 는
 * 사실상 데모 전용 식별자라서, 응답에서 빼도 실상품 쪽 기능 손실이 **0** 이다.
 *
 * ## 왜 SELECT 가 아니라 응답에서 지우나
 *
 * `buildCols` 에서 `p.slug` 를 빼면 **서버 자신의 데모-후순위 정렬·`fcfs` 판정이 늘 false** 가 되어
 * 2026-07-04 대표 지시(*"데모 이용권 노출은 항상 후순위"*)가 조용히 깨진다. 그래서 SQL 은 그대로 두고
 * **직렬화 직전 한 자리**에서만 지운다 — 라이브 쿼리 경로와 materialized(cron 저장본) 경로가 그 한
 * 자리를 함께 통과하므로 두 벌이 갈릴 수 없다.
 *
 * ## `demo` → `boost`
 *
 * 클라가 그 플래그를 쓰는 유일한 목적은 **'선착순 상위노출' boost 에서 제외**하는 것이다
 * (`RestaurantMapPage` displayList). 그래서 이름을 *하는 일*로 바꿨다 — `boost: false` =
 * "상위노출 대상 아님". 기본값(true)은 싣지 않는다(바이트 + "제외가 예외" 라는 뜻).
 *
 * ⚠️ 이 함수가 **못 가리는 것**: 어드민 응답(의도적으로 데모를 구분해 보여 준다) · DB·cron 저장본
 * (서버 내부) · 사진·문구 같은 콘텐츠 자체.
 */
export function toPublicProductRows<T extends Record<string, unknown>>(rows: readonly T[]): T[] {
  return rows.map((row) => {
    const { slug: _slug, is_demo: _isDemo, ...rest } = row as T & { slug?: unknown; is_demo?: unknown }
    const fcfs = (rest as { fcfs?: Record<string, unknown> }).fcfs
    if (fcfs && typeof fcfs === 'object' && 'demo' in fcfs) {
      const { demo, ...fcfsRest } = fcfs as { demo?: unknown }
      return { ...rest, fcfs: { ...fcfsRest, ...(demo ? { boost: false } : {}) } } as unknown as T
    }
    return rest as unknown as T
  })
}
