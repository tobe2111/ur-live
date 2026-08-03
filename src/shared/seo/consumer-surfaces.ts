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

// ⚠️ 상대경로 — 이 파일은 워커(esbuild, alias 미해석)에서도 로드된다. `@/` 로 쓰면 워커 빌드가 깨진다.
import { normalizeSido } from '../constants/region-slugs'

export interface ConsumerSurfaceSeo {
  /** og/twitter title (사이트명 접미사 **없이**) — `<SEO title>` 에 그대로 넣는 값 */
  title: string
  description: string
  /** canonical 에 보존할 쿼리 파라미터. 나머지(utm 등)는 버려 중복 URL 을 막는다. */
  canonicalParams?: readonly string[]
  /**
   * 서버에서도 `robots: noindex, follow` 를 낸다.
   * 클라 `<SEO noindex>` 는 JS 렌더 후라 비-JS 크롤러(네이버 Yeti)에겐 무효였다 — 실측으로
   * `/search`·`/gb-market` 이 클라에선 noindex 인데 **서빙 HTML 은 `index, follow`** 였다.
   */
  noindex?: boolean
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
  // 📣 랜딩 4종 — sitemap 이 priority 0.6~0.85 로 제출하는데 서버 메타는 제네릭 홈이었다.
  //   문구는 각 페이지의 `<SEO>` 가 쓰던 것을 **그대로 옮겨 왔다**(사용자 노출 변화 0).
  //   ⚠️ 그 페이지들은 이제 이 표를 읽는다 — 문구를 고칠 때 여기만 고치면 서버·클라가 함께 바뀐다.
  //   (두 벌로 두면 반드시 갈라진다. 그게 이 파일이 존재하는 이유다.)
  '/about': {
    title: '서비스 소개',
    description: '우리 동네 맛집·뷰티·숙소를 그룹 특가로. 함께 사서 더 좋은 가격, 교환권은 결제 즉시 발급. 소상공인·크리에이터·소비자 모두에게 최고의 가치를.',
  },
  '/creators': {
    title: '크리에이터 모집',
    description: '링크 하나로 동네 맛집을 팔고 커미션을 받으세요. 가입 → 딜 선택 → 링크 공유, 3단계면 시작.',
  },
  '/creators/apply': {
    title: '유어딜 제휴 크리에이터 모집',
    description: '동네 맛집·카페·뷰티·숙소 딜을 소개할 크리에이터를 찾습니다. 지금 제휴 신청하세요.',
  },
  '/partners': {
    title: '입점 안내',
    description: '광고는 클릭에 돈을 쓰고, 유어딜은 손님이 매장에 온 다음에만 비용이 듭니다. 수수료 5% 업계 최저.',
  },

  // ── 🗺️ 소비자 콘텐츠 표면 ─────────────────────────────────────────────
  //   전부 실측에서 **홈 메타 + `index, follow` + canonical 없음** 으로 나왔다(라우트 30개 전수).
  //   문구는 각 페이지 `<SEO>` 가 쓰던 것을 그대로 옮겨 왔다(사용자 노출 변화 0).
  //   i18n 을 쓰는 페이지는 `t(key, { defaultValue: CONSUMER_SURFACE_SEO[...].title })` 형태로
  //   **ko 기본값만** 여기서 읽는다 — 다국어는 유지되고 ko 문구는 한 곳에서 온다.
  '/stays': {
    title: '숙소',
    description: '펜션·호텔·풀빌라 숙소 이용권 — 할인가로 예약하고 매장에서 바로 사용',
  },
  '/meal-vouchers': {
    title: '이용권',
    description: '맛집 이용권을 할인가에 만나보세요. 치킨·피자·한식·카페 등 다양한 이용권 특가.',
  },
  '/experience': {
    title: '체험단 응모',
    description: '무료로 응모하고 공정 추첨으로 매장 체험권을 받아보세요.',
  },
  '/new-openings': {
    title: '우리 동네 새 가게',
    description: '이번 달 우리 동네에 새로 문을 연 가게들 — 공공 인허가 데이터 기반 신규 개업 소식.',
  },
  '/business': {
    title: '유어딜 사장님 — 3분이면 매장 매출이 시작됩니다',
    description: '자영업자를 위한 모바일 우선 공동구매 플랫폼. Magic Link 로 PIN 없이 통계 확인, 자동 환불, 카카오톡 알림톡까지. 수수료 3-5%.',
  },
  '/influencer': {
    title: '유어딜 인플루언서 — 팔로워가 곧 수익이 됩니다',
    description: '매장 섭외 없이 카톡 share 만으로 공구 수익. 친구 추천 양쪽 0.5% 보너스 딜 + 셀러 추천 commission 분할.',
  },
  '/influencer/rankings': {
    title: '인플루언서 랭킹',
    description: '지역별 매출 Top 인플루언서 — 실시간 ranking',
  },
  '/introduce': {
    title: '유어딜 - 우리 동네 공동구매 (맛집·뷰티·숙소)',
    description: '우리 동네 맛집·뷰티·숙소를 그룹 특가로. 함께 사서 더 좋은 가격, 교환권은 결제 즉시 발급.',
  },
  '/join': {
    title: '시작하기',
    description: '동네 핫플, 친구랑 공동구매. 매장 가입 또는 로그인으로 시작하세요.',
  },

