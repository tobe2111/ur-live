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
    title: '유어딜 - 우리 동네 맛집·카페·뷰티 이용권 할인',
    description:
      '우리 동네 맛집·카페·뷰티·숙소 이용권을 할인가로 사서 매장에서 바로 쓰세요. 기프티콘 교환권은 결제 즉시 발송, 내 주변 동네딜은 지도에서 한눈에. 가입하면 내 유어샵도 함께 열립니다.',
  },
  '/vouchers': {
    title: '기프티콘 교환권 - 카페·편의점·치킨 할인',
    description:
      '스타벅스·메가MGC커피·GS25·투썸 등 인기 브랜드 기프티콘을 할인가로. 결제하면 바로 발송되고 유효기간 안에 매장에서 쓰면 됩니다.',
    canonicalParams: ['category', 'brand'],
  },
  '/browse': {
    title: '쇼핑 - 유어딜 상품 모아보기',
    description: '유어딜 사업자 유저가 직접 파는 상품을 한눈에. 카테고리·가격으로 골라 담고 바로 결제하세요.',
    canonicalParams: ['category'],
  },
  '/map': {
    title: '내 주변 동네딜 지도 - 걸어갈 수 있는 할인',
    description: '지금 있는 자리에서 가까운 순으로 동네 이용권을 봅니다. 맛집·카페·뷰티·숙소를 지도에서 고르고 할인가로 사서 그 매장에서 바로 쓰세요.',
  },
  // 📣 랜딩 4종 — sitemap 이 priority 0.6~0.85 로 제출하는데 서버 메타는 제네릭 홈이었다.
  //   문구는 각 페이지의 `<SEO>` 가 쓰던 것을 **그대로 옮겨 왔다**(사용자 노출 변화 0).
  //   ⚠️ 그 페이지들은 이제 이 표를 읽는다 — 문구를 고칠 때 여기만 고치면 서버·클라가 함께 바뀐다.
  //   (두 벌로 두면 반드시 갈라진다. 그게 이 파일이 존재하는 이유다.)
  '/about': {
    title: '서비스 소개 - 유어딜은 이렇게 작동합니다',
    description: '매장은 손님이 온 다음에만 비용을 냅니다. 손님은 동네 이용권을 할인가로 사고, 마음에 든 딜은 내 유어샵에 담아 소개하면 몫이 쌓입니다. 매장·소개·구매 셋이 함께 이득인 구조.',
  },
  '/creators': {
    title: '동네 딜 소개하고 수익 받기',
    description: '링크 하나로 우리 동네 맛집을 소개하고 팔릴 때마다 몫을 받으세요. 가입 → 유어샵에 담기 → 링크 공유, 3단계면 시작입니다.',
  },
  '/creators/apply': {
    title: '유어딜 소개 파트너 신청',
    description: '동네 맛집·카페·뷰티·숙소 이용권을 소개해 주실 분을 찾습니다. 팔로워 수보다 동네를 아는 것이 중요해요.',
  },
  '/partners': {
    title: '매장 입점 안내 - 손님이 온 다음에만 비용',
    description: '광고는 클릭에 돈이 나가지만 유어딜은 손님이 매장에 온 뒤에만 수수료 5%가 붙습니다. 카카오맵에서 우리 가게를 찾아 등록하면 바로 이용권을 올릴 수 있어요.',
  },

  // ── 🗺️ 소비자 콘텐츠 표면 ─────────────────────────────────────────────
  //   전부 실측에서 **홈 메타 + `index, follow` + canonical 없음** 으로 나왔다(라우트 30개 전수).
  //   문구는 각 페이지 `<SEO>` 가 쓰던 것을 그대로 옮겨 왔다(사용자 노출 변화 0).
  //   i18n 을 쓰는 페이지는 `t(key, { defaultValue: CONSUMER_SURFACE_SEO[...].title })` 형태로
  //   **ko 기본값만** 여기서 읽는다 — 다국어는 유지되고 ko 문구는 한 곳에서 온다.
  '/stays': {
    title: '숙소 이용권 - 펜션·호텔·풀빌라 할인',
    description: '펜션·호텔·풀빌라 숙박 이용권을 할인가로. 원하는 날짜를 골라 예약하고 현장에서 바로 사용하세요.',
  },
  '/experience': {
    title: '무료 체험단 응모 - 우리 동네 매장',
    description: '응모는 무료, 당첨은 공정 추첨. 우리 동네 맛집·카페·뷰티 매장 체험권을 받아보세요.',
  },
  '/new-openings': {
    title: '우리 동네 새로 생긴 가게 - 이번 달 신규 오픈',
    description: '이번 달 우리 동네에 새로 문을 연 가게를 공공 인허가 데이터로 먼저 확인하세요. 오픈 기념 이용권이 올라오면 바로 보입니다.',
  },
  '/business': {
    title: '유어딜 사장님 - 내 가게 이용권 팔기',
    description: '카카오맵에서 우리 가게를 찾아 등록하면 바로 이용권을 올릴 수 있습니다. 손님이 QR 로 쓰면 정산되고, 수수료는 팔린 만큼만 5%. 광고비 선불 없음.',
  },
  '/influencer': {
    title: '동네 딜 소개로 수익 만들기',
    description: '매장을 직접 섭외하지 않아도 됩니다. 마음에 든 이용권을 내 유어샵에 담아 링크로 소개하면, 그 링크로 팔릴 때마다 몫이 쌓입니다.',
  },
  '/influencer/rankings': {
    title: '이 달의 소개 랭킹',
    description: '지역별로 이번 달 소개 성과가 높은 유어샵을 봅니다. 어떤 딜이 실제로 팔리는지 참고하세요.',
  },
  '/introduce': {
    title: '유어딜 소개 - 우리 동네 이용권 공동구매',
    description: '우리 동네 맛집·카페·뷰티·숙소 이용권을 할인가로 사서 매장에서 바로 쓰는 서비스. 기프티콘 교환권은 결제 즉시 발송됩니다.',
  },
  '/join': {
    title: '유어딜 시작하기',
    description: '내 가게를 등록해 이용권을 팔거나, 로그인해서 동네 딜을 사고 소개해 보세요. 둘 다 해도 됩니다.',
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
    title: '자주 묻는 질문 - 이용권 사용·환불',
    description: '이용권은 어떻게 쓰는지, 유효기간이 지나면 어떻게 되는지, 환불은 언제 되는지 — 가장 많이 묻는 것부터 답합니다.',
  },
  '/gdpr': {
    title: 'Privacy Policy (GDPR) - YourDeal',
    description: 'YourDeal privacy policy and GDPR compliance information.',
  },

  // ── 🚫 색인 제외 ──────────────────────────────────────────────────────
  //   클라 `<SEO noindex>` 는 JS 렌더 후라 비-JS 크롤러엔 무효 — 서버에서도 막는다.
  '/search': {
    title: '검색',
    description: '매장 이름이나 지역으로 이용권을 찾아보세요.',
    noindex: true,
  },
  '/gb-market': {
    title: '소개 마켓',
    description: '지금 소개 몫이 걸린 이용권을 찾아 내 유어샵에 담으세요.',
    noindex: true,
  },
  // 📜 약관 4종 — `/terms` 는 위에 있고 나머지 문서별 약관이 서버 메타 없이 남아 있었다.
  //   ⚠️ description 에 **시행일·버전을 넣지 않는다.** `TermsDocument` 가 그렇게 만들고 있었는데
  //   ① 개정할 때마다 메타가 흔들리고 ② 검색결과에 보일 문장으로도 부적합하다(버전 스탬프).
  //   시행일/버전은 본문 상단에 그대로 보인다 — 메타는 "이 문서가 누구에게 무엇을 정하는가" 만.
  // ⚠️ '판매자' 는 명칭 SSOT 의 금지어지만 여기만 예외다 — 이 title 은 **약관 정본의 제목**
  //   (`terms/seller-terms-content.ts` v1.0, 대표 확정)과 같아야 하고, 시행 중인 계약 문서의
  //   제목을 SEO 편의로 바꾸면 정본과 검색결과가 갈린다. 정본을 개정할 때 함께 바꿀 것.
  '/terms/seller': {
    title: '판매자 이용약관',
    description: '유어딜에서 상품·이용권을 판매하는 사업자 유저에게 적용되는 약관 — 입점, 정산과 수수료, 금지 행위, 책임 범위.',
  },
  '/terms/influencer': {
    title: '소개 활동 약관',
    description: '유어샵 링크로 이용권을 소개하는 유저에게 적용되는 약관 — 커미션 정책, 정산과 원천징수, 금지 행위.',
  },
  '/terms/group-buy': {
    title: '공동구매 약관',
    description: '유어딜 이용권 구매자에게 적용되는 약관 — 결제와 발급, 매장에서의 사용, 유효기간과 환불.',
  },
  '/area-report': {
    title: '우리 동네 상권 리포트 - 개업·폐업 현황',
    description: '공공 인허가 데이터로 보는 우리 동네 업종별 영업 현황과 최근 개업·폐업 흐름. 창업 자리를 고를 때 참고하세요.',
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
  if (!entry) return resolveAreaReportSeo(path, origin, siteName)

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
