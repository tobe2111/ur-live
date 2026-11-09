/**
 * 🖼️ 이용권 상세(`/pass/:id`)의 **서버가 그리는 첫 화면** (2026-09-15 대표
 * *"꼭 로딩이 걸려야 해?"* → *"없어지는게 좋으면 없애도 돼"*).
 *
 * ## 왜 — 데이터는 진작 도착해 있는데 그릴 사람이 안 깨어나 있었다
 * 라이브 실측(iPhone 에뮬, 하드로드):
 *
 *     0.2초   HTML 도착 — `__SSR_INITIAL_DETAIL__` 에 상품이 **이미 들어 있다**
 *     0.5초   히어로 사진 도착 — 워커가 preload 로 당겨 놨다(`home-card-preload.ts`)
 *     1.4초   React 마운트 — 그제서야 사진이 화면에 그려진다
 *
 * 그 1.2초 동안 화면은 `urdeal.` 워드마크뿐이다. **사진이 캐시에 앉아서 기다린다.**
 * CPU 프로파일상 그 1초의 대부분은 앱 코드가 아니라 `(program)`(V8 파싱·컴파일)이라,
 * 코드를 고쳐서 줄일 수 있는 성질이 아니다 — 번들을 줄이거나, **기다리지 않고 그리거나** 둘뿐이다.
 *
 * ## 무엇을 그리나 — **제목까지**. 그 아래는 한 픽셀도 안 그린다
 * React 는 `createRoot`(비-hydrate)라 마운트 시 `#root` 를 **통째로 갈아엎는다**. 그래서 서버가
 * 그린 것과 React 첫 렌더가 어긋나면 그 자리가 **튄다** — 대표가 2026-07-01 에 금지한
 * *"로딩 화면 2~3개"* 로 되돌아가는 길이 정확히 이것이다.
 *
 * ⇒ 어긋날 수 없는 것만 그린다:
 *   - **빵부스러기**(카테고리) — `DetailBreadcrumb` 과 **같은 클래스 문자열**, 사용자와 무관.
 *   - **히어로 사진** — `DetailGallery` 모바일 슬라이드와 같은 프레임(3:2)·같은 URL
 *     (`detailHeroMobileUrl` SSOT — 워커 preload 가 이미 쓰는 그 함수).
 *   - **매장명 + 제목(h1)** — 시드에 있는 값 그대로. 2026-09-16 에 경계를 여기까지 밀었다(아래).
 *   - 그 아래는 **로더**. 마운트 때 로더가 사라지고 내용이 채워질 뿐, **사진과 제목은 제자리에 있다.**
 *
 * ## 2026-09-16 — 경계를 제목까지 밀었다. 가로막던 둘을 먼저 치웠다
 * 09-15 에는 히어로에서 멈췄다. 제목 **위**에 per-user 블록이 둘 있어서다:
 *   1. `ShareRewardBanner`(딜 보유자에게만 — 2026-11-02 팔아보기 한 줄 `SellThisCard` 로 통합) — 서버 조회가 끝나야 뜨는데 제목 위에 있어서
 *      **딜 가진 사용자에게만** 뒤늦게 제목이 아래로 밀렸다. 이건 서버 렌더와 무관하게 **오늘도
 *      나던 밀림**이라, 배너를 가격 아래로 내려 고쳤다(`GroupBuyDetailPage`).
 *   2. `?ref=` 추천 진입 배너 — 이쪽은 **URL 로 결정**되니 그 파라미터가 붙은 요청에서만
 *      제목을 접는다(`search` 인자). 그 경우 09-15 와 똑같이 히어로까지만 = 무회귀.
 *
 * ❌ **주소·가격은 여전히 안 그린다.** 제목 바로 아래 주소 줄에 `· 1.2km`(내 위치 기준 거리)가
 *    **문장 안으로** 들어가는데 그 값은 localStorage 에만 있어 서버가 모른다. 거리 없이 그리면
 *    마운트 때 그 줄이 한 줄 → 두 줄로 **되감길 수 있고**, 그러면 바로 아래 가격이 밀린다.
 *    ⇒ 경계는 "서버가 확실히 아는 마지막 것" = h1 이다. 서버가 **안 그린** 것이 나중에 채워지는
 *    건 밀림이 아니다 — 위는 한 픽셀도 안 움직인다.
 * ✅ PC(lg+)도 그린다 (2026-11-09 대표 승인 — 2026-09-16 의 ❌ 를 대체. 그때 이유 셋과 답은 `shared/detail-pc-first-screen.ts` 머리말):
 *    그리드 통째(좌 열: 갤러리 PC 블록 + 제목 헤더 · 우 열: 빈 `<aside>` 360px) → 마운트 때 가로 안 줄어듦. 핀 SVG 는 빈 칸.
 *    호출부가 UA 로 가른다(`isMobile`) — 폰 본문엔 PC 블록을, PC 본문엔 폰 슬라이드를 **넣지 않는다**(숨긴 `<img>` 도 받아지므로
 *    둘 다 넣으면 사진을 두 벌 받는다). 라이브 실측(1440px·4G·CPU 4배): PC 상세 첫 글자 0.76s · LCP 2.47s(그림이 앱 뒤).
 * ❌ `/vouchers/:id`(교환권)는 **같은 DETAIL 슬롯이지만 다른 페이지**(`VoucherDetailPage`)다.
 *    호출부가 pathname 으로 가른다 — 여기서 그리면 없는 레이아웃을 그리는 셈이다.
 *
 * ## 이 파일이 **못** 하는 것
 * - 클래스가 갈렸는지는 문자열로 못 잰다 → `detail-ssr-first-screen` 테스트가 실제 컴포넌트를
 *   렌더해 프레임·URL·클래스를 대조한다. 그래도 최종 판정은 **프레임 캡처**다.
 * - 마운트 전에는 눌러도 아무 일도 안 난다(사진은 배경이라 링크가 아니다 — 원래 그렇다).
 */
