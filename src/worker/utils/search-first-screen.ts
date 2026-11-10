/**
 * 🔎 검색 화면(`/search`) 서버 첫 화면 (2026-11-10).
 *
 * 라이브 실측(폰 4G · CPU 4배): HTML 0.3~0.5s 에 다 왔는데 **첫 그림 2.25s** — 헤더(뒤로 · 검색창 · 가방)와 빈 검색 안내
 * (유달이 · 두 줄 문구)는 전부 고정 모양인데 앱 코드가 다 와야 그려졌다. 홈 머리의 돋보기를 누르면 바로 보는 화면이다.
 *
 * 그리는 것: [헤더(검색어가 있으면 입력창에 되돌려 넣는다)] + [검색어 없음: 유달이 + 안내 두 줄] + 그 아래 로더.
 *   검색어가 있으면 헤더만 그리고 결과 자리는 로더다(결과는 API 가 와야 안다 — 여기서 self-fetch 를 더하지 않는다: 새 캐시 키 0).
 * 그리지 않는 것: 최근 검색어(기기 저장값 — 바로 뒤 스크립트가 **있으면 안내 그림을 걷어낸다**, React 가 그 자리에 칩을 그린다) ·
 *   인기 검색어(API) · 아이콘 그림(뒤로·가방은 같은 크기의 빈 칸 — 두 벌 금지; 돋보기만 공유 path 로 그린다).
 *
 * 🖥️ PC: `MobileAppLayout` 이 이 화면을 430 액자로 감싼다(`/search` 는 풀폭 목록에 없다) → 게스트 탭과 같은 [네비 높이 예약 + 액자].
 */
import { SEARCH_CLS, SEARCH_COPY, SEARCH_LENS, SEARCH_HERO_MASCOT, RECENT_SEARCHES_KEY, searchQueryOf, SR_CLS, SR_COPY, SR_SERVER_ROWS, SR_LIST_MOTION_CSS, SR_LIST_MOTION_REDUCE_CSS, SR_PRICE_RANGE, SR_SERVER_ROWS_ATTR, type SearchScope } from '../../shared/search-page'
import { ROW_CLS, ROW_THUMB_OPTS, ROW_NO_ADDRESS, ROW_PIN } from '../../shared/row-thumb'
import { priceDisplay } from '../../shared/price-display'
import { stripStorePrefix } from '../../utils/deal-title'
import { cfImage } from '../../utils/cf-image'
import { searchRowVisible } from './search-thumb-preload'
import { UDAL_HELLO_SRC, UDAL_HELLO_ART } from '../../shared/mascot-art'
import { PC_HOME_FS } from '../../shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from './guest-first-screen'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

export { searchQueryOf } // 2026-11-10 shared/search-page.ts 로 옮겼다(시드 경로도 같은 함수) — 워커·가드가 여기서도 읽는다

/** 헤더 — `SearchHeader` 쉬는 상태(포커스 전 · 제안 닫힘)와 같은 모양. 검색어가 있으면 `value` 로 되돌린다. */
function header(query: string): string {
  const lens = `<svg viewBox="0 0 24 24" class="${SEARCH_CLS.lensSvg}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="ur-sm-lens" d="${SEARCH_LENS.lens}"></path><path class="ur-sm-arrow" d="${SEARCH_LENS.arrow}"></path></svg>`
  return `<div class="${SEARCH_CLS.header}"><div class="${SEARCH_CLS.headerRow}">` +
    `<span class="${SEARCH_CLS.iconBtn}" aria-hidden="true"><span class="${SEARCH_CLS.backIcon} block"></span></span>` +
    `<div class="${SEARCH_CLS.field}"><div class="${SEARCH_CLS.form}">` +
    `<span class="${SEARCH_CLS.lensBtn} ${SEARCH_CLS.lensIdle}" aria-hidden="true">${lens}</span>` +
    `<input type="text" readonly value="${escAttr(query)}" placeholder="${escAttr(SEARCH_COPY.placeholder)}" class="${SEARCH_CLS.inputBase} ${SEARCH_CLS.inputIdle}">` +
    `</div></div>` +
    `<span class="${SEARCH_CLS.iconBtn}" aria-hidden="true"><span class="${SEARCH_CLS.bagIcon} block"></span></span>` +
    `</div></div>`
}

/** 빈 검색 안내 — `SearchStates` 의 '검색어를 입력해주세요'(최근 검색어가 없을 때) 와 같은 모양. `Udal` 과 같은 `<img>`. */
function hero(): string {
  const w = SEARCH_HERO_MASCOT.width
  const h = Math.round((w * UDAL_HELLO_ART.h) / UDAL_HELLO_ART.w)
  const img = `<img src="${UDAL_HELLO_SRC}" alt="" aria-hidden="true" draggable="false" width="${w}" height="${h}" loading="eager" fetchpriority="high" decoding="async" data-udal="hello" class="select-none pointer-events-none ${SEARCH_CLS.heroMascot}" style="width:${w}px;height:auto">`
  return `<div class="${SEARCH_CLS.hero}" data-search-hero="">${img}<p class="${SEARCH_CLS.heroTitle}">${esc(SEARCH_COPY.heroTitle)}</p><p class="${SEARCH_CLS.heroSub}">${esc(SEARCH_COPY.heroSub)}</p></div>`
}

/** 최근 검색어가 기기에 있으면 안내 그림을 걷어낸다 — 그 사람은 마운트 때 그 자리에 최근 검색어 칩을 본다(`SearchStates`). */
export function searchFirstScreenGuardScript(nonce: string): string {
  const js = `(function(){try{var r=JSON.parse(localStorage.getItem('${RECENT_SEARCHES_KEY}')||'[]');if(Array.isArray(r)&&r.length){var n=document.querySelector('#ur-first-screen [data-search-hero]');if(n)n.remove()}}catch(e){}})()`
  return `<script nonce="${escAttr(nonce)}">${js}</script>`
}

