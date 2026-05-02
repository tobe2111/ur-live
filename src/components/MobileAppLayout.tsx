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
 *   - 기본: PC 에서도 풀 너비 사용 (페이지별 lg: variants 로 desktop layout 구성)
 *   - 라이브/쇼츠/음성 등 9:16 비디오 페이지는 `MOBILE_ONLY_PATHS` 매칭 시
 *     `data-mobile-only="true"` 부착 → 430px 액자 유지
 *   - data-mobile-only 페이지는 PC (xl+) 에서 좌측 TikTok 식 사이드바 추가 노출
 */

// 9:16 비디오 / 모바일 전용 UI 페이지 (PC 에서도 액자 유지)
const MOBILE_ONLY_PREFIXES = [
  '/live',         // LivePageV2 (9:16 풀스크린 비디오)
  '/shorts',       // ShortsPage (9:16 쇼츠)
]

export default function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const location = useLocation()
  const mobileOnly = MOBILE_ONLY_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  return (
    <>
      {/* PC (xl+) 좌측 TikTok 식 사이드바 — data-mobile-only 페이지에서만 노출.
          mobile/tablet (xl 미만) 에서는 hidden (사이드바 자체에서 처리) */}
      {mobileOnly && <DesktopLiveSidebar />}
      {/* PC (2xl+) 우측 안내 패널 — 좌 224 + 중앙 430 + 우 280 = 약 940px 가 들어가야
          하므로 1536px 이상 viewport 에서만 노출 (사이드바 자체에서 처리) */}
      {mobileOnly && <DesktopLiveRightPanel />}
      <div className="mobile-app-container" data-mobile-only={mobileOnly ? 'true' : 'false'}>
        {children}
      </div>
    </>
  )
}