import {
  DETAIL_HERO_MOBILE_WIDTH,
  DETAIL_MOBILE_THUMBS,
  DETAIL_MOBILE_THUMB_CLS, DETAIL_THUMB_PLACEHOLDER,
  DETAIL_MOBILE_THUMB_RATIO,
  DETAIL_MOBILE_THUMB_ROW_CLS,
  detailGalleryImages,
  detailHeroMobileUrl,
  detailMobileThumbUrl,
  showMobileThumbs,
} from '../../shared/detail-hero-image'
import { getVoucherShortLabel, normalizeCategory } from '../../shared/constants/voucher-categories'
import { PASS_HEAD, PASS_PAGE_BG, passSubLine } from '../../shared/pass-head'
import { buildDetailNoscript } from './crawler-noscript'
import { HOME_FS_CLASS, starFillPct } from './home-first-screen'
import { DETAIL_PC_FS, DETAIL_PC_THUMBS, DETAIL_PC_SCRIM_TOP, DETAIL_PC_SCRIM_BOTTOM, DETAIL_PC_COPY } from '../../shared/detail-pc-first-screen'
import { detailCropUrl, DETAIL_HERO_DESKTOP_WIDTH, DETAIL_PC_HERO_RATIO_MULTI, DETAIL_PC_HERO_RATIO_SINGLE, DETAIL_THUMB_WIDTH, DETAIL_PC_THUMB_RATIO } from '../../shared/detail-hero-image'
import { derivePricing } from '../../pages/group-buy/pricing'
import { formatNumber } from '../../utils/format'

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

/**
 * `DetailBreadcrumb`(overlayHeader) 과 **같은 클래스**. 갈리면 마운트 때 한 줄이 튄다.
 * ⚠️ 라벨은 명칭 SSOT(`getVoucherShortLabel`)를 쓴다 — 여기서 "식사권" 같은 옛 어휘가 되살아나지 않게.
 */
export const DETAIL_CRUMB_CLASS =
  'flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[13px] leading-none scrollbar-hide px-5 pb-2 lg:px-8 lg:pt-4 lg:pb-1 lg:max-w-[1200px] lg:mx-auto pt-[64px]'