type SeedRow = { id: number; name?: string | null; restaurant_name?: string | null; restaurant_address?: string | null; price: number; original_price?: number | null; discount_rate?: number | null; image_url?: string | null; deal_only?: number | string | null; category?: string | null }
const won = (n: number) => `${(Number(n) || 0).toLocaleString('ko-KR')}원`

/** 결과 한 줄 — `RestaurantRow`(검색: 거리 없음 · 선택 없음 · 선착순 없음)와 같은 모양. 누를 수 없는 그림이라 `<div>` 다(마운트 때 버튼이 그 자리에 온다). */
function row(p: SeedRow, eager: boolean): string {
  const { discount } = priceDisplay(p)
  const src = p.image_url ? (cfImage(p.image_url, ROW_THUMB_OPTS) || p.image_url) : ''
  const thumb = src
    ? `<img src="${escAttr(src)}" alt="" class="${ROW_CLS.thumb}" loading="${eager ? 'eager' : 'lazy'}">`
    : `<div class="${ROW_CLS.thumbEmpty}"></div>`
  const pin = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="24" height="24" class="${ROW_CLS.pin}"><path d="${ROW_PIN.path}" fill="none"></path><circle cx="${ROW_PIN.cx}" cy="${ROW_PIN.cy}" r="${ROW_PIN.r}" stroke="currentColor"></circle></svg>`
  const original = Number(p.original_price) > Number(p.price) ? `<span class="${ROW_CLS.original}">${won(Number(p.original_price))}</span>` : ''
  return `<div class="${ROW_CLS.btn} ${ROW_CLS.btnIdle}">${thumb}<div class="${ROW_CLS.body}">` +
    `<p class="${ROW_CLS.title}">${esc(stripStorePrefix(p.name, p.restaurant_name))}</p>` +
    `<p class="${ROW_CLS.store}">${esc(p.restaurant_name || '')}</p>` +
    `<p class="${ROW_CLS.addr}">${pin}${esc(p.restaurant_address || ROW_NO_ADDRESS)}</p>` +
    `<div class="${ROW_CLS.priceRow}">${discount > 0 ? `<span class="${ROW_CLS.discount}">${discount}%</span>` : ''}<span class="${ROW_CLS.price}">${won(p.price)}</span>${original}</div>` +
    `</div></div>`
}

/**
 * 결과 구역 — [총 N개 · 관련도순] + 앞 `SR_SERVER_ROWS` 줄. 시드가 없거나(마감 초과) 보일 줄이 0이면 '' (그땐 종전대로 로더).
 * 고르는 줄은 `SearchPage` 의 첫 렌더와 같다: 범위 필터(`searchRowVisible`) + 가격 기본 범위, 정렬은 관련도(응답 순서).
 */
export function searchResultsHtml(ssrPayload: string | null | undefined, scope: SearchScope): string {
  try {
    if (!ssrPayload) return ''
    const parsed = JSON.parse(ssrPayload) as { data?: SeedRow[] }
    if (!Array.isArray(parsed?.data)) return ''
    const rows = parsed.data.filter((p) => { const price = priceDisplay(p).price; return price >= SR_PRICE_RANGE.min && price <= SR_PRICE_RANGE.max && searchRowVisible(p, scope) })
    if (rows.length === 0) return ''
    const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="${SR_CLS.sortChevron}" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>`
    const bar = `<div class="${SR_CLS.bar}"><div class="${SR_CLS.barRow}"><div class="${SR_CLS.countWrap}">` +
      `<span class="${SR_CLS.countText}">${SR_COPY.prefix}</span><span class="${SR_CLS.countNum}">${rows.length}</span><span class="${SR_CLS.countText}">${SR_COPY.suffix}</span></div>` +
      `<div class="${SR_CLS.sortWrap}"><span class="${SR_CLS.sortBtn} ${SR_CLS.sortBtnTail}"><span class="${SR_CLS.sortLabel}">${SR_COPY.sortRelevance}</span>${chevron}</span></div></div></div>`
    const list = `<div class="${SR_CLS.list} ${SR_CLS.listMotion}" ${SR_SERVER_ROWS_ATTR}="">${rows.slice(0, SR_SERVER_ROWS).map((p, i) => row(p, i < 4)).join('')}</div>`
    return `<style>${SR_LIST_MOTION_CSS}${SR_LIST_MOTION_REDUCE_CSS}</style>${bar}${list}`
  } catch { return '' }
}

/**
 * @param isMobile 폰·크롤러면 화면 그대로. PC 면 [네비 높이 예약 + 430 액자](게스트 탭과 같은 상수).
 */
export function buildSearchFirstScreen(query: string, loaderHtml: string, nonce: string, isMobile = true, resultsHtml = ''): string {
  const body = query
    ? `<div class="${SEARCH_CLS.content}">${resultsHtml}</div>`
    : `<div class="${SEARCH_CLS.content}"><div class="${SEARCH_CLS.states}">${hero()}</div></div>`
  const page = `<div class="${SEARCH_CLS.root}">${header(query)}${body}</div>`
  const topnav = isMobile ? '' : `<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`
  const framed = isMobile ? page : `<div class="${GUEST_PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${GUEST_PC_FRAME.width}">${page}</div>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen">${topnav}${framed}</div>${query ? '' : searchFirstScreenGuardScript(nonce)}${query && resultsHtml ? '' : loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
