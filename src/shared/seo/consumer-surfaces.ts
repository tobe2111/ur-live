/**
 * 🔎 2026-07-29 (대표 "소비자 쪽 성능·SEO·UX 점검" → 실측 후 수리): **정적 소비자 표면의 메타 SSOT**.
 *
 * ## 왜 생겼나 (라이브 실측)
 * `/`·`/vouchers`·`/browse` 가 **서빙 HTML 에서 홈 메타를 그대로** 내보내고 있었다 —
 * title/description 3개 동일, `og:url` 전부 `https://urdeal.kr`, **canonical 없음**.
 * 그런데 sitemap 은 `/vouchers`·`/browse` 를 priority 0.9 로 제출한다 → 크롤러에겐 홈의 중복.
 *
 * 원인은 단순하다: 서버 메타 rewrite 가 **상세 슬롯에만** 있었다(DETAIL·PRODUCT·BLOGPOST·CURATOR·
 * WHOLESALE). 목록/정적 표면은 슬롯은 있는데(`__SSR_INITIAL_MAIN__` 등) 메타 rewrite 가 없었다.
 * 클라 `<SEO>`(react-helmet)는 **JS 렌더 후**라 Googlebot 은 보지만 네이버 Yeti 는 못 본다 —
 * `SEO.tsx` 의 2026-07-28 주석이 같은 사실을 이미 기록해 뒀다(정적 토큰만 실효였다).
 *
 * ## 이 파일이 SSOT 인 이유
 * 같은 문구를 **워커(비-JS 크롤러용 정적 메타)** 와 **클라(`<SEO>`)** 두 곳에서 각각 쓰면
 * 반드시 갈라진다. 그래서 값을 여기 한 곳에 두고 양쪽이 읽는다.
 * ⚠️ 워커는 alias(`@/`) 를 못 푸는 esbuild 로 빌드되므로 **상대경로로 import** 할 것.
 *
 * 여기 없는 표면(랜딩 `/about`·`/creators`·`/partners` 등)은 여전히 클라 `<SEO>` 만 갖는다 —
 * Google 은 보고 Yeti 는 못 본다. 확장하려면 아래 표에 항목을 추가하고 그 페이지의 `<SEO>` 를
 * `resolveConsumerSurfaceSeo` 로 갈아끼우면 된다(문구가 두 벌이 되지 않게 반드시 함께).
 */

// 🗂️ 표(표면이 생길 때마다 자란다)는 `consumer-surface-table.ts` 로 분리했다(2026-11-01 — 이
//    파일이 600줄 래칫에 꽉 차 항목 하나를 더할 수 없었다). **import 경로는 그대로** — 재수출한다.
import { CONSUMER_SURFACE_SEO } from './consumer-surface-table'
export type { ConsumerSurfaceSeo } from './consumer-surface-table'
export { CONSUMER_SURFACE_SEO, VOUCHER_FILTER_CATEGORIES } from './consumer-surface-table'

/**
 * 🏠 홈의 **보이지 않는** 제목 요소 — 워커 첫 화면과 `MobileHomePage` 가 같이 쓴다.
 * 왜 `sr-only` 인지는 아래 `'/'` 항목의 주석에 있다. 두 벌이 되면 마운트 때 제목이 바뀐다.
 */
export const HOME_H1 = '유어딜 - 우리 동네 맛집·카페·뷰티 이용권 할인'

/** 표시용 사이트명 — `SEO.tsx` 의 SITE_NAME 과 같은 값(접미사는 렌더 쪽에서 1회만 붙인다). */
export const CONSUMER_SITE_NAME = '유어딜'

const AREA_REGION_RE = /^[가-힣][가-힣\s·-]{1,19}$/

export function resolveAreaReportSeo(
  pathname: string,
  origin: string,
  siteName: string = CONSUMER_SITE_NAME
): ResolvedSurfaceSeo | null {
  const m = /^\/area-report\/([^/]+)\/?$/.exec(pathname)
  if (!m) return null
  let region = ''
  try { region = decodeURIComponent(m[1]).trim() } catch { region = m[1].trim() }
  if (!region) return null

  const looksLikeRegion = AREA_REGION_RE.test(region)
  const pageTitle = withSiteName(`${region} 상권 리포트`, siteName)
  return {
    pageTitle,
    title: pageTitle,
    description: `${region} 업종별 영업 현황과 최근 90일 개업·폐업 흐름입니다. 공공 인허가 데이터로 집계했습니다.`,
    canonical: `${origin}/area-report/${encodeURIComponent(region)}`,
    ...(looksLikeRegion ? {} : { noindex: true as const }),
  }
}

