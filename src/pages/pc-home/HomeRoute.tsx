import { lazy } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * 🖥️ 2026-07-15 (대표 시안 — 당근 스타일 PC 홈): 홈(`/`) 뷰포트 분기.
 *   - md+(≥768) = PC 홈(히어로 + 편성 섹션 + 딜 그리드) — **태블릿 포함**
 *   - 그 외(모바일) = 딜 피드 홈(2026-08-19 대표 확정 — 그루폰 모바일 시안).
 *
 * 🩸 2026-08-24 (대표 신고 — "태블릿으로 볼 때 아직 메인 이용권 UI가 예전 디자인"):
 *   이 분기가 **lg(1024)** 였는데 상단 헤더(`DesktopTopNav`)는 **`hidden md:block`** 이라
 *   md(768) 부터 PC 헤더가 떴다. 그래서 **768~1023 구간만 헤더는 새 디자인, 본문은 옛 디자인**
 *   으로 갈렸다 — 태블릿 세로(810)에서 차콜 색면도 히어로도 없이 흰 배경이 나오던 이유다.
 *   ⚠️ 이 값은 **헤더의 기준과 같아야 한다.** 한쪽만 바꾸면 그 구간이 다시 어긋난다
 *      (가드: `home-tablet-breakpoint.test.ts`).
 *     ⚠️ 2026-07-15 의 "홈=지도" 결정을 **대체**한다. 지도는 `/map` 으로 남는다.
 *        (2026-08-30: '상단 배너'는 **제목 옆 목록/지도 전환**으로 바뀌었다 — 배너는 없다.)
 *   createRoot(비-hydrate)라 첫 렌더부터 정확한 뷰포트로 분기(플래시 0). SSR 시드(__SSR_INITIAL_MAIN__)는
 *   PcHomePage(GroupBuyFeed)·RestaurantMapPage(useMapProducts) 양쪽 다 소비 → 0-RTT 유지.
 *   두 페이지 모두 lazy — 뷰포트에 필요한 청크만 로드.
 */
const PcHomePage = lazy(() => import('./PcHomePage'))
/**
 * 📱 2026-08-19 (대표 확정 — 그루폰 모바일 홈 시안): 모바일 메인이 **지도 → 딜 피드**로 바뀌었다.
 *   *"지금은 맵 링크잖아. 대신 변경되는 페이지에서 맵으로 이동하기 버튼이 있어야겠지?"*
 *   ⇒ 2026-08-30: 그 '상단 배너'는 **목록/지도 전환 컨트롤**(피드 제목 옆)로 대체됐다 —
 *      배너 한 블록이 사라지고 진입은 콘텐츠에 붙었다. `/map` 라우트·하단 탭 5개는 그대로.
 */
const MobileHomePage = lazy(() => import('@/pages/mobile-home/MobileHomePage'))

export default function HomeRoute() {
  // ⚠️ 768 = Tailwind `md` = DesktopTopNav 의 `hidden md:block` 과 같은 경계(위 주석 참조).
  const isDesktop = useMediaQuery('(min-width: 768px)')
  return (
    <>
      {/* 🔎 2026-07-29 (소비자 SEO 실측): 홈에 h1 이 **하나도 없었다** — 렌더된 DOM 의 유일한 h1 은
          index.html 의 숨겨진 인앱 차단 화면("인앱 브라우저에서는…")이라, JS 를 돌리지 않는 크롤러에겐
          그게 홈의 대표 제목이었다. 지도/피드 홈은 시각적 제목을 둘 자리가 없으므로 sr-only 로 둔다.
          ⚠️ 두 홈 브랜치 공통 위치 — 어느 쪽이 렌더되든 h1 은 정확히 1개. */}
      <h1 className="sr-only">유어딜 — 내 주변 동네딜·이용권·교환권을 할인가로</h1>
      {isDesktop ? <PcHomePage /> : <MobileHomePage />}
    </>
  )
}
