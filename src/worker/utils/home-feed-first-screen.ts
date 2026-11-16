/**
 * 🏠 2026-11-16 대표 *"해줘. 계속 개선해줘"* — 폰 홈 첫 화면의 **유어쇼츠 줄 + 전체 목록 첫 6장**도 서버가 그린다.
 *   (`home-first-screen.ts` 가 첫 섹션 · 띠 배너 · 둘째 섹션을 그리고, 이 파일이 그 아래를 잇는다.)
 *
 * 왜: 그 아래는 앱이 켜진 뒤(폰 4G·CPU 4배 1.8~2.2s)에야 생겼고, 사진은 그때 같이 출발하는 요청 수십 개와 회선을 나눠
 *   목록이 생긴 뒤에도 1~1.5s 를 더 기다렸다. 재료(MAIN · SECTIONS · HOMESHORTS · HOMEBANNERS 시드)는 이미 같은 HTML 에 있다.
 *
 * 화면과 **같은 결과**를 낼 수 있을 때만 그린다 — 하나라도 모르면 빈 문자열(종전 그대로 앱이 그린다):
 *   ① 위치 쿠키가 없다 — 있으면 목록이 거리순(`MAINNEAR` 시드)이고 순서를 서버가 다시 만들 수 없다.
 *      ⚠️ 위치는 폰 저장소(localStorage)에도 있다. 쿠키(30일)가 먼저 만료되면 서버는 인기순을 그리고 앱이 거리순으로 바꾼다 —
 *      줄 높이가 같아 밀리지 않고 글자만 바뀐다(드물다: 30일 안 온 사람만).
 *   ② 편성 섹션이 **정확히 둘** — 셋째부터는 유어쇼츠 **뒤**에 온다(`HomeSections shortsAfter`).
 *   ③ 유어쇼츠 시드가 있다(없으면 그 칸 높이를 모른다) · ④ `wide` 배너가 없다(편성 아래·목록 위에 그린다).
 * 목록 순서 = `GroupBuyFeed`(category all · sort popular · 위치 없음): 시드 → 메인 노출만 → 판매 수 내림차순(안정 정렬)
 *   → 위 편성 섹션 상품은 뒤로(`deferSeeded`) → id 중복 제거 → 처음 6장(`useProgressiveCap` 첫 렌더 수).
 */
import { DEAL_ROW, feedSoldOf } from '../../shared/deal-card-grid'
import { isHomeVisibleProduct } from '../../shared/deal-cats'
import { bannersOfSlot } from '../../shared/home-strip-banners'
import { URSHORTS_CARD_W, URSHORTS_CARD_H, type UrShortItem } from '../../shared/urshorts'
import { shortDisplayTitle } from '../../shared/urshorts-display'
import { priceDisplay } from '../../shared/price-display'
import { formatNumber } from '../../utils/format'
import { nearKeyFromCookieHeader } from '../../shared/home-near'

/** 화면 첫 렌더가 그리는 목록 장수 — `GroupBuyFeed` `useProgressiveCap(firstScreen ? 12 : 6)` 의 홈 값(firstScreen=false). */
export const HOME_FEED_FS_CARDS = 6

