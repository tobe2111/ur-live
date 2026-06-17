import { ReactNode, lazy, Suspense, CSSProperties, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopLiveSidebar from './DesktopLiveSidebar'
import { useTheme } from '@/shared/stores/useTheme'

const DesktopLiveLeftPanel = lazy(() => import('./DesktopLiveLeftPanel'))
const DesktopLiveRightPanel = lazy(() => import('./DesktopLiveRightPanel'))

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

// 📐 2026-06-16: PC 컨슈머 프레임 적용 경로 (단계적 롤아웃).
//   전체 컨슈머 롤아웃 (2026-06-17): 대시보드/도매몰/비디오 제외 모든 컨슈머 페이지에 프레임.
//   각 페이지의 fixed 하단/상단 바는 `.app-frame-bar` 클래스로 프레임 폭에 정렬 (index.css).
// 📐 그리드/피드/리스트 페이지 — 넓은 프레임(720, 2-3열). 그 외 컨슈머는 430(모바일 폭).
const GRID_FRAME_PATHS = new Set([
  '/', '/group-buy', '/vouchers', '/browse', '/meal-vouchers', '/stays',
  '/wishlist', '/mypage/wishlist', '/interest-list', '/following', '/my/follows',
])

export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const location = useLocation()
  const applied = useTheme(s => s.applied)
  const mobileOnly = MOBILE_ONLY_PREFIXES.some(p => location.pathname.startsWith(p))
  const hideSidebar = HIDE_SIDEBAR_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  const showSidebar = !hideSidebar
  // 컨슈머 프레임 — 대시보드/도매몰/비디오는 제외 (전 컨슈머 적용).
  const framed = !mobileOnly && !hideSidebar
  // 📐 상품 상세(/products/:id)는 lg+ 2단(이미지|구매) 레이아웃이라 넓은 프레임(720) — 430 에 욱여넣어
  //   2단이 짜부되던 것 방지. 그 외 상세(공구/교환권)는 단일 컬럼이라 430 유지.
  const isWideDetail = location.pathname.startsWith('/products/')
  const frameWidth = (GRID_FRAME_PATHS.has(location.pathname) || isWideDetail) ? '720px' : '430px'

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
    return () => { body.classList.remove('app-frame-host', 'app-frame-dark') }
  }, [framed, applied])

  return (
    <>
      {/* PC (xl+) 좌측 사이드바 — 일반 페이지 + 라이브/쇼츠 (fixed). */}
      {showSidebar && <DesktopLiveSidebar />}
      {/* PC (xl+) 라이브 좌/우 패널 — /live/:id 에서만 (fixed). */}
      {mobileOnly && <Suspense fallback={null}><DesktopLiveLeftPanel /></Suspense>}
      {mobileOnly && <Suspense fallback={null}><DesktopLiveRightPanel /></Suspense>}
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