/**
 * 🍞 `DetailBreadcrumb` 의 내부 클래스 — **컴포넌트와 글자까지 같아야 한다**(가드가 대조한다).
 *
 * 🩸 2026-10-12: 종전 이 자리의 항목 span 이 `gap-1.5` 였다. 컴포넌트는 `gap-2` 다 — 즉 PC 상세의
 *   빵부스러기 칸 간격이 마운트 때 6px → 8px 로 **벌어지고 있었다**(에러 0 · 화면도 안 깨진다).
 *   항목 수만큼 가로로 밀리므로 눈에 잘 안 띈다. 호버 클래스도 빠져 있던 것을 함께 맞췄다.
 */
export const DETAIL_CRUMB_ITEM_CLASS = 'flex items-center gap-2 shrink-0'
export const DETAIL_CRUMB_SEP_CLASS = 'text-gray-300 dark:text-gray-600'
export const DETAIL_CRUMB_LINK_CLASS =
  'text-gray-600 dark:text-gray-300 underline underline-offset-[3px] decoration-gray-300 dark:decoration-gray-600 hover:text-gray-900 dark:hover:text-white hover:decoration-current'
export const DETAIL_CRUMB_CURRENT_CLASS = 'text-gray-500 dark:text-gray-400'

/**
 * 빵부스러기 `<nav>` HTML. 항목이 **2개 미만이면 `''`** — 컴포넌트도 안 그린다(`shown.length < 2`).
 * `to` 가 없는 마지막 칸은 링크가 아니라 `aria-current="page"` 인 span 이다(컴포넌트와 같다).
 */
export function crumbNavHtml(items: Array<{ label: string; to?: string }>): string {
  const shown = items.filter(c => c.label)
  if (shown.length < 2) return ''
  const inner = shown.map((c, i) => (
    `<span class="${DETAIL_CRUMB_ITEM_CLASS}">` +
      (i > 0 ? `<span aria-hidden="true" class="${DETAIL_CRUMB_SEP_CLASS}">/</span>` : '') +
      (c.to
        ? `<a href="${escAttr(c.to)}" class="${DETAIL_CRUMB_LINK_CLASS}">${escText(c.label)}</a>`
        : `<span aria-current="page" class="${DETAIL_CRUMB_CURRENT_CLASS}">${escText(c.label)}</span>`) +
    '</span>'
  )).join('')
  return `<nav aria-label="현재 위치" class="${DETAIL_CRUMB_CLASS}">${inner}</nav>`
}

function crumbHtml(category: string | null | undefined): string {
  const cat = normalizeCategory(category)
  if (!cat) return '' // 크럼이 하나면 경로가 아니다 — 컴포넌트도 안 그린다(`shown.length < 2`).
  const nav = crumbNavHtml([
    { label: '홈', to: '/' },
    { label: getVoucherShortLabel(cat), to: `/?category=${cat}` },
  ])
  // 🎟️ 2026-10-11 (D안): 모바일은 빵부스러기를 안 그린다 — 컴포넌트도 `hidden lg:block` 으로 감쌌다.
  return nav ? `<div class="hidden lg:block">${nav}</div>` : ''
}

/** 사진 위 그라디언트 — `DetailGallery` 의 `badges` 와 같은 값(없으면 사진 가장자리 톤이 달라진다). */
const HERO_SCRIMS =
  '<div style="position:absolute;inset:0 0 auto 0;height:110px;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.4),transparent)"></div>' +
  '<div style="position:absolute;inset:auto 0 0 0;height:120px;pointer-events:none;background:linear-gradient(0deg,rgba(0,0,0,.32),transparent)"></div>'

/**
 * 🏷️ 머리 카드의 위쪽(가게 · 제목) — `PassHeadCard` 와 **같은 클래스 문자열**(`PASS_HEAD`, 2026-10-11 D안).
 * 종전엔 React inline style 을 손으로 옮겨 두 벌을 시험으로 대조했다. 이제는 같은 상수를 import 해서
 * 갈릴 수가 없다. 카드의 나머지(거리 · 가격)는 마운트 뒤 h1 **아래**에 채워진다 — 위는 안 움직인다.
 */
/** 온누리 뱃지 — `PASS_HEAD.onnuri` 재수출(호환). */
export const DETAIL_ONNURI_CLASS = PASS_HEAD.onnuri

