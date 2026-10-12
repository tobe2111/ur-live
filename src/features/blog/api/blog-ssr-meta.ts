/**
 * 📝 2026-07-01 블로그 서버측 SSR 메타/구조화데이터 빌더 (worker/index.ts 에서 추출).
 *   JS 안 도는 크롤러(네이버/카카오/소셜 스크래퍼)용 title/OG/JSON-LD 를 순수 계산으로 생성.
 *   worker/index 의 HTMLRewriter `.on()` 배선은 이 결과값만 소비 — god 파일 성장 방지(file-size 래칫).
 *   ⚠️ 동작 불변: 기존 인라인 로직과 byte-동일한 출력(JSON-LD/canonical/OG). 순수 함수만.
 */
import { CONSUMER_SITE_NAME } from '../../../shared/seo/consumer-surfaces'

/** 블로그 빵부스러기 라벨 — 표의 다른 `crumb` 들과 같은 감각(짧게). */
const BLOG_CRUMB = '블로그'


// script 종료 태그 이스케이프 — <script type="application/json"> / ld+json 안전 임베드.
function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script')
}

// 제목/요약 등 메타 텍스트의 마크다운 볼드 표기(**) 제거 — 크롤러/소셜/JSON-LD 에 글자로 노출 방지.
function stripBold(s: string): string {
  return s.replace(/\*\*/g, '')
}

/**
 * 🍞 2026-10-12 — 블로그 빵부스러기. 라이브 실측에서 `/blog` 와 글 23편 전부
 *   `BreadcrumbList` **0건**이었다(검색결과 제목 아래에 빵부스러기 대신 생 URL 이 뜬다).
 *   목록 표면들은 `surface-list-jsonld.ts` 가 체인을 쌓아 주는데, 블로그는 **다른 빌더**를
 *   쓰는 유일한 표면이라 그 처방이 여기까지 안 와 있었다.
 *
 * 체인은 **두~세 단계**다: `유어딜 › 블로그`(목록) / `유어딜 › 블로그 › 제목`(상세).
 * ⚠️ `name`·`item` 둘 다 넣는다 — 마지막 단계도 자기 URL 을 갖는다(구글 권장).
 * ⚠️ 사이트 이름은 `CONSUMER_SITE_NAME` SSOT 를 쓴다(손으로 '유어딜' 을 적으면 갈린다).
 *    워커는 alias(`@/`) 를 못 풀어 상대경로로 받는다.
 */
function blogBreadcrumb(
  origin: string,
  canonical: string,
  leaf?: { name: string; url: string },
): Record<string, unknown> {
  const trail: Array<{ name: string; url: string }> = [
    { name: CONSUMER_SITE_NAME, url: `${origin}/` },
    { name: BLOG_CRUMB, url: `${origin}/blog` },
  ]
  if (leaf) trail.push(leaf)
  return {
    '@type': 'BreadcrumbList',
    // 🔗 `@id` 를 줘서 본문 노드가 **참조**로 가리킨다 — 같은 체인을 두 벌 싣지 않는다
    //   (그러면 같은 문서에 동일한 BreadcrumbList 가 둘이 된다). 참조 대상은 같은 `@graph`
    //   안에 있으므로 **매달린 `@id` 가 생기지 않는다**(2026-10-11 E4 판정 기준).
    '@id': `${canonical}#breadcrumb`,
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.name, item: t.url,
    })),
  }
}

export interface BlogPostMeta {
  /** <title> 값 — "제목 - 유어딜 블로그" */
  pageTitle: string
  /** og/twitter title — 원제목 */
  title: string
  description: string
  canonical: string
  ogImage: string
  /** 이스케이프 완료된 BlogPosting JSON-LD 문자열 */
  jsonLd: string
}

