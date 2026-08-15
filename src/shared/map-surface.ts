/**
 * 🗺️ **지도 화면을 렌더하는 경로 SSOT** (2026-08-14 — 대표 태블릿 스크린샷 "로고 2개·버튼 겹침").
 *
 * `RestaurantMapPage` 는 **자기 화면을 자기가 다 쓴다** — 자체 상단 헤더(로고 포함) + `h-[100dvh]`
 * 루트 + `bottom-0` 바텀시트. 그래서 이 화면을 렌더하는 경로는 두 가지를 동시에 지켜야 한다:
 *
 *   1. 전역 `DesktopTopNav` 를 `<lg` 에서 띄우지 말 것 — 띄우면 **상단바가 둘**이 된다(로고 2개).
 *   2. `<main>` 에 하단 네비 여백(`pb-3.5rem`)을 주지 말 것 — 주면 문서가 뷰포트보다 **56px 커져**
 *      바텀시트가 화면 밖으로 밀리고 그만큼 스크롤이 생긴다(스크롤하면 sticky 네비가 지도를 덮는다).
 *
 * ⚠️ **`/` 가 여기 있는 이유** — 홈은 `lg` 미만에서 `HomeRoute` 가 `RestaurantMapPage` 를 렌더한다
 *   (`lg+` 는 `PcHomePage`). 즉 **`/` 와 `/map` 은 태블릿·모바일에서 같은 화면**이다. 이 사실이
 *   두 곳에 각각 손으로 적혀 있어서 실제로 갈라졌다:
 *     - `DesktopTopNav.LEGACY_OWN_HEADER` 에 `/map` 만 있고 `/` 가 빠짐 → 768~1023 이중 헤더
 *     - `App.tsx mapFullScreen` 에 `/map` 만 있고 `/` 가 빠짐 → **전 폭에서** 홈만 56px 넘침
 *   ⇒ 목록을 하나로 합쳐 다시 갈라지지 않게 한다. 가드: `home-map-surface.test.ts`.
 */
export const MAP_SCREEN_PATHS = ['/', '/map', '/restaurant-map'] as const

/** 이 경로는 `RestaurantMapPage`(풀높이 자체 헤더 화면)를 렌더한다 — `/` 는 `<lg` 한정. */
export function isMapScreenPath(pathname: string): boolean {
  return (MAP_SCREEN_PATHS as readonly string[]).includes(pathname)
}
