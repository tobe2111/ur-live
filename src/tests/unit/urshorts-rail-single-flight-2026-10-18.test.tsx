/**
 * 🔁 2026-10-18 — 유어쇼츠 레일이 **다시 마운트돼도 목록을 한 번만** 받는다.
 *
 * `check-duplicate-fetch` 가 홈·쇼핑에서 간헐로 `/api/urshorts ×2`(+395ms · +429ms)를 잡았다
 * (CI 3회 · 로컬 5회 중 1회). 원인은 레일이 놓이는 **자리**다 — `HomeSections` 가 편성 섹션 도착
 * 전엔 자리표시 분기에, 도착 뒤엔 첫 섹션 안에 레일을 그려 React 가 새로 마운트하고, 새 인스턴스가
 * 관측 → 요청을 또 냈다. 섹션 도착과 관측 중 무엇이 먼저냐로 갈려 간헐이었다.
 *
 * 이 시험은 그 순서를 그대로 재생한다: [마운트 → 1200px 신호 → 언마운트 → 다시 마운트 → 신호].
 * ⚠️ 못 보는 것: 실제 `HomeSections` 의 재배치 시점(그건 `check-duplicate-fetch` 가 브라우저로 센다).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

type Rec = { margin: string; cb: IntersectionObserverCallback; targets: Element[]; dead: boolean }
let observers: Rec[] = []
class FakeIO {
  rec: Rec
  constructor(cb: IntersectionObserverCallback, opt?: IntersectionObserverInit) {
    this.rec = { margin: opt?.rootMargin ?? '', cb, targets: [], dead: false }
    observers.push(this.rec)
  }
  observe(t: Element) { this.rec.targets.push(t) }
  disconnect() { this.rec.dead = true }
  unobserve() {}
  takeRecords() { return [] }
}
function enter(margin: string) {
  for (const r of observers) {
    if (r.dead || r.margin !== margin) continue
    const live = r.targets.filter((t) => t.isConnected)
    if (live.length) r.cb(live.map((t) => ({ isIntersecting: true, target: t }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver)
  }
}

const ITEMS = [1, 2].map((i) => ({
  id: i, video_id: `v${i}`, thumb_url: `https://img.youtube.com/vi/v${i}/hqdefault.jpg`,
  store_name: '가게', product_name: '상품', price: 10000, original_price: 12000,
}))

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.resetModules()               // 모듈 단위 보관이 시험끼리 새지 않게
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  fetchMock = vi.fn(async () => ({ json: async () => ({ success: true, data: ITEMS }) }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals() })

const urshortsCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/urshorts')).length

describe('유어쇼츠 레일 — 다시 마운트돼도 요청은 한 번', () => {
  it('응답 전에 다시 마운트되면 날아가는 요청을 이어받는다', async () => {
    const { default: UrShortsRail } = await import('@/components/home/UrShortsRail')
    const a = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    await act(async () => { enter('1200px') })
    a.unmount()                                  // 섹션이 도착해 레일이 다른 자리로 옮겨 간다
    const b = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    await act(async () => { enter('1200px') })
    await waitFor(() => expect(b.container.querySelector('section')).not.toBeNull())
    expect(urshortsCalls(), '다시 마운트될 때마다 목록을 또 받는다').toBe(1)
  })

  it('이미 받았으면 새 인스턴스가 첫 렌더부터 그 목록으로 그린다(깜빡임 없음)', async () => {
    const { default: UrShortsRail } = await import('@/components/home/UrShortsRail')
    const a = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    await act(async () => { enter('1200px') })
    await waitFor(() => expect(a.container.textContent).toContain('유어쇼츠'))
    a.unmount()
    const b = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    expect(b.container.querySelector('section'), '첫 렌더에 레일이 이미 서 있다').not.toBeNull()
    expect(urshortsCalls()).toBe(1)
  })

  it('실패는 보관하지 않는다 — 다음 마운트가 다시 시도한다', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline') })
    const { default: UrShortsRail } = await import('@/components/home/UrShortsRail')
    const a = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    await act(async () => { enter('1200px') })
    await waitFor(() => expect(urshortsCalls()).toBe(1))
    a.unmount()
    render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    await act(async () => { enter('1200px') })
    await waitFor(() => expect(urshortsCalls(), '실패를 보관하면 레일이 세션 내내 안 뜬다').toBe(2))
  })
})
