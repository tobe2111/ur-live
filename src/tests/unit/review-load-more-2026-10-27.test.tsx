/**
 * 💬 2026-10-27 (대표 "리뷰 더 보기도 필요할 것 같은데?") — 첫 5개 뒤로 다음 페이지를 이어 붙인다.
 * 못 보는 것: 실제 서버 페이지 경계(스텁) · 버튼 생김새.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProductReviews from '@/pages/product-detail/ProductReviews'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn() } }))
vi.mock('@/lib/i18n-lite', () => ({
  useTranslation: () => ({ t: (_k: string, o?: Record<string, unknown>) => String(o?.defaultValue ?? _k).replace(/\{\{n\}\}/g, String(o?.n ?? '')) }),
}))
vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } })
const rv = (id: number) => ({ id, rating: 5, content: `리뷰 본문 ${id}`, user_name: `손님${id}`, created_at: '2026-10-01 00:00:00' })

beforeEach(() => {
  // 폴드 아래 게이트(IntersectionObserver)를 즉시 통과시킨다.
  vi.stubGlobal('IntersectionObserver', class { constructor(cb: (e: Array<{ isIntersecting: boolean }>) => void) { setTimeout(() => cb([{ isIntersecting: true }])) } observe() {} disconnect() {} })
  get.mockReset()
  get.mockImplementation((url: string) => {
    const u = String(url)
    if (u.includes('/summary')) return ok({ avg_rating: 4.8, total_count: 7, star_5: 7 })
    if (u.includes('page=2')) return ok({ reviews: [rv(6), rv(7)] })
    if (u.includes('/eligibility') || u.includes('reward-config')) return ok({})
    return ok({ reviews: [1, 2, 3, 4, 5].map(rv) })
  })
})

describe('리뷰 더 보기', () => {
  it('남은 개수를 말하고, 누르면 다음 페이지를 이어 붙이고 사라진다', async () => {
    render(<ProductReviews productId={1} limit={5} />)
    const btn = await screen.findByRole('button', { name: /리뷰 더 보기 \(2개 남음\)/ })
    fireEvent.click(btn)
    await screen.findByText('리뷰 본문 7')
    expect(screen.getByText('리뷰 본문 1')).toBeTruthy()
    expect(get.mock.calls.some(([u]) => String(u).includes('limit=5&page=2'))).toBe(true)
    await waitFor(() => expect(screen.queryByRole('button', { name: /리뷰 더 보기/ })).toBeNull())
  })
})