function titleHtml(d: DetailSeed): string {
  // 🛍️ 2026-10-24 그루폰식 → 🔤 2026-10-25 D안: [가게 · 종류 · 지역] 한 줄이 **제목 위**(`passSubLine` — 클라와 같은 함수·같은 순서).
  const sub = passSubLine(d)
  const onnuri = d.onnuri_merchant
    ? `<span class="${DETAIL_ONNURI_CLASS}">온누리 사용 가능</span>`
    : ''
  return (
    `<div class="${PASS_HEAD.card}">` +
      (sub ? `<div class="${PASS_HEAD.merchant}">${escText(sub)}${onnuri}</div>` : '') +
      `<h1 class="${PASS_HEAD.h1}">${escText(d.name || '')}</h1>` +
      (d.prelaunch ? `<span class="${PASS_HEAD.prelaunch}">오픈 예정 · 사전 응모 받는 중</span>` : '') +
      statsAndPriceHtml(d) +
    '</div>'
  )
}

/**
 * 💰 2026-11-09 별점 줄 + 가격 — `PassHeadCard` 와 **같은 클래스(`PASS_HEAD`)·같은 계산(`derivePricing`)·같은 숫자 형식**.
 *   종전 ❌("주소 줄의 `· N km` 가 되감겨 가격이 밀린다")은 2026-11-02 상세 C안으로 주소 줄이 걷히고 거리가 이 줄 **오른쪽**으로
 *   옮겨 가며 사라졌다. 거리는 서버가 모르니 안 그린다 — 같은 줄 오른쪽이라 나중에 붙어도 높이가 그대로다.
 *   ⚠️ 남는 밀림 하나: 리뷰·구매가 0 인데 거리가 있으면 그 줄이 마운트 때 새로 생긴다(라이브 50건 중 2건).
 */
function statsAndPriceHtml(d: DetailSeed): string {
  const rv = Number(d.avg_rating) || 0
  const rc = Number(d.review_count) || 0
  const hasReviews = rv > 0 && rc > 0
  const buyers = Number(d.sold_count ?? d.group_buy_current) || 0
  let stats = ''
  if (hasReviews || buyers > 0) {
    const star = hasReviews
      ? `<span class="${HOME_FS_CLASS.starWrap}" style="font-size:12px;letter-spacing:0.5px" role="img" aria-label="5점 만점에 ${rv.toFixed(1)}점">` +
        `<span class="${HOME_FS_CLASS.starBase}" aria-hidden="true">★★★★★</span>` +
        `<span class="${HOME_FS_CLASS.starFill}" style="width:${starFillPct(rv)}%" aria-hidden="true">★★★★★</span></span>` +
        `<b class="font-medium" style="color:var(--gbd-ink)">${rv.toFixed(1)}</b>` +
        `<button type="button" class="${PASS_HEAD.statsBtn}" style="color:var(--gbd-sub)">(${formatNumber(rc)})</button>`
      : ''
    stats =
      `<div class="${PASS_HEAD.stats}"><span class="${PASS_HEAD.statsLeft}">` + star +
      (hasReviews && buyers > 0 ? '<span aria-hidden="true" style="color:var(--gbd-sub2)">·</span>' : '') +
      (buyers > 0 ? `<span style="color:var(--gbd-sub)">${formatNumber(buyers)}명 구매</span>` : '') +
      '</span></div>'
  }
  const price = Number(d.price)
  if (!Number.isFinite(price) || price <= 0) return stats
  const { unitPrice, refPrice, displayDiscountPct } = derivePricing({
    price, original_price: Number(d.original_price) || undefined, current_discount_pct: Number(d.current_discount_pct) || 0,
  })
  if (!(unitPrice > 0)) return stats
  return stats +
    `<div class="${PASS_HEAD.price}">` +
      (refPrice > unitPrice ? `<div class="${PASS_HEAD.priceRef}" style="color:var(--gbd-sub)"><s class="ur-strike">${formatNumber(refPrice)}원</s></div>` : '') +
      `<div class="${PASS_HEAD.priceRow}">` +
        (displayDiscountPct > 0 ? `<span class="ur-pct-pop ${PASS_HEAD.pricePct}" style="color:var(--sale)">${displayDiscountPct}%</span>` : '') +
        `<span class="${PASS_HEAD.priceNow}" style="color:var(--gbd-ink)">${formatNumber(unitPrice)}원</span>` +
      '</div>' +
    '</div>'
}

