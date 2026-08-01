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
  return (
    <>
      {/* 🔎 2026-07-29 (소비자 SEO 실측): 홈에 h1 이 **하나도 없었다** — 렌더된 DOM 의 유일한 h1 은
          index.html 의 숨겨진 인앱 차단 화면("인앱 브라우저에서는…")이라, JS 를 돌리지 않는 크롤러에겐
          그게 홈의 대표 제목이었다. 지도/피드 홈은 시각적 제목을 둘 자리가 없으므로 sr-only 로 둔다.
          ⚠️ 두 홈 브랜치 공통 위치 — 어느 쪽이 렌더되든 h1 은 정확히 1개. */}
      <h1 className="sr-only">유어딜 — 내 주변 동네딜·이용권·교환권을 할인가로</h1>
      {isDesktop ? <PcHomePage /> : <RestaurantMapPage home mode="map" />}
    </>
  )
}
