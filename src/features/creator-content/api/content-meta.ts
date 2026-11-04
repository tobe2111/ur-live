/**
 * 🔎 콘텐츠 주소 → 제목·썸네일·작성자 (2026-11-04)
 *
 * 검색 쿼터를 쓰지 않는 길만 쓴다:
 *   유튜브·틱톡 → 공개 oEmbed(키·쿼터 없음) · 네이버 블로그·클립 → 글 페이지의 og 태그.
 *   인스타그램 oEmbed 는 앱 토큰이 필요해서 쓰지 않는다 — 제목 없이 카드만 서고, 재생은 공식 재생기가 한다.
 *
 * 🪟 **블로그를 창 안에 띄울 수 있나(`embeddable`)** 도 여기서 정한다. 그 글 페이지가 응답 헤더로
 *    `X-Frame-Options` 나 `frame-ancestors` 를 주면 다른 사이트 안에 못 뜬다 — 그러면 창은 미리보기를 보여 주고
 *    "블로그에서 전체 읽기" 로 같은 화면에서 넘어간다. 브라우저는 막힌 iframe 을 우리에게 알려 주지 않으므로
 *    (교차 출처) **서버가 미리 헤더를 보고 적어 둔다.**
 */
import { stripHtml, naverBlogMobileUrl, youtubeThumb, type ContentPlatform } from '../../../shared/creator-content'

export interface ContentMeta {
  title: string | null
  thumb_url: string | null
  author_name: string | null
  summary: string | null
  embeddable: boolean
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

function metaTag(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
  const m = html.match(re) ?? html.match(re2)
  return m ? stripHtml(m[1]).slice(0, 300) || null : null
}

/** 응답 헤더가 다른 사이트 안에 띄우는 것을 막는가. 아무 말이 없으면 허락으로 본다. */
export function frameAllowed(headers: Headers): boolean {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase()
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return false
  const csp = (headers.get('content-security-policy') || '').toLowerCase()
  const fa = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('frame-ancestors'))
  if (fa && !/\*|urdeal\.kr/.test(fa)) return false
  return true
}

function httpsOnly(u: string | null): string | null {
  return u && /^https:\/\//.test(u) ? u.slice(0, 600) : null
}

async function oembed(endpoint: string): Promise<{ title?: string; author_name?: string; thumbnail_url?: string } | null> {
  const r = await fetch(endpoint, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) }).catch(() => null)
  if (!r || !r.ok) return null
  return r.json<{ title?: string; author_name?: string; thumbnail_url?: string }>().catch(() => null)
}

/** 블로그·클립 글 페이지 하나를 읽어 og 태그와 창 허락 여부를 본다. 실패해도 null 이 아니라 빈 값. */
export async function fetchPageMeta(url: string): Promise<ContentMeta> {
  const empty: ContentMeta = { title: null, thumb_url: null, author_name: null, summary: null, embeddable: false }
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR' }, redirect: 'follow', signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!r || !r.ok) return empty
  const embeddable = frameAllowed(r.headers)
  const html = (await r.text().catch(() => '')).slice(0, 200_000)
  return {
    title: metaTag(html, 'og:title'),
    thumb_url: httpsOnly(metaTag(html, 'og:image')),
    author_name: metaTag(html, 'naverblog:nickname') ?? metaTag(html, 'og:site_name'),
    summary: metaTag(html, 'og:description'),
    embeddable,
  }
}

export async function fetchContentMeta(platform: ContentPlatform, extId: string, url: string): Promise<ContentMeta> {
  const base: ContentMeta = { title: null, thumb_url: null, author_name: null, summary: null, embeddable: false }
  if (platform === 'youtube') {
    const o = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${extId}`)}`)
    return { ...base, title: o?.title?.slice(0, 200) ?? null, author_name: o?.author_name?.slice(0, 80) ?? null, thumb_url: youtubeThumb(extId), embeddable: true }
  }
  if (platform === 'tiktok') {
    const o = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
    return { ...base, title: o?.title?.slice(0, 200) ?? null, author_name: o?.author_name?.slice(0, 80) ?? null, thumb_url: httpsOnly(o?.thumbnail_url ?? null), embeddable: true }
  }
  if (platform === 'instagram') return { ...base, embeddable: true }
  if (platform === 'naver_blog') return fetchPageMeta(naverBlogMobileUrl(extId))
  return fetchPageMeta(url) // 네이버 클립 — 창 안 재생기 없음(원본으로), 썸네일만
}
