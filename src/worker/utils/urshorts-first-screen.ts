/**
 * 🎬 유어쇼츠 목록(`/urshorts`)의 **서버가 그리는 첫 화면** (2026-11-09 대표 *"계속 최적화"* — 라이브 실측 첫 글자 **2.0초**,
 * 다른 화면은 0.5초대. 시드(#2249)로 목록은 1.3초에 왔지만 `#root` 는 앱이 켜질 때까지 로더뿐이었다).
 *
 * 그리는 것: [머리(뒤로 칸 · 제목 · 편수) + 설명 한 줄 + 칩 줄(도시·종류, **같은 함수** `facets.ts` 로 센다) + 2열 카드 격자].
 * 카드는 `pages/urshorts/BrowseCard.tsx` 의 마크업을 **글자 하나까지** 옮긴다 — 시험이 진짜 컴포넌트를 렌더해 대조한다.
 * 안 그리는 것: 아이콘(뒤로 화살표·재생 삼각형)은 같은 크기의 빈 칸만. 등장 애니메이션(`ur-vc-in`)은 서버 화면엔 없다 —
 * 화면도 시드로 첫 렌더한 카드엔 애니메이션을 안 건다(이미 보이던 것이 다시 커지면 깜빡임).
 * 폰만(호출부가 UA 로 가른다) — PC 는 열 수가 달라도 같은 클래스(sm:/lg:)라 그려도 되지만, 홈과 같은 규율로 좁게 시작한다.
 */
import { cfImage } from '../../utils/cf-image'
import { formatNumber } from '../../utils/format'
import { priceDisplay } from '../../shared/price-display'
import { shortsRegionLabel } from '../../shared/urshorts-regions'
import { shortDisplayTitle } from '../../shared/urshorts-display'
import { URSHORTS_VIEWER_PATH, type UrShortItem } from '../../shared/urshorts'
import { cityFacets, categoryFacets, MIN_FACETS_TO_SHOW, type Facet } from '../../pages/urshorts/facets'
import { escAttr, escText } from './home-first-screen'
import { URSHORTS_FIRST_CARDS } from '../../shared/urshorts-list-cache'

/** PC 액자 — `guest-first-screen.ts` 의 `GUEST_PC_FRAME` 과 같은 값(시험이 대조). import 하지 않는 이유: 표면별 CSS 생성기가 import 를 따라가 손님 탭 클래스까지 끌려온다. */
export const PC_FRAME = { cls: 'mobile-app-container app-framed', width: '430px' } as const

/** `BrowseCard` 와 같은 썸네일 폭(`urshorts-seed.ts` 의 preload 도 같은 값). */
export const URSHORTS_FS_THUMB_WIDTH = 360
export const URSHORTS_FS_EAGER = 4
/**
 * 서버가 그리는 카드 수 — 2026-11-13 시드가 전량(`?all=1`, 최대 60편)이 됐다. 편수·칩은 **전량으로** 세고(앱과 같은 값 — 안 그러면
 * 앱이 칩 줄을 하나 더 꽂아 격자가 52px 밀렸다: 라이브 CLS 0.15) 카드는 위에서 이만큼만 그린다. 나머지는 앱이 **아래에** 붙이므로
 * 밀림이 아니다(폰 첫 화면엔 카드 2~4장이 보인다). HTML 을 60장으로 불리지 않으려는 상한이다.
 */
export const URSHORTS_FS_CARDS = URSHORTS_FIRST_CARDS // 화면 첫 렌더와 같은 값(shared/urshorts-list-cache.ts)

export const URSHORTS_FS_CLASS = {
  page: 'min-h-[100dvh] bg-[var(--bg)]',
  header: 'sticky top-0 z-10 flex items-center gap-1 bg-[var(--bg)]/95 px-2 py-2 backdrop-blur',
  back: 'grid h-9 w-9 place-items-center rounded-full text-gray-700 dark:text-gray-200',
  h1: 'text-[16px] font-semibold tracking-tight text-gray-900 dark:text-white',
  dot: '-ml-[3px] text-brand-text',
  count: 'ml-2 text-[12px] font-medium text-gray-500 dark:text-gray-400',
  desc: 'px-3 pb-2 text-[13px] text-gray-500 dark:text-gray-400',
  body: 'px-3 pb-10',
  chipRow: '-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 py-1 scrollbar-hide',
  chip: 'shrink-0 inline-flex items-center gap-1 h-9 px-4 rounded-full text-[13px] font-medium transition-colors',
  chipOn: 'bg-brand text-white',
  chipOff: 'bg-surface text-gray-800 dark:text-gray-100 shadow-lift',
  countOn: 'tabular-nums text-[12px] font-medium text-white/75',
  countOff: 'tabular-nums text-[12px] font-medium text-gray-400 dark:text-gray-500',
  grid: 'grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  link: 'group block text-left',
  media: 'relative block aspect-[9/16] overflow-hidden rounded-[10px] bg-media-slot',
  img: 'h-full w-full object-cover',
  play: 'absolute left-2 top-2 grid h-[24px] w-[24px] place-items-center rounded-full bg-black/50 text-white',
  dur: 'absolute right-1.5 top-1.5 rounded bg-black/60 px-1 py-px text-[12px] font-medium tabular-nums text-white',
  scrim: 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2 pb-2 pt-5 text-white',
  store: 'block truncate text-[12px] opacity-90',
  product: 'mt-px block truncate text-[12px] font-medium leading-tight',
  original: 'mt-1 block text-[12px] tabular-nums line-through opacity-70',
  price: 'mt-px block text-[12px] font-medium tabular-nums',
  sale: 'text-sale-on-media',
  title: 'mt-2 block line-clamp-2 text-[12px] font-medium leading-snug text-gray-900 dark:text-gray-100',
  meta: 'mt-1 block truncate text-[12px] text-gray-500 dark:text-gray-400',
} as const
const C = URSHORTS_FS_CLASS
export const URSHORTS_FS_DESC = '영상으로 먼저 보고 바로 사는 동네 이용권. 도시·종류로 골라 보세요.'