/**
 * `title` 에 사이트명 접미사를 **중복 없이** 붙인다.
 *
 * 🐛 라이브 실측 버그: `/vouchers` 의 실제 `<title>` 이 `교환권 - 유어딜 - 유어딜` 이었다.
 * `SEO.tsx` 가 `- 유어딜` 을 붙이는데 호출부(`VouchersPage`)가 이미 포함한 문자열을 넘겼다.
 * 접미사를 붙이는 자리는 여기 하나뿐이어야 한다.
 */
export function withSiteName(title: string, siteName: string = CONSUMER_SITE_NAME): string {
  const t = title.trim()
  if (!t) return siteName
  // 제목이 이미 사이트명을 담고 있으면 붙이지 않는다.
  //   `교환권 - 유어딜`(접미사 중복) · `유어딜 - 돈버는 쇼핑…`(홈 전체 제목) ·
  //   `유어딜 인플루언서 — …`(랜딩) 세 형태를 한 규칙으로 덮는다.
  // 트레이드오프: 상품명에 '유어딜' 이 들어가면 접미사가 안 붙는다 — 중복 노출보다 낫다.
  if (t.includes(siteName)) return t
  return `${t} - ${siteName}`
}

/**
 * HTML 속성값 이스케이프 — `el.append('<link href="…">', {html:true})` 처럼 **문자열로 마크업을 만들 때**만
 * 필요하다(HTMLRewriter 의 `setAttribute` 는 스스로 이스케이프한다). canonical 은 origin+경로+인코딩된
 * 파라미터라 실무상 위험 문자가 없지만, 마크업 생성 지점에 이스케이프가 없으면 다음 사람이 그 자리에
 * 사용자 문자열을 넣는다.
 */
export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 경로 정규화 — 같은 내용이 여러 URL 로 색인되지 않게 **정본 경로 모양**을 하나로 만든다.
 *
 * 🔗 2026-10-12 실측: `/vouchers/`·`/./vouchers`·`/vouchers?` 는 이미 `/vouchers` 로 모였는데
 *   **`//vouchers` 만** `canonical=…//vouchers` 로 자기 자신을 선언했다(끝 슬래시는 떼는데 앞
 *   이중 슬래시는 안 뗐다). 흔히 링크되는 모양은 아니지만, 정본이 하나여야 하는 자리다.
 */
function normalizeCanonicalPath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, '/')
  return collapsed !== '/' && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed
}

/**
 * canonical URL 생성 — 허용 파라미터의 **허용 값만** 보존(정렬해 순서 흔들림 제거), 나머지는 제거.
 *
 * 🔴 **값을 검증하는 것이 이 함수의 요점이다.** 2026-10-12 실측에서 허용 *키*만 보고 값은 비어
 *   있지 않으면 그대로 실어, `?category=테스트123` 이 자기 자신을 정본이라 선언했다(본문 43자).
 *   `allowValues` 에 그 키가 있으면 목록에 든 값만 남기고, 모르는 값은 **파라미터를 떼서** 맨
 *   경로를 정본으로 삼는다 — 즉 쓰레기 URL 이 `/vouchers` 로 통합된다.
 */
export function buildCanonical(
  origin: string,
  pathname: string,
  search: string,
  allow: readonly string[] | undefined,
  allowValues?: Readonly<Record<string, readonly string[]>>
): string {
  const path = normalizeCanonicalPath(pathname)
  if (!allow || allow.length === 0) return `${origin}${path}`
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search || '')
  } catch {
    return `${origin}${path}`
  }
  const kept: string[] = []
  for (const key of [...allow].sort()) {
    const v = params.get(key)
    if (!v) continue
    const ok = allowValues?.[key]
    if (ok && !ok.includes(v.trim())) continue // 모르는 값 → 파라미터를 떼고 맨 경로로 통합
    kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
  }
  return kept.length ? `${origin}${path}?${kept.join('&')}` : `${origin}${path}`
}

export interface ResolvedSurfaceSeo {
  /** `<title>` 값 (사이트명 포함) */
  pageTitle: string
  /** og/twitter title (= pageTitle) */
  title: string
  description: string
  canonical: string
  /** true 면 서버에서도 robots noindex */
  noindex?: boolean
  /**
   * 🔴 **브랜드 JSON-LD(`Organization`+`WebSite`)를 여기서 만들지 말 것.**
   * 이 함수의 결과는 **사람이 받는 셸(`index.html`)** 에 rewrite 되고, 그 문서엔 2026-07-20 도메인
   * 이전 때 넣은 정적 `@graph` 가 **이미** 있다(`@id` 도 `#organization`·`#website` 로 같다).
   * 여기서 또 만들면 같은 `@id` 의 노드가 **한 문서에 두 벌** 나가고, 두 벌은 반드시 갈린다
   * (`inLanguage` 가 `ko` ↔ `ko-KR` 로 어긋나는 식).
   *
   * ⚠️ **"그래서 브랜드 노드는 필요 없다" 가 아니다** — 2026-10-11 에 제가 그렇게 오판했다.
   * **크롤러는 이 문서를 받지 않는다**(봇 UA 는 `app.get('*')` 의 최소 HTML). 그래서 브랜드 노드는
   * `shared/seo/brand-jsonld.ts` 로 데이터화해 **봇 셸 쪽에만** 꽂았고(머지 `482239ee8`,
   * E4 실측 Yeti `#organization` 0 → 1), 두 셸은 **상호배타**라 중복이 구조적으로 불가능하다.
   * 이 함수는 사람 셸 경로라 여전히 금지다 — 넣으면 그 문서에서 중복이 된다.
   * 가드: `seo-crawler-visibility-2026-10-11.test.ts` ③ · ③-2.
   */
}

