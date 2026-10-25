/**
 * 🧭 시드 없는 정적 표면의 크롤러 본문 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/thin-surface-copy-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/thin-surface-copy-2026-10-12.test.ts'
const SSOT = 'src/shared/seo/surface-copy.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
/** 🌐 단일 언어 신호 가드 — hreflang 을 **짓지 않기로** 한 판단을 잠근다(그 파일 머리말에 근거). */
const LANG = 'src/tests/unit/single-language-signals-2026-10-12.test.ts'

export default [
  {
    name: '🧭 정적 표면 배선이 사라진다 — 12개 표면이 다시 15~40자로',
    file: NS,
    find: '  const copy = surfaceCopyFor(path)',
    replace: '  const copy = null as ReturnType<typeof surfaceCopyFor>',
    test: TEST,
    why: '문구가 멀쩡해도 배선이 빠지면 라이브는 종전 그대로다 — 2026-10-11 에 "파일에 있다 ≠ 크롤러가 받는다" 로 값을 치렀다.',
  },
  {
    name: '🧭 약관 본문이 조항 제목 대신 전문을 쏟는다',
    file: NS,
    find: 'const heads = terms.sections.map(x => x.title).filter(Boolean)',
    replace: 'const heads = terms.sections.flatMap(x => [...(x.paras || []), ...(x.items || [])])',
    test: TEST,
    why: '요약이지 덤프가 아니다 — `<noscript>` 는 **사람이 받는 응답에도 그대로 실린다**(크롤러 전용은 가이드 위반).',
  },
  {
    name: '🧭 약관이 문서가 아니라 손으로 쓴 요약을 쓴다',
    file: NS,
    find: "const terms: TermsDoc | null = path === '/terms' ? CONSUMER_TERMS",
    replace: "const terms: TermsDoc | null = path === '/terms' ? ({ ...CONSUMER_TERMS, sections: [] })",
    test: TEST,
    why: '조가 늘거나 개정되면 손 요약은 갈린다 — 문서에서 파생해야 자동으로 따라온다.',
  },
  {
    name: '🧭 SSOT 가 화면에 없는 말을 담는다 (클로킹)',
    file: SSOT,
    find: "      '팔로워가 많지 않아도 괜찮아요. 동네 이웃에게 진짜 좋은 딜을 소개하는 것부터 시작합니다.',",
    replace: "      '유어딜 소개로 월 수백만원을 버는 분들이 많습니다.',",
    test: TEST,
    why: '크롤러에게만 다른 소개를 주는 것은 구글이 명시적으로 금지한다 — ①이 페이지 소스와 대조해 막는다.',
  },
  {
    name: '🧭 SSOT 가 요율을 적는다 — 어드민에서 바뀌면 낡는다',
    file: SSOT,
    find: "      '무료 응모 · 공정 추첨 · 선정 시 체험권이 이용권 지갑에 발급돼요.',",
    replace: "      '수수료는 5% 입니다.',",
    test: TEST,
    why: '요율·기간·금액은 `platform_settings` 조정 대상이라 문구에 적으면 반드시 낡는다(머리말 규율).',
  },
  {
    name: '🧭 끝 슬래시를 다른 키로 본다 — `/partners/` 가 빈다',
    file: SSOT,
    // 2026-10-25 재조준 — 업종 견적 페이지 파생이 같은 줄에 붙었다(불변식 그대로).
    find: "  return SURFACE_COPY[path] ?? (life",
    replace: '  return SURFACE_COPY[pathname] ?? (life',
    test: TEST,
    why: '`CONSUMER_SURFACE_SEO` 와 같은 키로 봐야 한다 — 한쪽만 끝 슬래시를 떼면 메타는 있고 본문만 비는 조합이 생긴다.',
  },
  {
    name: '🧭 판정이 다른 표면까지 삼킨다',
    file: SSOT,
    find: "SURFACE_COPY[path] ?? (life ? { lines: life, source: ['src/shared/home-service-categories.ts'] } : null)",
    replace: 'SURFACE_COPY[path] ?? SURFACE_COPY["/partners"]',
    test: TEST,
    why: '상세·유어샵에 입점 랜딩 문구가 붙으면 그 페이지 내용과 무관한 말을 선언하는 셈이다.',
  },


  // 🌐 단일 언어 신호 — 가드: single-language-signals-2026-10-12.test.ts

  {
    name: '🌐 거짓 다국어 선언이 되살아난다 — 존재하지 않는 URL 5개를 가리킨다',
    file: 'src/components/SEO.tsx',
    find: '      <meta property="og:locale" content={OG_LOCALE} />',
    replace: '      <meta property="og:locale" content={OG_LOCALE} />\n      <meta property="og:locale:alternate" content="en_US" />',
    test: LANG,
    why: '`og:locale:alternate` 는 "같은 URL 이 그 언어로도 있다" 는 뜻이다 — 언어 전환이 URL 을 안 바꾸므로 거짓이다.',
  },
  {
    name: '🌐 og:locale 이 다시 i18n 언어로 흔들린다 — 서버 값과 어긋난다',
    file: 'src/components/SEO.tsx',
    find: "const OG_LOCALE = 'ko_KR'",
    replace: "const OG_LOCALE = (globalThis as { __lang?: string }).__lang || 'ko_KR'",
    test: LANG,
    why: '크롤은 서버 HTML(ko_KR)을 받는다 — 클라에서 흔들면 닿지도 않으면서 두 벌이 갈리기만 한다.',
  },
  {
    name: '🌐 `inLanguage` 가 한쪽만 `ko-KR` 로 갈린다',
    file: 'src/shared/seo/brand-jsonld.ts',
    find: "      inLanguage: 'ko',",
    replace: "      inLanguage: 'ko-KR',",
    test: LANG,
    why: '2026-10-11 에 브랜드 노드를 두 벌 낼 뻔한 자리의 실제 증상이 이 드리프트였다(그 파일 주석이 그 예를 든다).',
  },
  {
    name: '🌐 hreflang 을 URL 없이 선언한다',
    file: 'src/components/SEO.tsx',
    find: '      <link rel="canonical" href={fullUrl} />',
    replace: '      <link rel="canonical" href={fullUrl} />\n      <link rel="alternate" hrefLang="en" href={fullUrl} />',
    test: LANG,
    why: '같은 URL 을 영어판이라고 선언하는 것이다 — 구글이 보는 것은 한국어 본문이다.',
  },
  {
    name: '🧭 본문을 다시 한 줄로 줄인다 — thin 으로 되돌아간다',
    file: 'src/shared/seo/surface-copy.ts',
    find: "      '고르고, 사고, 매장에서 쓰기.',",
    replace: '',
    test: 'src/tests/unit/thin-surface-copy-2026-10-12.test.ts',
    why: '2026-10-12 2차에서 `/introduce` 를 66 → 205자로 늘렸다. 길이 하한이 없으면 다음 정리 PR 이 조용히 되돌린다 — 화면은 안 깨지고 라이브를 재 본 사람만 안다.',
  },
  {
    name: '🧭 화면에 없는 말을 크롤러에게 준다 (클로킹)',
    file: 'src/shared/seo/surface-copy.ts',
    find: "      '지도와 유어샵, 유어쇼츠에서 동네 이용권을 봅니다',",
    replace: "      '업계 1위 유어딜, 전국 10만 매장이 함께합니다',",
    test: 'src/tests/unit/thin-surface-copy-2026-10-12.test.ts',
    why: '크롤러에게만 주는 문구는 구글 가이드 위반이고, 사실도 아니다 — 모든 줄이 그 페이지 소스에 실재해야 한다.',
  },
]
