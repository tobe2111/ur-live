/**
 * 🎟️ 교환권 목록(`/vouchers`) 첫 화면을 서버가 그린다 — 2026-10-14 (대표 "모두 순서대로 진행").
 *
 * 왜: 실사용자 vitals 에서 교환권의 LCP 요소가 **상품이 아니라 로딩 마스코트 그림**이었다(재생 실측
 *   FCP 0.94s → LCP 2.58s). 시드(`__SSR_INITIAL_VOUCHERS__`, 20건 · 사진 URL 포함)는 HTML 에 이미 와 있는데
 *   `#root` 를 로더가 덮고 있었다. 홈·상세·유어샵과 같은 처방이다.
 *
 * 그리는 것: [머리 배너 자리 + 딜 안내 바(배너에 걸침) + 카테고리 칩 줄 높이 + 브랜드 로고 줄 높이 + '커피/음료 교환권' 줄 + 타일 두 줄(3열)].
 *   🎟️ 2026-10-14 대표 B안 — 목록이 한 줄 행에서 **3열 타일**(`VoucherTile`)로 바뀌었다.
 *
 * 🎟️ 2026-10-14 대표 확정 안 C — 맨 위는 제목 줄이 아니라 **배너**다. 배너는 마운트 뒤 `/api/banners` 로
 *   오므로 서버는 그 자리를 같은 높이의 어두운 판으로만 세운다(화면도 응답 전까지 같은 판을 그린다).
 *   검색·보관함 아이콘은 그 판 위에 떠 있어(absolute) 높이를 안 만든다 — 그리지 않는다.
 *
 * 🔴 첫 화면은 **비로그인 화면**이다. 잔액 자리가 로그인 여부로 높이가 다르고(한 줄 바 ↔ 카드),
 *   그 판단은 브라우저 `localStorage.user_id`(`getUserIdSync`)로 한다 — 서버는 모른다.
 *   그래서 노드 바로 뒤의 인라인 스크립트가 **로그인 흔적이 있으면 이 노드를 걷어낸다**(그러면 종전 로더).
 *   넓은 화면(1024px+)은 격자 모드라 같은 이유로 걷어낸다. 걷어내는 쪽이 늘 안전하다 — 잘못 남기면 밀린다.
 *
 * 🐢 사진은 **`fetchpriority="low"`** 다(화면의 `VoucherTile` 은 앞 6장이 high) — 의도적 차이.
 *   재생 실측(느린 4G·CPU 4배, 5회 중앙값): high 면 사진 4장이 CSS·JS 와 회선을 나눠 FCP 0.88→1.45s ·
 *   조작 가능 2.93→3.52s 로 **늦어졌다**. low 면 LCP 2.50→**1.17s** · FCP 1.10s · 조작 가능 3.19s.
 *   사진을 아예 빼면 LCP 가 사진(React 이후)이 되어 3.41s — 그래서 사진은 싣되 순서를 양보한다.
 *   React 는 마운트 때 새 노드를 만들므로 이 속성이 화면 쪽 동작을 바꾸지 않는다.
 *
 * 🔴 아이콘(lucide·유어딜 세트)은 그리지 않는다 — path 를 문자열로 옮기면 두 벌이 갈린다.
 *   아이콘이 차지하는 **가로 자리**만 같은 치수의 빈 span 으로 세운다(세로 높이는 글자 줄이 정한다).
 *
 * 출처(클래스는 글자 하나까지 같아야 한다 — 시험이 소스를 읽어 대조한다):
 *   `pages/VouchersPage.tsx`(페이지 · 칩 줄 그룹 · 정렬 줄 · 목록) · `pages/vouchers/VouchersHero.tsx`(배너 판 · 걸침)
 *   `pages/vouchers/DealBalanceCard.tsx`(비로그인 바) · `pages/vouchers/TopChromeReserve.tsx`(칩 줄)
 *   `components/ui/sort-menu.tsx` · `shared/voucher-tile.ts`(타일 클래스 SSOT) · `pages/vouchers/shared.tsx`(VoucherTile)
 */
