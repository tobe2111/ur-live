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
import { SEARCH_CLS, SEARCH_COPY, SEARCH_LENS, SEARCH_HERO_MASCOT, RECENT_SEARCHES_KEY, SEARCH_QUERY_MAX } from '../../shared/search-page'
import { UDAL_HELLO_SRC, UDAL_HELLO_ART } from '../../shared/mascot-art'
import { PC_HOME_FS } from '../../shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from './guest-first-screen'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

/** `?q=` — 화면(`useSearchParams().get('q')`)과 같은 값. 제어문자는 뺀다, 길이는 제안 API 와 같은 상한. */
export function searchQueryOf(search: string): string {
  try {
    const q = new URLSearchParams(search).get('q') || ''
    return q.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, SEARCH_QUERY_MAX)
  } catch { return '' }
}

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

/**
 * @param isMobile 폰·크롤러면 화면 그대로. PC 면 [네비 높이 예약 + 430 액자](게스트 탭과 같은 상수).
 */
export function buildSearchFirstScreen(query: string, loaderHtml: string, nonce: string, isMobile = true): string {
  const body = query
    ? `<div class="${SEARCH_CLS.content}"></div>`
    : `<div class="${SEARCH_CLS.content}"><div class="${SEARCH_CLS.states}">${hero()}</div></div>`
  const page = `<div class="${SEARCH_CLS.root}">${header(query)}${body}</div>`
  const topnav = isMobile ? '' : `<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`
  const framed = isMobile ? page : `<div class="${GUEST_PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${GUEST_PC_FRAME.width}">${page}</div>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다.
  return `<div id="ur-first-screen">${topnav}${framed}</div>${query ? '' : searchFirstScreenGuardScript(nonce)}${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
