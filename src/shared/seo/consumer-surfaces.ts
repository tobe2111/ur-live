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

export interface ConsumerSurfaceSeo {
  /** og/twitter title (사이트명 접미사 **없이**) — `<SEO title>` 에 그대로 넣는 값 */
  title: string
  description: string
  /** canonical 에 보존할 쿼리 파라미터. 나머지(utm 등)는 버려 중복 URL 을 막는다. */
  canonicalParams?: readonly string[]
}

/** 표시용 사이트명 — `SEO.tsx` 의 SITE_NAME 과 같은 값(접미사는 렌더 쪽에서 1회만 붙인다). */
export const CONSUMER_SITE_NAME = '유어딜'

/**
 * pathname → 메타. **키는 정확히 일치하는 경로만**(상세는 각자 빌더가 담당).
 *
 * `/` 는 의도적으로 title/description 을 index.html 기본값과 **동일하게** 둔다 —
 * 홈은 원래 그 문구가 맞고, 여기서 필요한 건 canonical 뿐이다.
 */
export const CONSUMER_SURFACE_SEO: Readonly<Record<string, ConsumerSurfaceSeo>> = {
  '/': {
    title: '유어딜 - 돈버는 쇼핑, 이용권·교환권·동네딜',
    description:
      '할인가로 사서 매장에서 바로 쓰는 이용권, 기프티콘 교환권, 내 주변 동네딜, 무료 체험단 응모, 나만의 링크샵까지. 유어딜에서 돈버는 쇼핑.',
  },
  '/vouchers': {
    title: '교환권',
    description:
      '스타벅스·GS25·메가MGC커피 등 인기 브랜드 기프티콘 교환권을 딜로 즉시 구매하세요. 결제 후 바로 발송됩니다.',
    canonicalParams: ['category', 'brand'],
  },
  '/browse': {
    title: '쇼핑',
    description: '유어딜에서 파는 상품을 한눈에. 카테고리·가격으로 골라 담고 딜로 결제하세요.',
    canonicalParams: ['category'],
  },
  '/map': {
    title: '내 주변 동네딜 지도',
    description: '지도에서 내 주변 동네딜을 찾아보세요. 우리 동네 맛집·뷰티·숙소 이용권을 할인가로.',
  },
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

/** canonical URL 생성 — 허용 파라미터만 보존(정렬해 순서 흔들림 제거), 나머지는 제거. */
export function buildCanonical(
  origin: string,
  pathname: string,
  search: string,
  allow: readonly string[] | undefined
): string {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
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
    if (v) kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
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
}

/**
 * 정적 소비자 표면의 메타를 해석. 표에 없으면 `null`(호출부는 기본 메타 유지).
 *
 * 카테고리/브랜드 필터가 붙은 목록은 **제목을 분화**한다 — 같은 title 로 여러 URL 을 제출하면
 * 그 자체가 중복 신호다(sitemap 이 `/vouchers?category=편의점` 등을 실제로 제출한다).
 */
export function resolveConsumerSurfaceSeo(
  pathname: string,
  search: string,
  origin: string,
  siteName: string = CONSUMER_SITE_NAME
): ResolvedSurfaceSeo | null {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const entry = CONSUMER_SURFACE_SEO[path]
  if (!entry) return null

  let title = entry.title
  let description = entry.description
  if (entry.canonicalParams?.length) {
    let params: URLSearchParams | null = null
    try { params = new URLSearchParams(search || '') } catch { params = null }
    const brand = params?.get('brand')?.trim()
    const category = params?.get('category')?.trim()
    if (brand) {
      title = `${brand} ${entry.title}`
      description = `${brand} ${entry.description}`
    } else if (category) {
      title = `${category} ${entry.title}`
      description = `${category} — ${entry.description}`
    }
  }

  const pageTitle = withSiteName(title, siteName)
  return {
    pageTitle,
    title: pageTitle,
    description,
    canonical: buildCanonical(origin, path, search, entry.canonicalParams),
  }
}
