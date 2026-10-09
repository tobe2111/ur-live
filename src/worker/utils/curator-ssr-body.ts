/**
 * 🛍️ 유어샵(`/u/:handle`)의 **서버가 그리는 첫 화면** (2026-10-09 대표 *"모두 다 하자"*).
 *
 * ## 왜 — 공유 링크로 들어온 사람이 1초 동안 "누구의 가게인지" 를 못 본다
 * 라이브 실측(2026-10-08, iPhone UA): `/u/jiwon1228` 의 서버 HTML 은 **시드 2,639B** 를 이미
 * 담고 있다 — 이름·소개·SNS·핀 4개(사진 URL·가격·정가·매장명까지). 그런데 `#root` 는
 * 유달이 로더가 덮고 있어서, 가게가 다 도착한 뒤에도 사람은 로더만 봤다(실측 ~1초).
 * 유어샵은 **공유해서 퍼지는 것**이 존재 이유라, 그 1초가 가장 비싼 1초다.
 *
 * ## ⚠️ 이 화면은 ①`/vouchers/:id`·④홈과 **성질이 하나 달랐다** — 주인/방문자 폭
 * 이름 줄 오른쪽에 `[관리]` 버튼이 **주인에게만** 뜬다(c2 확정). 그래서 왼쪽 이름 칸이
 * 방문자 `222px` ↔ 주인 `140px`(390px·SNS 2 기준, 실측)로 갈리고, 이름이 그 사이 폭이면
 * `line-clamp-2` 가 1줄↔2줄로 갈려 헤더가 `126 ↔ 148px` 로 **22px** 어긋난다.
 * **서버는 누가 보는지 모른다** ⇒ 그 어긋남은 마운트 때 아래를 전부 밀어내는 밀림이다.
 *
 * 버린 길 둘: ⓐ **쿠키로 주인 판정** — 세션 쿠키가 있어도 `isOwner` 는 `localStorage.user_id`
 * 로 정해지므로(클라 전용) 쿠키는 그 질문에 답하지 못하고, HTML 을 사용자별로 가르게 된다.
 * ⓑ **이름 폭을 워커가 계산** — 글자 폭을 워커에서 추정하는 것은 이 레포가 반복해 당한
 * *두 벌이 갈리는* 클래스다. ⇒ 선택한 길: **부품이 그 자리를 항상 비워 둔다**
 * (`CuratorHeader` 의 `관리` 자리 예약 — 그 파일의 🪑 주석. 라이브 17곳 전부 변화 0).
 *
 * ## 무엇을 그리나 — **줄 4개까지**
 * React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 통째로 갈아엎는다. 서버가 그린 것과
 * 첫 렌더가 어긋나면 그 자리가 튄다 ⇒ 어긋날 수 없는 것만 그린다.
 *
 *   1. **브랜드 바** — `UrDealLogo` 는 글자(`urdeal`) + 점 하나라 워커가 그릴 수 있다
 *      (정적 로더가 이미 size 34 로 같은 것을 그린다 — 그 선례를 19 로 되풀이한다).
 *   2. **이름 줄** — 이름(h1) + 소개(bio). 오른쪽 버튼 자리는 **높이·폭만**:
 *      SNS·공유는 빈 `w-9 h-9`, 관리는 `invisible` 알약. 🔴 **아이콘 path 는 안 옮긴다**
 *      (lucide `Share2`·SNS SVG·`EditIcon` — 손으로 옮기면 두 벌이 갈린다). 아이콘은 그 빈
 *      칸 **안에서** 나중에 나타나므로 밀림 0 이다(2026-10-08 교환권 상세와 같은 처방).
 *   3. **칩·정렬 줄** — 라벨은 **안 그린다**(카테고리 라벨 표는 `voucher-types.ts` 에 있고 그
 *      파일은 `urdeal-icons` 를 import 한다 — 워커가 읽으면 번들이 터진다). 줄의 **높이만**
 *      `invisible` 칩 하나로 만든다. `empty:hidden` 때문에 빈 div 로는 자리가 접힌다.
 *   4. **진열 줄 4개** — `PinRow`→`DealRow` 의 마크업을 그대로. 사진 URL 은 `cfImage(…, {width:240})`
 *      로 **PinRow 와 같은 값**(하나만 달라도 마운트 때 다시 받는다). 할인율은 `priceDisplay`
 *      SSOT(선언값과 계산값의 `max` — 2026-09-29 에 화면마다 달랐던 것의 수습).
 *      순번 배지는 `curatorHomePins` SSOT 의 순서 — 그 숫자는 SNS 에서 부르는 **주소**다.
 *
 * ❌ **안 그리는 것**: 검색창(핀 12개 이상일 때만 — 자리 높이만 예약) · 빈 유어샵 화면
 *    (`EmptyUrShop`: 주인/방문자 문구가 갈린다) · 사업자 유어샵(`linked_seller` 가 있으면
 *    React 는 `SellerPublicPage` 를 그린다 — 레이아웃이 통째로 다르다) · 맨 아래 유입 링크
 *    (`!isOwner` 게이트) · 프로필 사진(`CuratorHeader` 가 ⑤에서 아바타를 지웠다 — 자리가 없다).
 * ❌ **PC(lg+)는 안 그린다** — UA 로 가른다. PC 는 `.ur-ushop-pc` 2열 그리드 + 전역
 *    `DesktopTopNav` 가 `#root` 안에 따로 서므로, 서버가 그 둘을 모른 채 그리면 마운트 때
 *    가로·세로가 같이 움직인다(④홈과 같은 판단).
 *
 * ## 이 파일이 **못** 하는 것
 * - 클래스가 갈렸는지는 문자열로 못 잰다 → `curator-ssr-first-screen-2026-10-09` 테스트가
 *   **진짜 `PinRow`·`CuratorHeader` 를 렌더해** 토큰까지 대조한다. 최종 판정은 프레임 캡처다.
 * - 번역이 ko 가 아니면 `관리` 알약의 폭이 달라져 서버와 어긋날 수 있다(워커엔 i18n 이 없다).
 *   그때 어긋나는 것은 이름이 그 폭 창에 들어오는 가게뿐이고, 라이브는 KR 전용이다.
 * - 워커는 사진을 preload 하지 않는다(홈·교환권 상세와 달리 `/u/` 엔 그 배선이 없다).
 *   첫 화면의 `<img>` 가 파서 시점에 바로 받기 시작하므로 **같은 문서 안에서** 당겨진다.
 */
