/**
 * 🔎 검색 화면(`/search`)의 **클래스·문구 SSOT** (2026-11-10 — 라이브 폰 첫 그림 2.25s · HTML 은 0.3~0.5s).
 *
 * 워커(`worker/utils/search-first-screen.ts`)가 같은 화면의 위쪽(헤더 + 빈 검색 안내)을 서버 첫 화면으로 그린다.
 * 클래스를 두 벌로 두면 하나만 고치는 날 서버 화면과 앱 화면이 갈려 마운트 때 모양이 바뀐다(에러 0) — 그래서
 * `SearchHeader` · `SearchStates` · `SearchPage` 와 워커가 **이 파일 하나**를 읽는다. 문구는 `t(key, { defaultValue })` 로 쓴다.
 */
export const SEARCH_CLS = {
  /** `SearchPage` 뿌리 — 100dvh(룰 #8 · 인앱 하단 네비 실종 방지). */
  root: 'bg-white dark:bg-[#11141C] pb-safe-nav md:pb-20 min-h-[100dvh]',
  /** `SearchHeader` — 폰은 상단 고정, md+ 는 흐름(전역 네비와 겹치지 않게 · 2026-09-15). */
  header: 'sticky top-0 md:static z-50 bg-white dark:bg-[#11141C]',
  headerRow: 'flex items-center gap-2 px-3 py-2',
  iconBtn: 'shrink-0 p-1',
  backIcon: 'w-6 h-6 text-gray-900 dark:text-white',
  field: 'flex-1 relative',
  form: 'relative',
  /** 돋보기/닫기 버튼 — 쉬는 상태(`lensIdle`)와 쓰는 상태(`lensOn`, 모션 표식)가 뒤에 붙는다. */
  lensBtn: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 dark:text-gray-500',
  lensIdle: 'pointer-events-none',
  lensOn: 'ur-sm-on',
  lensSvg: 'w-4 h-4',
  inputBase: 'w-full pl-10 pr-9 py-2 bg-gray-50 dark:bg-[#1D1F29] rounded-full text-[15px] text-gray-900 dark:text-white font-medium transition-all focus:outline-none',
  inputIdle: 'border-2 border-transparent',
  inputFocus: 'border-2 border-gray-900 bg-white dark:bg-[#11141C]',
  bagIcon: 'w-5 h-5 text-gray-900 dark:text-white',
  /** 본문 칸(`SearchPage`) · 상태 칸(`SearchStates` 빈 검색) · 안내 머리. */
  content: 'ur-content-wide px-5 lg:px-8 py-4',
  states: 'py-6',
  hero: 'flex flex-col items-center justify-center py-12 mb-5',
  heroTitle: 'text-[15px] font-medium text-gray-900 dark:text-white mb-1',
  heroSub: 'text-[13px] text-gray-500 dark:text-gray-400',
  heroMascot: 'mb-3',
} as const

export const SEARCH_COPY = {
  placeholder: '상품명, 브랜드, 셀러 검색',
  closeTyping: '검색 닫기',
  heroTitle: '검색어를 입력해주세요',
  heroSub: '상품명 또는 판매자명으로 검색할 수 있습니다',
} as const

/** 🎬 돋보기 ↔ 닫기 화살표(같은 그림이 이어서 바뀐다) — 서버와 앱이 같은 path 를 그린다. */
export const SEARCH_LENS = {
  lens: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M15.3 15.3L20 20',
  arrow: 'M19 12H5M11 6l-6 6l6 6',
} as const

/** 빈 검색 안내의 유달이 — `Udal mood="hello" size={96}`(원본 332×487). */
export const SEARCH_HERO_MASCOT = { width: 96 } as const

/** 최근 검색어 저장 키(`SearchStates`) — 서버 첫 화면 가드가 같은 키를 읽어 안내 그림을 걷어낸다. */
export const RECENT_SEARCHES_KEY = 'recent_searches_v1'

/** 검색어 상한 — 서버 첫 화면이 입력창에 되돌려 그릴 때(제안 API 와 같은 200). */
export const SEARCH_QUERY_MAX = 200

/** `?q=` — 화면(`useSearchParams().get('q')`)과 같은 값. 제어문자는 뺀다, 길이는 제안 API 와 같은 상한. (서버 첫 화면·시드가 같이 쓴다) */
export function searchQueryOf(search: string): string {
  try {
    const q = new URLSearchParams(search).get('q') || ''
    return q.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, SEARCH_QUERY_MAX)
  } catch { return '' }
}

/**
 * 🌱 검색 결과 시드 (2026-11-10 — 라이브 폰 `/search?q=돈가스` LCP **3.7s**: 결과 목록이 앱 부팅 뒤 한 왕복(한국→LA) 더 기다렸다).
 *   워커가 HTML 에 첫 장(50개)을 `__SSR_INITIAL_SEARCH__` 로 싣고, `useSearchInfinite` 가 같은 검색어·범위면 그걸 첫 장으로 쓴다.
 *   경로는 훅의 요청과 **글자 하나 다르지 않아야** 한다(엣지 사본·직전 사본 키가 그 문자열이다).
 */
export const SEARCH_PAGE_SIZE = 50
export const SEARCH_SEED_ID = '__SSR_INITIAL_SEARCH__'
/** 시드를 기다리는 상한(ms) — 차가운 검색어는 D1 FTS 가 수백 ms 라 HTML 을 붙잡지 않게 자른다(늦으면 종전대로 앱이 받는다). */
export const SEARCH_SEED_DEADLINE_MS = 700
export type SearchScope = 'voucher' | 'exchange'

