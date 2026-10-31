/**
 * 🧭 대외 랜딩(`/partners` · `/influencer`)과 생활 허브(`/life`)의 **크롤러 전용 덧붙임** — 워커 전용.
 *
 * 2026-10-31 대표 *"/partners · /influencer 도 SEO, GEO 세팅 빡세게 해줘"*. 라이브 실측(Googlebot·Yeti·
 * OAI-SearchBot 셋 다 같은 결과):
 *
 *     /partners    본문 252자 · a태그 0 · JSON-LD = 브랜드·빵부스러기·WebPage 뿐 · FAQPage 0
 *     /influencer  본문 256자 · a태그 0 · 같음
 *
 * 메타·canonical·빵부스러기는 멀쩡했다. 비어 있던 것은 **인용할 문장**(질문과 답)과 **구조화 신호**
 * (이 페이지가 사장님용 서비스라는 것) 그리고 **내부 링크**다.
 *
 * ## 무엇을 더하나
 * - FAQ — `shared/landing-faq.ts` SSOT. 두 페이지가 화면에 **같은 배열**을 그린다(클로킹 아님).
 * - `FAQPage` JSON-LD — 같은 배열. ⚠️ 구글은 2023-08 부터 FAQ 리치결과를 정부·의료 사이트에만
 *   보여 준다. 그래도 내는 이유는 Bing·네이버·AI 검색이 Q&A 구조를 그대로 읽기 때문이다(GEO).
 * - `Service`(입점) — 대상 `BusinessAudience`. 소비자 쇼핑 페이지와 갈리는 신호다(`/life` 와 같은 수법).
 * - 내부 링크 — **그 화면에 실제로 있는 링크만**(헤더의 로고·서비스 소개·사장님). 화면에 없는
 *   링크를 크롤러에게만 주지 않는다. `/store/new`·`/login` 은 robots 차단·도구라 넣지 않는다.
 *
 * ## 왜 따로 파일인가
 * `crawler-noscript.ts`(599줄)·`consumer-surfaces.ts`(600줄)가 파일 크기 상한에 붙어 있다. 거기엔
 * 호출 한 줄씩만 두고 판정은 여기서 한다. 클라 번들에 실리지 않게 `worker/utils` 에 둔다.
 */
import { LIFE_HUB_PATH } from '../../shared/seo/life-hub-seo'
import { lifeFaqFor } from '../../shared/life-seo'
import { PARTNER_FAQ, REFERRAL_FAQ, type LandingFaq } from '../../shared/landing-faq'
import { CONSUMER_SURFACE_SEO, CONSUMER_SITE_NAME } from '../../shared/seo/consumer-surfaces'

const norm = (p: string) => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p)

/** 경로 → 그 화면이 그리는 FAQ. 없으면 빈 배열(종전 출력과 byte-동일). */
export function landingFaqFor(pathname: string): readonly LandingFaq[] {
  const path = norm(pathname)
  if (path === '/partners') return PARTNER_FAQ
  if (path === '/influencer') return REFERRAL_FAQ
  return path === LIFE_HUB_PATH ? lifeFaqFor(path) : []
}

/** 그 화면 헤더에 실제로 있는 링크(가드가 페이지 소스와 대조한다). */
const LANDING_LINK_PATHS: Readonly<Record<string, readonly string[]>> = {
  '/partners': ['/', '/about'],
  '/influencer': ['/', '/about', '/partners'],
}

/** 라벨은 빵부스러기와 같은 SSOT(`crumb`) — 손으로 적으면 갈린다. 홈은 사이트 이름. */
export function landingLinks(pathname: string): Array<{ href: string; label: string }> {
  return (LANDING_LINK_PATHS[norm(pathname)] ?? []).map((href) => ({
    href,
    label: href === '/' ? CONSUMER_SITE_NAME : CONSUMER_SURFACE_SEO[href]?.crumb || CONSUMER_SITE_NAME,
  }))
}

/** 구조화 데이터 노드. 해당 없는 경로는 빈 배열. */
export function landingJsonLdNodes(pathname: string, origin: string, canonical: string): Array<Record<string, unknown>> {
  const path = norm(pathname)
  if (path !== '/partners' && path !== '/influencer') return []
  const faq = landingFaqFor(path)
  const nodes: Array<Record<string, unknown>> = [{
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  }]
  if (path === '/partners') {
    nodes.push({
      '@type': 'Service',
      '@id': `${canonical}#service`,
      name: `${CONSUMER_SITE_NAME} 매장 입점`,
      serviceType: '선결제 이용권 판매',
      description: CONSUMER_SURFACE_SEO['/partners']?.description,
      url: canonical,
      provider: { '@id': `${origin}/#organization` },
      audience: { '@type': 'BusinessAudience', name: '식당·카페·미용실·숙소 사장님' },
      areaServed: { '@type': 'Country', name: '대한민국' },
    })
  }
  return nodes
}
