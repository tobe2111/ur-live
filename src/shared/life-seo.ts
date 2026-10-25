/**
 * 🏠 생활 서비스(사장님 견적) 검색 노출 SSOT — 2026-10-25 대표 "이 프로젝트도 seo, geo 에 노출 잘 되게끔".
 *
 * ## 라이브 실측 (Googlebot UA, 수리 전)
 *   `/life` → 제목이 홈과 같음(`유어딜 - 돈버는 쇼핑…`) · 본문 8자 · sitemap 0건.
 *   `/life/request/:업종` → robots 차단(`Disallow: /life/request` 가 개인 목록 `/life/requests` 를
 *   막으려다 업종 페이지까지 같이 막았다) · 제목도 홈과 같음.
 *   ⇒ "간판 견적"·"주방 후드 청소 업체" 같은 사장님 질의에 내놓을 페이지가 하나도 없었다.
 *
 * ## 무엇을 여기서 정하나
 *   - 허브(`/life`)와 업종 페이지(`/life/request/:key`)의 제목·설명 — 서버 메타와 화면 `<SEO>` 가 **같이** 읽는다.
 *   - 크롤러 본문(`<noscript>`)의 문장·링크 — 업종 페이지는 **그 화면이 실제로 묻는 질문**만 쓴다(클로킹 금지).
 *   - 구조화 데이터 — 허브는 서비스 목록(`ItemList`), 업종은 `Service`(대상 = 사업자).
 *
 * ⚠️ 워커가 읽는 파일이라 상대경로로만 import 한다(`@/` 금지).
 * 업체 모집(`/life/pro`)은 2026-10-25 부터 색인한다 — 로그인 전 화면이 모집 랜딩이 됐다(`LIFE_PRO_SEO`).
 */
import { HOME_SERVICE_CATEGORIES, categoryDef, type CategoryDef } from './home-service-categories'

import { LIFE_HUB_PATH, LIFE_HUB_SEO } from './seo/life-hub-seo'
import { LIFE_FAQ, type LifeFaq } from './life-faq'
export { LIFE_HUB_PATH, LIFE_HUB_SEO }

/** 허브(`/life`)만 FAQ 를 그린다 — 그 페이지가 화면에 같은 목록을 띄우므로 크롤러·구조화 데이터도 같이 낸다. */
export function lifeFaqFor(pathname: string): readonly LifeFaq[] {
  return (pathname.replace(/\/+$/, '') || '/') === LIFE_HUB_PATH ? LIFE_FAQ : []
}

const REQUEST_RE = /^\/life\/request\/([a-z_]+)\/?$/

/** 업종 페이지 경로면 그 정의. 아니면(없는 업종 포함) null. */
export function lifeCategoryOf(pathname: string): CategoryDef | null {
  const m = REQUEST_RE.exec(pathname)
  return m ? categoryDef(m[1]) ?? null : null
}

export const lifeCategoryPath = (key: string) => `/life/request/${key}`

/** 업종 페이지 제목(사이트명 없이). 서버·화면이 같은 함수를 쓴다. */
export function lifeCategoryTitle(def: CategoryDef): string {
  return `${def.label} 견적 - 사장님 생활 서비스`
}

/** 업종 페이지 서버 메타 재료. `consumer-surfaces.ts` 가 사이트명·canonical 을 붙인다. */
export function lifeCategorySeo(pathname: string): { title: string; description: string; path: string } | null {
  const def = lifeCategoryOf(pathname)
  return def ? { title: lifeCategoryTitle(def), description: def.blurb, path: lifeCategoryPath(def.key) } : null
}

/** 빵부스러기 마지막 단계(업종 이름). */
export function lifeCategoryCrumb(pathname: string): string | null {
  return lifeCategoryOf(pathname)?.label ?? null
}

/**
 * 크롤러 본문의 링크. 허브 → 업종 전부, 업종 → 같은 분류의 다른 업종.
 * 링크 글자는 업종 이름(그 페이지 머리줄이 그리는 이름과 같다).
 */
export function lifeChildLinks(pathname: string): Array<{ href: string; label: string }> {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === LIFE_HUB_PATH) {
    return HOME_SERVICE_CATEGORIES.map((d) => ({ href: lifeCategoryPath(d.key), label: `${d.label} 견적` }))
  }
  const def = lifeCategoryOf(path)
  if (!def) return []
  return HOME_SERVICE_CATEGORIES
    .filter((d) => d.audience === def.audience && d.key !== def.key)
    .map((d) => ({ href: lifeCategoryPath(d.key), label: `${d.label} 견적` }))
}

/**
 * 업종 페이지 크롤러 문장 — **요청서가 실제로 묻는 질문**(필드 이름)만 쓴다. 화면 머리줄이 `{업종} 견적` 이고
 * 마지막 확인 화면이 같은 질문들을 늘어놓으므로 화면에 없는 말이 아니다.
 */
export function lifeCategoryLines(pathname: string): string[] | null {
  const def = lifeCategoryOf(pathname)
  if (!def) return null
  return [
    `${def.label} 견적`,
    def.blurb, // 2026-10-25 — 요청서 첫 질문 위 소개로 화면에 뜬다
    `요청서에서 묻는 것: ${def.fields.map((f) => f.label).join(' · ')}`,
  ]
}

/**
 * 구조화 데이터 노드. 허브 = 업종 목록(`ItemList` of `Service`), 업종 = `Service` 하나.
 * 대상은 사업자(`BusinessAudience`) — 일반 소비자 이사·청소 앱과 갈리는 신호다.
 */
export function lifeJsonLdNodes(pathname: string, origin: string, canonical: string): Array<Record<string, unknown>> {
  const path = pathname.replace(/\/+$/, '') || '/'
  const provider = { '@id': `${origin}/#organization` }
  const audience = { '@type': 'BusinessAudience', name: '식당·카페·숙소 사장님' }
  const service = (d: CategoryDef) => ({
    '@type': 'Service',
    name: `${d.label} 견적`,
    serviceType: d.label,
    url: `${origin}${lifeCategoryPath(d.key)}`,
    provider,
    audience,
    areaServed: { '@type': 'Country', name: '대한민국' },
  })
  if (path === LIFE_HUB_PATH) {
    return [{
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: LIFE_FAQ.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    }, {
      '@type': 'ItemList',
      '@id': `${canonical}#services`,
      name: LIFE_HUB_SEO.crumb,
      numberOfItems: HOME_SERVICE_CATEGORIES.length,
      itemListElement: HOME_SERVICE_CATEGORIES.map((d, i) => ({ '@type': 'ListItem', position: i + 1, item: service(d) })),
    }]
  }
  const def = lifeCategoryOf(path)
  return def ? [{ ...service(def), '@id': `${canonical}#service`, description: def.blurb }] : []
}
