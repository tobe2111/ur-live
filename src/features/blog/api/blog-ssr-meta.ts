/**
 * 📝 2026-07-01 블로그 서버측 SSR 메타/구조화데이터 빌더 (worker/index.ts 에서 추출).
 *   JS 안 도는 크롤러(네이버/카카오/소셜 스크래퍼)용 title/OG/JSON-LD 를 순수 계산으로 생성.
 *   worker/index 의 HTMLRewriter `.on()` 배선은 이 결과값만 소비 — god 파일 성장 방지(file-size 래칫).
 *   ⚠️ 동작 불변: 기존 인라인 로직과 byte-동일한 출력(JSON-LD/canonical/OG). 순수 함수만.
 */

// script 종료 태그 이스케이프 — <script type="application/json"> / ld+json 안전 임베드.
function escapeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script')
}

// 제목/요약 등 메타 텍스트의 마크다운 볼드 표기(**) 제거 — 크롤러/소셜/JSON-LD 에 글자로 노출 방지.
function stripBold(s: string): string {
  return s.replace(/\*\*/g, '')
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
    const article: Record<string, unknown> = {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: title, description,
      author: { '@type': 'Organization', name: post.author || '유어딜' },
      publisher: { '@type': 'Organization', name: '유어딜' },
      mainEntityOfPage: canonical, url: canonical,
      ...(pub ? { datePublished: pub, dateModified: pub } : {}),
    }
    const jsonLd = escapeScript(JSON.stringify({ ...article, image: ogImage }))
    return { pageTitle: `${title} - 유어딜 블로그`, title, description, canonical, ogImage, jsonLd }
  } catch { return null }
}

/**
 * 블로그 목록(/blog) Blog + ItemList(BlogPosting) JSON-LD — 검색 리치결과.
 * payload 없거나(콜드 timeout) 파싱 실패/글 0건이면 '' 반환(메타만 주입).
 */
export function buildBlogListJsonLd(ssrPayload: string | null, origin: string, canonical: string, name: string, description: string): string {
  if (!ssrPayload) return ''
  try {
    const posts = (JSON.parse(ssrPayload) as { data?: Array<{ slug?: string; title?: string; summary?: string; author?: string; published_at?: string }> })?.data || []
    const items = posts.slice(0, 20).filter(p => p && p.slug && p.title).map((p, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${origin}/blog/${p.slug}`,
      item: {
        '@type': 'BlogPosting', headline: stripBold(String(p.title)), description: stripBold(String(p.summary || '')).slice(0, 200),
        url: `${origin}/blog/${p.slug}`, mainEntityOfPage: `${origin}/blog/${p.slug}`,
        author: { '@type': 'Organization', name: p.author || '유어딜' },
        publisher: { '@type': 'Organization', name: '유어딜' },
        ...(p.published_at ? { datePublished: new Date(p.published_at).toISOString() } : {}),
      },
    }))
    if (!items.length) return ''
    const graph = {
      '@context': 'https://schema.org', '@type': 'Blog', name, description, url: canonical,
      publisher: { '@type': 'Organization', name: '유어딜' },
      blogPost: items.map(it => it.item),
      mainEntity: { '@type': 'ItemList', itemListElement: items },
    }
    return escapeScript(JSON.stringify(graph))
  } catch { return '' }
}
