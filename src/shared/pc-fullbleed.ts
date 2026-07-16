/**
 * 🖥️ 2026-07-16 (대표 시안 — 당근 스타일 PC): 소비자 페이지 중 lg+(≥1024)에서 430 액자(프레임)를
 *   벗고 풀너비로 렌더할 경로 집합. 여기 등재된 경로는:
 *   - 프레임(app-framed)/앱 사이드바(DesktopLiveSidebar)/거터 레일 제외 → 풀너비
 *   - 하단 모바일 네비(BottomNav)를 lg+ 에서 숨김(index.css `body.pc-fullbleed`)
 *   모바일/태블릿(<lg)은 프레임 CSS 자체가 lg+ 전용이라 영향 0(기존 레이아웃 그대로).
 *
 * 상단 네비 처리 차이:
 *   - `/` (홈): 전역 DesktopTopNav 를 콘텐츠 폭 모드로 표시(자체 헤더 없음 — PcHomePage).
 *   - `/vouchers` (교환권): 페이지 자체 헤더(교환권 타이틀/검색/잔액/카테고리)를 그대로 쓰므로
 *     전역 DesktopTopNav 는 숨김(중복 방지) → `OWN_HEADER_PC_PATHS`.
 */
const FULLBLEED_PC_PATHS = new Set<string>([
  '/', '/vouchers', '/stays',
  // 🗺️ 2026-07-16 (대표 — 지도뷰 PC 분할, 여기어때식): /map 은 lg+ 에서 풀너비 좌 리스트 + 우 지도 분할.
  //   자체 상단바(MapTopBar 검색/카테고리)를 쓰므로 own-header. 모바일(<lg)은 기존 풀스크린 지도 그대로.
  '/map',
  // 마이/계정(자체 서브헤더 + 전역 상단바 유지 — own-header 아님). ur-content-medium/narrow 중앙정렬.
  '/user/profile', '/my-vouchers', '/my-orders',
  // 검색/찜(브라우징 그리드 — 전역 상단바 유지). ur-content-wide 중앙정렬.
  '/search', '/wishlist',
])

/** 이 경로는 lg+ 에서 풀너비(프레임/사이드바/거터 제외 + 하단네비 숨김). */
export function isFullBleedPcPath(pathname: string): boolean {
  return FULLBLEED_PC_PATHS.has(pathname)
}

/** 풀너비지만 페이지 자체 상단 헤더를 쓰는 경로 → 전역 DesktopTopNav 숨김. */
const OWN_HEADER_PC_PATHS = ['/vouchers', '/stays', '/map']
export function hasOwnHeaderPc(pathname: string): boolean {
  return OWN_HEADER_PC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