interface DetailSeed {
  name?: string
  image_url?: string
  images?: string | null
  image_urls?: string | null
  detail_images?: string | null
  category?: string | null
  restaurant_name?: string | null
  onnuri_merchant?: boolean
  prelaunch?: boolean | number
  // 📰 아래는 **`<noscript>` 본문 요약 전용**(2026-10-11) — 첫 화면은 이 값들을 그리지 않는다.
  //   그릴 수 없는 이유는 위 "❌ 주소·가격은 여전히 안 그린다" 에 적혀 있고 그 판단은 그대로다.
  //   크롤러는 거리를 모르는 것이 문제가 아니라 **본문이 49자인 것**이 문제라, 사람에게 안 보이는
  //   자리(`<noscript>`)에만 담는다. 규율·근거: `utils/crawler-noscript.ts`.
  description?: string | null
  long_description?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  restaurant_address?: string | null
  restaurant_phone?: string | null
  voucher_expiry?: string | null
  voucher_terms?: string | null
  avg_rating?: number | null
  review_count?: number | null
  sold_count?: number | null
  group_buy_current?: number | null
  current_discount_pct?: number | null
}

/**
 * `#root` 에 넣을 첫 화면 HTML. 만들 수 없으면 `''` → 호출부가 기존 로더로 폴백(무회귀).
 *
 * @param ssrPayload `__SSR_INITIAL_DETAIL__` 원문
 * @param loaderHtml 기존 URDEAL 로더(사진 아래에 붙는다 — 아직 오는 중이라는 정직한 신호)
 * @param search 요청의 쿼리(`url.search`). `?ref=` 가 붙으면 추천 진입 배너가 제목 **위**에 끼므로
 *               제목을 접고 히어로까지만 그린다(09-15 동작 = 무회귀). 안 넘기면 제목까지.
 */
/** 사진 칸 배경(폰 썸네일·PC 갤러리 공용) — 자리색은 `DETAIL_THUMB_PLACEHOLDER`(라이트에서 검은 상자가 되지 않게, React `bg()` 와 같은 값). */
function thumbBgStyle(url: string): string {
  return `background-color:${DETAIL_THUMB_PLACEHOLDER};background-image:url(&quot;${escAttr(url)}&quot;);background-size:cover;background-position:center`
}

/** 첫 화면 래퍼 열기 — 폰·PC 공용. id 는 `lib/boot-first-screen.ts` 상수와 같아야 하고(갈리면 폴백이 no-op), `.gbd` + 바탕은 페이지 루트와 같다. */
function firstScreenOpen(): string {
  return `<div id="ur-first-screen" class="gbd ${PASS_PAGE_BG}" style="color:var(--gbd-ink)">`
}

/** 🖼️ 모바일 썸네일 2칸 — 이용권·숙소 서버 첫 화면 공용. 3장 미만이면 ''. */
export function mobileThumbRowHtml(images: string[]): string {
  if (!showMobileThumbs(images.length)) return ''
  return `<div class="lg:hidden ${DETAIL_MOBILE_THUMB_ROW_CLS}">` +
    images.slice(1, 1 + DETAIL_MOBILE_THUMBS).map((src) =>
      `<div class="${DETAIL_MOBILE_THUMB_CLS}" style="aspect-ratio:${DETAIL_MOBILE_THUMB_RATIO};${thumbBgStyle(detailMobileThumbUrl(src))}"></div>`,
    ).join('') +
  '</div>'
}

/**
 * 🏁 2026-11-09 썸네일 2칸은 CSS `background-image` 라 브라우저가 **늦게·낮은 우선순위로** 받는다(대표 캡처 — 큰 사진은
 *   떴는데 그 아래 두 칸이 한참 검었다). 첫 화면 안이므로 `Link: rel=preload` 로 미리 받게 한다(히어로와 같은 길, 우선순위는 auto).
 *   `mobileThumbRowHtml` 과 **같은 조건·같은 주소**(두 벌로 세면 preload 가 버려진다). 3장 미만이면 [].
 */
