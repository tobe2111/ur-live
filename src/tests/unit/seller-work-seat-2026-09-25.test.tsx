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
    // 🔁 2026-10-06 재조준: 상품 목록은 이제 **달라고 해야** 받는다(4번째 인자). 불변식은 그대로다 —
    //   *좌석이 맞으면 두 목록을 받아 확인 대기만 남긴다*. 바뀐 것은 "언제 받는가" 하나다.
    const { result } = renderHook(() => useSellerWork(7, true, undefined, true))
    await waitFor(() => expect(result.current.orders.length).toBe(1))
    expect(result.current.orders[0].title).toBe('치즈돈까스')
    expect(result.current.orders[0].buyer).toBe('김손님')
    expect(result.current.products.length).toBe(1)
  })

  /**
   * ⚡ 2026-10-06 — 첫 화면(마이 '내 가게')은 상품 목록을 **안 받는다**(대표 *"내 가게 이 부분이
   *   가장 늦게 떠"*). 소스 검사는 `first-screen-fetch-2026-10-06.test.ts` 가 하고, 여기서는
   *   **실제로 요청이 안 나가는지**를 센다(문자열이 맞아도 배선이 틀릴 수 있다).
   */
  it('기본(첫 화면)은 주문만 부르고 상품은 안 부른다', async () => {
    localStorage.setItem('seller_token', seatToken(7))
    const { useSellerWork } = await load()
    const { result } = renderHook(() => useSellerWork(7, true))
    await waitFor(() => expect(result.current.orders.length).toBe(1))
    await settle()
    const urls = get.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/api/seller/orders'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/seller/products'))).toBe(false)
    // 그리고 그 회차를 **실패로 세지 않는다** — 안 그러면 멀쩡한데 "불러오지 못했습니다" 가 뜬다.
    expect(result.current.failed).toBe(false)
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
    // 상품 경로를 시험하므로 목록을 켠다(첫 화면은 이걸 안 켠다 — 위 ⚡ 참조).
    const { result } = renderHook(() => useSellerWork(7, true, onSeatLost, true))
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
    const { result } = renderHook(() => useSellerWork(7, true, undefined, true))
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