import { cfImage } from '../../utils/cf-image'
import { priceDisplay } from '../../shared/price-display'
import { formatNumber } from '../../utils/format'
import { curatorHomePins } from '../../shared/curator-pin-order'

function escAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return escAttr(s).replace(/'/g, '&#39;')
}

/**
 * 🔒 아래는 **`CuratorPage.tsx`·`CuratorHeader.tsx`·`PinRow.tsx`·`DealRow.tsx` 의 className 과
 *    글자 하나까지 같아야 한다.** 갈리면 마운트 때 그 자리가 튄다 — 테스트가 소스를 읽어 대조한다.
 */
export const CURATOR_FS_CLASS = {
  root: 'min-h-[100dvh] bg-surface text-gray-900 dark:text-white pb-28',
  pcGrid: 'ur-ushop-pc',
  side: 'ur-ushop-side',
  main: 'ur-ushop-main',
  header: 'bg-surface',
  headerInner: 'max-w-3xl mx-auto',
  brandBar: 'lg:hidden flex items-center px-4 pt-3',
  brandLink: 'active:opacity-70',
  nameRow: 'flex items-start px-4 pt-4 pb-4',
  nameCol: 'min-w-0 flex-1',
  nameLine: 'flex items-start gap-2 min-w-0',
  h1: 'text-[17px] font-bold text-gray-900 dark:text-white leading-tight tracking-[-0.03em] line-clamp-2',
  bio: 'mt-1 text-[12px] text-gray-600 dark:text-gray-300 leading-snug line-clamp-2',
  cluster: 'ml-3 flex items-center gap-2 shrink-0',
  iconBtn: 'w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-wash active:opacity-70 transition-colors',
  manageBtn: 'h-9 px-3 rounded-full bg-brand text-white text-[15px] font-bold inline-flex items-center gap-1 shrink-0 active:opacity-70',
  searchWrap: 'max-w-3xl mx-auto px-4 pt-3 pb-1',
  searchBox: 'flex items-center gap-2 h-11 px-4 rounded-xl bg-wash',
  chipsRow: 'max-w-3xl mx-auto px-4 pt-2 border-b border-rule flex items-center gap-2 empty:hidden',
  chip: 'shrink-0 inline-flex items-center gap-1 h-9 px-3 -mb-px border-b-2 text-[15px] font-bold whitespace-nowrap active:opacity-60 transition-colors',
  sortSlot: 'ml-auto shrink-0',
  sortBtn: 'h-9 inline-flex items-center',
  rows: 'max-w-3xl mx-auto px-4 pb-4 divide-y divide-rule lg:divide-y-0 lg:grid lg:gap-2 ur-ushop-rows',
  row: 'w-full flex items-center gap-3 text-left px-1 py-3 active:opacity-60 transition-opacity',
  rowLeading: 'w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-gray-400 dark:text-gray-500',
  rowThumb: 'relative w-[76px] h-[76px] shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#222225]',
  rowThumbImg: 'w-full h-full object-cover',
  rowBody: 'flex-1 min-w-0',
  rowEyebrow: 'text-[12px] font-semibold leading-none mb-1 text-gray-400 dark:text-gray-500 truncate',
  rowTitle: 'text-[15px] leading-snug line-clamp-2 font-bold text-gray-900 dark:text-white',
  rowPriceLine: 'flex items-baseline gap-1 mt-1',
  rowDiscount: 'text-[15px] font-extrabold text-sale tracking-tight',
  rowPrice: 'text-[17px] font-extrabold text-gray-900 dark:text-white tracking-tight',
  rowUnit: 'text-[12px] font-bold text-gray-900 dark:text-white',
  rowStrike: 'text-[12px] ml-1 leading-none line-through text-gray-400 dark:text-gray-500',
} as const

