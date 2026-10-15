/**
 * 🧭 화면 코드 미리받기 등록부 (2026-10-15 대표 *"지도 화면 코드를 홈에서 미리 받기"* 승인).
 *
 * 홈이 지도 화면 코드를 미리 받으려고 `import('@/pages/RestaurantMapPage')` 를 **직접** 쓰면,
 * 묶음기(`scripts/surface-chunks.mjs`)가 지도 모듈에 홈의 lazy 라벨을 붙여 봉투가 다시 짜인다
 * (그 묶음은 화면별 바이트 예산이 잠그고 있다). 그래서 동적 import 는 **App.tsx 의 lazy 한 곳에만** 두고,
 * App.tsx 가 그 로더를 여기에 등록한다. 홈은 이름으로만 부른다 — 같은 `import()` 를 부르므로
 * 브라우저 모듈 캐시를 공유하고, 사용자가 지도로 가면 React.lazy 가 이미 받은 모듈을 그대로 쓴다.
 */
type Loader = () => Promise<unknown>
const loaders = new Map<string, Loader>()
const started = new Set<string>()

export function registerRoutePreload(name: string, load: Loader): void {
  loaders.set(name, load)
}

/** 등록된 화면 코드를 한 번만 받는다. 실패해도 조용히 — 그 화면이 갈 때 다시 받는다. */
export function preloadRoute(name: string): void {
  if (started.has(name)) return
  const load = loaders.get(name)
  if (!load) return
  started.add(name)
  load().catch(() => { started.delete(name) })
}
