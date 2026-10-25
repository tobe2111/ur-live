/**
 * 📝 블로그 상세 첫 화면 SSOT (2026-10-19 대표 *"지도랑 블로그도 상세히 진행해줘"*).
 *
 * ## 무엇을 고치는가 (라이브 실측 — 폰 · 느린 4G · CPU 4배)
 * `/blog/:slug` 는 서버가 본문을 **꾸밈 없는 HTML**(`<main><article><h1>…`)로 넣어 두었다(크롤러용 — 2026-07-28).
 * 그 HTML 은 앱 CSS(36KB)가 와야 그려졌고(첫 그림 2.4~3.0초), React 가 뜨면 **완전히 다른 모양**으로 바뀌었다
 * (머리글·태그·제목 크기·커버가 그때 생긴다). 즉 첫 그림이 늦고, 그 첫 그림이 곧 사라졌다.
 *
 * ## 처방
 * 화면(`BlogDetailPage`·`BlogMarkdown`·`BlogCover`)과 워커(`worker/utils/blog-detail-first-screen.ts`)가
 * **같은 클래스·같은 규칙**을 이 파일에서 import 한다. 워커는 React 와 같은 모양을 그리고, CSS 먼저 부팅으로
 * HTML 직후 그린다. 본문 전부를 같은 클래스로 그리므로 크롤러가 읽는 글자는 종전과 같다.
 *
 * ⚠️ React·아이콘을 import 하지 않는다(워커 번들). 아이콘은 워커가 같은 크기의 빈 칸으로 세운다.
 */
import { CATEGORY_PALETTE, type CategoryHue } from './category-palette'

/** 본문 마크다운 — `BlogMarkdown` 과 워커 문자열 렌더러가 같은 클래스를 쓴다. */
export const BLOG_MD = {
  tableWrap: 'overflow-x-auto my-4',
  table: 'w-full text-sm border-collapse',
  th: 'text-left px-3 py-2 bg-gray-50 dark:bg-[#1D1F29] border-b border-line font-medium text-gray-700 dark:text-gray-200',
  td: 'px-3 py-2 border-b border-gray-100 dark:border-[#2C2F35] text-gray-600 dark:text-gray-300',
  h2: 'scroll-mt-24 text-xl font-bold text-gray-900 dark:text-white mt-8 mb-3',
  h3: 'scroll-mt-24 text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2',
  ul: 'my-3 space-y-1.5',
  ol: 'my-3 space-y-1.5 list-none',
  li: 'flex items-start gap-2 text-[16.5px] text-gray-700 dark:text-gray-200 leading-[1.85]',
  bullet: 'text-brand-text mt-1 shrink-0',
  num: 'text-brand-text font-medium mt-0.5 shrink-0 tabular-nums',
  quote: 'my-4 pl-4 border-l-4 border-line text-gray-600 dark:text-gray-300 italic',
  hr: 'my-8 border-line',
  p: 'text-[16.5px] text-gray-700 dark:text-gray-200 leading-[1.85] my-3',
  img: 'block max-w-full rounded-lg my-3',
  a: 'text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80',
  strong: 'font-bold text-gray-900 dark:text-white',
} as const

/** 상세 페이지 골격 — 치수를 정하는 클래스. */
export const BLOG_DETAIL = {
  root: 'min-h-[100dvh] bg-white dark:bg-[#11141C]',
  header: 'sticky top-0 z-40 bg-white/90 dark:bg-[#11141C]/90 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]',
  headerInner: 'max-w-7xl mx-auto flex items-center justify-between px-4 lg:px-8 h-14',
  logo: 'flex items-center gap-2 text-[17px] font-bold text-gray-900 dark:text-white tracking-tight',
  logoBar: 'text-gray-300 dark:text-[#333] font-light',
  logoBlog: 'text-gray-500 dark:text-gray-400 text-[15px] font-bold',
  actions: 'flex items-center gap-1 sm:gap-2',
  iconBtn: 'p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1D1F29]',
  homeLink: 'hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-[15px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1D1F29]',
  cta: 'px-4 py-2 bg-brand text-white rounded-lg text-[15px] font-bold hover:opacity-90',
  grid: 'max-w-7xl mx-auto px-4 lg:px-8 py-8 lg:py-12 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_260px] lg:gap-8 xl:gap-10',
  article: 'min-w-0',
  tags: 'flex flex-wrap gap-2 mb-4',
  tag: 'text-[12px] bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-md font-medium',
  h1: 'text-[24px] sm:text-[34px] font-bold text-gray-900 dark:text-white leading-tight',
  summary: 'text-[15px] sm:text-[17px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed',
  meta: 'flex items-center gap-3 mt-4 pb-6 text-[15px] text-gray-400 dark:text-gray-500',
  metaRead: 'inline-flex items-center gap-1',
  cover: 'w-full aspect-[16/7] rounded-2xl mb-8',
  tocBox: 'lg:hidden mb-8 border border-line rounded-xl overflow-hidden',
  tocBtn: 'w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#141414]',
  tocLabel: 'flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-white',
  body: 'max-w-[46rem]',
} as const

