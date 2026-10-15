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
import { readListView, saveListView } from '@/lib/list-view-cache'
import { VOUCHERS_DEFAULT_CATEGORY, VOUCHERS_DEFAULT_SEED_PATH } from '@/shared/seo/voucher-facet'

type Loader = () => Promise<unknown>

export const LOGGED_IN_TABS: Loader[] = [
  () => import('@/pages/VouchersPage'),
  () => import('@/pages/MyVouchersPage'),
  () => import('@/pages/UserProfilePage'),
  () => import('@/pages/CuratorPage'),
]

export const GUEST_TABS: Loader[] = [
  () => import('@/pages/VouchersPage'),
  () => import('@/pages/guest/GuestPassPage'),
  () => import('@/pages/guest/GuestUrShopPage'),
  () => import('@/pages/guest/GuestMyPage'),
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

/**
 * 🎁 교환권 탭은 코드가 와 있어도 **상품 목록**을 기다리는 로더가 남는다(로컬 실측 — 청크 0건인데 로더 15프레임).
 * 그래서 탭 코드를 받은 뒤 **기본 화면(커피/음료 · 낮은 가격순) 1페이지**도 받아, 페이지가 재방문에 쓰는
 * 보관함(`list-view-cache`)에 넣어 둔다 → 처음 눌러도 `warm` 시드로 그려지고 최신 목록은 뒤에서 교체된다.
 *  - 주소는 워커 시드·cron 예열과 **같은 키**(`VOUCHERS_DEFAULT_SEED_PATH`)라 엣지 캐시를 맞는다.
 *  - 보관 키·모양은 `VouchersPage` 의 것과 같아야 한다 — 시험이 그 소스와 대조한다(갈리면 조용히 안 쓰인다).
 *  - 이미 보관본이 있으면 덮지 않는다(그쪽이 사용자가 실제로 본 것이다).
 */
export const VOUCHERS_PAGE_SIZE = 20
export const VOUCHERS_PAGE_INITIAL_VISIBLE = 9
export const VOUCHERS_DEFAULT_VIEW_KEY = `vouchers:list:page:${VOUCHERS_DEFAULT_CATEGORY}||price_low`

export async function warmVouchersList(fetcher: (url: string) => Promise<ListBody> = defaultFetch): Promise<boolean> {
  if (readListView(VOUCHERS_DEFAULT_VIEW_KEY) != null) return false
  const body = await fetcher(VOUCHERS_DEFAULT_SEED_PATH).catch(() => null)
  if (!body?.success || !Array.isArray(body.data) || body.data.length === 0) return false
  if (readListView(VOUCHERS_DEFAULT_VIEW_KEY) != null) return false // 받는 사이 사용자가 먼저 열었다
  saveListView(VOUCHERS_DEFAULT_VIEW_KEY, {
    products: body.data,
    page: 1,
    hasMore: body.data.length === VOUCHERS_PAGE_SIZE,
    embedVisible: VOUCHERS_PAGE_INITIAL_VISIBLE,
  })
  return true
}

type ListBody = { success?: boolean; data?: unknown } | null
async function defaultFetch(url: string): Promise<ListBody> {
  const r = await fetch(url, { credentials: 'same-origin' })
  return r.ok ? ((await r.json()) as ListBody) : null
}

/** App 마운트 1회. */
export function startTabWarm(pathname: string): () => void {
  if (typeof window === 'undefined') return () => {}
  let store: Pick<Storage, 'getItem'>
  try { store = window.localStorage } catch { return () => {} }
  const loaders = pickTabLoaders(pathname, store)
  if (!loaders) return () => {}
  // 교환권 목록은 교환권 화면 밖에서만 미리 받는다(그 화면은 스스로 받는다).
  const withData: Loader[] = pathname === '/vouchers' ? loaders : [...loaders, () => warmVouchersList()]
  return warmTabChunks(withData)
}
