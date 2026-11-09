/**
 * 🗺️ 지도 첫 목록 요청이 두 번 나가지 않는다 (2026-11-09 폰 흉내 실측: 홈 지도 버튼 → 0.34s·0.53s 같은 요청 두 번).
 *   홈의 미리받기(`prefetchMapFeedFirstPage`)가 끝나기 전에 지도 화면이 마운트해도 같은 page 1 은 하나로 묶인다.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const get = vi.fn(() => new Promise((r) => setTimeout(() => r({ data: { success: true, data: [{ id: 1 }], total: 1 } }), 30)))
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...(a as [])) } }))
import { prefetchMapFeedFirstPage, useMapProducts } from '@/hooks/queries/useMapProducts'

describe('지도 첫 목록 묶기', () => {
  it('미리받기 진행 중에 화면이 마운트하면 요청은 1번', async () => {
    const pre = prefetchMapFeedFirstPage('food', null, 'discount')
    renderHook(() => useMapProducts('food', null, { sort: 'discount' }))
    await pre
    await new Promise((r) => setTimeout(r, 60))
    const firstPage = get.mock.calls.filter((c) => JSON.stringify(c).includes('"category":"food"'))
    expect(firstPage.length).toBe(1)
  })
})
