import { ReactNode, lazy, Suspense, CSSProperties, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopLiveSidebar from './DesktopLiveSidebar'
import { useTheme } from '@/shared/stores/useTheme'

const DesktopLiveLeftPanel = lazy(() => import('./DesktopLiveLeftPanel'))
const DesktopLiveRightPanel = lazy(() => import('./DesktopLiveRightPanel'))
const LinkshopMobileQR = lazy(() => import('./LinkshopMobileQR'))

interface MobileAppLayoutProps {
  children: ReactNode
}

/**
 * MobileAppLayout
 * 📐 2026-05-02: PC 풀 너비 활성화 (옵션 B).
 * 📐 2026-05-03: 사이드바 패턴 전체 페이지 확장 — `/live` 디자인을 모든 PC 페이지로 확장.
 * 📐 2026-06-16: PC 컨슈머 프레임 (docs/design 미관 결정) — 모바일 완성도를 PC 로 그대로.
 *   - app-framed 페이지: PC(lg+) 에서 가운데 430px 프레임 + 배경 (모바일 디자인 그대로 액자화)
 *   - data-mobile-only (라이브/쇼츠 9:16): 기존 430px 액자 + 좌우 패널 유지
 *   - 대시보드(셀러/어드민/에이전시) + 도매몰/공급자(B2B): 풀 PC 너비 (HIDE_SIDEBAR_PREFIXES → 프레임 제외)
 *   - 모바일(<lg): 전부 풀 너비 (영향 없음)
 *
 * 🛡️ 2026-05-03 hotfix: data-mobile-only 페이지에 xl:pl-56 적용 시 컬럼 압축 사고 → mobile-only 는 padding 0.
 */

// 9:16 비디오 / 모바일 전용 UI 페이지 (PC 에서도 액자 + 좌우 패널). '/live/:id' 만 (리스트 '/live' 는 일반).
const MOBILE_ONLY_PREFIXES = [
  '/live/',        // LivePageV2 (9:16 풀스크린 비디오)
  '/shorts',       // ShortsPage (9:16 쇼츠)
]

// 풀 PC 너비 (프레임/사이드바 제외): 대시보드 + 도매몰/공급자(B2B) + 결제리턴/임베드.
// 🏭 2026-06-04 도매몰(/wholesale)·제조사(/supplier) = B2B 서피스 — 자체 카테고리 UI 사용.
// 📐 2026-06-16 (사용자 확인): 도매몰 관련은 풀 PC 프레임이어야 함 → 여기 등재되어 app-framed 에서 자동 제외됨.
const HIDE_SIDEBAR_PREFIXES = [
  '/seller', '/admin', '/agency', '/supplier', '/wholesale', '/embed', '/checkout/return', '/introduce',
]

// 🎨 2026-06-18 (사용자 시안): 링크샵 진입 시 PC 좌측 카테고리 사이드바 숨김 → 깔끔한 액자.
//   프레임(중앙 정렬)은 유지(HIDE_SIDEBAR_PREFIXES 와 달리 풀너비로 안 만듦) + 우하단 QR 표시.
//   /u(링크샵), /profile/(레거시 링크샵), /s/(셀러 공개) 모두 링크샵 서피스.
const LINKSHOP_PREFIXES = ['/u/', '/u', '/profile/', '/s/']

// 🛡️ 2026-06-18 (사용자 정정 — "링크샵 주인은 왼쪽 카테고리가 보여야지"): 사이드바 숨김/QR 은
//   "공유 링크로 들어온 방문자"에게만. 주인이 자기 링크샵을 보면 평소 앱(사이드바) 그대로.
//   주인 판별 = URL 핸들 ↔ localStorage 핸들(useLinkshopPath 우선순위: seller_username →
//   linked_seller_username → user_handle, /u/me·/u 는 항상 주인). SSR(window 없음)=방문자로 간주
//   → 익명 액자 우선, 주인 하드로드 시 첫 client 렌더에서 사이드바 자기치유(createRoot 비-hydrate).
// 🖥️ 2026-06-18 (대표 결정 — PC 전면 반응형 단계적 롤아웃): 풀너비 데스크탑 레이아웃을 쓸 경로.
//   여기 등재된 경로만 프레임(430 액자) 해제 + 상단 네비 + 풀너비. 단계별로 확장(홈부터).
const DESKTOP_RESPONSIVE_PATHS = new Set<string>(['/'])

function isOwnLinkshopPath(pathname: string): boolean {
  if (typeof window === 'undefined') return false
  if (pathname === '/u' || pathname === '/u/me') return true
  const m = pathname.match(/^\/(?:u|profile|s)\/([^/]+)/)
  if (!m) return false
  const handle = decodeURIComponent(m[1] || '').toLowerCase().replace(/^@/, '')
  if (!handle) return false
  if (handle === 'me') return true
  try {
    return [
      localStorage.getItem('seller_username'),
      localStorage.getItem('linked_seller_username'),
      localStorage.getItem('user_handle'),
    ].some((v) => v && v.toLowerCase().replace(/^@/, '') === handle)
  } catch { return false }
}

// 📐 2026-06-16: PC 컨슈머 프레임 적용 경로 (단계적 롤아웃).
//   전체 컨슈머 롤아웃 (2026-06-17): 대시보드/도매몰/비디오 제외 모든 컨슈머 페이지에 프레임.
//   각 페이지의 fixed 하단/상단 바는 `.app-frame-bar` 클래스로 프레임 폭에 정렬 (index.css).
// 📐 2026-06-17 (사용자 요청 — 액자 폭 통일): 모든 컨슈머 페이지를 폰 폭(430) 단일 액자로.
//   기존엔 그리드/리스트·상품상세만 720 이라 페이지 이동 시 액자 폭이 튀었음. 그리드(2-3열)·상품상세(2단)는
//   프레임 안에서 '폰처럼' 보이도록 index.css `.app-framed` 오버라이드(≥1024)가 모바일 레이아웃으로 되돌린다.

export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const location = useLocation()
  const applied = useTheme(s => s.applied)
  const mobileOnly = MOBILE_ONLY_PREFIXES.some(p => location.pathname.startsWith(p))
  const hideSidebar = HIDE_SIDEBAR_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  // 🎨 2026-06-18 링크샵 서피스 — 좌측바 숨김 + 우하단 QR (프레임은 유지).
  //   단, 주인이 자기 링크샵을 볼 땐 평소 앱(사이드바 표시) — 방문자(공유링크 진입)에게만 액자+QR.
  const isLinkshop = location.pathname === '/u' || LINKSHOP_PREFIXES.some(p => location.pathname.startsWith(p))
  const linkshopVisitor = isLinkshop && !isOwnLinkshopPath(location.pathname)
  // 🖥️ 2026-06-18 (대표 결정 — PC 전면 반응형): 데스크탑 풀너비 페이지(단계적 롤아웃).
  //   프레임(430 액자) 대신 상단 네비 + 풀너비 반응형. 좌측 카테고리 사이드바는 숨김(사용자 "사이드바 위주 X").
  //   페이지의 기존 lg: 레이아웃이 그대로 살아남(프레임 CSS 덮기 미적용). 모바일(<lg)은 영향 0.
  const isDesktopResponsive = !mobileOnly && DESKTOP_RESPONSIVE_PATHS.has(location.pathname)
  const showSidebar = !hideSidebar && !linkshopVisitor && !isDesktopResponsive
  // 컨슈머 프레임 — 대시보드/도매몰/비디오 + 데스크탑 반응형 페이지는 제외.
  const framed = !mobileOnly && !hideSidebar && !isDesktopResponsive
  // 📐 2026-06-17: 단일 폰 폭(430) — 페이지별 폭 분기 제거(액자가 페이지마다 안 튐).
  const frameWidth = '430px'

  // 📐 2026-06-17: PC 프레임 양옆 배경(바탕)을 현재 테마에 직접 연동 (사용자 신고
  //   "다크 테마인데 PC 바탕이 흰색"). 기존엔 `body:has(.app-framed)` CSS 로만 처리했는데
  //   `:has()` 미지원/캐시 등 엣지에서 라이트 바탕이 남을 수 있어, 테마 store 의 applied 값으로
  //   <body> 클래스를 직접 토글해 결정적으로 적용. CSS 규칙은 index.css `body.app-frame-host`.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (framed) {
      body.classList.add('app-frame-host')
      body.classList.toggle('app-frame-dark', applied === 'dark')
    } else {
      body.classList.remove('app-frame-host', 'app-frame-dark')
    }
    // 🖥️ 2026-06-18: 데스크탑 풀너비 페이지 → 상단 네비를 사이드바 없는 폭으로 보정(CSS: body.app-fullwidth).
    body.classList.toggle('app-fullwidth', isDesktopResponsive)
    return () => { body.classList.remove('app-frame-host', 'app-frame-dark', 'app-fullwidth') }
  }, [framed, applied, isDesktopResponsive])

  return (
    <>
      {/* PC (xl+) 좌측 사이드바 — 일반 페이지 + 라이브/쇼츠 (fixed). */}
      {showSidebar && <DesktopLiveSidebar />}
      {/* PC (xl+) 라이브 좌/우 패널 — /live/:id 에서만 (fixed). */}
      {mobileOnly && <Suspense fallback={null}><DesktopLiveLeftPanel /></Suspense>}
      {mobileOnly && <Suspense fallback={null}><DesktopLiveRightPanel /></Suspense>}
      {/* 🎨 2026-06-18 링크샵 PC 우하단 "모바일로 보기" QR — 방문자에게만(주인은 평소 앱 뷰). */}
      {linkshopVisitor && <Suspense fallback={null}><LinkshopMobileQR /></Suspense>}
      <div
        className={`mobile-app-container ${framed ? 'app-framed' : (showSidebar && !mobileOnly ? 'md:pl-[60px] xl:pl-56' : '')}`}
        data-mobile-only={mobileOnly ? 'true' : 'false'}
        style={framed ? ({ '--app-frame': frameWidth } as CSSProperties) : undefined}
      >
        {children}
      </div>
    </>
  )
}
