/**
 * 🏠 모바일 홈(`/`)의 **서버가 그리는 첫 화면** (2026-10-08 대표 *"처음에 유어딜 페이지 들어올 때
 * 만큼은 로딩 장면 없이 바로 페이지가 나타날 수 없나?"* → *"모두 다 하자"* → *"진행해줘"*).
 *
 * ## 왜 — 그릴 것이 이미 HTML 안에 와 있었다
 * 라이브 실측(2026-10-08, iPhone UA, JS 를 끈 채 서버 HTML 그대로 캡처): 홈 문서는 **48KB** 이고
 * 그 안에 `__SSR_INITIAL_MAIN__` + `__SSR_INITIAL_SECTIONS__` 가 **사진 URL까지** 들어 있다.
 * 심지어 워커는 그 시드로 첫 4장의 `<link rel=preload as=image>` 까지 이미 만든다
 * (`home-card-preload.ts`, 2026-08-27). 그런데 `#root` 는 catch-all 로 **유달이 로더**가 덮고 있어서,
 * 사진이 다 도착한 뒤에도 사람은 로더만 본다. 로더가 떠 있는 시간(600~1,100ms)은 어디나 비슷하고
 * **차이는 그 1초에 무엇이 보이느냐**뿐이다.
 *
 * ## ❌ 먼저 버린 길 — 워커에서 React 를 그리기
 * `entry-server.tsx` + `renderToStaticMarkup` 을 워커에서 돌리면 베끼기 자체가 사라진다. **산수로
 * 불가능하다**: `_worker.js` gzip 이 **991,518B** 이고 CI 게이트가 **1,032,000B**(main.yml) —
 * 여유 **39.5KB** 인데 `react-dom/server` 하나가 gzip ~40KB 다. 그 위에 페이지 트리·i18n·
 * react-query 가 얹힌다. 그리고 이 게이트는 **이미 한 번 배포를 깨뜨린 자리**다(#533 → #537).
 * ⇒ 베끼되, **시험이 진짜 컴포넌트를 렌더해 대조**한다(`home-ssr-first-screen-2026-10-08`).
 *
 * ## 무엇을 그리나 — 크롬(높이만) + **첫 섹션의 카드 4장**
 * React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 통째로 갈아엎는다. 서버가 그린 것과
 * 첫 렌더가 어긋나면 그 자리가 **튄다** ⇒ 어긋날 수 없는 것만 그린다.
 *
 *   1. **상단 크롬 3줄** — 높이를 만드는 클래스는 그대로. 글리프(로고·검색·알림·장바구니·핀·
 *      쉐브론·유어쇼츠 아이콘)는 **안 그린다**(두 벌이 갈리는 클래스). 위치 이름도 안 그린다 —
 *      `localStorage`(저장 지역·마지막 측위)에 달려 있어 서버가 모르고, **아는 척하면 돌아온
 *      사람에게 틀린 동네를 보여 준다.** 줄 높이는 [목록|지도] 전환과 카테고리 탭이 만든다
 *      (둘 다 **글자**라 안전하다 — 숫자로 예약하지 않는다).
 *   2. **첫 섹션** — 패널 + 제목/부제 + 2열 그리드에 카드 **4장**(시드 그대로).
 *      카드는 `GroupBuyFeedCard` 의 마크업을 그대로 옮기고 사진은 `DealCardMedia` 의 커버 한 장
 *      (`seen` 초기값이 `{0}` 이라 클라도 첫 렌더에 `<img>` 가 하나다).
 *      `src`/`srcSet`/`sizes` 는 **카드와 같은 함수**(`cfImage`/`cfSrcSet`)로 만든다 — 하나만
 *      달라도 브라우저가 preload 를 버리고 같은 사진을 두 번 받는다.
 *
 * ❌ **안 그리는 것**(서버가 모르거나 그리면 손해)
 *   - **거리(`N km`)** — 내 위치 기준이라 서버가 모른다. 주소 줄은 `justify-between` 한 줄이라
 *     거리가 나중에 들어와도 **높이가 안 바뀐다**.
 *   - **찜 하트 · 추첨 배지** — `absolute` 라 흐름에 영향 0. 하트는 hover 전엔 안 보인다.
 *   - **더보기 링크** — 제목 블록(17px + 부제)이 그 줄에서 더 높아서 없어도 줄 높이가 같다.
 *   - **둘째 섹션 이하 · 피드 · 유어쇼츠 레일** — 첫 화면 밖이다. 서버가 **안 그린** 것이
 *     나중에 채워지는 건 밀림이 아니다.
 *
 * ## 이 파일이 **못** 하는 것
 * - **배너**: `HomeBannerStrip` 은 첫 섹션 **위**에 오는데 시드에 없다(`/api/banners`). 지금
 *   라이브엔 자리(`banner_slot`)를 고른 배너가 **0건**이라 아무것도 안 그려진다(실측). 어드민이
 *   자리를 고르면 그때부터 내가 그린 카드가 배너 높이만큼 내려간다 — **오늘도 같은 밀림이
 *   스켈레톤에 일어나므로 회귀는 아니지만**, 없애려면 배너를 시드에 실어야 한다(별건).
 * - 클래스가 갈렸는지는 문자열로 못 잰다 → 시험이 **실제 컴포넌트를 렌더해** 대조한다.
 *   최종 판정은 프레임 캡처다(`out/firstpaint.mjs`).
 * - Save-Data 켠 사용자는 `cfImage` 가 quality 를 낮춰 URL 이 달라진다 → 그 사용자만 사진을
 *   다시 받는다(히어로 preload 가 2026-07-02 부터 안고 있는 것과 **같은** 트레이드오프).
 * - 마운트 전에는 탭·필터가 안 눌린다(카드 링크는 `<a href>` 라 **눌린다**).
 */
