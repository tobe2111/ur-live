/**
 * 🚪 하단 탭 화면 코드 미리받기 (2026-10-15 대표 *"각 페이지 들어갈 때 시간이 걸려 아직도"*).
 *   라이브 실측: 처음 누르는 탭마다 화면 코드를 누른 뒤에야 받아 풀스크린 로더가 0.3~0.65초.
 *   이 시험이 지키는 것: ① 그려질 화면을 고른다(로그아웃이면 게스트 화면) ② 첫 화면(load) 전에는 안 받는다
 *   ③ 한 번에 하나씩 ④ 데이터 절약·2G 는 안 한다 ⑤ 대시보드엔 안 한다 ⑥ App 이 실제로 부른다.
 *   ⚠️ 못 보는 것: 실제로 로더가 안 뜨는지(브라우저 실측 몫) · 회선 경합.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { warmTabChunks, pickTabLoaders, shouldWarmTabs, LOGGED_IN_TABS, GUEST_TABS, TAB_WARM_DELAY_MS } from '@/lib/tab-warm'
import { warmVouchersList, VOUCHERS_DEFAULT_VIEW_KEY, VOUCHERS_PAGE_SIZE, VOUCHERS_PAGE_INITIAL_VISIBLE } from '@/pages/vouchers/tab-warm-list'
import { readListView, saveListView, dropListView } from '@/lib/list-view-cache'
import { VOUCHERS_DEFAULT_SEED_PATH } from '@/shared/seo/voucher-facet'
import { stripComments } from '../helpers/source-text'

function setReadyState(v: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => v })
}
const store = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null })

afterEach(() => { setReadyState('complete'); vi.useRealTimers() })

describe('tab-warm', () => {
  it('① 로그인 키는 RouteGuards 의 isUserLoggedIn 과 같다 — 로그인이면 실제 탭, 아니면 게스트 화면', () => {
    expect(pickTabLoaders('/', store({ user_id: '3' }))).toBe(LOGGED_IN_TABS)
    expect(pickTabLoaders('/', store({ session_login: '1' }))).toBe(LOGGED_IN_TABS)
    expect(pickTabLoaders('/', store({}))).toBe(GUEST_TABS)
    const guard = stripComments(readFileSync('src/components/auth/RouteGuards.tsx', 'utf8'))
    expect(guard).toMatch(/function isUserLoggedIn[\s\S]{0,120}'user_id'[\s\S]{0,80}'session_login'/)
  })

  it('① 게스트 목록은 게스트 화면을, 로그인 목록은 실제 화면을 가리킨다', () => {
    const src = stripComments(readFileSync('src/lib/tab-warm.ts', 'utf8'))
    const guest = src.slice(src.indexOf('GUEST_TABS'), src.indexOf('TAB_WARM_DELAY_MS'))
    expect(guest).toContain("pages/guest/GuestPassPage")
    expect(guest).toContain("pages/guest/GuestMyPage")
    expect(guest).not.toContain("pages/MyVouchersPage")
    const logged = src.slice(src.indexOf('LOGGED_IN_TABS'), src.indexOf('GUEST_TABS'))
    expect(logged).toContain("pages/MyVouchersPage")
    expect(logged).not.toContain('guest/')
  })

  it('⑤ 대시보드에는 받지 않는다', () => {
    for (const p of ['/seller', '/seller/orders', '/admin', '/agency/x', '/ads']) expect(pickTabLoaders(p, store({ user_id: '1' }))).toBeNull()
    expect(pickTabLoaders('/sellers-guide', store({}))).not.toBeNull()
  })

  it('④ 데이터 절약·2G 는 안 한다', () => {
    expect(shouldWarmTabs({ connection: { saveData: true } })).toBe(false)
    expect(shouldWarmTabs({ connection: { effectiveType: '2g' } })).toBe(false)
    expect(shouldWarmTabs({ connection: { effectiveType: 'slow-2g' } })).toBe(false)
    expect(shouldWarmTabs({ connection: { effectiveType: '4g' } })).toBe(true)
    expect(shouldWarmTabs({})).toBe(true)
  })

  it('② load 전에는 안 받고, load 뒤 지연이 지나야 받는다 · ③ 하나씩', async () => {
    vi.useFakeTimers()
    setReadyState('loading')
    let inFlight = 0, maxInFlight = 0
    const calls: number[] = []
    const slowLoader = (i: number) => () => { calls.push(i); inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); return new Promise<void>((r) => setTimeout(() => { inFlight--; r() }, 1000)) } // 예약 간격(200ms)보다 길게 — 그래야 "동시" 가 드러난다
    warmTabChunks([slowLoader(0), slowLoader(1), slowLoader(2)])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toEqual([])
    setReadyState('complete')
    window.dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(TAB_WARM_DELAY_MS - 100)
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toEqual([0, 1, 2])
    expect(maxInFlight).toBe(1)
  })

  it('하나가 실패해도 다음 것을 받는다 · 취소하면 멈춘다', async () => {
    vi.useFakeTimers()
    const calls: number[] = []
    warmTabChunks([() => { calls.push(0); return Promise.reject(new Error('x')) }, () => { calls.push(1); return Promise.resolve() }])
    await vi.advanceTimersByTimeAsync(20_000)
    expect(calls).toEqual([0, 1])
    const c2: number[] = []
    const stop = warmTabChunks([() => { c2.push(0); return Promise.resolve() }])
    stop()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(c2).toEqual([])
  })

  it('⑥ App 이 마운트 때 실제로 부른다', () => {
    const app = stripComments(readFileSync('src/App.tsx', 'utf8'))
    expect(app).toMatch(/useEffect\(\(\) => startTabWarm\(location\.pathname\), \[\]\)/)
  })

  it('⑦ 교환권 목록 보관 키·모양·주소가 VouchersPage 와 같다(갈리면 조용히 안 쓰인다)', () => {
    const vp = stripComments(readFileSync('src/pages/VouchersPage.tsx', 'utf8'))
    expect(vp).toContain("const viewKey = `vouchers:list:${embedded ? 'home' : 'page'}:${category}|${brand}|${searchParams.get('sort') || 'price_low'}`")
    expect(vp).toContain(`const PAGE_SIZE = ${VOUCHERS_PAGE_SIZE}`)
    expect(vp).toContain(`const EMBED_INITIAL = embedded ? 12 : ${VOUCHERS_PAGE_INITIAL_VISIBLE}`)
    expect(vp).toMatch(/saveListView<VouchersViewState>\(viewKey, \{ products, page, hasMore, embedVisible \}\)/)
    expect(vp).toContain('rawCategory || VOUCHERS_DEFAULT_CATEGORY')
    // 페이지가 실제로 보내는 요청 = 워커 시드 키(엣지 캐시 적중)
    expect(VOUCHERS_DEFAULT_SEED_PATH).toMatch(/^\/api\/products\?page=1&limit=20&deal_only=1&sort=price_low&category=/)
    expect(VOUCHERS_DEFAULT_VIEW_KEY).toBe('vouchers:list:page:커피/음료||price_low')
  })

  it('⑦ 받은 목록을 보관하되, 사용자가 이미 본 것은 덮지 않는다', async () => {
    dropListView(VOUCHERS_DEFAULT_VIEW_KEY)
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i }))
    const urls: string[] = []
    expect(await warmVouchersList(async (u) => { urls.push(u); return { success: true, data } })).toBe(true)
    expect(urls).toEqual([VOUCHERS_DEFAULT_SEED_PATH])
    expect(readListView(VOUCHERS_DEFAULT_VIEW_KEY)).toEqual({ products: data, page: 1, hasMore: true, embedVisible: 9 })
    saveListView(VOUCHERS_DEFAULT_VIEW_KEY, { products: [{ id: 99 }], page: 3, hasMore: true, embedVisible: 30 })
    let called = 0
    expect(await warmVouchersList(async () => { called++; return { success: true, data } })).toBe(false)
    expect(called).toBe(0)
    expect((readListView(VOUCHERS_DEFAULT_VIEW_KEY) as { page: number }).page).toBe(3)
    dropListView(VOUCHERS_DEFAULT_VIEW_KEY)
    expect(await warmVouchersList(async () => ({ success: false }))).toBe(false)
    expect(readListView(VOUCHERS_DEFAULT_VIEW_KEY)).toBeNull()
  })

  it('⑦ 교환권·쇼핑 화면에서는 목록을 미리 받지 않는다(스스로 /api/products 를 부른다)', () => {
    const src = stripComments(readFileSync('src/lib/tab-warm.ts', 'utf8'))
    expect(src).toMatch(/SELF_LISTING\.test\(pathname\) \? loaders : \[\.\.\.loaders, \(\) => import\('@\/pages\/vouchers\/tab-warm-list'\)\.then\(\(m\) => m\.warmVouchersList\(\)\)\]/)
    expect(src).toContain("const SELF_LISTING = /^\\/(vouchers|browse)(\\/|$)/")
    // 첫 화면 번들에 정적으로 묶지 않는다(홈 청크 개수 회귀)
    expect(src).not.toMatch(/^import .*list-view-cache/m)
    expect(src).not.toMatch(/^import .*tab-warm-list/m)
  })
})
