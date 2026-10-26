/**
 * 🎯 2026-10-27 (대표 "데모 이용권 상세 하단에 구매하기 보다 응모하기 … 결제하기 눌렀더니 당첨자만 구매할 수
 *   있다고 뜨고 있어"): 추첨 상품이면 당첨자가 아닌 손님에게 하단 버튼이 **결제 대신 응모**를 한다.
 *   이용권 바·PC 상자·숙소 바가 같은 `useFcfsDetail` 을 본다(대표 "통일할 건 통일").
 * 못 보는 것: 서버 응모 처리 · 실제 결제 차단(서버 `fcfs-gate.ts` 몫).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DealBottomBar from '@/pages/group-buy/DealBottomBar'
import DealPurchaseBox from '@/pages/group-buy/DealPurchaseBox'
import { __resetFcfsDetailStore } from '@/features/group-buy/useFcfsDetail'
import { readCode } from '../helpers/source-text'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }))
vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } })
let myStatus: string | null = null

beforeEach(() => {
  __resetFcfsDetailStore()
  localStorage.setItem('user_id', '3')
  myStatus = null
  get.mockReset(); post.mockReset()
  get.mockImplementation((u: string) => {
    if (String(u).endsWith('/me')) return ok({ status: myStatus })
    if (String(u).includes('/api/fcfs/')) return ok({ enabled: true, spots: 5, appliedDisplay: 12, deadline: null })
    return ok({})
  })
  post.mockImplementation(() => ok({ appliedDisplay: 13 }))
})

const common = {
  isJoinable: true, isPrelaunch: false, buyable: true, joining: false, quantity: 1, total: 30000,
  setQuantity: () => {}, maxQty: 5, unitPrice: 30000, refPrice: 35000, discountPct: 14,
}
const bar = (onJoin = vi.fn()) => <DealBottomBar {...common} dealPlan={null} dealUse={null} setDealUse={() => {}} canPayWithDeal={false} dealBalance={0} productId={7} onJoin={onJoin} />

describe('추첨 상품 하단 버튼', () => {
  it('당첨 전이면 [응모하기] — 누르면 응모하고 결제 창은 안 연다', async () => {
    const onJoin = vi.fn()
    render(bar(onJoin))
    const btn = await screen.findByRole('button', { name: /응모하기/ })
    fireEvent.click(btn)
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/fcfs/7/apply'))
    expect(onJoin).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    await screen.findByRole('button', { name: /응모 완료/ })
  })
  it('당첨자는 종전대로 [구매하기]', async () => {
    myStatus = 'selected'
    render(bar())
    await waitFor(() => expect(get.mock.calls.some(([u]) => String(u).endsWith('/me'))).toBe(true))
    await screen.findByRole('button', { name: '구매하기' })
  })
  it('추첨이 아닌 상품은 [구매하기] 그대로', async () => {
    get.mockImplementation(() => ok({ enabled: false }))
    render(bar())
    await screen.findByRole('button', { name: '구매하기' })
  })
  it('PC 구매 상자도 같은 값을 본다', async () => {
    render(
      <MemoryRouter initialEntries={['/pass/7']}>
        <Routes><Route path="/pass/:id" element={<DealPurchaseBox {...common} name="x" unitSaving={5000} totalSaving={5000} onBuy={() => {}} onPrelaunchApply={() => {}} />} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('button', { name: /응모하기/ })
  })
  it('숙소 상세도 같은 훅으로 응모 칸·하단 버튼을 낸다', () => {
    const s = readCode('src/pages/StayDetailPage.tsx')
    expect(s).toMatch(/useFcfsDetail\(productId\)/)
    expect(s).toMatch(/<FcfsApplyBlock productId=\{productId\} \/>/)
    expect(s).toMatch(/raffle=\{fcfs\.gate \?/)
  })

  // 🎯 2026-10-26 (대표 "데모 이용권은 그냥 응모하기만 되면 돼"): 추첨 상품의 PC 상자엔 결제 흔적이 없다.
  it('PC 상자 — 추첨이면 수량·딜 사용·결제 안내를 안 그린다', async () => {
    render(
      <MemoryRouter initialEntries={['/group-buy/7']}>
        <Routes><Route path="/group-buy/:id" element={<DealPurchaseBox {...common} name="x" unitSaving={5000} totalSaving={5000} onBuy={() => {}} onPrelaunchApply={() => {}} dealSlot={<div>딜사용슬롯</div>} />} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('button', { name: /응모하기/ })
    expect(screen.queryByRole('group', { name: '수량 조절' })).toBeNull()
    expect(screen.queryByText('딜사용슬롯')).toBeNull()
    expect(screen.queryByText(/토스로 3초 안전결제/)).toBeNull()
    expect(screen.getByText(/결제 없이 응모해요/)).toBeTruthy()
  })
  it('추첨 여부를 모르는 동안 결제 버튼은 결제 창을 안 연다', async () => {
    let release: (v: unknown) => void = () => {}
    get.mockImplementation((u: string) => String(u).includes('/api/fcfs/') ? new Promise((r) => { release = r }) : ok({}))
    render(bar())
    fireEvent.click(screen.getByRole('button', { name: '구매하기' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    release({ data: { success: true, data: { enabled: false } } })
  })
})