/** `__SSR_INITIAL_DETAIL__` 원문 → 갤러리 사진 목록(첫 화면과 같은 함수). 파싱 실패면 []. */
export function detailGalleryImagesOf(ssrPayload: string): string[] {
  try { const d = (JSON.parse(ssrPayload) as { data?: DetailSeed })?.data; return d ? detailGalleryImages(d) : [] } catch { return [] }
}
export function mobileThumbPreloadHrefs(images: string[]): string[] {
  if (!showMobileThumbs(images.length)) return []
  return images.slice(1, 1 + DETAIL_MOBILE_THUMBS).map((src) => detailMobileThumbUrl(src)).filter((u) => !!u && !u.startsWith('data:'))
}

/**
 * 🖐️ 2026-10-27 (대표 "사진이 여러장임에도 안넘어가. 로딩이 좀 지나니까 넘어가지는 것 같기도 하고"):
 *   서버 첫 화면이 첫 장 하나만 그려서, 앱이 뜨기 전에는 넘길 사진이 없었다. 나머지 장도 같은
 *   스냅 슬라이드로 그린다 — 화면 밖이라 `loading="lazy"`(넘겨야 받는다, 추가 요청 0).
 *   이용권·숙소 서버 첫 화면이 **같은 함수**를 쓴다(한쪽만 고쳐지는 일 방지).
 */
export function restSlidesHtml(images: string[], alt: string, slideCls = ''): string {
  return images.slice(1).map((src) => {
    const u = detailHeroMobileUrl(src, DETAIL_HERO_MOBILE_WIDTH)
    if (!u || u.startsWith('data:')) return ''
    return `<div${slideCls ? ` class="${slideCls}"` : ''} style="position:relative;flex:0 0 100%;scroll-snap-align:center;background-color:#1D1F29">` +
      `<img src="${escAttr(u)}" alt="${escAttr(alt)}" loading="lazy" decoding="async"` +
      ` style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>`
  }).join('')
}