import { cfImage, cfSrcSet } from '../../utils/cf-image'
import { priceDisplay } from '../../shared/price-display'
import { formatNumber } from '../../utils/format'
import { cardImageAlt } from '../../utils/deal-title'
import { VOUCHERS_DEFAULT_CATEGORY } from '../../shared/seo/voucher-facet'
import { VOUCHERS_TOP_ROW } from '../../shared/vouchers-top-row'
import {
  VOUCHER_TILE_CLASS, VOUCHER_CAT_TAB, VOUCHER_TILE_ABOVE_FOLD, VOUCHER_TILE_IMG_W, VOUCHER_TILE_SIZES, voucherSoldLabel,
} from '../../shared/voucher-tile'

/** 서버가 그리는 타일 수 — 폰 한 화면(844px)에 보이는 두 줄(3 × 2). 나머지는 마운트 뒤 React 가 그린다. */
export const VOUCHERS_FS_ROWS = 6
/** `VoucherTile` 의 `aboveFold`(idx < VOUCHER_TILE_ABOVE_FOLD) 와 같은 값 — eager/lazy·불투명도가 갈린다. */
const ABOVE_FOLD = VOUCHER_TILE_ABOVE_FOLD
/** `VouchersPage` 의 PAGE_SIZE — 개수 표시(`20+`)가 시드 길이로 정해진다. */
const PAGE_SIZE = 20

export const VOUCHERS_FS_CLASS = {
  page: 'bg-warm dark:bg-[#11141C] pb-safe-nav md:pb-20 min-h-[100dvh]',
  /** 🎟️ 2026-11-01 A안 — 머리 한 줄. 클래스는 React 와 **같은 상수**(`shared/vouchers-top-row`). */
  topRow: VOUCHERS_TOP_ROW.row,
  topRule: VOUCHERS_TOP_ROW.rule,
  topGuest: VOUCHERS_TOP_ROW.guest,
  topActions: VOUCHERS_TOP_ROW.actions,
  topIcBtn: VOUCHERS_TOP_ROW.icbtn,
  reveal: 'sticky top-0 z-20 bg-warm pt-1',
  chipWrap: VOUCHER_CAT_TAB.wrap,
  chipRow: `${VOUCHER_CAT_TAB.row} invisible`,
  chip: `${VOUCHER_CAT_TAB.tab} ${VOUCHER_CAT_TAB.on}`,
  brandWrap: 'ur-content-wide px-5 lg:px-8 pt-2 pb-3 invisible',
  brandRow: 'flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1',
  brandItem: 'flex flex-col items-center gap-1 shrink-0',
  brandTile: 'w-12 h-12 rounded-2xl block',
  brandLabel: 'text-[12px] max-w-[56px]',
  sortBar: 'ur-content-wide px-5 lg:px-8 pt-5 pb-3 flex items-center justify-between gap-2',
  sortTitle: 'text-[17px] font-bold text-gray-900 dark:text-white flex items-baseline gap-2 min-w-0',
  sortCount: 'text-[15px] text-gray-500 dark:text-gray-400 shrink-0',
  sortBtn: 'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-[12px] font-medium text-gray-900 dark:text-white active:scale-[0.98] transition-transform',
  listWrap: 'ur-content-wide px-5 lg:px-8 pt-1 pb-6',
  /** 🎟️ 2026-10-14 B안 — 목록은 3열 타일. 타일 안 클래스는 `VOUCHER_TILE_CLASS`(React 와 같은 상수). */
  list: VOUCHER_TILE_CLASS.grid,
} as const

interface VoucherSeedRow {
  id?: number | string
  name?: string
  brand_name?: string | null
  image_url?: string | null
  price?: number | string | null
  original_price?: number | string | null
  discount_rate?: number | string | null
  sold_count?: number | string | null
  dominant_color?: string | null
}

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