/**
 * 정적 소비자 표면의 메타를 해석. 표에 없으면 `null`(호출부는 기본 메타 유지).
 *
 * 카테고리/브랜드 필터가 붙은 목록은 **제목을 분화**한다 — 같은 title 로 여러 URL 을 제출하면
 * 그 자체가 중복 신호다(sitemap 이 `/vouchers?category=편의점` 등을 실제로 제출한다).
 */
type DynSeo = { title: string; description: string; path: string; noindex?: boolean } | null; const dynamicSurfaceSeo: Array<(p: string) => DynSeo> = []; /** 워커 전용 동적 표면(업종 데이터가 공용 번들에 안 실리게) */ export const registerDynamicSurfaceSeo = (f: (p: string) => DynSeo) => { if (!dynamicSurfaceSeo.includes(f)) dynamicSurfaceSeo.push(f) }; export function resolveConsumerSurfaceSeo(
  pathname: string,
  search: string,
  origin: string,
  siteName: string = CONSUMER_SITE_NAME
): ResolvedSurfaceSeo | null {
  // 🔗 2026-10-12: 정규화를 **조회 시점에** 건다. canonical 쪽만 고쳤을 때 `//vouchers` 는 표에
  //   그 키가 없어 `entry` 가 undefined → 메타가 통째로 null 이 됐다(= 그 URL 만 제네릭 셸을 받는다).
  //   끝 슬래시·중복 슬래시를 먼저 접어야 `/vouchers` 항목을 찾고 canonical 도 `/vouchers` 가 된다.
  const path = normalizeCanonicalPath(pathname)
  const entry = CONSUMER_SURFACE_SEO[path]
  // 표에 없으면 동적 표면 빌더에 넘긴다(경로에서 값을 뽑을 수 있는 것만 — 조회는 하지 않는다).
  if (!entry) { const l = dynamicSurfaceSeo.reduce<DynSeo>((a, f) => a ?? f(path), null); if (l) { const t = withSiteName(l.title, siteName); return { pageTitle: t, title: t, description: l.description, canonical: `${origin}${l.path}`, ...(l.noindex ? { noindex: true } : {}) } } return resolveAreaReportSeo(path, origin, siteName) }

  let title = entry.title
  let description = entry.description
  const titleKeys = entry.titleParams ?? entry.canonicalParams
  if (titleKeys?.length) {
    let params: URLSearchParams | null = null
    try { params = new URLSearchParams(search || '') } catch { params = null }
    // 🔴 **제목 접두도 canonical 과 같은 집합을 믿는다.** 2026-10-12 실측에서 검증이 없어
    //   `?category=테스트123` 이 `<title>테스트123 기프티콘 교환권…</title>` 과 같은 `og:title` 로
    //   나갔다 — 없는 카테고리의 **페이지 정체성을 지어내고** 그게 공유 카드에도 실린다.
    //   ⚠️ 두 자리가 갈리면 제목은 `치킨` 인데 canonical 은 떼는 모순이 생긴다. 한 집합만 쓴다.
    const allowed = (key: 'brand' | 'category', v: string | undefined): string | undefined => {
      if (!v || !titleKeys?.includes(key)) return undefined
      const ok = entry.canonicalParamValues?.[key]
      return !ok || ok.includes(v) ? v : undefined
    }
    const brand = allowed('brand', params?.get('brand')?.trim())
    const category = allowed('category', params?.get('category')?.trim())
    const facet = brand || category
    if (facet) { // 틀이 없는 표면은 종전 그대로: 브랜드 `{v} 설명` · 카테고리 `{v}: 설명`.
      const tpl = entry.facetTitle ? [entry.facetTitle, entry.facetDescription ?? `{v}: ${entry.description}`] : [`{v} ${entry.title}`, brand ? `{v} ${entry.description}` : `{v}: ${entry.description}`]
      ;[title, description] = tpl.map((t) => t.split('{v}').join(facet))
    }
  }

  const pageTitle = withSiteName(title, siteName)
  return {
    pageTitle,
    title: pageTitle,
    description,
    canonical: buildCanonical(origin, path, search, entry.canonicalParams, entry.canonicalParamValues),
    ...(entry.noindex ? { noindex: true } : {}),
  }
}