export function buildDetailFirstScreen(ssrPayload: string, loaderHtml: string, search = '', isMobile = true): string {
  try {
    const d = (JSON.parse(ssrPayload) as { data?: DetailSeed })?.data
    if (!d || !d.name) return ''
    const images = detailGalleryImages(d)
    const main = images[0] || ''
    if (!main) return '' // 사진이 없으면 그릴 것도 없다(카테고리 아이콘 폴백은 React 가 그린다).
    if (!isMobile) return pcFirstScreen(d, images, loaderHtml, search) // 🖥️ 2026-11-09 PC 는 다른 레이아웃(2열) — 아래는 폰 본문
    const heroUrl = detailHeroMobileUrl(main, DETAIL_HERO_MOBILE_WIDTH)
    if (!heroUrl || heroUrl.startsWith('data:')) return ''

    const hero =
      '<div class="relative lg:hidden">' +
        '<div class="scrollbar-hide" style="display:flex;overflow-x:auto;aspect-ratio:3/2;scroll-snap-type:x mandatory">' +
          // 🔎 2026-10-11 (대표 "허가 — 진행"): 배경이 아니라 **진짜 <img>**. 구글 이미지는 CSS 배경을
          //   못 보므로, 종전엔 이 사진이 목록 페이지(제목이 일반적인)에만 귀속되고 정작 제목이
          //   이용권 명칭인 이 상세 페이지엔 못 붙었다. React(`DetailGallery` 모바일 슬라이드)와
          //   **같은 구조·같은 URL** 이라야 마운트 때 안 밀린다 — 가드가 둘을 대조한다.
          `<div style="position:relative;flex:0 0 100%;scroll-snap-align:center;background-color:#1D1F29;` +
            `background-image:url(&quot;${escAttr(heroUrl)}&quot;);background-size:cover;background-position:center">` +
            `<img src="${escAttr(heroUrl)}" alt="${escAttr(d.name)}" loading="eager" fetchpriority="high" decoding="async"` +
            ` style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` +
          '</div>' +
          restSlidesHtml(images, d.name) +
        '</div>' +
        HERO_SCRIMS +
      '</div>' +
      // 🖼️ 2026-10-27 (대표 "그루폰처럼"): 큰 사진 아래 썸네일 2칸 — React `DetailGallery` 와 같은 상수·같은 URL.
      //   없으면 마운트 때 이 줄 높이만큼 제목이 아래로 밀린다.
      mobileThumbRowHtml(images)

    // 🏷️ 제목은 `?ref=`(추천 진입 배너가 제목 위에 끼는 경우)가 없을 때만. 없으면 09-15 와 동일.
    let hasRef = false
    try { hasRef = !!new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('ref') } catch { hasRef = true }
    const title = hasRef ? '' : titleHtml(d)

    // 로더는 사진 **아래**로 — 종전 `min-height:100dvh` 그대로면 사진 때문에 문서가 화면보다 길어진다.
    const shortLoader = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')
    // 🧷 2026-09-16 (대표 판정 후속): 첫 화면을 id 로 감싼다 — 클라(`lib/boot-first-screen.ts`)가 이
    //   **노드 자체**를 들고 있다가 Suspense 폴백에 도로 붙인다(불투명 풀스크린 로더가 방금 도착한
    //   사진을 덮던 것 제거). 리터럴이 갈리면 조용히 no-op 이라 `BOOT_FIRST_SCREEN_ID` 와 대조한다.
    // 🎨 `class="gbd"` + 배경은 페이지 루트(`GroupBuyDetailPage` 의 `<div className="gbd" …>`)와 같다.
    //   이게 없으면 (a) `--gbd-*` 가 안 풀려 제목이 기본색이 되고 (b) 바탕이 `--bg`(#F8F7FC) 라
    //   마운트 때 `--surface`(#FFFFFF) 로 **바뀐다**. 노드 자체가 들고 다니는 값이라 폴백 안에서도 유지된다.
    // 📰 2026-10-11 (대표 "네이버도 해주고"): JS 를 안 돌리는 크롤러에게만 보이는 본문 요약.
    //   사람에게는 렌더되지 않고(JS 가 돌면 `<noscript>` 는 무시된다) 마운트 때 함께 사라진다
    //   → 밀림 0 · 추가 요청 0(시드에 이미 온 값만 쓴다). 규율: 지어낸 문구 금지 · 제목 반복 금지.
    return (
      firstScreenOpen() +
        `${crumbHtml(d.category)}${hero}${title}${buildDetailNoscript(d)}` +
      '</div>' + shortLoader
    )
  } catch {
    return '' // seed 파싱 실패 — 로더로 폴백(치명 아님)
  }
}

/** `?ref=` 가 붙으면 추천 진입 배너가 제목 위에 끼므로 제목을 접는다(폰과 같은 규칙). */
function hasRefParam(search: string): boolean {
  try { return !!new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('ref') } catch { return true }
}

/** 🖥️ PC 갤러리 블록 — `DetailGallery` 의 `hidden lg:block` 부분과 같은 구조·같은 URL(`detailCropUrl`). 배경이라 `<img>` 는 없다(React 도 없다). */
function pcGalleryHtml(images: string[]): string {
  const multi = images.length > 1
  const main = images[0]
  const heroUrl = detailCropUrl(main, DETAIL_HERO_DESKTOP_WIDTH, multi ? DETAIL_PC_HERO_RATIO_MULTI : DETAIL_PC_HERO_RATIO_SINGLE)
  const bgStyle = thumbBgStyle
  const rest = images.length - 1 - DETAIL_PC_THUMBS
  const thumbs = multi
    ? `<div class="${DETAIL_PC_FS.pcThumbCol}">` + images.slice(1, 1 + DETAIL_PC_THUMBS).map((src, i) => {
        const isLast = i === DETAIL_PC_THUMBS - 1 && rest > 0
        return `<div class="${DETAIL_PC_FS.pcThumb}" style="${bgStyle(detailCropUrl(src, DETAIL_THUMB_WIDTH, DETAIL_PC_THUMB_RATIO))}">` +
          (isLast ? `<span class="${DETAIL_PC_FS.pcRest}"><span class="${DETAIL_PC_FS.pcRestN}">+${rest}</span>${escText(DETAIL_PC_COPY.allPhotos(images.length))}</span>` : '') +
          '</div>'
      }).join('') + '</div>'
    : ''
  return `<div class="${DETAIL_PC_FS.heroBox}" style="background:var(--gbd-card)"><div class="${DETAIL_PC_FS.pcWrap}">` +
    `<div class="${multi ? DETAIL_PC_FS.pcGridMulti : ''}">` +
      `<div class="${DETAIL_PC_FS.pcMain}" style="aspect-ratio:${multi ? '4 / 3' : '16 / 9'};${bgStyle(heroUrl)}">` +
        `<div style="${DETAIL_PC_SCRIM_TOP}"></div><div style="${DETAIL_PC_SCRIM_BOTTOM}"></div>` +
      '</div>' + thumbs +
    '</div></div></div>'
}

