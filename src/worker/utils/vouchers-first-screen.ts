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
import { STRIP_CLS, HERO_CARD_CLS, HERO_RAIL_CLS, stripBannerImageUrl, bannersOfSlot, heroEdgeFillCss } from '../../shared/home-strip-banners'
import { resolveBannerLink } from '../../components/home/banner-link'
import {
  VOUCHER_TILE_CLASS, VOUCHER_TILE_ABOVE_FOLD, VOUCHER_TILE_IMG_W, VOUCHER_TILE_SIZES, voucherSoldLabel,
} from '../../shared/voucher-tile'

/** 서버가 그리는 타일 수 — 폰 한 화면(844px)에 보이는 두 줄(3 × 2). 나머지는 마운트 뒤 React 가 그린다. */
export const VOUCHERS_FS_ROWS = 6
/** `VoucherTile` 의 `aboveFold`(idx < VOUCHER_TILE_ABOVE_FOLD) 와 같은 값 — eager/lazy·불투명도가 갈린다. */
const ABOVE_FOLD = VOUCHER_TILE_ABOVE_FOLD
/** `VouchersPage` 의 PAGE_SIZE — 개수 표시(`20+`)가 시드 길이로 정해진다. */
const PAGE_SIZE = 20

export const VOUCHERS_FS_CLASS = {
  page: 'bg-warm dark:bg-[#11141C] pb-safe-nav md:pb-20 min-h-[100dvh]',
  hero: 'relative h-[196px] overflow-hidden bg-gray-900 dark:bg-surface',
  overlap: 'relative z-10 -mt-7 px-4',
  reveal: 'sticky top-0 z-20 bg-warm pt-1',
  balanceBar: 'w-full flex items-center justify-between gap-2 rounded-xl bg-surface shadow-lift active:scale-[0.99] transition-transform h-11 px-4',
  balanceText: 'text-[12px] text-gray-600 dark:text-gray-300 truncate text-left',
  balanceLink: 'shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-brand-text',
  chipWrap: 'ur-content-wide px-4 lg:px-8 py-2',
  chipRow: 'flex gap-2 overflow-x-auto scrollbar-hide invisible',
  chip: 'shrink-0 inline-flex items-center gap-2 h-9 pl-3 pr-4 rounded-full text-[13px] font-medium',
  brandWrap: 'ur-content-wide px-4 lg:px-8 pt-2 pb-3 invisible',
  brandRow: 'flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1',
  brandItem: 'flex flex-col items-center gap-1 shrink-0',
  brandTile: 'w-12 h-12 rounded-2xl block',
  brandLabel: 'text-[12px] max-w-[56px]',
  sortBar: 'ur-content-wide px-4 lg:px-8 pt-3 pb-2 border-t border-gray-100 dark:border-[#2C2F35] flex items-center justify-between gap-2',
  sortTitle: 'text-[15px] font-bold text-gray-900 dark:text-white flex items-center gap-2 min-w-0',
  sortCount: 'text-[13px] font-medium text-gray-400 dark:text-gray-500 shrink-0',
  sortBtn: 'inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-[12px] font-medium text-gray-900 dark:text-white active:scale-[0.98] transition-transform',
  listWrap: 'ur-content-wide px-4 lg:px-8 pt-1 pb-6',
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
/**
 * 🖼️ 2026-10-18 머리 배너 첫 장을 **판 안에** 그린다 (대표 *"다 이상적으로 해줘"* — 교환권 LCP 가 배너였다).
 *
 * 실측(라이브 · 느린 4G · CPU 4배): 배너 사진 요청이 **3.8초에야** 출발했다 — 화면 코드가 다 돌고
 * `/api/banners` 응답을 받은 뒤에야 `<img>` 가 생겼기 때문이다. 판(196px)은 이미 서 있으니 사진만 늦었고,
 * 그 사진이 이 화면의 가장 큰 그림(LCP 4.3초)이었다. 워커가 같은 응답을 보조 시드로 받아(예열 키 —
 * 새 캐시 키 0) 첫 장을 **같은 클래스 · 같은 사진 주소**로 그리면 사진이 HTML 직후 출발한다.
 *
 * 🔒 마크업은 `StripRail` → `StripCard`(hero) 와 같다 — 레일·카드 클래스는 상수(`STRIP_CLS`·`HERO_*`)에서 오고
 *   사진 주소는 `stripBannerImageUrl` 한 함수다. 판 높이가 고정이라 마운트 때 무엇이 바뀌어도 아래는 안 밀린다.
 * ❌ 그리지 않는 것: 숫자 알약·넘김 버튼(위치가 absolute 라 높이를 안 만든다) · 둘째 장 이후.
 */
function heroBannerHtml(bannersJson: string | null | undefined): string {
  if (!bannersJson) return ''
  let banners
  try { banners = bannersOfSlot(JSON.parse(bannersJson), 'vouchers') } catch { return '' }
  const b = banners[0]
  if (!b) return ''
  const many = banners.length > 1
  const link = resolveBannerLink(b.link_url)
  const bg = stripBannerImageUrl(b.image_url, 'vouchers')
  const cls = `relative ${many ? STRIP_CLS.cardMany : STRIP_CLS.cardOne} ${many ? STRIP_CLS.pcCardW : ''} ${STRIP_CLS.card}  ${HERO_CARD_CLS}`
  const style = bg ? ` style="${escAttr(heroEdgeFillCss(bg))}"` : ' style="background:var(--brand-grad)"'
  const inner =
    (bg ? `<img src="${escAttr(bg)}" alt="" aria-hidden="true" loading="eager" fetchpriority="high" decoding="async" class="${STRIP_CLS.img}">` +
      `<div class="${STRIP_CLS.scrim}" aria-hidden="true"></div>` : '') +
    `<strong class="${escAttr(STRIP_CLS.title)}">${escText(b.title)}</strong>` +
    (b.description ? `<span class="${STRIP_CLS.desc}">${escText(b.description)}</span>` : '')
  const card = link?.kind === 'internal'
    ? `<a href="${escAttr(link.to)}" class="${escAttr(cls)}"${style}>${inner}</a>`
    : link?.kind === 'external'
      ? `<a href="${escAttr(link.href)}" target="_blank" rel="noopener noreferrer" class="${escAttr(cls)}"${style}>${inner}</a>`
      : `<div class="${escAttr(cls)}"${style}>${inner}</div>`
  return `<div class="${STRIP_CLS.root}" aria-roledescription="carousel" aria-label="이벤트 배너"><div class="relative">` +
    `<div class="${STRIP_CLS.rail} ${many ? STRIP_CLS.railMany : ''} ${HERO_RAIL_CLS}">${card}</div></div></div>`
}

/**
 * @param bannersJson `/api/banners` 응답(보조 시드). 없거나 교환권 배너가 0장이면 종전처럼 빈 판.
 */
export function buildVouchersFirstScreen(seedJson: string, loaderHtml: string, nonce: string, bannersJson?: string | null): string {
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
    `<div class="${C.hero}">${heroBannerHtml(bannersJson)}</div>` +
    `<div class="${C.overlap}"><div class="${C.balanceBar}">` +
    `<span class="${C.balanceText}">딜을 모으면 더 싸게 살 수 있어요</span>` +
    `<span class="${C.balanceLink}">모으는 방법 <span class="w-3 h-3 inline-block"></span></span>` +
    `</div></div>` +
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