  // ── 📜 약관·정책 ──────────────────────────────────────────────────────
  //   ⚠️ `/terms` 의 클라 `<SEO>` 는 `TermsOfServicePage` 가 아니라 위임 대상인
  //   `terms/TermsDocument` 안에 있다(문서 제목 SSOT = `terms/consumer-terms-content.ts`).
  //   여기 title 은 그 문서 제목과 **같은 값**을 서버가 낼 수 있게 둔 것이다 — 문서 제목을 바꾸면
  //   여기도 바꿔야 한다(형제 `/terms/seller` 등은 문서별로 달라 표에 넣지 않았다).
  '/terms': {
    title: '유어딜 이용약관',
    description: '유어딜 서비스를 이용하는 모든 회원에게 적용되는 이용약관 정본 — 회원 가입과 탈퇴, 딜 포인트, 결제와 환불, 회사와 회원의 책임.',
  },
  '/privacy': {
    title: '개인정보처리방침',
    description: '유어딜 개인정보처리방침입니다.',
  },
  '/refund': {
    title: '환불정책',
    description: '유어딜 환불 및 반품 정책을 안내합니다.',
  },
  '/faq': {
    title: '자주 묻는 질문',
    description: '유어딜 이용에 대한 자주 묻는 질문과 답변을 확인하세요.',
  },
  '/gdpr': {
    title: 'Privacy Policy (GDPR) - YourDeal',
    description: 'YourDeal privacy policy and GDPR compliance information.',
  },

  // ── 🚫 색인 제외 ──────────────────────────────────────────────────────
  //   클라 `<SEO noindex>` 는 JS 렌더 후라 비-JS 크롤러엔 무효 — 서버에서도 막는다.
  '/search': {
    title: '검색',
    description: '유어딜에서 원하는 이용권을 검색하세요.',
    noindex: true,
  },
  '/gb-market': {
    title: '공구 마켓',
    description: '지금 소개비가 걸린 공구를 찾아 내 링크샵에 담으세요.',
    noindex: true,
  },
  // 📜 약관 4종 — `/terms` 는 위에 있고 나머지 문서별 약관이 서버 메타 없이 남아 있었다.
  //   ⚠️ description 에 **시행일·버전을 넣지 않는다.** `TermsDocument` 가 그렇게 만들고 있었는데
  //   ① 개정할 때마다 메타가 흔들리고 ② 검색결과에 보일 문장으로도 부적합하다(버전 스탬프).
  //   시행일/버전은 본문 상단에 그대로 보인다 — 메타는 "이 문서가 누구에게 무엇을 정하는가" 만.
  '/terms/seller': {
    title: '판매자 이용약관',
    description: '유어딜에서 상품·이용권을 판매하는 사업자 유저에게 적용되는 약관 — 입점, 정산과 수수료, 금지 행위, 책임 범위.',
  },
  '/terms/agency': {
    title: '에이전시 파트너 약관',
    description: '유어딜 에이전시 파트너에게 적용되는 약관 — 매장 영입과 관리, 수수료 지급, 계약 해지.',
  },
  '/terms/influencer': {
    title: '인플루언서 약관',
    description: '유어딜 추천 링크로 활동하는 인플루언서에게 적용되는 약관 — 커미션 정책, 정산과 원천징수, 금지 행위.',
  },
  '/terms/group-buy': {
    title: '공동구매 약관',
    description: '유어딜 이용권 구매자에게 적용되는 약관 — 결제와 발급, 매장에서의 사용, 유효기간과 환불.',
  },
  '/area-report': {
    title: '우리 동네 상권 리포트',
    description: '공공 인허가 데이터로 보는 우리 동네 업종별 영업 현황과 개업·폐업 흐름.',
  },
}