/** 화면(`UrShortsRail` · `GroupBuyFeed` · `MobileHomePage`) 클래스 — 글자 그대로 미러한다(시험이 소스와 대조). */
export const HOME_FEED_FS_CLASS = {
  shortsPanel: 'ur-home-panel ur-panel-ink',
  shortsHead: 'mb-3 flex items-end justify-between gap-3',
  shortsTitle: 'text-[16px] font-semibold tracking-tight text-white',
  shortsTitleSub: 'ml-2 text-[12px] font-normal text-white/60',
  shortsAll: 'shrink-0 whitespace-nowrap text-[12px] font-medium text-white/75 underline-offset-4 hover:underline',
  shortsRail: 'scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto',
  shortsCard: 'shrink-0 snap-start text-left',
  shortsMedia: 'relative block overflow-hidden rounded-[10px] bg-media-slot',
  shortsPlay: 'absolute left-2 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-black/50 text-white',
  shortsDur: 'absolute right-1.5 top-1.5 rounded bg-black/60 px-1 py-px text-[12px] font-medium tabular-nums text-white',
  shortsScrim: 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-[7px] pb-[7px] pt-[18px] text-white',
  shortsStore: 'block truncate text-[12px] opacity-90',
  shortsProduct: 'mt-px block truncate text-[12px] font-medium leading-tight',
  shortsOriginal: 'mt-1 block text-[12px] tabular-nums line-through opacity-70',
  shortsPrice: 'mt-px block text-[12px] font-medium tabular-nums',
  shortsMore: 'grid shrink-0 snap-start place-items-center gap-2 rounded-[10px] border border-dashed border-white/20 text-center text-brand-text',
  shortsMoreLabel: 'mt-1 block text-[12px] font-medium',
  shortsMoreCount: 'mt-[2px] block text-[12px] font-normal text-white/55',
  feedSection: 'mt-5',
  feedAnchor: 'scroll-mt-24',
  feedHead: 'flex items-center justify-between px-4 py-2 text-[12px] text-gray-500 dark:text-gray-400',
  sortWrap: 'relative shrink-0',
  sortBtn: 'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-[12px] font-medium text-gray-900 dark:text-white active:scale-[0.98] transition-transform',
  feedGrid: `${DEAL_ROW.grid} px-4 pb-8 ur-cv-grid ur-cv-feedrow`,
} as const
const C = HOME_FEED_FS_CLASS

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type FeedRow = { id?: number | string | null; sold_count?: number | null; group_buy_current?: number | null; category?: string | null; name?: string | null }

/** `GroupBuyFeed` 의 홈 기본 순서(위 머리말). 시드가 깨졌으면 null. */
export function homeFeedOrder<T extends FeedRow>(mainSeedJson: string | null, sectionIds: ReadonlySet<number>): T[] | null {
  if (!mainSeedJson) return null
  let rows: T[]
  try {
    const d = JSON.parse(mainSeedJson) as { data?: T[] }
    if (!Array.isArray(d?.data)) return null
    rows = d.data
  } catch { return null }
  const sorted = rows.filter((p) => p && isHomeVisibleProduct(p as never)).sort((a, b) => feedSoldOf(b as never) - feedSoldOf(a as never))
  const head: T[] = [], tail: T[] = []
  for (const p of sorted) (typeof p.id === 'number' && sectionIds.has(p.id) ? tail : head).push(p)
  const seen = new Set<number | string>()
  return head.concat(tail).filter((p) => p.id != null && !seen.has(p.id) && (seen.add(p.id), true))
}

function shortsCardHtml(item: UrShortItem): string {
  const pd = priceDisplay(item)
  const dur = Number(item.duration_sec) || 0
  const durLabel = dur > 0 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : null
  const hasInfo = !!(item.store_name || item.product_name || pd.price > 0)
  const info = hasInfo ? `<span class="${C.shortsScrim}">` +
    (item.store_name ? `<span class="${C.shortsStore}">${esc(item.store_name)}</span>` : '') +
    (item.product_name ? `<span class="${C.shortsProduct}">${esc(item.product_name)}</span>` : '') +
    (pd.showOriginal ? `<span class="${C.shortsOriginal}">${formatNumber(pd.originalPrice)}원</span>` : '') +
    (pd.price > 0 ? `<span class="${C.shortsPrice}">${pd.discount > 0 ? `<b class="text-sale-on-media">${pd.discount}% </b>` : ''}${formatNumber(pd.price)}원</span>` : '') +
    '</span>' : ''
  // 사진은 그리지 않는다 — 화면도 레일이 화면 근처에 오기 전엔 안 받는다(`load={near}`). 아이콘은 같은 칸만.
  return `<button type="button" class="${C.shortsCard}" style="width:${URSHORTS_CARD_W}px" aria-label="${esc(`${item.store_name || ''} ${shortDisplayTitle(item) || '유어쇼츠 영상'}`)}">` +
    `<span class="${C.shortsMedia}" style="height:${URSHORTS_CARD_H}px"><span class="${C.shortsPlay}"></span>` +
    (durLabel ? `<span class="${C.shortsDur}">${durLabel}</span>` : '') + info + '</span></button>'
}

