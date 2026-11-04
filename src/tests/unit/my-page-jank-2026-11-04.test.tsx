/**
 * 🐢 2026-11-04 대표 *"최적화가 필요하네 버벅임이 심하네 특히 마이페이지"* (스크린샷: 끊긴 회선에서 마이가
 * 판매 판 없이 '매장 계산대' 카드 하나만 남음).
 *
 * 고친 것 둘:
 *  ① 오늘 매출 숫자 올라가기가 **판매 구역 전체**를 매 프레임 다시 그렸다(실측: 첫 1초에 커밋 60회 · 홈 9회,
 *     CPU×4 에서 스크립트 1,147ms → 960ms · React 663 → 448ms). 숫자만 `TodayRevenueCount` 로 떼었다.
 *  ② 마이 탭을 누를 때마다 좌석(내 가게)·'내 딜' 을 빈손에서 다시 받았다 → 같은 탭 재방문은 지난 값을
 *     즉시 그리고 뒤에서 새로 받는다. 재조회가 실패해도 그린 값을 지우지 않는다.
 *
 * ⚠️ 못 보는 것: 실제 폰 체감 · 한국 회선 왕복(로그인 필요 — 라이브 체감은 대표 확인).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { readCode, stripComments } from '../helpers/source-text'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import { useMyStores, __resetSeatMemo } from '@/pages/user-profile/useMyStores'

const ok = {
  data: {
    success: true,
    data: {
      stores: [{ seller_id: 7, name: '뼈로구이', role: 'owner', status: 'approved', today_revenue: 1000, today_orders: 1, pending: 0, active_products: 2 }],
      totals: { today_revenue: 1000, today_orders: 1, pending: 0 },
      current_seller_id: 7,
    },
  },
}

describe('① 숫자 올라가기는 숫자 한 칸만 다시 그린다', () => {
  const code = stripComments(readCode('src/pages/user-profile/SellerSection.tsx'))
  it('useCountUp 은 TodayRevenueCount 안에서만 불린다', () => {
    const body = code.slice(code.indexOf('export default function SellerSection'))
    expect(body, '본체에서 부르면 0.8초 동안 매 프레임 판매 구역 전체가 다시 그려진다').not.toMatch(/useCountUp\(/)
    expect(code).toMatch(/function TodayRevenueCount\([^)]*\)\s*\{\s*const shown = useCountUp\(/)
    expect(body).toContain('<TodayRevenueCount value={store?.today_revenue}')
  })
})

describe('② 좌석은 같은 탭 재방문에 지난 값을 즉시 쓴다', () => {
  beforeEach(() => {
    __resetSeatMemo()
    get.mockReset()
    localStorage.clear()
    localStorage.setItem('user_id', '3')
  })

  it('첫 방문은 종전대로 로딩부터 시작한다', async () => {
    get.mockResolvedValue(ok)
    const { result } = renderHook(() => useMyStores())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stores).toHaveLength(1)
  })

  it('재방문은 첫 프레임부터 지난 가게를 그리고, 재조회가 실패해도 지우지 않는다', async () => {
    get.mockResolvedValue(ok)
    const first = renderHook(() => useMyStores())
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    first.unmount()

    get.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useMyStores())
    expect(result.current.loading).toBe(false)
    expect(result.current.stores.map((s) => s.seller_id)).toEqual([7])
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.failed, '회선이 잠깐 끊겼다고 가게가 사라지면 안 된다').toBe(false)
    expect(result.current.stores).toHaveLength(1)
  })

  it('다른 사람으로 바뀌면 기억을 쓰지 않는다', async () => {
    get.mockResolvedValue(ok)
    const first = renderHook(() => useMyStores())
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    first.unmount()
    localStorage.setItem('user_id', '30')
    const { result } = renderHook(() => useMyStores())
    expect(result.current.loading).toBe(true)
    expect(result.current.stores).toHaveLength(0)
  })

  it('첫 방문의 실패는 여전히 실패다(성공처럼 위장하지 않는다)', async () => {
    get.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useMyStores())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.failed).toBe(true)
  })
})
