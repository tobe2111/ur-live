/**
 * 🎬 유어쇼츠 레일 — 목록이 온 뒤에도 썸네일 신호가 살아 있다 (2026-10-14, 대표 신고
 * *"유어쇼츠가 로딩에 걸려서 안 보이는 경우가 많아 … 영구적 문제 해결이 필요해"*).
 *
 * 결함: 관측 대상을 `useRef` 로 들면, 목록이 오는 순간 빈 관측 div 가 <section> 으로 바뀌어도
 * 관측기는 **문서에서 떨어진 옛 div** 를 계속 본다 → 300px 신호가 영원히 안 와 썸네일 0장.
 * 라이브 재현: 아이폰 화면 + CPU 4배, 3/3 (서버 첫 화면 때문에 페이지가 처음부터 길 때).
 *
 * 이 시험은 진짜 브라우저처럼 **떨어진 요소는 교차하지 않는** 가짜 IntersectionObserver 로
 * [1200px 신호 → 목록 도착 → 레일이 화면에 들어옴] 순서를 그대로 재생한다.
 * ⚠️ 못 보는 것: 실제 스크롤 거리 · 이미지 다운로드 자체.
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

/** 그 여백의 살아 있는 관측기 중 **문서에 붙은** 대상만 교차시킨다 — 브라우저와 같다. */
function enter(margin: string) {
  for (const r of observers) {
    if (r.dead || r.margin !== margin) continue
    const live = r.targets.filter((t) => t.isConnected)
    if (!live.length) continue
    r.cb(live.map((t) => ({ isIntersecting: true, target: t }) as unknown as IntersectionObserverEntry), {} as IntersectionObserver)
  }
}

const ITEMS = [1, 2, 3].map((i) => ({
  id: i, video_id: `v${i}`, thumb_url: `https://img.youtube.com/vi/v${i}/hqdefault.jpg`,
  store_name: '가게', product_name: '상품', price: 10000, original_price: 12000,
}))

beforeEach(() => {
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true, data: ITEMS }) })))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('유어쇼츠 레일 — 관측 대상이 바뀌어도 신호가 끊기지 않는다', () => {
  it('목록이 먼저 오고 그 뒤에 레일이 화면에 들어와도 썸네일이 뜬다', async () => {
    const { default: UrShortsRail } = await import('@/components/home/UrShortsRail')
    const { container } = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)

    // ① 1200px 앞 → 목록만 받는다(썸네일은 아직)
    await act(async () => { enter('1200px') })
    await waitFor(() => expect(container.querySelector('section')).not.toBeNull())
    expect(container.querySelectorAll('img').length).toBe(0)

    // ② 레일이 300px 안으로 — 이 신호는 **지금 붙어 있는 <section>** 에 와야 한다
    await act(async () => { enter('300px') })
    await waitFor(() => expect(container.querySelectorAll('img').length).toBe(ITEMS.length))
  })

  it('한 번에 둘 다 들어와도(짧은 페이지) 그대로 뜬다', async () => {
    const { default: UrShortsRail } = await import('@/components/home/UrShortsRail')
    const { container } = render(<MemoryRouter><UrShortsRail /></MemoryRouter>)
    await act(async () => { enter('1200px'); enter('300px') })
    await waitFor(() => expect(container.querySelectorAll('img').length).toBe(ITEMS.length))
  })
})
