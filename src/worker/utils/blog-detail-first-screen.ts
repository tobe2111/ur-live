/**
 * 📝 블로그 상세(`/blog/:slug`) 서버 첫 화면 (2026-10-19 대표 *"지도랑 블로그도 상세히 진행해줘"*).
 *
 * 종전 서버 본문(`features/blog/api/blog-ssr-body.ts`)은 꾸밈 없는 HTML 이라 앱 CSS 를 기다렸다 그려졌고,
 * React 가 뜨면 머리글·태그·커버가 생기며 화면이 통째로 바뀌었다(실측 첫 그림 2.4~3.0초).
 * 이 첫 화면은 **React 와 같은 모양**(같은 클래스 상수 — `shared/blog-page.ts`)으로 [머리글 + 태그 + 제목 + 요약 +
 * 메타 + 커버 + 목차 버튼 + 본문 전부]를 그린다. 본문 전부를 그리므로 크롤러가 읽는 글자는 종전과 같다.
 *
 * ## 그리지 않는 것
 * - 아이콘(SVG) — 같은 크기의 빈 칸만(두 벌 금지). 아이콘은 그 칸 *안에서* 나중에 나타난다.
 * - 본문 아래(추천 글·CTA) — 첫 화면 밖이고 다른 글 목록이 필요하다.
 * - PC — 호출부가 폰 UA(+크롤러)에서만 부른다(좌측 목차 칸이 그려져야 해 다른 마크업이다).
 *
 * ## 실패하면
 * 빈 문자열 — 호출부가 종전 크롤러용 본문으로 되돌아간다(무회귀).
 */
import {
  BLOG_DETAIL, BLOG_COVER, blogMarkdownHtml, blogCoverTopic, blogCoverBg, blogCoverInk,
  blogDateLabel, blogReadMin, blogHasToc, parseBlogTags,
} from '../../shared/blog-page'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const stripBold = (s: unknown) => String(s ?? '').replace(/\*\*/g, '')
/** 아이콘 자리 — lucide·유어딜 아이콘은 preflight 로 `display:block` 이므로 같은 크기의 block 칸이다. */
const iconSlot = (px: number) => `<span class="block shrink-0" style="width:${px}px;height:${px}px" aria-hidden="true"></span>`

interface BlogPostSeed { slug?: string; title?: string; summary?: string; content?: string; tags?: unknown; author?: string | null; published_at?: string; thumbnail_url?: string | null }

export function buildBlogDetailFirstScreen(ssrPayload: string | null | undefined): string {
  let post: BlogPostSeed | undefined
  try { post = (JSON.parse(ssrPayload || '') as { data?: BlogPostSeed })?.data } catch { return '' }
  if (!post || !post.slug || !post.title || !post.content) return ''

  const tags = parseBlogTags(post.tags)
  const tagsHtml = tags.length ? `<div class="${BLOG_DETAIL.tags}">${tags.map(t => `<span class="${BLOG_DETAIL.tag}">${esc(t)}</span>`).join('')}</div>` : ''

  let cover: string
  if (post.thumbnail_url) {
    cover = `<img src="${esc(post.thumbnail_url)}" alt="" class="${BLOG_DETAIL.cover} object-cover" loading="lazy">`
  } else {
    const { hue, label } = blogCoverTopic(post.slug, tags)
    cover = `<div class="${BLOG_DETAIL.cover} ${BLOG_COVER.box}" style="background-color:${blogCoverBg(hue)}">${iconSlot(BLOG_COVER.heroIcon)}`
      + `<span class="${BLOG_COVER.label}" style="color:${blogCoverInk(hue)}">유어딜 · ${esc(label)}</span></div>`
  }

  const toc = blogHasToc(post.content)
    ? `<div class="${BLOG_DETAIL.tocBox}"><button type="button" class="${BLOG_DETAIL.tocBtn}"><span class="${BLOG_DETAIL.tocLabel}">${iconSlot(16)}목차</span>${iconSlot(16)}</button></div>`
    : ''

  const header =
    `<header class="${BLOG_DETAIL.header}"><div class="${BLOG_DETAIL.headerInner}">` +
      `<a href="/blog" class="${BLOG_DETAIL.logo}">유어딜 <span class="${BLOG_DETAIL.logoBar}">|</span> <span class="${BLOG_DETAIL.logoBlog}">Blog</span></a>` +
      `<div class="${BLOG_DETAIL.actions}">` +
        `<a href="/blog" aria-label="블로그 검색" class="${BLOG_DETAIL.iconBtn}">${iconSlot(16)}</a>` +
        `<button type="button" aria-label="공유" class="${BLOG_DETAIL.iconBtn}">${iconSlot(16)}</button>` +
        `<a href="/" class="${BLOG_DETAIL.homeLink}">${iconSlot(16)}유어딜 홈</a>` +
        `<a href="/store/new" class="${BLOG_DETAIL.cta}">내 가게 등록</a>` +
      `</div>` +
    `</div></header>`

  const article =
    `<article class="${BLOG_DETAIL.article}">` +
      tagsHtml +
      `<h1 class="${BLOG_DETAIL.h1}">${esc(stripBold(post.title))}</h1>` +
      `<p class="${BLOG_DETAIL.summary}">${esc(stripBold(post.summary))}</p>` +
      `<div class="${BLOG_DETAIL.meta}"><span>${esc(post.author ?? '')}</span><span>·</span><span>${esc(blogDateLabel(post.published_at))}</span><span>·</span>` +
        `<span class="${BLOG_DETAIL.metaRead}">${iconSlot(14)}${blogReadMin(post.content)}분 읽기</span></div>` +
      cover + toc +
      `<div class="${BLOG_DETAIL.body}">${blogMarkdownHtml(post.content)}</div>` +
    `</article>`

  // 왼쪽 목차 칸(lg 전용)은 비워 둔다 — 폰에선 hidden 이고, 이 첫 화면은 폰에서만 그린다.
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen"><div class="${BLOG_DETAIL.root}">${header}<div class="${BLOG_DETAIL.grid}"><aside class="hidden lg:block"></aside>${article}</div></div></div>`
}
