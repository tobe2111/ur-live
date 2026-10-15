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
  void loadRoute(name)
}

/**
 * 🚀 2026-10-15: 같은 일을 하되 **모듈을 돌려준다**(유어샵 탭처럼 받은 모듈의 함수를 바로 쓰는 곳).
 *   등록된 로더는 `lib/boot-page` 의 `lazyPage(...).load` 다 — 그 로더로 받아야 화면 컴포넌트가
 *   "준비됨" 으로 바뀌어, 그 화면으로 갈 때 "페이지 로딩 중" 이 한 번도 안 뜬다.
 *   ⚠️ 같은 모듈을 `import()` 로 **직접** 받으면 코드는 받아지지만 그 표시가 안 바뀐다(2026-10-15 라이브 실측 —
 *   홈 카드가 상세 코드를 미리 받아 두고도 누를 때마다 로딩 화면이 0.35초 떴다).
 */
const inflight = new Map<string, Promise<unknown>>()
export function loadRoute(name: string): Promise<unknown> {
  const hit = inflight.get(name)
  if (hit) return hit
  const load = loaders.get(name)
  if (!load) return Promise.resolve(undefined)
  started.add(name)
  const p = load().catch((e) => { started.delete(name); inflight.delete(name); throw e })
  inflight.set(name, p)
  p.catch(() => { /* 호출부가 안 받아도 처리되지 않은 거절로 남지 않게 */ })
  return p
}
