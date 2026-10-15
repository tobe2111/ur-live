/**
 * 🚪 하단 탭 화면 코드를 첫 화면 **뒤에** 미리 받아 둔다 (2026-10-15 대표 *"각 페이지 들어갈 때 시간이 걸려 아직도"*).
 *
 * 라이브 실측(iPhone 13, urdeal.kr, 홈에서 탭 이동): 처음 누르는 탭마다 그 화면 코드를 **누른 뒤에야** 받기
 * 시작해 풀스크린 로더가 0.3~0.65초 떴다(교환권 4청크 620ms → 그다음에야 상품 요청). 2026-05-27 에 Lighthouse
 * 점수 때문에 idle prefetch 를 통째로 지운 뒤로 비어 있던 자리다 — 그때 걱정은 "첫 화면과 회선을 나눠 쓴다" 였고,
 * 그건 `runAfterLoad`(load 뒤 + 한가할 때)와 추가 지연으로 막는다.
 *
 * 규칙:
 *  - 로그인 여부로 **실제로 그려질 화면**을 고른다 — 로그아웃이면 이용권·유어샵·마이 탭은 게스트 화면이다
 *    (`ProtectedRoute guest=`). 엉뚱한 화면을 받으면 회선만 쓰고 이득이 0 이다.
 *  - 한 번에 하나씩, 한가할 때마다. 지금 보고 있는 화면의 다음 행동(사진·스크롤)을 막지 않게.
 *  - Save-Data 이거나 2G 면 안 한다(누르는 순간의 `onPointerDown` 미리받기는 그대로 남는다).
 *  - 페이지 진입점(`src/pages/`)만 부른다 — 묶음기가 이것을 부팅 사용자로 세지 않는 경로다(`surface-chunks.mjs`).
 */
import { runAfterLoad } from '@/lib/after-load'

type Loader = () => Promise<unknown>

export const LOGGED_IN_TABS: Loader[] = [
  () => import('@/pages/VouchersPage'),
  () => import('@/pages/MyVouchersPage'),
  () => import('@/pages/UserProfilePage'),
  () => import('@/pages/CuratorPage'),
  // 홈 맨 위 [목록|지도] 전환의 지도 — 라이브 실측 지도 진입 시 청크 6개를 누른 뒤에 받아 로더 0.2초.
  () => import('@/pages/RestaurantMapPage'),
]

export const GUEST_TABS: Loader[] = [
  () => import('@/pages/VouchersPage'),
  () => import('@/pages/guest/GuestPassPage'),
  () => import('@/pages/guest/GuestUrShopPage'),
  () => import('@/pages/guest/GuestMyPage'),
  () => import('@/pages/RestaurantMapPage'),
]

/** 첫 화면이 자리 잡은 뒤 이만큼 더 기다린다 — 방금 뜬 화면의 늦은 사진·데이터와 겹치지 않게. */
export const TAB_WARM_DELAY_MS = 3000

export function shouldWarmTabs(nav: { connection?: { saveData?: boolean; effectiveType?: string } } | undefined): boolean {
  const c = nav?.connection
  if (!c) return true
  if (c.saveData) return false
  return !/(^|-)2g$/.test(c.effectiveType || '')
}

/** 취소 함수를 돌려준다. `loaders` 는 순서대로, 한가할 때마다 하나씩. */
export function warmTabChunks(loaders: Loader[], delayMs = TAB_WARM_DELAY_MS): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!shouldWarmTabs(navigator as unknown as Parameters<typeof shouldWarmTabs>[0])) return () => {}
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const next = (i: number) => {
    if (cancelled || i >= loaders.length) return
    const run = () => {
      if (cancelled) return
      let p: Promise<unknown>
      try { p = loaders[i]() } catch { p = Promise.resolve() }
      p.catch(() => {}).finally(() => next(i + 1))
    }
    if (ric) ric(run, { timeout: 2000 })
    else timer = setTimeout(run, 200)
  }
  const stopLoad = runAfterLoad(() => { timer = setTimeout(() => next(0), delayMs) })
  return () => { cancelled = true; stopLoad(); if (timer !== undefined) clearTimeout(timer) }
}

/** 대시보드(셀러·어드민·에이전시·유어애즈)에는 하단 탭이 없다 — 받지 않는다. */
const NO_TAB_PREFIX = /^\/(seller|admin|agency|ads|wholesale|supplier)(\/|$)/

/** 로그인 판정은 `RouteGuards` 의 `isUserLoggedIn` 과 **같은 키**다 — 갈리면 그려지지 않을 화면을 받는다. */
export function pickTabLoaders(pathname: string, store: Pick<Storage, 'getItem'>): Loader[] | null {
  if (NO_TAB_PREFIX.test(pathname)) return null
  let loggedIn = false
  try { loggedIn = !!store.getItem('user_id') || !!store.getItem('session_login') } catch { /* 저장소 막힘 — 게스트로 */ }
  return loggedIn ? LOGGED_IN_TABS : GUEST_TABS
}

/** App 마운트 1회. */
export function startTabWarm(pathname: string): () => void {
  if (typeof window === 'undefined') return () => {}
  let store: Pick<Storage, 'getItem'>
  try { store = window.localStorage } catch { return () => {} }
  const loaders = pickTabLoaders(pathname, store)
  if (!loaders) return () => {}
  // 교환권 목록은 교환권 화면 밖에서만 미리 받는다(그 화면은 스스로 받는다).
  // 별도 모듈로 나중에 부른다 — 정적으로 묶으면 홈 첫 화면 청크가 하나 늘었다(2026-10-15 CI surface-chunk-runtime 26→27).
  const withData: Loader[] = pathname === '/vouchers' ? loaders : [...loaders, () => import('@/pages/vouchers/tab-warm-list').then((m) => m.warmVouchersList())]
  return warmTabChunks(withData)
}
