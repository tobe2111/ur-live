import { ReactNode, lazy, Suspense, CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopLiveSidebar from './DesktopLiveSidebar'

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
//   1단계: 리디자인 대상 group-buy 상세에서 미관(폭/배경) 확정 → 이후 컨슈머 전체로 확장.
//   ⚠️ 확장 시 각 페이지의 fixed 하단/상단 바를 프레임 폭(var(--app-frame))에 맞춰야 함
//      (xl:left-56 / left-0 right-0 / lg:max-w-[720px] → lg:left-1/2 -translate-x-1/2 max-w-[var(--app-frame)]).
const FRAME_PREFIXES = [
  '/group-buy/',   // 공구 상세 (리스트 '/group-buy' 는 그리드 — 후속 단계, 별도 폭)
]

export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const location = useLocation()
  const mobileOnly = MOBILE_ONLY_PREFIXES.some(p => location.pathname.startsWith(p))
  const hideSidebar = HIDE_SIDEBAR_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  const showSidebar = !hideSidebar
  // 컨슈머 프레임 — 대시보드/도매몰/비디오는 제외.
  const framed = !mobileOnly && !hideSidebar && FRAME_PREFIXES.some(p => location.pathname.startsWith(p))
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
        style={framed ? ({ '--app-frame': '430px' } as CSSProperties) : undefined}
      >
        {children}
      </div>
    </>
  )
}
