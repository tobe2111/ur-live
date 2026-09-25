/**
 * 🔴 마이 안 판매 작업 — **보내기 직전 좌석 확인** (2026-09-25, 설계 §15-3 규칙 ②)
 *
 * ## 이 시험이 막는 사고
 * 좌석 토큰은 JWT 안에 `seller_id` 가 박혀 있어 **가게를 바꾸면 토큰이 통째로 바뀐다.**
 * 셀러 대시보드는 전환 뒤 하드 리로드로 그 틈을 없앴지만, 마이는 리로드를 못 한다.
 * 그래서 이런 순간이 생긴다:
 *
 *     가게 A 의 주문 목록을 펼쳐 둔 채 → [가게 전환] 으로 B → 화면에 남은 A 의 행에서 [확인]
 *
 * 서버는 토큰으로 스코프하니 남의 주문이 확정되지는 않는다. 문제는 **사장님이 처리했다고 믿는데
 * 아무 일도 안 일어나는 것**이다. ⇒ 보내기 전에 막고, 다시 부른다.
 *
 * ## 못 막는 것
 * - 서버 권한 판정(그건 `canOperateStore` 와 `seller-operators-invariants.test.ts` 의 몫).
 * - 실제 브라우저에서의 탭·스크롤(jsdom 은 레이아웃이 없다).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

/**
 * 🩸 "부르지 않는다" 를 `waitFor` 로 쓰면 **첫 확인에서 바로 통과**한다 — 요청이 나갈 기회를 주기 전에
 *   끝나므로 어떤 결함도 못 잡는다(주입 검증이 실제로 이걸 잡았다). 진짜로 기다렸다가 센다.
 */
async function settle() {
  await act(async () => { await new Promise((r) => setTimeout(r, 25)) })
}

const put = vi.fn(async () => ({ data: { success: true } }))
const get = vi.fn(async (url: string) => ({
  data: {
    success: true,
    data: url.includes('/orders')
      ? [{ id: 1, order_number: 'A-1', status: 'PAID', total_amount: 22000, shipping_name: '김손님', created_at: '2026-09-25 00:12:00', items: [{ product_name: '치즈돈까스' }] }]
      : [{ id: 11, name: '치즈돈까스', price: 22000, is_active: 1, group_buy_current: 3, status: 'ACTIVE' }],
  },
}))
vi.mock('@/lib/api', () => ({ default: { get, put } }))

/** base64url JWT 흉내 — 한글 payload 를 넣어 순진한 atob 을 걸러 낸다. */
function seatToken(sellerId: number): string {
  const json = JSON.stringify({ seller_id: sellerId, name: '돈까스연구소', type: 'seller' })
  let bin = ''
  for (const b of new TextEncoder().encode(json)) bin += String.fromCharCode(b)
  return `h.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`
}

async function load() {
  const seat = await import('@/lib/seller-seat')
  const { useSellerWork } = await import('@/pages/user-profile/seller-section/useSellerWork')
  return { seat, useSellerWork }
}

describe('좌석이 맞을 때만 일한다', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('좌석이 다르면 목록을 아예 안 부른다 — 부르면 남의 가게 숫자를 그린다', async () => {
    localStorage.setItem('seller_token', seatToken(8))
    const { useSellerWork } = await load()
    renderHook(() => useSellerWork(7, true))
    await settle()
    expect(get).not.toHaveBeenCalled()
  })

  it('좌석이 맞으면 주문·상품을 부르고, 확인 대기만 남긴다', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    const { result } = renderHook(() => useSellerWork(7, true))
    await waitFor(() => expect(result.current.orders.length).toBe(1))
    expect(result.current.orders[0].title).toBe('치즈돈까스')
    expect(result.current.orders[0].buyer).toBe('김손님')
    expect(result.current.products.length).toBe(1)
  })

  it('접혀 있으면(enabled=false) 요청이 0 이다', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    renderHook(() => useSellerWork(7, false))
    await settle()
    expect(get).not.toHaveBeenCalled()
  })
})

describe('🔴 전환 뒤 남은 행에서 눌러도 보내지 않는다', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('주문 확인 — 좌석이 어긋나면 PUT 0 · 안내 · 재조회', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    const onSeatLost = vi.fn()
    const { result } = renderHook(() => useSellerWork(7, true, onSeatLost))
    await waitFor(() => expect(result.current.orders.length).toBe(1))
    const stale = result.current.orders[0]

    // 🪑 여기서 가게가 바뀐다 — 화면에는 아직 A 의 행이 남아 있다.
    localStorage.setItem('seller_token', seatToken(8))

    let ok: boolean | undefined
    await act(async () => { ok = await result.current.confirmOrder(stale) })
    expect(ok).toBe(false)
    expect(put).not.toHaveBeenCalled()
    expect(onSeatLost).toHaveBeenCalledTimes(1)
  })

  it('판매 토글 — 좌석이 어긋나면 PUT 0', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    const onSeatLost = vi.fn()
    const { result } = renderHook(() => useSellerWork(7, true, onSeatLost))
    await waitFor(() => expect(result.current.products.length).toBe(1))
    const stale = result.current.products[0]

    localStorage.setItem('seller_token', seatToken(8))
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.toggleProduct(stale) })
    expect(ok).toBe(false)
    expect(put).not.toHaveBeenCalled()
    expect(onSeatLost).toHaveBeenCalledTimes(1)
  })
})

describe('좌석이 맞으면 제대로 보낸다', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('주문 확인은 PREPARING 전이 — 대시보드 [주문 확인] 칩과 같은 동작', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    const { result } = renderHook(() => useSellerWork(7, true))
    await waitFor(() => expect(result.current.orders.length).toBe(1))
    await act(async () => { await result.current.confirmOrder(result.current.orders[0]) })
    expect(put).toHaveBeenCalledWith('/api/seller/orders/A-1/status', { status: 'PREPARING' })
    // 응답 성공 뒤에만 목록에서 사라진다(낙관적 갱신 금지 — 서버가 거절할 수 있다).
    await waitFor(() => expect(result.current.orders.length).toBe(0))
  })

  it('판매 끄기는 is_active 와 status 를 **함께** 보낸다(한쪽만 보내면 노출이 안 꺼진다)', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    const { result } = renderHook(() => useSellerWork(7, true))
    await waitFor(() => expect(result.current.products.length).toBe(1))
    await act(async () => { await result.current.toggleProduct(result.current.products[0]) })
    expect(put).toHaveBeenCalledWith('/api/seller/products/11', { is_active: false, status: 'HIDDEN' })
    await waitFor(() => expect(result.current.products[0].isActive).toBe(false))
  })

  it('서버가 거절하면 화면도 안 바뀐다', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    put.mockResolvedValueOnce({ data: { success: false } } as never)
    const { useSellerWork } = await load()
    const { result } = renderHook(() => useSellerWork(7, true))
    await waitFor(() => expect(result.current.orders.length).toBe(1))
    let ok: boolean | undefined
    await act(async () => { ok = await result.current.confirmOrder(result.current.orders[0]) })
    expect(ok).toBe(false)
    expect(result.current.orders.length).toBe(1)
  })
})
