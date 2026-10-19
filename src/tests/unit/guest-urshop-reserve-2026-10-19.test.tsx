/**
 * 🧱 로그인 전 유어샵 탭(`/u/me`) — 예시 진열대 자리를 미리 잡는다 (2026-10-19 라이브 실측 CLS 0.39).
 *
 * 예시 진열대는 인기 이용권 응답이 와야 그려지는데, 그 전엔 자리가 없어 도착하는 순간 아래 혜택·가입 버튼이
 * 통째로 425px 밀렸다. 기다리는 동안 같은 부품(DealRow)으로 같은 개수(3)를 안 보이게 세운다.
 *
 * ⚠️ 못 보는 것: 실제 높이가 같은지(jsdom 엔 레이아웃이 없다 — 라이브 CLS 로 판정). 제목이 두 줄인 상품은
 *   한 줄 자리표시보다 줄당 ~20px 클 수 있다(작은 밀림은 남는다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const state: { data?: unknown[]; isLoading: boolean } = { isLoading: true }
vi.mock('@/pages/guest/usePopularPasses', () => ({ usePopularPasses: () => state }))
vi.mock('@/components/mascot/Udal', () => ({ default: () => null }))
vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/pages/guest/GuestKakaoButton', () => ({ default: () => <button>kakao</button> }))
import GuestUrShopPage from '@/pages/guest/GuestUrShopPage'

const draw = () => render(<MemoryRouter><GuestUrShopPage /></MemoryRouter>)
const section = (c: HTMLElement) => c.querySelector('section')

describe('예시 진열대 자리 잡기', () => {
  beforeEach(() => cleanup())

  it('응답 전: 진열대가 이미 있고(같은 줄 3개) 안 보인다', () => {
    state.isLoading = true; state.data = undefined
    const { container } = draw()
    const s = section(container)
    expect(s, '응답 전 자리가 없다 — 도착하면 아래가 밀린다').not.toBeNull()
    expect(s!.className).toContain('invisible')
    expect(s!.getAttribute('aria-hidden')).toBe('true')
    expect(s!.querySelectorAll('a').length).toBe(3)
  })

  it('응답 뒤: 같은 자리에 진짜 줄이 보인다', () => {
    state.isLoading = false
    state.data = [1, 2, 3, 4].map((i) => ({ id: i, name: `이용권${i}`, restaurant_name: '가게', price: 1000, image_url: 'https://x/a.jpg' }))
    const { container } = draw()
    const s = section(container)
    expect(s!.className).not.toContain('invisible')
    expect(s!.querySelectorAll('a').length).toBe(3)
    expect(s!.textContent).toContain('이용권1')
  })

  it('실패·0건이면 접는다(자리표시를 영원히 남기지 않는다)', () => {
    state.isLoading = false; state.data = []
    const { container } = draw()
    expect(section(container)).toBeNull()
  })
})