/** `PinRow` 가 쓰는 값과 동일 — 하나만 달라도 브라우저가 사진을 두 번 받는다. */
export const CURATOR_THUMB_WIDTH = 240
/** 첫 화면에 그리는 줄 수. 390×844 에서 헤더(126) + 칩 줄(46) + 줄 4개(400) ≈ 572px. */
export const CURATOR_FS_ROWS = 4
/** `CuratorPage.tsx` 의 `SEARCH_MIN_PINS` 와 같아야 한다(검색창 자리 예약 조건). */
export const CURATOR_SEARCH_MIN_PINS = 12
/** 브랜드 바 로고 크기 — `CuratorHeader` 의 `<UrDealLogo size={19}/>`. */
export const CURATOR_LOGO_SIZE = 19

interface CuratorSeedPin {
  id?: number
  product_id?: number
  product_name?: string
  image_url?: string | null
  thumbnail?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  category?: string | null
  deal_only?: number | null
  deal_pct?: number | null
  dominant_color?: string | null
  restaurant_name?: string | null
}
interface CuratorSeed {
  success?: boolean
  curator?: {
    handle?: string
    name?: string
    bio?: string | null
    youtube_url?: string | null
    instagram_url?: string | null
    tiktok_url?: string | null
  }
  pins?: CuratorSeedPin[]
  linked_seller?: unknown
}

/** `UrDealLogo` 미러 — 글자 + 로즈 원 마침표. 값은 그 컴포넌트의 식 그대로. */
function logoHtml(size: number): string {
  const dot = Math.max(2, size * 0.18)
  return (
    '<span class="inline-flex items-baseline select-none text-[#16181C] dark:text-[#F8F7FC]"' +
    ` style="font-family:'Poppins','Pretendard Variable',system-ui,sans-serif;font-weight:800;font-size:${size}px;letter-spacing:-0.035em;line-height:1">` +
    'urdeal' +
    `<span class="bg-brand" style="display:inline-block;width:${dot}px;height:${dot}px;border-radius:50%;margin-left:${size * 0.08}px"></span>` +
    '</span>'
  )
}