/** 타일의 구매수 표기와 같은 규칙(SSOT 재수출 — 시험이 이 이름으로 부른다). */
export const soldLabelOf = voucherSoldLabel

/** `dominant_color` 는 `#rrggbb` 만 받는다(스타일 속성에 그대로 들어가므로). */
function safeColor(c: unknown): string | null {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null
}

/** 진짜 `VoucherTile`(pages/vouchers/shared.tsx)과 같은 모양 — 시험이 둘을 렌더해 대조한다. */
function tileHtml(p: VoucherSeedRow, idx: number): string {
  const T = VOUCHER_TILE_CLASS
  const price = Number(p.price) || 0
  const orig = p.original_price != null ? Number(p.original_price) || 0 : 0
  const pd = priceDisplay({ price, original_price: orig || null, discount_rate: Number(p.discount_rate) || 0 })  // 화면은 priceDisplay(p) — 같은 입력
  const sold = Number(p.sold_count || 0)
  const above = idx < ABOVE_FOLD
  const color = safeColor(p.dominant_color)
  const name = String(p.name ?? '')
  const brand = p.brand_name ? String(p.brand_name) : ''

  const src = p.image_url ? (cfImage(p.image_url, { width: VOUCHER_TILE_IMG_W, format: 'auto' }) || p.image_url) : ''
  const srcSet = p.image_url ? cfSrcSet(p.image_url, VOUCHER_TILE_IMG_W) : ''
  const img = src
    ? `<img src="${escAttr(src)}"${srcSet ? ` srcset="${escAttr(srcSet)}"` : ''} sizes="${VOUCHER_TILE_SIZES}" alt="${escAttr(cardImageAlt(name, brand || null))}" width="${VOUCHER_TILE_IMG_W}" height="${VOUCHER_TILE_IMG_W}" loading="${above ? 'eager' : 'lazy'}" fetchpriority="low" decoding="async" style="opacity:${above ? 1 : 0};transition:opacity 200ms ease-out" class="${T.img}">`
    : ''

  return (
    `<div class="${T.root}">` +
    `<div class="${T.thumb}"${color ? ` style="background-color:${color}"` : ''}>${img}</div>` +
    (brand ? `<span class="${T.brand}"><span class="${T.brandName}">${escText(brand)}</span><span aria-hidden="true" class="${T.chev}">›</span></span>` : '') +
    `<p class="${T.title}">${escText(name)}</p>` +
    `<div class="${T.priceRow}">` +
    (pd.discount > 0 ? `<span class="${T.discount}">${pd.discount}%</span>` : '') +
    `<span class="${T.price}">${formatNumber(price)}</span>` +
    `<span class="${T.unit}">딜</span>` +
    `</div>` +
    (sold > 0 ? `<p class="${T.meta}">구매 ${voucherSoldLabel(sold)}</p>` : '') +
    `</div>`
  )
}

/**
 * 로그인 흔적 또는 넓은 화면이면 첫 화면을 걷어낸다 — 그 경우 React 가 그릴 화면이 비로그인 목록과 다르다.
 * `getUserIdSync()` 와 같은 두 키를 본다(`user_id` · `userId`). `matchMedia` 는 `VouchersPage` 의 `isPc` 와 같은 질의.
 */
export function vouchersFirstScreenGuardScript(nonce: string): string {
  const js = `(function(){try{var s=localStorage;if(s.getItem('user_id')||s.getItem('userId')||(window.matchMedia&&matchMedia('(min-width: 1024px)').matches)){var n=document.getElementById('ur-first-screen');if(n)n.remove()}}catch(e){}})()`
  return `<script nonce="${escAttr(nonce)}">${js}</script>`
}

