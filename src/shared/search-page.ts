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