/** 커버 폴백(사진이 없을 때) — 주제 → 아이콘 키·색·라벨. 위에서부터 먼저 맞는 것. 새 주제는 여기 한 줄. */
export type BlogCoverIcon = 'gift' | 'meal' | 'stay' | 'beauty' | 'store' | 'cafe' | 'leisure'
const COVER_TOPICS: Array<[RegExp, BlogCoverIcon, CategoryHue, string]> = [
  [/exchange|교환권|기프티콘/, 'gift', 'yellow', '교환권'],
  [/voucher|이용권/, 'meal', 'red', '이용권'],
  [/stay|숙소|펜션/, 'stay', 'blue', '숙소'],
  [/beauty|미용|뷰티/, 'beauty', 'pink', '뷰티'],
  [/dongne|동네딜|지역/, 'store', 'green', '동네딜'],
  [/linkshop|유어샵|쇼핑몰|business|사업자|판매/, 'store', 'teal', '유어샵'],
  [/cafe|카페|커피/, 'cafe', 'orange', '카페'],
  [/experience|체험|액티비티/, 'leisure', 'purple', '체험'],
]

export function parseBlogTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  try { const v = JSON.parse(String(raw ?? '')); return Array.isArray(v) ? v.map(String) : [] } catch { return [] }
}

export function blogCoverTopic(slug: string, tags: string[]): { icon: BlogCoverIcon; hue: CategoryHue; label: string } {
  const hay = `${slug} ${tags.join(' ')}`.toLowerCase()
  const hit = COVER_TOPICS.find(([re]) => re.test(hay))
  const [, icon, hue, label] = hit ?? [null, 'meal' as BlogCoverIcon, 'blue' as CategoryHue, '유어딜']
  return { icon, hue, label }
}

/** 커버 면 색(16진 + 알파 14) — 화면과 워커가 같은 값을 쓴다. */
export function blogCoverBg(hue: CategoryHue): string {
  return `${CATEGORY_PALETTE[hue].main}14`
}
export function blogCoverInk(hue: CategoryHue): string {
  return CATEGORY_PALETTE[hue].dark
}
/** 커버 폴백 크기 — 상세(hero) 아이콘 88 · 목록(thumb) 40. 라벨은 hero 에만. */
export const BLOG_COVER = {
  box: 'relative overflow-hidden flex items-center justify-center',
  label: 'absolute bottom-3.5 left-4 text-[12px] font-medium',
  heroIcon: 88,
  thumbIcon: 40,
} as const

/** 읽는 시간(분) — 화면과 같은 계산. */
export function blogReadMin(content: string | null | undefined): number {
  return Math.max(1, Math.round((content?.length || 0) / 500))
}

/** 본문에 목차가 생기는가 — `blogToc` 와 같은 블록 판정(`\n\n` 로 나눈 블록이 `## `/`### ` 로 시작). */
export function blogHasToc(content: string | null | undefined): boolean {
  return (content || '').split('\n\n').some(b => { const t = b.trim(); return t.startsWith('## ') || t.startsWith('### ') })
}

/** 발행일 — 화면과 같은 표기(`2026년 7월 26일`). D1 의 'YYYY-MM-DD HH:MM:SS'(UTC, Z 없음)도 UTC 로 읽는다. */
export function blogDateLabel(publishedAt: string | null | undefined): string {
  const s = publishedAt || ''
  const d = s ? new Date(s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z') : new Date()
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })
}

