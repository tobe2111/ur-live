import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import DesktopLiveSidebar from './DesktopLiveSidebar'
import DesktopLiveLeftPanel from './DesktopLiveLeftPanel'
import DesktopLiveRightPanel from './DesktopLiveRightPanel'

interface MobileAppLayoutProps {
  children: ReactNode
}

/**
 * MobileAppLayout
 * 📐 2026-05-02: PC 풀 너비 활성화 (옵션 B).
 * 📐 2026-05-03: 사이드바 패턴 전체 페이지 확장 — `/live` 디자인을 모든 PC 페이지로 확장.
 *   - 일반 페이지: PC (xl+) 좌측 사이드바 + 중앙 ur-content-* 콘텐츠
 *   - data-mobile-only 페이지 (라이브/쇼츠 9:16): 430px 액자 가운데 정렬 유지
 *     사이드바/우측패널은 fixed (position) 라 컨테이너 폭에 영향 X — padding 추가하지 않음
 *   - 모바일 (lg 미만): 사이드바 hidden, BottomNav 사용
 *
 * 🛡️ 2026-05-03 hotfix: data-mobile-only 페이지에 xl:pl-56 적용 시 430px - 224px = 206px
 *   컬럼 압축되는 사고 → 일반 페이지에만 padding 적용, mobile-only 는 padding 0.
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
      {/* PC (xl+) 좌측 TikTok 식 사이드바 — 일반 페이지 + 라이브/쇼츠 모두 노출 (fixed 포지션). */}
      {showSidebar && <DesktopLiveSidebar />}
      {/* PC (xl+) 좌측 통계 패널 — /live/:id 에서만 (fixed, 사이드바 바로 우측). */}
      {mobileOnly && <DesktopLiveLeftPanel />}
      {/* PC (xl+) 우측 상품/공지 패널 — 라이브/쇼츠 페이지에서 (fixed 포지션). */}
      {mobileOnly && <DesktopLiveRightPanel />}
      {/* 일반 페이지만 컨테이너에 사이드바 padding 적용. mobile-only 는 430px 액자 가운데 유지.
          📐 2026-05-06 (responsive-tablet-mobile.md): md~xl 60px collapsed sidebar → md:pl-[60px]. */}
      <div
        className={`mobile-app-container ${showSidebar && !mobileOnly ? 'md:pl-[60px] xl:pl-56' : ''}`}
        data-mobile-only={mobileOnly ? 'true' : 'false'}
      >
        {children}
      </div>
    </>
  )
}

