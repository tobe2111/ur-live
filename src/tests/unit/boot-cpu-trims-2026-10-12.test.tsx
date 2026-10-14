/**
 * ⚡ 첫 렌더 CPU 다듬기 (2026-10-12, 대표 "대기업급 속도 · 근본 원인") — 재생 프로파일(CPU 4배)에서 잡힌 두 자리.
 *   ① `formatNumber` 가 부를 때마다 숫자 포매터를 새로 짓던 것(자체 시간 74ms) → 로캘마다 한 번
 *   ② 비로그인 방문자 카드마다 찜 목록 쿼리를 구독하던 것(하트들 약 100ms) → 비로그인은 구독 없음
 * ⚠️ 못 막는 것: 실제 체감 ms(이 크기는 재생 측정의 편차 안이다 — 동작을 고정할 뿐).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { formatNumber, formatPriceShort } from '@/utils/format'

const useWishlist = vi.fn(() => ({ data: [{ product_id: 7 }] }))
vi.mock('@/hooks/queries/useWishlist', () => ({ useWishlist: () => useWishlist() }))
vi.mock('@tanstack/react-query', async (orig) => ({ ...(await orig<object>()), useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))

describe('① formatNumber — 출력은 toLocaleString 과 같다', () => {
  it.each([0, 7, 1234, 1234567, -9800, 12.5, 0.1234, 1e12])('%s', (n) => {
    expect(formatNumber(n)).toBe(n.toLocaleString('ko-KR'))
    expect(formatNumber(n, 'en-US')).toBe(n.toLocaleString('en-US'))
  })
  it('비정상 입력은 0', () => {
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber('abc')).toBe('0')
    expect(formatPriceShort(9800)).toBe('9,800')
  })
})

describe('② 찜 하트 — 비로그인은 구독하지 않는다', () => {
  async function renderHeart() {
    const { default: WishlistHeart } = await import('@/components/deal/WishlistHeart')
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route path="/x" element={<WishlistHeart productId={7} />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('비로그인: useWishlist 0회 · 누르면 로그인으로', async () => {
    localStorage.clear(); useWishlist.mockClear()
    await renderHeart()
    expect(useWishlist).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '찜하기' }))
    expect(screen.getByText('login page')).toBeTruthy()
  })

  it('로그인: 종전대로 구독하고 찜 상태를 칠한다', async () => {
    localStorage.clear(); localStorage.setItem('session_login', '1'); useWishlist.mockClear()
    await renderHeart()
    expect(useWishlist).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '찜 해제' }).getAttribute('aria-pressed')).toBe('true')
    localStorage.clear()
  })
})
