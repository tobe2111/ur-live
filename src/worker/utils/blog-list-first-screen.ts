/**
 * 📝 블로그 목록(`/blog`) 서버 첫 화면 (2026-10-19 대표 *"지도랑 블로그도 상세히 진행해줘"*).
 *
 * 종전 서버 본문(`buildBlogListBody`)은 크롤러용 꾸밈 없는 목록이라, 앱 CSS 를 기다려 그려졌고(실측 첫 그림 ~2.0초)
 * React 가 뜨면 히어로·검색창·칩·카드가 생기며 화면이 통째로 바뀌었다.
 * 이 첫 화면은 **React 와 같은 모양**(같은 상수 — `shared/blog-page.ts` `BLOG_LIST`)으로
 * [머리 줄 + 히어로(최신 글) + 넘김 버튼 + 검색창 + 태그 칩 + "전체 아티클" 첫 쪽 7편 + 쪽 번호]를 그린다.
 *
 * ## 크롤러
 * 첫 쪽 밖의 글로 가는 링크가 사라지지 않게 **전체 목록**(종전 `buildBlogListBody`)을 `<noscript>` 로 덧붙인다
 * (JS 를 도는 브라우저는 그리지 않는다 — 밀림 0).
 *
 * ## 그리지 않는 것 · 실패
 * 아이콘(SVG)은 같은 크기의 빈 칸. PC 는 그리지 않는다(호출부가 폰 UA 에서만). 글이 없거나 시드가 깨지면 '' → 종전 본문.
 */
import {
  BLOG_LIST, BLOG_COVER, BLOG_PER_PAGE, BLOG_FEATURED, BLOG_SEARCH_PLACEHOLDER,
  blogPageNums, blogAllTags, blogCoverTopic, blogCoverBg, blogCoverInk, parseBlogTags,
} from '../../shared/blog-page'
import { buildBlogListBody } from '../../features/blog/api/blog-ssr-body'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const stripBold = (s: unknown) => String(s ?? '').replace(/\*\*/g, '')
const iconSlot = (px: number, cls = 'block shrink-0') => `<span class="${cls}" style="width:${px}px;height:${px}px" aria-hidden="true"></span>`

interface ListPost { slug?: string; title?: string; summary?: string; tags?: unknown; author?: string | null; thumbnail_url?: string | null }

function coverHtml(p: ListPost, cls: string, hero: boolean): string {
  if (p.thumbnail_url) return `<img src="${esc(p.thumbnail_url)}" alt="" class="${cls} object-cover" loading="lazy">`
  const { hue, label } = blogCoverTopic(String(p.slug), parseBlogTags(p.tags))
  return `<div class="${cls} ${BLOG_COVER.box}" style="background-color:${blogCoverBg(hue)}">${iconSlot(hero ? BLOG_COVER.heroIcon : BLOG_COVER.thumbIcon)}`
    + (hero ? `<span class="${BLOG_COVER.label}" style="color:${blogCoverInk(hue)}">유어딜 · ${esc(label)}</span>` : '') + `</div>`
}

/** `ChipRow` 와 같다 — 첫 태그(파란) + 작성자(회색, 첫 태그와 같으면 생략). */
function chipRow(p: ListPost): string {
  const tags = parseBlogTags(p.tags)
  const author = p.author || ''
  return `<div class="${BLOG_LIST.chipRow}">`
    + (tags[0] ? `<span class="${BLOG_LIST.tagChip}">${esc(tags[0])}</span>` : '')
    + (author && author !== tags[0] ? `<span class="${BLOG_LIST.authorChip}">${esc(author)}</span>` : '')
    + `</div>`
}

