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
  '/user/profile', '/my-vouchers', '/my-gifticons', '/my-orders',
  // 검색/찜(브라우징 그리드 — 전역 상단바 유지). ur-content-wide 중앙정렬.
  '/search', '/wishlist',
  /**
   * 🖥️ 2026-08-19 (대표 — "PC 친화적이지 않은 페이지들 확인해서 PC 버전의 페이지도 완벽히 구사해줘").
   *
   * 실측(1440px, 소비자 라우트 15개): **9개가 430px 모바일 액자**에 갇혀 있었다.
   * 특히 `/cart` 는 **PC 2단 코드(좌 목록 + 우 sticky 요약)를 이미 갖고 있었는데**, 액자 폭이
   * 430px 이라 `lg:grid` 가 발현될 자리가 없어 죽은 코드였다 — 만들어 놓고 못 쓰고 있었다.
   *
   * ⚠️ 등재 조건(이 파일 위 주석): 하단 고정바가 `app-frame-bar` 를 쓰면 pc-fullbleed 가 그 바를
   *   숨기므로 안 된다. 아래 경로는 전부 확인했다 —
   *   `/cart` 는 `app-frame-bar` 를 쓰지만 **`lg:hidden` 이 함께 붙어** PC 에선 우측 요약이 대신한다.
   *   `/notifications`·`/browse` 는 고정바 자체가 없다.
   *   (`/account/settings` 는 `/user/profile` 로 가는 리다이렉트 스텁이라 등재 대상이 아니다 —
   *    도착지가 이미 등재돼 있다. 넣어 봐야 아무 효과가 없고 목록만 헷갈린다.)
   *   `/referral` 은 `lg:hidden` 없는 `app-frame-bar` 를 써서 **일부러 제외**했다(CTA 가 사라진다).
   */
  '/cart', '/notifications', '/browse',
])

// 🖥️ 2026-07-16 (대표 — 상세 PC 2단): 상세 라우트(동적 :id)는 prefix 로 풀너비화 → 좌 이미지 + 우 정보 2단.
//   ⚠️ 여기 등재하려면 그 페이지의 하단 구매바가 `.app-frame-bar` 를 쓰지 않아야 함(pc-fullbleed 가 숨김).
//   교환권 상세(VoucherDetailPage)는 구매바가 app-frame-bar 미사용(ur-content-narrow lg:max-w) → 안전.
//   숙소 상세(StayDetailPage)는 2026-07-20 하단 묶음바에서 app-frame-bar 제거 + lg:hidden(아사이드 대체) → 안전.
const FULLBLEED_PC_PREFIXES = ['/vouchers/', '/group-buy/', '/stays/']

/** 이 경로는 lg+ 에서 풀너비(프레임/사이드바/거터 제외 + 하단네비 숨김). */
export function isFullBleedPcPath(pathname: string): boolean {
  return FULLBLEED_PC_PATHS.has(pathname) || FULLBLEED_PC_PREFIXES.some((p) => pathname.startsWith(p))
}

/** 풀너비지만 페이지 자체 상단 헤더를 쓰는 경로 → 전역 DesktopTopNav 숨김.
 *  🖥️ 2026-07-19 (대표 — "상단은 어느 페이지든 공통, /map 도"): 예외 전부 제거 — 전역 상단 네비
 *  (로고+검색+앱/판매+카테고리 바)가 PC(lg+) 전 소비자 페이지 공통. 지도(/map)도 여기어때식으로
 *  [전역 네비 위 + 지도 분할 아래]. lg 미만(모바일/태블릿)의 자체 헤더 유지는 DesktopTopNav 내부
 *  LEGACY_OWN_HEADER 게이트가 담당(이중 헤더 방지). */
const OWN_HEADER_PC_PATHS: string[] = []
export function hasOwnHeaderPc(pathname: string): boolean {
  return OWN_HEADER_PC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
