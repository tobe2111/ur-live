import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopLiveSidebar from './DesktopLiveSidebar'
import DesktopLiveRightPanel from './DesktopLiveRightPanel'

interface MobileAppLayoutProps {
  children: ReactNode
}

/**
 * MobileAppLayout
 * 📐 2026-05-02: PC 풀 너비 활성화 (옵션 B).
 * 📐 2026-05-03: 사이드바 패턴 전체 페이지 확장 — `/live` 디자인을 모든 PC 페이지로 확장.
 *   - 기본: PC (xl+) 에서 좌측 TikTok 식 사이드바 항상 노출
 *   - data-mobile-only 페이지 (라이브/쇼츠 9:16): 430px 액자 + 우측 안내 패널 (2xl+)
 *   - 일반 페이지: 좌측 사이드바만 + 중앙 콘텐츠 ur-content-* 토큰 활용
 *   - 모바일 (lg 미만): 사이드바 hidden, BottomNav 사용
 */

// 9:16 비디오 / 모바일 전용 UI 페이지 (PC 에서도 액자 유지 + 우측 패널)
const MOBILE_ONLY_PREFIXES = [
  '/live',         // LivePageV2 (9:16 풀스크린 비디오)
  '/shorts',       // ShortsPage (9:16 쇼츠)
]

// 사이드바 숨길 페이지 (셀러/어드민/에이전시 대시보드 + 결제/임베드)
const HIDE_SIDEBAR_PREFIXES = [
  '/seller', '/admin', '/agency', '/embed', '/checkout/return', '/introduce',
]

export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const location = useLocation()
  const mobileOnly = MOBILE_ONLY_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  const hideSidebar = HIDE_SIDEBAR_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  const showSidebar = !hideSidebar
  return (
    <>
      {/* PC (xl+) 좌측 TikTok 식 사이드바 — 일반 페이지 + 라이브/쇼츠 모두 노출. */}
      {showSidebar && <DesktopLiveSidebar />}
      {/* PC (2xl+) 우측 안내 패널 — 라이브/쇼츠 페이지에서만 (9:16 액자 옆 안내). */}
      {mobileOnly && <DesktopLiveRightPanel />}
      <div
        className={`mobile-app-container ${showSidebar ? 'xl:pl-56' : ''} ${mobileOnly ? '2xl:pr-72' : ''}`}
        data-mobile-only={mobileOnly ? 'true' : 'false'}
      >
        {children}
      </div>
    </>
  )
}

