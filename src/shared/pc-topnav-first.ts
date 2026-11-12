/**
 * 🖥️ PC 상단 네비 서버 첫 화면 클래스 — `pc-home-first-screen` 에서 **따로 뗐다**: 상품 상세 첫 화면(`detail-ssr-body`)이
 *   그 파일을 import 하므로 여기 두면 상세 표면 critical CSS 가 이 클래스들까지 끌고 와 상한(40KB)을 넘는다(2026-11-12 빌드 실측 40,738B).
 */
/**
 * 🖥️ 2026-11-12 대표 PC 캡처의 **빈 맨 위 줄** — 서버가 상단 네비(로고 · 검색창 · 둘째 줄 메뉴 글자)를 그린다.
 *   `DesktopTopNav`(isHome) 와 **글자 그대로** 같은 클래스(시험이 소스를 대조). 아이콘은 같은 크기의 빈 칸으로 자리만 잡는다
 *   — 앱이 켜지면 헤더가 통째로 바뀌는데, 글자 위치가 같아야 그 순간 옆으로 튀지 않는다.
 */
export const PC_TOPNAV_CLS = {
  row1: 'flex items-center gap-3 h-[68px] max-w-[1440px] mx-auto w-full px-5 lg:px-8',
  logoLink: 'flex items-center shrink-0',
  searchForm: 'flex-1 max-w-lg xl:max-w-2xl',
  searchIcon: 'absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none',
  searchInput: 'w-full h-[46px] pl-11 pr-[52px] text-[15px] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-full border-2 border-brand dark:border-brand/70 outline-none focus:ring-2 focus:ring-brand/25',
  searchBtn: 'absolute right-[5px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-colors',
  right: 'flex items-center gap-1 shrink-0 ml-auto',
  row2Wrap: 'max-w-[1440px] mx-auto w-full px-5 lg:px-8 flex items-center gap-3',
  row2Inner: 'relative flex-1 min-w-0',
  row2Nav: 'h-11 flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth',
  itemBase: 'relative shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
  itemOn: 'text-gray-900 dark:text-white',
  itemOff: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]',
  dot: 'absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand',
  sep: 'shrink-0 w-px h-4 mx-2 bg-gray-200 dark:bg-[#2C2F35]',
} as const
/** 둘째 줄 서비스 축 — `DesktopTopNav` 의 categoryItems 와 같은 순서·라벨(쇼핑 탭은 숨김 상태). */
export const PC_TOPNAV_SERVICES = [
  { label: '홈', path: '/' }, { label: '교환권', path: '/vouchers' }, { label: '동네딜', path: '/map' },
  { label: '유어샵', path: '/u/me' }, { label: '블로그', path: '/blog' },
] as const
export const PC_TOPNAV_SEARCH_PLACEHOLDER = '동네딜, 교환권, 상품 검색'