export function urshortsItemsOf(ssrPayload: string | null | undefined): UrShortItem[] {
  try {
    if (!ssrPayload) return []
    const p = JSON.parse(ssrPayload) as { success?: boolean; data?: UrShortItem[] }
    return p?.success && Array.isArray(p.data) ? p.data.filter((it) => it && it.video_id) : []
  } catch { return [] }
}

function chipRowHtml(label: string, facets: Facet[], total: number): string {
  if (facets.length < MIN_FACETS_TO_SHOW) return ''
  const chip = (text: string, n: number, on: boolean) =>
    `<button type="button" aria-pressed="${on}" class="${C.chip} ${on ? C.chipOn : C.chipOff}">${escText(text)} <span class="${on ? C.countOn : C.countOff}">${n}</span></button>`
  return `<div class="${C.chipRow}" aria-label="${escAttr(label)}">${chip('전체', total, true)}${facets.map((f) => chip(f.label, f.count, false)).join('')}</div>`
}

export function urshortsCardHtml(item: UrShortItem, eager: boolean): string {
  const thumb = item.thumb_url || item.product_image || ''
  const pd = priceDisplay(item)
  const dur = Number(item.duration_sec) || 0
  const durLabel = dur > 0 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : null
  const hasInfo = !!(item.store_name || item.product_name || pd.price > 0)
  const place = item.region_area || shortsRegionLabel(item.region_si)
  const title = shortDisplayTitle(item)
  const img = thumb ? `<img src="${escAttr(cfImage(thumb, { width: URSHORTS_FS_THUMB_WIDTH }))}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async" class="${C.img}">` : ''
  const info = hasInfo ? `<span class="${C.scrim}">` +
    (item.store_name ? `<span class="${C.store}">${escText(item.store_name)}</span>` : '') +
    (item.product_name ? `<span class="${C.product}">${escText(item.product_name)}</span>` : '') +
    (pd.showOriginal ? `<span class="${C.original}">${formatNumber(pd.originalPrice)}원</span>` : '') +
    (pd.price > 0 ? `<span class="${C.price}">${pd.discount > 0 ? `<b class="${C.sale}">${pd.discount}% </b>` : ''}${formatNumber(pd.price)}원</span>` : '') +
    '</span>' : ''
  const meta = [item.channel, place].filter(Boolean).join(' · ')
  return `<a href="${escAttr(`${URSHORTS_VIEWER_PATH}?v=${item.video_id}`)}" class="${C.link}" aria-label="${escAttr(`${item.store_name || ''} ${title || '유어쇼츠 영상'}`)}">` +
    `<span class="${C.media}">${img}<span class="${C.play}" aria-hidden="true"></span>${durLabel ? `<span class="${C.dur}">${durLabel}</span>` : ''}${info}</span>` +
    (title ? `<span class="${C.title}">${escText(title)}</span>` : '') +
    (meta ? `<span class="${C.meta}">${escText(meta)}</span>` : '') +
    '</a>'
}

/** `#root` 첫 화면 HTML. 영상이 0편이면 ''(호출부가 로더로 폴백 — 무회귀). */
/** @param isMobile 폰·크롤러면 화면 그대로. 🖥️ 2026-11-13 PC 면 430 액자(`PC_FRAME`) — PC 유어쇼츠는 액자 화면이고 위 네비가 없다(라이브 실측). */
export function buildUrShortsFirstScreen(ssrPayload: string | null | undefined, loaderHtml: string, isMobile = true): string {
  const items = urshortsItemsOf(ssrPayload)
  if (items.length === 0) return ''
  const header = `<header class="${C.header}"><span class="${C.back}" aria-hidden="true"></span><h1 class="${C.h1}">유어쇼츠<span aria-hidden="true" class="${C.dot}">.</span></h1><span class="${C.count}">${items.length}편</span></header>`
  const body = `<div class="${C.body}">${chipRowHtml('도시', cityFacets(items), items.length)}${chipRowHtml('종류', categoryFacets(items), items.length)}` +
    `<ul class="${C.grid}">${items.slice(0, URSHORTS_FS_CARDS).map((it, i) => `<li>${urshortsCardHtml(it, i < URSHORTS_FS_EAGER)}</li>`).join('')}</ul></div>`
  const page = `<div class="${C.page}">${header}<p class="${C.desc}">${escText(URSHORTS_FS_DESC)}</p>${body}</div>`
  const framed = isMobile ? page : `<div class="${PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${PC_FRAME.width}">${page}</div>`
  return `<div id="ur-first-screen">${framed}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
