/**
 * 🚀 하드로드 때 "페이지 로딩 중" 단계를 건너뛴다 (2026-10-15 대표 *"가장 이상적이고 영구적으로"*).
 *
 * ## 무엇이 느렸나 (라이브 실측 — 이용권 상세, 느린 4G · CPU 4배, 측정기 부하 없이)
 * 페이지 코드는 워커가 HTML 단계에서 이미 미리받게 해 둔다(route-chunk-map). 그런데 App 의 페이지는
 * `React.lazy` 라서, 모듈이 이미 받아져 있어도 **첫 렌더에서 한 번은 무조건 멈춘다**(lazy 의 약속이
 * 다음 마이크로태스크에야 풀린다). 그러면 React 는 Suspense 폴백을 먼저 그리고, **폴백을 그린 뒤 최소
 * 0.5초가 지나야 내용을 드러낸다**(React 18 의 공개 지연 — 로딩 화면이 깜빡이지 않게 하는 장치).
 *
 *     폴백 2,814ms → 구매 버튼 3,348ms (534ms) · 3,244 → 4,165 · 3,740 → 4,799
 *     그 사이 대부분이 **아무 일도 안 하는 시간**이었고, 레이아웃도 두 번 돌았다(폴백 + 페이지).
 *
 * ## 처방
 * 첫 렌더 **전에** 이 주소의 페이지 모듈을 준비한다(`preloadBootPage`) — 이미 미리받은 청크라 기다림은
 * 사실상 모듈 평가뿐이다. 그리고 그 페이지는 `lazyPage` 로 감싸서, 모듈이 준비돼 있으면 **lazy 를 거치지
 * 않고 바로** 그린다 ⇒ 폴백 단계·0.5초 지연·레이아웃 한 번이 함께 사라진다.
 *
 * ## 지키는 것
 *   - 페이지는 여전히 **별도 청크**다(lazy 의 목적 = 첫 다운로드 분리 — 그대로).
 *   - 기다림에는 **상한**이 있다(`BOOT_PAGE_WAIT_MS`). 청크가 늦거나 깨져도 그 뒤엔 종전대로 그린다.
 *   - 실패는 삼키지 않고 넘긴다 — 같은 import 를 React.lazy 가 다시 부르고, 청크 오류는 종전 자가복구가 맡는다.
 *   - 주소 → 표면 판정은 워커와 **같은 함수**(`shared/route-surface`)다.
 */
import { createElement, lazy, type ComponentType } from 'react'
import { routeSurface, HOME_DESKTOP_QUERY, type RouteSurface } from '@/shared/route-surface'
import { isMobileUserAgent } from '@/shared/detail-hero-image'

/** 첫 렌더를 이 이상 붙잡지 않는다(ms). 미리받은 청크면 수십 ms 안에 끝난다. */
export const BOOT_PAGE_WAIT_MS = 2500

type Loader = () => Promise<unknown>
const bootLoaders = new Map<RouteSurface, Loader[]>()

/** App.tsx 가 표면별 페이지 로더를 등록한다(동적 import 는 App.tsx 한 곳에만 — route-preload 와 같은 규율). */
export function registerBootPage(surface: RouteSurface, load: Loader): void {
  const list = bootLoaders.get(surface) || []
  list.push(load)
  bootLoaders.set(surface, list)
}

/**
 * 지금 주소의 표면 — 워커와 같은 판정(`routeSurface`). 로그인 여부는 `RouteGuards` 의 소비자 판정과 같은
 * 로컬 흔적으로 본다(세션 쿠키는 HttpOnly 라 앱이 못 본다). 틀려도 미리받기가 빗나갈 뿐 화면은 같다.
 */
export function bootSurface(): RouteSurface | null {
  try {
    const authed = !!localStorage.getItem('user_id') || !!localStorage.getItem('session_login')
    // 홈은 뷰포트로 고른다 — HomeRoute 와 같은 쿼리(UA 로 고르면 안 그릴 홈을 받는다).
    const narrow = typeof matchMedia === 'function'
      ? !matchMedia(HOME_DESKTOP_QUERY).matches
      : isMobileUserAgent(navigator.userAgent)
    return routeSurface(location.pathname, narrow, authed)
  } catch {
    return null
  }
}

/** 등록된 표면 목록(가드용). */
export function registeredBootSurfaces(): RouteSurface[] {
  return [...bootLoaders.keys()]
}

/**
 * 이 표면의 페이지 모듈을 준비한다. 상한을 넘거나 실패하면 그냥 끝난다(앱은 종전대로 뜬다).
 * 반환값: 상한 안에 준비됐으면 true.
 */
export async function preloadBootPage(surface: RouteSurface | null, waitMs = BOOT_PAGE_WAIT_MS): Promise<boolean> {
  if (!surface) return false
  const list = bootLoaders.get(surface)
  if (!list || list.length === 0) return false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<false>((res) => { timer = setTimeout(() => res(false), waitMs) })
  try {
    return await Promise.race([Promise.all(list.map((l) => l())).then(() => true), timeout])
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * `React.lazy` 와 같은 쓰임새인데, 모듈이 이미 준비돼 있으면 **lazy 를 거치지 않고 바로** 그린다.
 * `load` 는 같은 import 를 부르는 함수이고 `registerBootPage` 에 그대로 넘긴다.
 *
 * ⚠️ 렌더 사이에 요소 종류가 바뀌어도 안전하다 — lazy 쪽은 멈춘 채 커밋된 적이 없고(폴백만 보였다),
 *    모듈이 풀린 다음 렌더부터는 언제나 진짜 컴포넌트다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy 와 같은 타입 시그니처(컴포넌트 타입을 그대로 돌려준다)
export function lazyPage<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): T & { load: () => Promise<{ default: T }> } {
  let ready: T | null = null
  const load = () => factory().then((m) => { ready = m.default; return m })
  const Lazy = lazy(load)
  // 렌더하는 쪽 타입은 느슨하게 — 바깥 시그니처(T)가 호출부의 props 를 그대로 검사한다.
  const Ready = (): ComponentType<Record<string, unknown>> => ready as unknown as ComponentType<Record<string, unknown>>
  const LazyAny = Lazy as unknown as ComponentType<Record<string, unknown>>
  function BootPage(props: Record<string, unknown>) {
    return ready ? createElement(Ready(), props) : createElement(LazyAny, props)
  }
  return Object.assign(BootPage, { load }) as unknown as T & { load: () => Promise<{ default: T }> }
}