/** 한 줄(= `PinRow` → `DealRow`). 사진이 없으면 빈 썸네일 칸만(부품과 같은 동작). */
function rowHtml(pin: CuratorSeedPin, handle: string, order: number): string {
  const img = (pin.thumbnail || pin.image_url || '').trim()
  const src = img ? cfImage(img, { width: CURATOR_THUMB_WIDTH, format: 'auto' }) || img : ''
  const pd = priceDisplay({ price: pin.price, original_price: pin.original_price, discount_rate: pin.discount_rate })
  const hasStrike = pin.original_price != null && pin.price != null && pd.showOriginal
  const unit = pin.deal_only === 1 ? '딜' : '원'
  const thumbStyle = pin.dominant_color ? ` style="background:${escAttr(pin.dominant_color)}"` : ''

  const priceLine = pin.price != null
    ? `<div class="${CURATOR_FS_CLASS.rowPriceLine}">` +
        (pd.discount > 0 ? `<span class="${CURATOR_FS_CLASS.rowDiscount}">${pd.discount}%</span>` : '') +
        `<span class="${CURATOR_FS_CLASS.rowPrice}">${escText(formatNumber(pin.price))}</span>` +
        `<span class="${CURATOR_FS_CLASS.rowUnit}">${unit}</span>` +
        (hasStrike
          ? `<span class="${CURATOR_FS_CLASS.rowStrike}">${escText(formatNumber(pin.original_price))}${unit}</span>`
          : '') +
      '</div>'
    : ''

  return (
    `<a href="/u/${escAttr(handle)}/p/${escAttr(String(pin.product_id ?? ''))}" class="${CURATOR_FS_CLASS.row}">` +
      `<span class="${CURATOR_FS_CLASS.rowLeading}">${order}</span>` +
      `<div class="${CURATOR_FS_CLASS.rowThumb}"${thumbStyle}>` +
        (src
          ? `<img src="${escAttr(src)}" alt="" width="${CURATOR_THUMB_WIDTH}" height="${CURATOR_THUMB_WIDTH}"` +
            ` loading="lazy" decoding="async" class="${CURATOR_FS_CLASS.rowThumbImg}">`
          : '') +
      '</div>' +
      `<div class="${CURATOR_FS_CLASS.rowBody}">` +
        (pin.restaurant_name ? `<p class="${CURATOR_FS_CLASS.rowEyebrow}">${escText(pin.restaurant_name)}</p>` : '') +
        `<p class="${CURATOR_FS_CLASS.rowTitle}">${escText(pin.product_name || '')}</p>` +
        priceLine +
      '</div>' +
    '</a>'
  )
}

/**
 * `#root` 에 넣을 첫 화면 HTML. 만들 수 없으면 `''` → 호출부가 기존 로더로 폴백(무회귀).
 *
 * @param ssrPayload `__SSR_INITIAL_CURATOR__` 원문
 * @param loaderHtml 기존 URDEAL 로더(첫 화면 **아래**에 붙는다 — 아직 오는 중이라는 정직한 신호)
 */
