import { lazy } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * 🖥️ 2026-07-15 (대표 시안 — 당근 스타일 PC 홈): 홈(`/`) 뷰포트 분기.
 *   - lg+(≥1024) = 당근 스타일 PC 홈(풀너비 레일 + 그리드)
 *   - 그 외(모바일/태블릿) = RestaurantMapPage 지도 홈(대표 2026-07-15 "홈=지도" 결정 정합)
 *   createRoot(비-hydrate)라 첫 렌더부터 정확한 뷰포트로 분기(플래시 0). SSR 시드(__SSR_INITIAL_MAIN__)는
 *   PcHomePage(GroupBuyFeed)·RestaurantMapPage(useMapProducts) 양쪽 다 소비 → 0-RTT 유지.
 *   두 페이지 모두 lazy — 뷰포트에 필요한 청크만 로드.
 */
const PcHomePage = lazy(() => import('./PcHomePage'))
const RestaurantMapPage = lazy(() => import('@/pages/RestaurantMapPage'))

export default function HomeRoute() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  return isDesktop ? <PcHomePage /> : <RestaurantMapPage home mode="map" />
}