// ── 본문 문자열 렌더러 — `BlogMarkdown` 과 **같은 블록·인라인 규칙** ─────────────────────────────
const SAFE_HREF = /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
const stripBold = (s: string) => s.replace(/\*\*/g, '')

function inlineHtml(text: string): string {
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+?)\*\*/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  const pushText = (s: string) => { if (s) out += esc(s.replace(/\*\*/g, '')) }
  while ((m = re.exec(text)) !== null) {
    pushText(text.slice(last, m.index))
    if (m[1] !== undefined && m[2] !== undefined) {
      out += SAFE_HREF.test(m[2]) ? `<img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy" class="${BLOG_MD.img}">` : esc(m[1])
    } else if (m[3] !== undefined && m[4] !== undefined) {
      if (SAFE_HREF.test(m[4])) {
        const ext = /^https?:/i.test(m[4])
        out += `<a href="${esc(m[4])}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''} class="${BLOG_MD.a}">${esc(m[3])}</a>`
      } else out += esc(m[3])
    } else if (m[5] !== undefined) {
      out += `<strong class="${BLOG_MD.strong}">${esc(m[5])}</strong>`
    }
    last = re.lastIndex
  }
  pushText(text.slice(last))
  return out
}

/** `BlogMarkdown` 의 HTML 판 — 같은 블록 분할(`\n\n`)·같은 클래스·같은 헤딩 id(`sec-{n}`). 모든 원문은 탈출한다. */
export function blogMarkdownHtml(content: string | null | undefined): string {
  let hIdx = 0
  return (content || '').split('\n\n').map(block => {
    const t = block.trim()
    if (!t) return ''
    if (t.includes('|') && t.includes('---')) {
      const lines = t.split('\n').filter(l => l.trim() && !l.trim().match(/^\|[-\s|]+\|$/))
      if (lines.length >= 2) {
        const headers = lines[0].split('|').filter(Boolean).map(h => h.trim())
        const rows = lines.slice(1).map(l => l.split('|').filter(Boolean).map(c => c.trim()))
        return `<div class="${BLOG_MD.tableWrap}"><table class="${BLOG_MD.table}"><thead><tr>${headers.map(h => `<th class="${BLOG_MD.th}">${inlineHtml(h)}</th>`).join('')}</tr></thead>`
          + `<tbody>${rows.map(r => `<tr>${r.map(c => `<td class="${BLOG_MD.td}">${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      }
    }
    if (t.startsWith('## ')) return `<h2 id="sec-${hIdx++}" class="${BLOG_MD.h2}">${esc(stripBold(t.slice(3)))}</h2>`
    if (t.startsWith('### ')) return `<h3 id="sec-${hIdx++}" class="${BLOG_MD.h3}">${esc(stripBold(t.slice(4)))}</h3>`
    if (t.startsWith('- ')) {
      const items = t.split('\n').filter(l => l.trim().startsWith('- '))
      return `<ul class="${BLOG_MD.ul}">${items.map(it => `<li class="${BLOG_MD.li}"><span class="${BLOG_MD.bullet}">•</span><span>${inlineHtml(it.trim().slice(2))}</span></li>`).join('')}</ul>`
    }
    if (/^\d+\.\s/.test(t)) {
      const items = t.split('\n').filter(l => /^\d+\.\s/.test(l.trim()))
      return `<ol class="${BLOG_MD.ol}">${items.map((it, j) => {
        const mm = it.trim().match(/^(\d+)\.\s+(.*)$/)
        return `<li class="${BLOG_MD.li}"><span class="${BLOG_MD.num}">${esc(mm?.[1] ?? String(j + 1))}.</span><span>${inlineHtml(mm?.[2] ?? it)}</span></li>`
      }).join('')}</ol>`
    }
    if (t.startsWith('> ')) {
      const body = t.split('\n').map(l => l.replace(/^>\s?/, '')).join(' ')
      return `<blockquote class="${BLOG_MD.quote}">${inlineHtml(body)}</blockquote>`
    }
    if (t === '---') return `<hr class="${BLOG_MD.hr}">`
    return `<p class="${BLOG_MD.p}">${inlineHtml(t)}</p>`
  }).join('')
}

// ── 블로그 목록(`/blog`) — 화면(`BlogListPage`)과 워커(`worker/utils/blog-list-first-screen.ts`)가 같은 상수 ───────
export const BLOG_LIST = {
  root: 'min-h-[100dvh] bg-white dark:bg-[#11141C]',
  bar: 'bg-white dark:bg-[#11141C] border-b border-gray-100 dark:border-[#2C2F35]',
  barInner: 'max-w-6xl mx-auto flex items-center justify-between px-5 lg:px-8 h-14',
  logo: 'text-[17px] font-bold text-gray-900 dark:text-white tracking-tight',
  actions: 'flex items-center gap-2 sm:gap-2',
  home: 'flex items-center gap-2 px-3 py-2 rounded-lg text-[15px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1D1F29]',
  homeText: 'hidden sm:inline',
  cta: 'px-4 py-2 bg-brand text-white rounded-lg text-[15px] font-bold hover:opacity-90',
  wrap: 'max-w-6xl mx-auto px-5 lg:px-8',
  hero: 'pt-6 pb-8',
  heroLink: 'group grid lg:grid-cols-2 gap-5 lg:gap-8 items-center',
  heroText: 'order-2 lg:order-1',
  heroTitle: 'mt-3 text-[24px] sm:text-[28px] leading-snug font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2',
  heroSummary: 'mt-2 text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2',
  heroCoverWrap: 'order-1 lg:order-2',
  heroCover: 'w-full aspect-[16/9] rounded-2xl',
  heroNav: 'flex items-center gap-2 mt-6',
  heroBtn: 'w-10 h-10 rounded-full border border-line flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1D1F29]',
  heroCount: 'ml-2 text-[12px] text-gray-400 dark:text-gray-500 tabular-nums',
  searchWrap: 'pt-6 pb-1',
  searchIcon: 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none',
  search: 'w-full h-11 pl-10 pr-10 rounded-xl bg-gray-50 dark:bg-[#1D1F29] border border-line text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-300 dark:focus:border-[#3A3A3A]',
  chips: 'flex gap-2 overflow-x-auto scrollbar-hide py-4',
  chip: 'px-4 py-2 rounded-full text-[15px] font-medium shrink-0',
  chipOn: 'bg-brand text-white',
  chipOff: 'bg-gray-50 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2C2F35]',
  listSection: 'py-8',
  listTitle: 'text-[24px] font-bold text-gray-900 dark:text-white mb-2',
  rows: 'divide-y divide-gray-100 dark:divide-[#2C2F35]',
  row: 'group flex items-start justify-between gap-5 sm:gap-8 py-6',
  rowText: 'flex-1 min-w-0',
  rowTitle: 'mt-2 text-[17px] sm:text-[17px] font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors',
  rowSummary: 'mt-2 text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2',
  rowCover: 'w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0',
  chipRow: 'flex flex-wrap items-center gap-2',
  tagChip: 'text-[12px] font-medium bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-md',
  authorChip: 'text-[12px] font-medium bg-gray-100 dark:bg-[#1D1F29] text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md',
  pager: 'flex items-center justify-center gap-2 mt-10',
  pagerArrow: 'w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1D1F29] disabled:opacity-30 disabled:hover:bg-transparent',
  pagerNum: 'min-w-9 h-9 px-2 rounded-lg text-[15px] font-medium tabular-nums',
  pagerOn: 'bg-brand text-white',
  pagerOff: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1D1F29]',
} as const

/** 목록 규칙 — 한 쪽 7편 · 히어로 = 최신 5편 · 검색창 안내 · 쪽 번호 창(최대 7). */
export const BLOG_PER_PAGE = 7
export const BLOG_FEATURED = 5
export const BLOG_SEARCH_PLACEHOLDER = '블로그 검색 (이용권, 유어샵, 정산…)'
export function blogPageNums(totalPages: number, curPage: number): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  let s = Math.max(1, curPage - 3)
  const e = Math.min(totalPages, s + 6)
  s = Math.max(1, e - 6)
  return Array.from({ length: e - s + 1 }, (_, i) => s + i)
}
/** 전체 태그 — 글 순서대로 처음 나온 순(화면의 `new Set(flatMap)` 과 같다). */
export function blogAllTags(posts: Array<{ tags?: unknown }>): string[] {
  return [...new Set(posts.flatMap(p => parseBlogTags(p.tags)))]
}