export function buildBlogListFirstScreen(seedJson: string | null | undefined): string {
  let posts: ListPost[]
  try {
    const raw = JSON.parse(seedJson || '') as { success?: boolean; data?: ListPost[] }
    if (!raw?.success || !Array.isArray(raw.data)) return ''
    posts = raw.data.filter(p => p && p.slug && p.title)
  } catch { return '' }
  if (!posts.length) return ''

  const featured = posts.slice(0, BLOG_FEATURED)
  const hero = featured[0]
  const heroHtml =
    `<section class="${BLOG_LIST.hero}">` +
      `<a href="/blog/${esc(hero.slug)}" class="${BLOG_LIST.heroLink}">` +
        `<div class="${BLOG_LIST.heroText}">${chipRow(hero)}<h2 class="${BLOG_LIST.heroTitle}">${esc(stripBold(hero.title))}</h2><p class="${BLOG_LIST.heroSummary}">${esc(stripBold(hero.summary))}</p></div>` +
        `<div class="${BLOG_LIST.heroCoverWrap}">${coverHtml(hero, BLOG_LIST.heroCover, true)}</div>` +
      `</a>` +
      (featured.length > 1
        ? `<div class="${BLOG_LIST.heroNav}"><button type="button" aria-label="이전" class="${BLOG_LIST.heroBtn}">${iconSlot(20)}</button><button type="button" aria-label="다음" class="${BLOG_LIST.heroBtn}">${iconSlot(20)}</button><span class="${BLOG_LIST.heroCount}">1 / ${featured.length}</span></div>`
        : '') +
    `</section>`

  const search =
    `<div class="${BLOG_LIST.searchWrap}"><div class="relative">${iconSlot(16, BLOG_LIST.searchIcon)}` +
    `<input placeholder="${esc(BLOG_SEARCH_PLACEHOLDER)}" class="${BLOG_LIST.search}"></div></div>`

  const chips = `<div class="${BLOG_LIST.chips}"><button type="button" class="${BLOG_LIST.chip} ${BLOG_LIST.chipOn}">전체</button>`
    + blogAllTags(posts).map(t => `<button type="button" class="${BLOG_LIST.chip} ${BLOG_LIST.chipOff}">${esc(t)}</button>`).join('') + `</div>`

  const page = posts.slice(0, BLOG_PER_PAGE)
  const rows = page.map(p =>
    `<a href="/blog/${esc(p.slug)}" class="${BLOG_LIST.row}"><div class="${BLOG_LIST.rowText}">${chipRow(p)}` +
    `<h4 class="${BLOG_LIST.rowTitle}">${esc(stripBold(p.title))}</h4><p class="${BLOG_LIST.rowSummary}">${esc(stripBold(p.summary))}</p></div>` +
    coverHtml(p, BLOG_LIST.rowCover, false) + `</a>`).join('')

  const totalPages = Math.max(1, Math.ceil(posts.length / BLOG_PER_PAGE))
  const pager = totalPages > 1
    ? `<div class="${BLOG_LIST.pager}"><button type="button" disabled aria-label="이전 페이지" class="${BLOG_LIST.pagerArrow}">${iconSlot(16)}</button>`
      + blogPageNums(totalPages, 1).map(n => `<button type="button" class="${BLOG_LIST.pagerNum} ${n === 1 ? BLOG_LIST.pagerOn : BLOG_LIST.pagerOff}">${n}</button>`).join('')
      + `<button type="button" aria-label="다음 페이지" class="${BLOG_LIST.pagerArrow}">${iconSlot(16)}</button></div>`
    : ''

  const bar =
    `<div class="${BLOG_LIST.bar}"><div class="${BLOG_LIST.barInner}"><a href="/blog" class="${BLOG_LIST.logo}">유어딜 블로그</a>` +
    `<div class="${BLOG_LIST.actions}"><a href="/" class="${BLOG_LIST.home}">${iconSlot(16)}<span class="${BLOG_LIST.homeText}">유어딜 홈</span></a>` +
    `<a href="/store/new" class="${BLOG_LIST.cta}">내 가게 등록</a></div></div></div>`

  const list = `<section class="${BLOG_LIST.listSection}"><h3 class="${BLOG_LIST.listTitle}">전체 아티클</h3><div class="${BLOG_LIST.rows}">${rows}</div>${pager}</section>`
  const crawl = buildBlogListBody(seedJson ?? null)
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen"><div class="${BLOG_LIST.root}">${bar}<div class="${BLOG_LIST.wrap}">${heroHtml}${search}${chips}${list}</div></div></div>`
    + (crawl ? `<noscript>${crawl}</noscript>` : '')
}