/**
 * `/area-report/:region` — 지역명이 **경로에 그대로 들어 있어** 데이터 조회 없이 메타를 만들 수 있다.
 *
 * ⚠️ 그런데 그 말은 **누구나 URL 을 지어낼 수 있다**는 뜻이기도 하다. 임의 문자열마다 고유한 제목을
 * 내주면 같은 화면이 무한한 URL 로 갈리는 도어웨이가 된다(이 PR 이 내내 고친 클래스와 같다).
 * 그래서 **한국 행정구역처럼 생긴 세그먼트만 색인 대상**으로 두고 나머지는 `noindex` 로 낸다.
 * 존재하지 않는 동을 완벽히 걸러내지는 못한다 — 그건 조회가 필요하고, 여기서 하려는 건
 * "크롤러가 지어낼 수 있는 공간"을 없애는 것뿐이다.
 */
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
    description: `${region} 업종별 영업 현황과 최근 90일 개업·폐업 흐름 — 공공 인허가 데이터 기반.`,
    canonical: `${origin}/area-report/${encodeURIComponent(region)}`,
    ...(looksLikeRegion ? {} : { noindex: true as const }),
  }
}

/**
 * 🗺️ 2026-08-03 (대표 — 도시별 색인 페이지): `/region/:sido[/:sigungu]` 서버 메타.
 *
 * 왜 서버에서 만드는가: 네이버 Yeti 는 JS 를 돌리지 않는다. 클라이언트 `<SEO>`(react-helmet)만
 * 두면 크롤러에겐 **모든 지역 페이지가 홈 메타**로 보이고, 그러면 도시 페이지를 만든 의미가 없다.
 *
 * ⚠️ 이 함수가 **못** 하는 것 — 딜 개수를 모른다(여기선 DB 조회를 하지 않는다. area-report 와 같은 규칙).
 *   그래서 "딜이 적은 지역은 noindex" 는 클라이언트 렌더에서만 붙는다. 실무상 구멍이 크지 않은 이유는
 *   **thin 지역 URL 로 가는 링크를 아예 만들지 않기 때문**이다(RegionLinkGrid·sitemap 둘 다 `indexable`
 *   만 내보낸다). 직접 주소를 친 경우에만 index 로 나가고, 그건 크롤러가 도달할 일이 드물다.
 *   이게 불충분해지면(예: 외부에서 thin URL 로 링크가 걸리면) 워커에서 집계를 읽어 판정해야 한다.
 */
export function resolveRegionSeo(
  pathname: string,
  origin: string,
  siteName: string = CONSUMER_SITE_NAME
): ResolvedSurfaceSeo | null {
  const m = /^\/region(?:\/([^/]+))?(?:\/([^/]+))?\/?$/.exec(pathname)
  if (!m) return null

  const dec = (v?: string) => {
    if (!v) return ''
    try { return decodeURIComponent(v).trim() } catch { return v.trim() }
  }
  const sidoRaw = dec(m[1])
  const sigunguRaw = dec(m[2])

  // `/region` 허브
  if (!sidoRaw) {
    const t = withSiteName('지역별 이용권·동네딜 — 우리 동네 할인 찾기', siteName)
    return {
      pageTitle: t,
      title: t,
      description: '서울·경기·부산부터 제주까지, 지역별 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요.',
      canonical: `${origin}/region`,
    }
  }

  const sido = normalizeSido(sidoRaw)
  // 모르는 지역 = 크롤러가 지어냈거나 오타. 색인시키면 soft-404 가 쌓인다.
  if (!sido || (sigunguRaw && !/^[가-힣]{1,10}(시|군|구)$/.test(sigunguRaw))) {
    const t = withSiteName('지역별 이용권·동네딜', siteName)
    return { pageTitle: t, title: t, description: '지역별 이용권·동네딜을 확인해보세요.', canonical: `${origin}/region`, noindex: true }
  }

  const label = sigunguRaw ? `${sido} ${sigunguRaw}` : sido
  const t = withSiteName(`${label} 이용권·동네딜 할인`, siteName)
  const canonicalPath = sigunguRaw
    ? `/region/${encodeURIComponent(sido)}/${encodeURIComponent(sigunguRaw)}`
    : `/region/${encodeURIComponent(sido)}`
  return {
    pageTitle: t,
    title: t,
    description: `${label}의 식당·카페·뷰티·숙박 이용권을 할인가로. 온라인에서 사고 매장에서 QR·PIN으로 바로 사용하세요.`,
    canonical: `${origin}${canonicalPath}`,
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
  /** true 면 서버에서도 robots noindex */
  noindex?: boolean
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
  // 표에 없으면 동적 표면 빌더에 넘긴다(경로에서 값을 뽑을 수 있는 것만 — 조회는 하지 않는다).
  if (!entry) return resolveRegionSeo(path, origin, siteName) ?? resolveAreaReportSeo(path, origin, siteName)

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
    ...(entry.noindex ? { noindex: true } : {}),
  }
}