/**
 * 교환권 목록 첫 화면 HTML — 실패하면 **빈 문자열**(호출부가 종전 로더로 되돌아간다. 무회귀).
 * @param seedJson `__SSR_INITIAL_VOUCHERS__` 본문(`{ success, data: [...] }`)
 */
export function buildVouchersFirstScreen(seedJson: string, loaderHtml: string, nonce: string): string {
  let rows: VoucherSeedRow[]
  try {
    const parsed = JSON.parse(seedJson) as { success?: boolean; data?: VoucherSeedRow[] }
    if (!parsed?.success || !Array.isArray(parsed.data)) return ''
    rows = parsed.data
  } catch {
    return ''
  }
  const valid = rows.filter(p => p && p.id != null && p.name)
  if (valid.length === 0) return ''
  // `VouchersPage.displayProducts` 와 같은 정렬(기본 price_low) — 시드도 그 정렬이지만 화면 규칙을 따른다.
  const shown = [...valid].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)).slice(0, VOUCHERS_FS_ROWS)
  const count = rows.length === PAGE_SIZE ? `${rows.length}+` : String(rows.length)
  const C = VOUCHERS_FS_CLASS

  const body =
    `<div class="${C.page}">` +
    `<h1 class="sr-only">교환권 - 인기 브랜드 기프티콘을 딜로 즉시 구매</h1>` +
    // 🔴 첫 화면은 **비로그인 화면**이다(로그인 흔적이 있으면 아래 가드 스크립트가 이 노드를 걷어낸다).
    // 그래서 잔액이 아니라 할 수 있는 일을 말한다 — 0 을 적지 않는다는 규칙과 같은 이유다.
    // 🔴 아이콘(lucide·유어딜 세트)은 그리지 않는다 — path 를 문자열로 옮기면 두 벌이 갈린다.
    //    같은 치수의 빈 span 으로 **가로 자리만** 세운다(줄 높이는 `h-14` 가 정한다).
    `<div class="${C.topRow}">` +
    `<span class="${C.topGuest}">딜 모으기<span class="w-4 h-4 inline-block"></span></span>` +
    `<div class="${C.topActions}">` +
    `<span class="${C.topIcBtn}"><span class="w-[22px] h-[22px] inline-block"></span></span>` +
    `<span class="${C.topIcBtn}"><span class="w-[22px] h-[22px] inline-block"></span></span>` +
    `</div></div>` +
    `<div class="${C.topRule}"></div>` +
    `<div class="${C.reveal}" style="transform:translateY(0);transition:transform 0.25s ease;will-change:transform">` +
    `<div aria-hidden="true"><div class="${C.chipWrap}"><div class="${C.chipRow}"><span class="${C.chip}">&nbsp;</span></div></div></div>` +
    `</div>` +
    // ☕ 2026-10-14: 첫 화면은 커피/음료 — 브랜드 로고 줄이 칩 아래에 선다(카테고리 목록이 오기 전엔 React 도 같은 예약).
    `<div class="${C.brandWrap}" aria-hidden="true"><div class="${C.brandRow}"><span class="${C.brandItem}"><span class="${C.brandTile}"></span><span class="${C.brandLabel}">&nbsp;</span></span></div></div>` +
    `<div class="${C.sortBar}">` +
    `<h2 class="${C.sortTitle}"><span class="truncate">${escText(VOUCHERS_DEFAULT_CATEGORY)} 교환권</span><span class="${C.sortCount}">${count}</span></h2>` +
    `<div class="relative shrink-0"><span class="${C.sortBtn}"><span class="w-3.5 h-3.5 inline-block"></span>낮은 가격순<span class="w-3.5 h-3.5 inline-block"></span></span></div>` +
    `</div>` +
    `<div class="${C.listWrap}"><div class="${C.list}">${shown.map(tileHtml).join('')}</div></div>` +
    `</div>`

  return `<div id="ur-first-screen">${body}</div>${vouchersFirstScreenGuardScript(nonce)}${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