import { cfImage, cfSrcSet } from '../../utils/cf-image'
import { DEAL_CAT_LABELS } from '../../shared/deal-cats'
import { DEAL_GRID_GAP } from '../../shared/deal-card-grid'
import { HOME_CARD_ABOVE_FOLD, HOME_CARD_IMG_WIDTH_BASE } from '../../shared/home-card-image'
import { canonicalDetailPath } from '../../shared/product-flow'
import { priceDisplay } from '../../shared/price-display'
import { stripStorePrefix } from '../../utils/deal-title'
import { formatNumber } from '../../utils/format'

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

/**
 * 🔒 아래는 **소비 컴포넌트의 className 과 글자 하나까지 같아야 한다.**
 * 갈리면 마운트 때 그 자리가 튄다 — 시험이 컴포넌트를 렌더해 대조한다.
 *
 * 출처: `pages/mobile-home/MobileHomePage.tsx`(크롬) · `pages/pc-home/PcHomeLocationBar.tsx`(위치)
 *       `components/home/HomeSections.tsx`(섹션) · `pages/main-home/GroupBuyFeedCard.tsx`(카드)
 *       `components/deal/DealCardMedia.tsx`(사진) · `components/deal/StarRating.tsx`(별)
 */
export const HOME_FS_CLASS = {
  root: 'bg-white dark:bg-[#11141C]',
  chrome: 'sticky top-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2C2F35]',
  topRow: 'px-4 h-11 flex items-center justify-between gap-2',
  locRow: 'px-4 pt-1 pb-3 flex items-center justify-between gap-3',
  locTrigger: 'inline-flex items-center gap-1 -ml-0.5 max-w-full',
  locLabel: 'text-[24px] font-black tracking-[-0.02em] text-gray-900 dark:text-white max-w-[220px] truncate',
  viewToggle: 'shrink-0 flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] p-1',
  viewOn: 'rounded-[6px] bg-surface px-3 py-2 text-[12px] font-bold text-gray-900 dark:text-white shadow-sm',
  viewOff: 'rounded-[6px] px-3 py-2 text-[12px] font-bold text-gray-500 dark:text-gray-400',
  catRow: 'flex items-end gap-3 px-4',
  catNav: 'flex min-w-0 flex-1 gap-5 overflow-x-auto scrollbar-hide',
  catBase: 'shrink-0 pb-2 text-[15px] transition-colors border-b-2',
  catOn: 'font-black text-gray-900 dark:text-white border-brand',
  catOff: 'font-semibold text-gray-400 dark:text-gray-500 border-transparent',
  panel: 'ur-home-panel light-island',
  secHead: 'flex items-end justify-between gap-4 mb-3',
  secTitle: 'text-[17px] font-black tracking-tight text-gray-900 dark:text-white',
  secSub: 'mt-1 text-[12px] text-gray-500 dark:text-gray-400',
  grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${DEAL_GRID_GAP}`,
  cardLink: 'block group active:scale-[0.98] flex flex-col',
  media: 'relative aspect-[4/3] w-full overflow-hidden group/media rounded-xl bg-gray-100 dark:bg-[#222225]',
  cover: 'absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]',
  body: 'pt-2',
  merchant: 'flex items-center gap-1 text-[12px] leading-none mb-1 text-gray-500 dark:text-gray-400',
  onnuri: 'shrink-0 px-1 py-[1px] rounded bg-brand-tint text-brand-text text-[12px] font-bold',
  title: 'text-[13px] font-bold line-clamp-2 leading-tight text-gray-900 dark:text-white',
  addr: 'flex items-center justify-between gap-2 mt-1 text-[12px] min-w-0 text-gray-500 dark:text-gray-400',
  rateRow: 'flex items-center gap-2 mt-1 text-[12px] text-gray-500 dark:text-gray-400',
  starWrap: 'relative inline-block shrink-0 leading-none select-none align-middle',
  starBase: 'text-gray-300 dark:text-gray-600',
  starFill: 'absolute left-0 top-0 overflow-hidden whitespace-nowrap text-yellow-400',
  rateNum: 'font-bold text-gray-900 dark:text-white',
  priceWrap: 'mt-1',
  priceTop: 'flex items-baseline gap-1 leading-none',
  discount: 'text-[12px] font-extrabold text-sale',
  orig: 'text-[12px] line-through text-gray-500 dark:text-gray-400',
  priceRow: 'flex items-baseline gap-1 mt-1 leading-none',
  price: 'text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-white',
  perNight: 'text-[12px] font-semibold text-gray-500 dark:text-gray-400',
} as const

/** `DealCardMedia` 의 커버 `sizes` — 그 파일의 템플릿과 같은 식이어야 한다. */
export function homeCardSizes(width: number): string {
  return `(max-width: 640px) 50vw, (max-width: 1024px) 33vw, ${width}px`
}

/** `StarRating` 의 채움 비율 — 같은 식이어야 문자열이 byte-일치한다. */
export function starFillPct(value: number): number {
  return Math.max(0, Math.min(100, (value / 5) * 100))
}

/** 시드에서 읽는 최소 모양 — 서버 `CARD_COLS`(section-rules.ts)의 부분집합. */
interface SeedProduct {
  id: number | string
  name?: string | null
  image_url?: string | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  brand_name?: string | null
  gc_brand_name?: string | null
  onnuri_merchant?: number | string | null
  category?: string | null
  deal_only?: number | string | null
  price?: number | null
  current_price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  avg_rating?: number | null
  review_count?: number | null
}
interface SectionsSeed {
  data?: Array<{ id?: number | string; title?: string | null; subtitle?: string | null; products?: SeedProduct[] }>
}

function starHtml(value: number): string {
  const pct = starFillPct(value)
  return (
    `<span class="${HOME_FS_CLASS.starWrap}" style="font-size:11px;letter-spacing:0.5px" role="img" aria-label="5점 만점에 ${value.toFixed(1)}점">` +
    `<span class="${HOME_FS_CLASS.starBase}" aria-hidden="true">★★★★★</span>` +
    `<span class="${HOME_FS_CLASS.starFill}" style="width:${pct}%" aria-hidden="true">★★★★★</span>` +
    `</span>`
  )
}

function cardHtml(p: SeedProduct, eager: boolean): string {
  const href = canonicalDetailPath(p) ?? `/pass/${p.id}`
  const brandName = p.brand_name || p.gc_brand_name || null
  const merchant = p.restaurant_name || brandName
  const onnuri = !!p.onnuri_merchant
  const title = stripStorePrefix(p.name || '', p.restaurant_name || undefined)
  const addrShort = (p.restaurant_address || '').trim().split(/\s+/).slice(0, 3).join(' ')
  const { price, originalPrice, discount } = priceDisplay({
    price: p.current_price ?? p.price ?? 0,
    original_price: p.original_price ?? undefined,
    discount_rate: p.discount_rate ?? undefined,
  })
  const unit = Number(p.deal_only) === 1 ? ' 딜' : '원'
  const rating = p.avg_rating ?? 0
  const reviewCount = p.review_count ?? 0

  // 🖼️ 사진 — 카드와 **같은 함수·같은 폭**(모바일 전용이라 base 폭 하나로 끝난다).
  const src = p.image_url || ''
  const resized = src ? cfImage(src, { width: HOME_CARD_IMG_WIDTH_BASE, format: 'auto' }) || src : ''
  const set = src ? cfSrcSet(src, HOME_CARD_IMG_WIDTH_BASE) : ''
  const img = resized
    ? `<img src="${escAttr(resized)}"${set ? ` srcset="${escAttr(set)}"` : ''} sizes="${escAttr(homeCardSizes(HOME_CARD_IMG_WIDTH_BASE))}" alt="${escAttr(p.name || '')}" loading="${eager ? 'eager' : 'lazy'}" fetchpriority="${eager ? 'high' : 'auto'}" decoding="async" class="${HOME_FS_CLASS.cover}">`
    : ''

  return (
    `<a href="${escAttr(href)}" class="${HOME_FS_CLASS.cardLink}">` +
    `<div class="${HOME_FS_CLASS.media}">${img}</div>` +
    `<div class="${HOME_FS_CLASS.body}">` +
    (merchant || onnuri
      ? `<p class="${HOME_FS_CLASS.merchant}"><span class="truncate">${escText(merchant || '')}</span>` +
        (onnuri ? `<span class="${HOME_FS_CLASS.onnuri}">온누리</span>` : '') +
        `</p>`
      : '') +
    `<p class="${HOME_FS_CLASS.title}">${escText(title)}</p>` +
    (addrShort ? `<p class="${HOME_FS_CLASS.addr}"><span class="truncate">${escText(addrShort)}</span></p>` : '') +
    (rating > 0
      ? `<p class="${HOME_FS_CLASS.rateRow}">${starHtml(rating)}<span class="${HOME_FS_CLASS.rateNum}">${rating.toFixed(1)}</span>` +
        (reviewCount > 0 ? `<span>(${formatNumber(reviewCount)})</span>` : '') +
        `</p>`
      : '') +
    `<div class="${HOME_FS_CLASS.priceWrap}">` +
    (discount > 0 || (originalPrice > price && originalPrice > 0)
      ? `<p class="${HOME_FS_CLASS.priceTop}">` +
        (discount > 0 ? `<span class="${HOME_FS_CLASS.discount}">${discount}%</span>` : '') +
        (originalPrice > price && originalPrice > 0
          ? `<span class="${HOME_FS_CLASS.orig}">${formatNumber(originalPrice)}${unit}</span>`
          : '') +
        `</p>`
      : '') +
    `<p class="${HOME_FS_CLASS.priceRow}"><span class="${HOME_FS_CLASS.price}">${formatNumber(price)}${unit}</span>` +
    (p.category === 'stay_voucher' && price > 0 ? `<span class="${HOME_FS_CLASS.perNight}">/1박~</span>` : '') +
    `</p></div></div></a>`
  )
}

function chromeHtml(): string {
  const cats = DEAL_CAT_LABELS.map(({ key, label }) =>
    `<span class="${HOME_FS_CLASS.catBase} ${key === 'all' ? HOME_FS_CLASS.catOn : HOME_FS_CLASS.catOff}">${escText(label)}</span>`,
  ).join('')
  return (
    `<div class="${HOME_FS_CLASS.chrome}">` +
    `<div class="${HOME_FS_CLASS.topRow}"></div>` +
    `<div class="${HOME_FS_CLASS.locRow}">` +
    // 위치 이름은 안 그린다(위 머리말) — 줄 높이를 만드는 **같은 마크업**만 세운다.
    `<div class="min-w-0"><div class="relative inline-block"><div class="flex items-center gap-2">` +
    `<span class="${HOME_FS_CLASS.locTrigger}"><span class="${HOME_FS_CLASS.locLabel}">&nbsp;</span></span>` +
    `</div></div></div>` +
    `<div class="${HOME_FS_CLASS.viewToggle}">` +
    `<span class="${HOME_FS_CLASS.viewOn}">목록</span><span class="${HOME_FS_CLASS.viewOff}">지도</span>` +
    `</div></div>` +
    `<div class="${HOME_FS_CLASS.catRow}"><nav class="${HOME_FS_CLASS.catNav}">${cats}</nav></div>` +
    `</div>`
  )
}

/**
 * 홈 첫 화면 HTML — 실패하면 **빈 문자열**(호출부가 종전 로더로 되돌아간다. 무회귀).
 *
 * @param sectionsSeedJson `__SSR_INITIAL_SECTIONS__` 본문(JSON 문자열)
 * @param loaderHtml 종전 유달이 로더 HTML — 그린 내용 **아래**에 짧게 붙인다
 */
export function buildHomeFirstScreen(sectionsSeedJson: string, loaderHtml: string): string {
  let sec: { title?: string | null; subtitle?: string | null; products?: SeedProduct[] } | undefined
  try {
    const parsed = JSON.parse(sectionsSeedJson) as SectionsSeed
    sec = (parsed?.data ?? []).find(s => Array.isArray(s?.products) && s.products.length > 0)
  } catch {
    return ''
  }
  const products = (sec?.products ?? []).filter(p => p && p.id != null).slice(0, HOME_CARD_ABOVE_FOLD)
  if (!sec || products.length === 0 || !sec.title) return ''

  const cards = products.map((p, i) => cardHtml(p, i < HOME_CARD_ABOVE_FOLD)).join('')
  const body =
    `<div class="${HOME_FS_CLASS.root}">` +
    chromeHtml() +
    `<div class="mt-3"><section class="${HOME_FS_CLASS.panel}">` +
    `<div class="${HOME_FS_CLASS.secHead}"><div class="min-w-0">` +
    `<h3 class="${HOME_FS_CLASS.secTitle}">${escText(sec.title)}</h3>` +
    (sec.subtitle ? `<p class="${HOME_FS_CLASS.secSub}">${escText(sec.subtitle)}</p>` : '') +
    `</div></div>` +
    `<div class="${HOME_FS_CLASS.grid}">${cards}</div>` +
    `</section></div></div>`

  // 🧷 노드 id 는 `/pass/`·`/vouchers/` 와 같다 — `lib/boot-first-screen.ts` 가 경로를 안 가리고
  //   이 노드를 들고 있다가 Suspense 폴백 안에 **같은 노드로** 도로 붙인다(재파싱·재다운로드 0).
  return `<div id="ur-first-screen">${body}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