/** `?scope=exchange` 만 교환권, 그 외 전부 이용권 — `SearchPage` 의 판정과 같다. */
export function searchScopeOf(search: string): SearchScope {
  try { return new URLSearchParams(search).get('scope') === 'exchange' ? 'exchange' : 'voucher' } catch { return 'voucher' }
}

/** 훅(`useSearchInfinite`)의 첫 장 요청 경로. 검색어가 2자 미만이면 ''(시드 없음 — 훅도 `enabled: false`). */
export function searchSeedPath(search: string): string {
  const q = searchQueryOf(search)
  if (q.length < 2) return ''
  const params = new URLSearchParams({ q, page: '1', limit: String(SEARCH_PAGE_SIZE), scope: searchScopeOf(search) })
  return `/api/search?${params.toString()}`
}

/** 시드 `<script>` 의 표식 — 읽는 쪽이 검색어·범위가 같은지 대조한다(다른 검색어의 시드를 첫 장으로 쓰면 거짓 결과). */
export function searchSeedAttrs(search: string): string {
  const q = searchQueryOf(search).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return ` data-q="${q}" data-scope="${searchScopeOf(search)}"`
}

/** 브라우저에서 한 번 읽는다 — 같은 검색어·범위일 때만, 읽은 뒤 지운다(SPA 로 다른 검색어로 옮겨도 다시 안 쓴다). */
export function readSearchSeed<T = unknown>(q: string, scope: SearchScope): T | null {
  try {
    if (typeof document === 'undefined') return null
    const el = document.getElementById(SEARCH_SEED_ID)
    if (!el) return null
    const ok = el.getAttribute('data-q') === q && el.getAttribute('data-scope') === scope
    el.remove()
    if (!ok || !el.textContent) return null
    const parsed = JSON.parse(el.textContent)
    return parsed && Array.isArray(parsed.data) ? (parsed as T) : null
  } catch { return null }
}

/**
 * 🔎 검색 **결과 구역**(개수·정렬 줄 + 결과 목록)의 클래스·문구·움직임 SSOT (2026-11-10).
 *   라이브 실측: 시드(#2293)·썸네일 preload(#2296) 뒤에도 결과 LCP 2.8~3.7s — 사진이 0.6s 에 와 있어도 **줄이 앱 마운트 뒤에** 그려졌다.
 *   ⇒ 워커가 시드의 앞 줄을 그린다(`worker/utils/search-first-screen.ts`). 화면(`SortFilterBar`·`SearchPage`)과 이 상수 하나를 읽는다.
 *   움직임(줄이 아래에서 올라온다 — 승인된 모션)은 서버가 그린 줄에서 **한 번** 돌고, 앱은 그 첫 목록을 다시 움직이지 않는다(`SearchPage`).
 */
export const SR_CLS = {
  bar: 'mb-5',
  barRow: 'flex items-center justify-between',
  countWrap: 'flex items-center gap-1',
  countText: 'text-[13px] text-gray-600 dark:text-gray-300',
  countNum: 'text-[13px] font-medium text-gray-900 dark:text-white',
  sortWrap: 'relative',
  sortBtn: 'appearance-none pr-6 pl-3 py-2 text-[12px] font-medium text-gray-900 dark:text-white bg-transparent focus:outline-none cursor-pointer',
  /** `components/ui/select.tsx` 가 버튼에 덧붙이는 꼬리·글자칸·화살표 — 시험이 그 소스와 대조한다. */
  sortBtnTail: 'inline-flex items-center justify-between gap-2 text-left',
  sortLabel: 'min-w-0 truncate ',
  sortChevron: 'w-4 h-4 shrink-0 opacity-60',
  list: 'flex flex-col divide-y divide-rule',
  listMotion: 'ur-sr-list',
} as const
export const SR_COPY = { prefix: '총', suffix: '개', sortRelevance: '관련도순' } as const
/** 서버가 그리는 줄 수 — 폰 한 화면(약 5줄) + 여유. 나머지는 앱이 마운트 때 잇는다(아래로만 자란다). */
export const SR_SERVER_ROWS = 8
/** 결과 줄 등장 움직임 — 앞 8줄이 40ms 간격으로 올라온다. 화면이 꽂던 CSS 의 그 부분 그대로. */
export const SR_LIST_MOTION_CSS = '@keyframes ur-sr-in { from { opacity: 0; transform: translateY(10px); } }.ur-sr-list > *:nth-child(-n+8) { animation: ur-sr-in .35s cubic-bezier(.2,.9,.3,1) backwards; }.ur-sr-list > *:nth-child(2) { animation-delay: 40ms; }.ur-sr-list > *:nth-child(3) { animation-delay: 80ms; }.ur-sr-list > *:nth-child(4) { animation-delay: 120ms; }.ur-sr-list > *:nth-child(5) { animation-delay: 160ms; }.ur-sr-list > *:nth-child(6) { animation-delay: 200ms; }.ur-sr-list > *:nth-child(7) { animation-delay: 240ms; }.ur-sr-list > *:nth-child(8) { animation-delay: 280ms; }'
export const SR_LIST_MOTION_REDUCE_CSS = '@media (prefers-reduced-motion: reduce){.ur-sr-list > *{animation:none!important}}'
/** 가격 필터 기본 범위(`SearchPage` 의 priceRange 초기값) — 서버가 같은 줄을 고르려면 같은 범위여야 한다. */
export const SR_PRICE_RANGE = { min: 0, max: 1000000 } as const
/** 서버가 결과 줄을 그렸다는 표식 — 앱이 이걸 보고 첫 목록의 등장 움직임을 생략한다. */
export const SR_SERVER_ROWS_ATTR = 'data-sr-rows'