/** 🖥️ PC 제목 헤더 — `DetailTitleHeader` 미러(핀 SVG 는 15px 빈 칸 · 별점은 React 와 같은 글자 ★). */
function pcTitleHtml(d: DetailSeed): string {
  const rv = Number(d.avg_rating) || 0
  const rc = Number(d.review_count) || 0
  const hasRating = rv > 0
  const store = d.restaurant_name
    ? `<div class="${DETAIL_PC_FS.store}">${escText(d.restaurant_name)}${escText(DETAIL_PC_COPY.registeredStore)}` +
      (d.onnuri_merchant ? `<span class="${DETAIL_PC_FS.onnuri}">${DETAIL_PC_COPY.onnuri}</span>` : '') + '</div>'
    : ''
  const rating = hasRating
    ? `<span class="${DETAIL_PC_FS.metaGroup}">` +
      `<span class="${HOME_FS_CLASS.starWrap}" style="font-size:15px;letter-spacing:0.5px" role="img" aria-label="5점 만점에 ${rv.toFixed(1)}점">` +
        `<span class="${HOME_FS_CLASS.starBase}" aria-hidden="true">★★★★★</span>` +
        `<span class="${HOME_FS_CLASS.starFill}" style="width:${starFillPct(rv)}%" aria-hidden="true">★★★★★</span></span>` +
      `<b class="${DETAIL_PC_FS.ratingB}">${rv.toFixed(1)}</b>` +
      (rc > 0 ? `<span class="${DETAIL_PC_FS.ratingCount}">(${rc})</span>` : '') + '</span>'
    : ''
  const address = d.restaurant_address
    ? `<span class="${DETAIL_PC_FS.metaGroup}">` + (hasRating ? `<span class="${DETAIL_PC_FS.sep}">|</span>` : '') +
      `<span class="block shrink-0 ${DETAIL_PC_FS.pin}" aria-hidden="true"></span>${escText(d.restaurant_address)}</span>`
    : ''
  const phone = d.restaurant_phone ? `<a href="tel:${escAttr(d.restaurant_phone)}" class="${DETAIL_PC_FS.phone}">${escText(d.restaurant_phone)}</a>` : ''
  return `<header class="${DETAIL_PC_FS.header}">${store}<h1 class="${DETAIL_PC_FS.h1}">${escText(d.name || '')}</h1>` +
    `<div class="${DETAIL_PC_FS.meta}">${rating}${address}${phone}</div></header>`
}

/** 🖥️ PC 첫 화면 본문 — [빵부스러기] + 2열 그리드[좌: 갤러리 + 제목 헤더 · 우: 빈 aside] + noscript, 아래 로더. */
function pcFirstScreen(d: DetailSeed, images: string[], loaderHtml: string, search: string): string {
  const title = hasRefParam(search) ? '' : pcTitleHtml(d)
  const loaderBelow = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh') // 폰과 같은 높이(사진 아래 로더)
  return (
    firstScreenOpen() +
      crumbHtml(d.category) +
      `<div class="${DETAIL_PC_FS.grid}"><div class="${DETAIL_PC_FS.leftCol}">${pcGalleryHtml(images)}${title}</div>` +
      `<aside class="${DETAIL_PC_FS.aside}"></aside></div>` +
      buildDetailNoscript(d) +
    '</div>' + loaderBelow
  )
}
