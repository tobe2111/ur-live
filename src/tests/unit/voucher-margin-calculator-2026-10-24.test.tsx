/**
 * 💰 이용권 마진 계산기 (2026-10-24 대표 *"유어딜 수수료, 인플루언서 수수료, 할인금액 이렇게 빼고 최종 마진"*)
 *
 * 지키는 것:
 *  ① 산술 — 정가 − 할인 − 유어딜 수수료 − 인플루언서 수수료 = 최종 마진. 수수료는 **판매가** 기준.
 *  ② 유어딜 수수료는 서버(fee-context)가 준 % 만 쓴다(매장별 20% 같은 요율도 그대로).
 *  ③ 인플루언서 수수료는 계산용 입력 — 바꾸면 마진이 따라 바뀌고, 저장된 소개비가 오면 그 값으로 잠긴다.
 *  ④ 등록·수정 두 화면에 같은 계산기가 붙는다.
 *
 * ⚠️ 못 보는 것: 실제 정산 금액(결제 경로 — 이 카드는 표시 전용) · 화면이 보기 좋은지.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import NetProceedsCard, { voucherMargin } from '@/pages/seller-meal-voucher/NetProceedsCard'

beforeEach(() => {
  cleanup()
  get.mockReset()
})

describe('① 산술', () => {
  it('정가 30,000 · 판매가 24,000 · 유어딜 10% · 인플루언서 10% → 최종 19,200원(정가의 64%)', () => {
    expect(voucherMargin({ price: 24000, originalPrice: 30000, platformFeePct: 10, influencerPct: 10 })).toMatchObject({
      list: 30000, discount: 6000, discountPct: 20, platformCut: 2400, influencerCut: 2400, net: 19200, marginPct: 64,
    })
  })
  it('정가가 없거나 판매가 이하면 할인 0 — 판매가에서 시작한다', () => {
    for (const originalPrice of [undefined, 0, 24000, 20000]) {
      const m = voucherMargin({ price: 24000, originalPrice, platformFeePct: 5, influencerPct: 0 })
      expect(m).toMatchObject({ list: 24000, discount: 0, platformCut: 1200, influencerCut: 0, net: 22800 })
    }
  })
  it('인플루언서 % 는 0~50 으로 자르고, 수수료는 판매가 기준이다(정가 아님)', () => {
    expect(voucherMargin({ price: 10000, originalPrice: 50000, platformFeePct: 0, influencerPct: 90 }).influencerCut).toBe(5000)
    expect(voucherMargin({ price: 10000, originalPrice: 50000, platformFeePct: 0, influencerPct: -5 }).influencerCut).toBe(0)
    expect(voucherMargin({ price: 10000, originalPrice: 50000, platformFeePct: 20, influencerPct: 0 }).platformCut).toBe(2000)
  })
})

const feeCtx = (pct: number, channel: string | null = 'brokered') =>
  get.mockResolvedValue({ data: { success: true, data: { channel, platform_fee_pct: pct, channel_rates_active: false } } })

describe('② ③ 화면', () => {
  it('서버 요율로 각 줄을 보이고, 인플루언서 % 를 넣으면 최종 마진이 바뀐다', async () => {
    feeCtx(20)
    render(<NetProceedsCard price={24000} originalPrice={30000} />)
    await screen.findByText('마진 계산기')
    expect(get).toHaveBeenCalledWith('/api/seller/fee-context')
    expect(screen.getByText(/유어딜 수수료 \(20%/)).toBeTruthy()
    expect(screen.getByText('−4,800원')).toBeTruthy()
    expect(screen.getByText('−6,000원')).toBeTruthy()
    expect(screen.getByText(/^19,200원/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/인플루언서 수수료/), { target: { value: '10' } })
    await waitFor(() => expect(screen.getByText(/^16,800원/)).toBeTruthy())
    expect(screen.getByText(/직접 팔리면 19,200원/)).toBeTruthy()
  })
  it('저장된 소개비가 오면 그 값으로 계산하고 입력칸은 잠근다', async () => {
    feeCtx(5)
    render(<NetProceedsCard price={10000} promoPct={15} />)
    await screen.findByText('마진 계산기')
    const input = screen.getByLabelText(/인플루언서 수수료/) as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.value).toBe('15')
    expect(screen.getByText(/^8,000원/)).toBeTruthy()
  })
  it('수수료를 못 받으면(미로그인·오류) 지어낸 숫자를 보이지 않는다', async () => {
    get.mockRejectedValue(new Error('401'))
    const { container } = render(<NetProceedsCard price={10000} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })
})

describe('④ 배선', () => {
  it('등록 화면이 정가를 넘긴다', () => {
    expect(readFileSync('src/pages/seller-meal-voucher/VoucherInfoStep.tsx', 'utf8'))
      .toMatch(/<NetProceedsCard price=\{form\.price\} originalPrice=\{form\.original_price\}/)
  })
  it('수정 화면도 이용권이면 같은 계산기를 보인다', () => {
    expect(readFileSync('src/pages/SellerProductEditPage.tsx', 'utf8')).toMatch(/margin=\{isVoucherCategory\(formData\.category\)\}/)
    expect(readFileSync('src/pages/seller-product-edit/PriceStockFields.tsx', 'utf8')).toMatch(/\{margin && <NetProceedsCard /)
  })
})