export function buildCuratorFirstScreen(ssrPayload: string, loaderHtml: string): string {
  try {
    const d = JSON.parse(ssrPayload) as CuratorSeed
    const c = d?.curator
    if (!d?.success || !c?.handle || !c?.name) return ''
    // 사업자 유어샵은 React 가 `SellerPublicPage` 를 그린다 — 레이아웃이 통째로 다르다.
    if (d.linked_seller) return ''
    const pins = Array.isArray(d.pins) ? d.pins : []
    // 빈 유어샵은 `EmptyUrShop`(주인/방문자 문구가 갈린다) → 그리지 않는다.
    if (pins.length === 0) return ''

    const snsCount =
      (c.youtube_url ? 1 : 0) + (c.instagram_url ? 1 : 0) + (c.tiktok_url ? 1 : 0)
    // SNS + 공유 = 빈 원 / 관리 = invisible 알약. 아이콘 path 는 옮기지 않는다(머리말 참조).
    const iconSlots = `<span class="${CURATOR_FS_CLASS.iconBtn}"></span>`.repeat(snsCount + 1)
    const cluster =
      `<div class="${CURATOR_FS_CLASS.cluster}">${iconSlots}` +
      `<span class="${CURATOR_FS_CLASS.manageBtn} invisible pointer-events-none">` +
        `<span style="display:inline-block;width:17px;height:17px"></span>관리` +
      '</span></div>'

    const header =
      `<header class="${CURATOR_FS_CLASS.header}"><div class="${CURATOR_FS_CLASS.headerInner}">` +
        `<div class="${CURATOR_FS_CLASS.brandBar}">`+
          // 🩸 `<a>` 를 빼면 **바가 5px 낮아진다**(실측 36 → 31). 로고 span 은 `inline-flex` 라
          //   직접 flex 아이템이 되면 19px 이지만, React 는 `<Link>` 로 감싸고 그 인라인 요소의
          //   줄박스가 24px 다. 감싸는 것 자체가 치수를 만든다.
          `<a href="/" aria-label="유어딜 홈" class="${CURATOR_FS_CLASS.brandLink}">${logoHtml(CURATOR_LOGO_SIZE)}</a>` +
        '</div>' +
        `<div class="${CURATOR_FS_CLASS.nameRow}">` +
          `<div class="${CURATOR_FS_CLASS.nameCol}">` +
            `<div class="${CURATOR_FS_CLASS.nameLine}"><h1 class="${CURATOR_FS_CLASS.h1}">${escText(c.name)}</h1></div>` +
            (c.bio ? `<p class="${CURATOR_FS_CLASS.bio}">${escText(c.bio)}</p>` : '') +
          '</div>' +
          cluster +
        '</div>' +
      '</div></header>'

    // 검색창은 핀 12개 이상일 때만 뜬다 — 자리 **높이만** 예약(입력칸 내용은 안 그린다).
    const search = pins.length >= CURATOR_SEARCH_MIN_PINS
      ? `<div class="${CURATOR_FS_CLASS.searchWrap}"><div class="${CURATOR_FS_CLASS.searchBox}"></div></div>`
      : ''

    // 칩·정렬 줄 — `empty:hidden` 이라 빈 div 로는 접힌다 ⇒ invisible 칩 하나로 높이를 만든다.
    // 🩸 칩만 넣으면 줄이 **1px 낮다**(실측 44 vs 45). 칩은 `-mb-px` 로 1px 올라앉고, 줄의 높이를
    //   정하는 것은 그 옆 **정렬 버튼 칸**(`ml-auto shrink-0`, 음수 마진 없음 → 36px)이다. 둘 다 예약한다.
    const chips =
      `<div class="${CURATOR_FS_CLASS.chipsRow}">` +
        `<span class="${CURATOR_FS_CLASS.chip} invisible">&nbsp;</span>` +
        `<div class="${CURATOR_FS_CLASS.sortSlot}"><span class="${CURATOR_FS_CLASS.sortBtn} invisible">&nbsp;</span></div>` +
      '</div>'

    const ordered = curatorHomePins(pins)
    const rows = ordered
      .slice(0, CURATOR_FS_ROWS)
      .map((p, i) => rowHtml(p, c.handle!, i + 1))
      .join('')

    // 로더는 첫 화면 **아래**로 — `min-height:100dvh` 그대로면 문서가 화면보다 길어진다.
    const shortLoader = loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')

    // 🧷 `id="ur-first-screen"` — 클라(`lib/boot-first-screen.ts`)가 이 **노드 자체**를 들고 있다가
    //   Suspense 폴백에 도로 붙인다. 그 장치는 경로를 안 가리므로 id 만 같으면 그대로 적용된다.
    return (
      `<div id="ur-first-screen" class="${CURATOR_FS_CLASS.root}">` +
        `<div class="${CURATOR_FS_CLASS.pcGrid}">` +
          `<div class="${CURATOR_FS_CLASS.side}">${header}</div>` +
          `<div class="${CURATOR_FS_CLASS.main}">${search}${chips}` +
            `<div class="${CURATOR_FS_CLASS.rows}">${rows}</div>` +
          '</div>' +
        '</div>' +
      '</div>' + shortLoader
    )
  } catch {
    return '' // seed 파싱 실패 — 로더로 폴백(치명 아님)
  }
}