/** 유어쇼츠 줄 — 시드가 0편이면 ''(화면도 빈 관측 div 하나 · 높이 0). 시드가 없으면 null(높이를 모른다). */
export function homeShortsPanelHtml(shortsSeedJson: string | null): string | null {
  if (!shortsSeedJson) return null
  let items: UrShortItem[]
  try {
    const d = JSON.parse(shortsSeedJson) as { success?: boolean; data?: UrShortItem[] }
    if (!d?.success || !Array.isArray(d.data)) return null
    items = d.data
  } catch { return null }
  if (items.length === 0) return ''
  return `<section class="${C.shortsPanel}"><div class="${C.shortsHead}"><h3 class="${C.shortsTitle}">유어쇼츠<span class="${C.shortsTitleSub}">눌러서 보고 바로 구매</span></h3>` +
    `<a href="/urshorts" class="${C.shortsAll}">전체 보기</a></div>` +
    `<div class="group relative"><div class="${C.shortsRail}">${items.map(shortsCardHtml).join('')}` +
    `<a href="/urshorts" class="${C.shortsMore}" style="width:${URSHORTS_CARD_W}px;height:${URSHORTS_CARD_H}px"><span><span class="mx-auto block h-6 w-6"></span>` +
    `<span class="${C.shortsMoreLabel}">전체 보기</span><span class="${C.shortsMoreCount}">${items.length}편</span></span></a></div></div></section>`
}

/**
 * 유어쇼츠 줄(편성 칸 안) + 목록 칸(편성 칸 밖)을 돌려준다. 그릴 수 없으면 null — 호출부가 종전 그대로 둔다.
 * @param cardHtml 홈 첫 화면 카드 함수(같은 모양 — 순환 import 를 피하려고 받는다)
 */
export function homeFeedFirstScreen(opts: {
  visibleSectionCount: number
  sectionIds: ReadonlySet<number>
  mainSeedJson: string | null
  shortsSeedJson: string | null
  bannersPayload: string | null
  cookieHeader: string | null
  cardHtml: (p: never, eager: boolean, href?: string, row?: boolean) => string
}): { shorts: string; feed: string } | null {
  if (opts.visibleSectionCount !== 2) return null
  if (nearKeyFromCookieHeader(opts.cookieHeader)) return null
  if (!opts.bannersPayload) return null
  try { if (bannersOfSlot(JSON.parse(opts.bannersPayload), 'wide').length > 0) return null } catch { return null }
  const shorts = homeShortsPanelHtml(opts.shortsSeedJson)
  if (shorts == null) return null
  const list = homeFeedOrder(opts.mainSeedJson, opts.sectionIds)
  if (!list || list.length === 0) return null
  const cards = list.slice(0, HOME_FEED_FS_CARDS).map((p) => opts.cardHtml(p as never, false, undefined, true)).join('')
  const head = `<div class="${C.feedHead}"><span>딜 ${list.length}개</span><div class="${C.sortWrap}"><button type="button" class="${C.sortBtn}">` +
    `<span class="w-3.5 h-3.5 inline-block" aria-hidden="true"></span>인기순<span class="w-3.5 h-3.5 inline-block" aria-hidden="true"></span></button></div></div>`
  return { shorts, feed: `<section class="${C.feedSection}"><div class="${C.feedAnchor}"></div>${head}<div class="${C.feedGrid}">${cards}</div></section>` }
}
