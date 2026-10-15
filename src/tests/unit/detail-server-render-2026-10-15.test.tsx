/**
 * 🧊 이용권 상세를 **서버에서 그려도 깨지지 않는다** (2026-10-15 대표 *"가장 이상적이고 영구적으로"* — 서버 렌더 2단계).
 *
 * 3단계(워커가 상세를 리액트로 그리고 브라우저가 이어받는 hydrate)의 전제 두 가지를 실제 렌더로 판정한다:
 *   ① 브라우저 전역(window·document·localStorage)이 없는 곳에서 `renderToString` 이 **던지지 않는다**.
 *      종전엔 렌더 본문이 `localStorage.getItem` 을 바로 불러 서버에서 즉시 죽었다(user_id·seller_id·위치 캐시).
 *   ② 서버가 그린 HTML 을 **로그인한 브라우저**(user_id·seller_id·위치 캐시가 있다)가 이어받아도 결과가 안 갈린다.
 *      갈리면 React 18 은 그 루트를 버리고 브라우저에서 다시 그린다 — 서버 렌더의 이득이 통째로 사라지고 에러는 0 이다.
 *
 * 이 시험이 못 보는 것: 워커 번들 안에서의 실행(esbuild·워커 런타임) · i18n 초기화 여부 · 실제 시드 경로(3단계의 일).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act } from 'react'
import { StaticRouter } from 'react-router-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import GroupBuyDetailPage from '@/pages/GroupBuyDetailPage'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { readCode } from '@/tests/helpers/source-text'

const PRODUCT = {
  id: 2919, seller_id: 26, name: '달빛한스푼 닭도리탕', description: '달빛한스푼 이용권',
  price: 31000, original_price: 35000, discount_rate: 0,
  image_url: 'https://media.ur-team.com/uploads/seller/26/2026-10/0F9CTfqE1eiqsu6n.jpg', thumbnail: null,
  images: '["https://media.ur-team.com/uploads/seller/26/2026-10/0F9CTfqE1eiqsu6n.jpg"]',
  category: 'meal_voucher', stock: 99, stock_quantity: 0, is_active: 1, deal_only: 0, sold_count: 0,
  review_count: 0, avg_rating: 0, dominant_color: '#743e20', detail_images: null, long_description: null,
  group_buy_target: 0, group_buy_current: 1, group_buy_status: 'active', group_buy_deadline: null, group_buy_tiers: null,
  restaurant_name: '달빛한스푼', restaurant_address: '서울 마포구 테스트로 1', restaurant_phone: '02-000-0000',
  restaurant_lat: 37.4937775227776, restaurant_lng: 126.986122793171,
  voucher_expiry: '2026-12-31 15:30:00', voucher_terms: null, referral_commission_rate: null,
  created_at: '2026-10-07 04:32:30', updated_at: '2026-10-07 04:55:56',
  seller_name: '달빛한스푼', seller_username: 'store_muxlddtf74b', seller_avatar: null, seller_bio: null,
  seller_instagram: null, seller_youtube: null, seller_tiktok: null, seller_facebook: null,
  current_discount_pct: 0, next_tier: null, next_tier_remaining: null, qty_cap: 10,
  kakao_place_url: 'https://place.map.kakao.com/10256701',
}
const URL_ = '/pass/2919'

function client() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(queryKeys.groupBuyProduct(2919), PRODUCT)
  return qc
}
const tree = (router: 'static' | 'memory', qc: QueryClient) => {
  const page = h(Routes, null, h(Route, { path: '/pass/:id', element: h(GroupBuyDetailPage) }))
  const routed = router === 'static'
    ? h(StaticRouter, { location: URL_ }, page)
    : h(MemoryRouter, { initialEntries: [URL_] }, page)
  return h(HelmetProvider, { context: {} }, h(QueryClientProvider, { client: qc }, routed))
}

/** 서버처럼 — 브라우저 전역을 지운 채 그린다. */
function serverRender(): string {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('document', undefined)
  vi.stubGlobal('localStorage', undefined)
  vi.stubGlobal('sessionStorage', undefined)
  try {
    return renderToString(tree('static', client()))
  } finally {
    vi.unstubAllGlobals()
  }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('① 브라우저 전역 없이 그린다', () => {
  it('던지지 않고 상품을 그린다(로더가 아니라 내용)', () => {
    const html = serverRender()
    expect(html).toContain('달빛한스푼 닭도리탕')
    expect(html.length).toBeGreaterThan(5000)
  })
  it('유효기간은 한국 날짜로 — 서버(UTC)가 그려도 하루 안 밀린다', () => {
    // 2026-12-31 15:30 UTC = 2027-01-01 00:30 KST. 시간대 없이 찍으면 실행 기계의 날짜(12월 31일)가 나온다.
    expect(serverRender()).toContain('2027. 1. 1.')
  })
})

describe('② 로그인한 브라우저가 서버 HTML 을 이어받아도 갈리지 않는다', () => {
  it('hydrate 회복 오류 0', async () => {
    const html = serverRender()
    localStorage.setItem('user_id', '3')
    localStorage.setItem('seller_id', '26')
    localStorage.setItem('ur_last_loc_v1', JSON.stringify({ lat: 37.5, lng: 127.0 }))
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | null = null
    await act(async () => {
      root = hydrateRoot(host, tree('memory', client()), { onRecoverableError: (e) => { errors.push(e) } })
    })
    const mismatchLogs = spy.mock.calls.filter((c) => /hydrat|did not match|Text content/i.test(String(c[0])))
    spy.mockRestore()
    act(() => { root?.unmount() })
    host.remove()
    expect(errors.map(String), 'hydrate 가 갈렸다 — React 가 서버 HTML 을 버리고 다시 그린다').toEqual([])
    expect(mismatchLogs.map((c) => String(c[0]).slice(0, 200))).toEqual([])
  })
})

describe('③ 렌더 본문이 localStorage 를 직접 읽지 않는다', () => {
  it('GroupBuyDetailPage 는 useStoredValue 로 읽는다', () => {
    const src = readCode('src/pages/GroupBuyDetailPage.tsx')
    expect(src).not.toMatch(/=\s*!*localStorage\.getItem\(/)
    expect(src).toMatch(/useStoredValue\('user_id'\)/)
    expect(src).toMatch(/useStoredValue\(LAST_LOC_KEY\)/)
  })
})