/** 블로그 상세(/blog/:slug) 서버 메타 — payload 없거나 파싱 실패 시 null(기본 메타 유지). */
export function buildBlogPostMeta(ssrPayload: string, origin: string): BlogPostMeta | null {
  try {
    const post = (JSON.parse(ssrPayload) as { data?: { title?: string; summary?: string; slug?: string; author?: string; published_at?: string } })?.data
    if (!post || !post.title) return null
    const title = stripBold(String(post.title))
    const description = stripBold(String(post.summary || '')).slice(0, 200)
    const canonical = `${origin}/blog/${post.slug || ''}`
    const pub = post.published_at ? new Date(post.published_at).toISOString() : undefined
    const ogImage = `${origin}/blog/og/${encodeURIComponent(post.slug || '')}`
    // 🧠 2026-07-27 GEO (대표 — "구글 AI 개요에 우리 서비스가"): publisher/isPartOf 를 index.html 의
    //   사이트 전역 Organization·WebSite 노드(@id)에 **참조로 연결** — 기존엔 이름만 같은 분리 노드라
    //   검색 AI 가 "이 글의 발행자 = 유어딜(urdeal.kr) 서비스"로 묶지 못했다. @id 로 그래프가 이어지면
    //   블로그 22편이 전부 브랜드 엔티티의 근거 문서가 된다(동음이의 혼동 방지의 핵심).
    const article: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: title, description,
      author: { '@type': 'Organization', name: post.author || '유어딜' },
      publisher: { '@id': `${origin}/#organization` },
      isPartOf: { '@id': `${origin}/#website` },
      mainEntityOfPage: canonical, url: canonical,
      ...(pub ? { datePublished: pub, dateModified: pub } : {}),
    }
    // 🍞 빵부스러기를 더하려면 노드가 둘이 되므로 `@graph` 로 감싼다(소비자는 재귀로 훑는다).
    //   `@context` 는 바깥에 한 번만 — 안쪽 노드에 남겨 두면 중복 선언이 된다.
    const { '@context': _ctx, ...articleNode } = article as Record<string, unknown>
    const crumb = blogBreadcrumb(origin, canonical, { name: title, url: canonical })
    const jsonLd = escapeScript(JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { ...articleNode, image: ogImage, breadcrumb: { '@id': crumb['@id'] } },
        crumb,
      ],
    }))
    return { pageTitle: `${title} - 유어딜 블로그`, title, description, canonical, ogImage, jsonLd }
  } catch { return null }
}

/**
 * 블로그 목록(/blog) Blog + ItemList(BlogPosting) JSON-LD — 검색 리치결과.
 * payload 없거나(콜드 timeout) 파싱 실패/글 0건이면 '' 반환(메타만 주입).
 */
export function buildBlogListJsonLd(ssrPayload: string | null, origin: string, canonical: string, name: string, description: string): string {
  // 시드가 아예 없어도(콜드 self-fetch timeout) 빵부스러기는 낸다 — 경로만으로 만들어진다.
  if (!ssrPayload) {
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blogBreadcrumb(origin, canonical)] }))
  }
  try {
    const posts = (JSON.parse(ssrPayload) as { data?: Array<{ slug?: string; title?: string; summary?: string; author?: string; published_at?: string }> })?.data || []
    const items = posts.slice(0, 20).filter(p => p && p.slug && p.title).map((p, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${origin}/blog/${p.slug}`,
      item: {
        '@type': 'BlogPosting', headline: stripBold(String(p.title)), description: stripBold(String(p.summary || '')).slice(0, 200),
        url: `${origin}/blog/${p.slug}`, mainEntityOfPage: `${origin}/blog/${p.slug}`,
        author: { '@type': 'Organization', name: p.author || '유어딜' },
        publisher: { '@id': `${origin}/#organization` },
        ...(p.published_at ? { datePublished: new Date(p.published_at).toISOString() } : {}),
      },
    }))
    // 🍞 글이 0건(콜드 timeout·발행 0)이어도 **빵부스러기는 낸다** — 그건 payload 와 무관하고,
    //   종전엔 여기서 `''` 로 빠져 그 경우 `/blog` 가 구조화 데이터를 통째로 못 받았다.
    const crumb = blogBreadcrumb(origin, canonical)
    if (!items.length) {
      return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [crumb] }))
    }
    const blog = {
      '@type': 'Blog', name, description, url: canonical,
      publisher: { '@id': `${origin}/#organization` },
      isPartOf: { '@id': `${origin}/#website` },
      blogPost: items.map(it => it.item),
      mainEntity: { '@type': 'ItemList', itemListElement: items },
      breadcrumb: { '@id': crumb['@id'] },
    }
    return escapeScript(JSON.stringify({ '@context': 'https://schema.org', '@graph': [blog, crumb] }))
  } catch { return '' }
}
