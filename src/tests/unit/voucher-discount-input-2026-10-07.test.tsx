/**
 * 💸 **이용권 등록 — 할인을 [원 / %] 로 골라 넣기** (2026-10-07 대표 *"3000원 할인 이렇게도 선택해서"* → 1번 확정)
 *
 * 지키는 것:
 *   ① 계산 — 3,000원 할인이면 정가 − 3,000, 20% 면 10원 단위 반올림, 판매가가 정가를 넘거나 0 이 되지 않는다
 *   ② 진실은 판매가 하나 — 할인 칸은 저장하지 않고 늘 (정가, 판매가)에서 다시 계산해 보여 준다
 *      (판매가를 직접 고치면 할인 칸이 따라온다)
 *   ③ % 표시 값은 손님 화면과 같은 SSOT(`priceDisplay`)에서 나온다
 *   ④ 등록 화면이 이 부품을 실제로 쓴다
 *
 * ⚠️ 못 보는 것: 폰 폭에서 원/% 토글이 어떻게 보이는지(그려서 볼 것) · 수정 화면(이번 범위 밖 — 1번 = 등록만).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { readCode } from '../helpers/source-text'
import { priceFromDiscount, discountFromPrices } from '@/pages/seller-meal-voucher/discount-input'
import { priceDisplay } from '@/shared/price-display'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}))

import DiscountPriceFields from '@/pages/seller-meal-voucher/DiscountPriceFields'

describe('① 계산', () => {
  it('원 할인: 정가 10,000 · 3,000원 → 7,000', () => {
    expect(priceFromDiscount(10_000, 'won', 3_000)).toBe(7_000)
  })
  it('% 할인: 10원 단위로 맞춘다', () => {
    expect(priceFromDiscount(10_000, 'pct', 20)).toBe(8_000)
    expect(priceFromDiscount(9_990, 'pct', 33)).toBe(6_690)
  })
  it('판매가는 0 이 되지 않고 정가를 넘지 않는다', () => {
    expect(priceFromDiscount(10_000, 'won', 50_000)).toBe(1)
    expect(priceFromDiscount(10_000, 'pct', 100)).toBeGreaterThan(0)
    expect(priceFromDiscount(12_345, 'pct', 0)).toBe(12_345)
    expect(priceFromDiscount(12_345, 'pct', 0.01)).toBeLessThanOrEqual(12_345)
  })
  it('정가가 없으면 할인으로 판매가를 못 만든다', () => {
    expect(priceFromDiscount(0, 'won', 3_000)).toBe(0)
  })
  it('할인 칸 표시는 (정가, 판매가)에서 다시 계산 — 원/% 둘 다', () => {
    expect(discountFromPrices(10_000, 7_000, 'won')).toBe(3_000)
    expect(discountFromPrices(10_000, 7_000, 'pct')).toBe(30)
    expect(discountFromPrices(10_000, 10_000, 'won')).toBe(0)
    expect(discountFromPrices(0, 7_000, 'pct')).toBe(0)
  })
  it('% 표시 값은 손님 화면 SSOT 와 같다', () => {
    for (const [o, p] of [[10_000, 6_990], [9_900, 8_910], [38_000, 30_100]]) {
      expect(discountFromPrices(o, p, 'pct')).toBe(priceDisplay({ price: p, original_price: o }).discount)
    }
  })
})

function Harness({ initial }: { initial: { price: number; original_price: number } }) {
  const [f, setF] = useState(initial)
  return (
    <>
      <DiscountPriceFields price={f.price} originalPrice={f.original_price}
        update={(k, v) => setF((s) => ({ ...s, [k]: Number(v) }))} />
      <output data-testid="price">{f.price}</output>
    </>
  )
}

describe('② 진실은 판매가 하나', () => {
  it('원을 고르고 3000 을 넣으면 판매가 7,000 이 저장된다', () => {
    const r = render(<Harness initial={{ price: 0, original_price: 10_000 }} />)
    fireEvent.click(r.getByRole('radio', { name: '원' }))
    const discount = r.getByPlaceholderText('3000') as HTMLInputElement
    fireEvent.change(discount, { target: { value: '3000' } })
    expect(r.getByTestId('price').textContent).toBe('7000')
  })
  it('판매가를 직접 고치면 할인 칸이 따라온다(따로 저장하지 않는다)', () => {
    const r = render(<Harness initial={{ price: 8_000, original_price: 10_000 }} />)
    const discount = r.getByPlaceholderText('20') as HTMLInputElement
    expect(discount.value).toBe('20')
    fireEvent.change(r.getByPlaceholderText('25000'), { target: { value: '7000' } })
    expect(discount.value).toBe('30')
  })
  it('정가가 없으면 할인 칸이 잠긴다', () => {
    const r = render(<Harness initial={{ price: 0, original_price: 0 }} />)
    expect((r.getByPlaceholderText('정가 먼저') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('④ 배선', () => {
  it('등록 화면 2단계가 이 부품을 쓰고, 옛 판매가/정가 두 칸을 따로 두지 않는다', () => {
    const s = readCode('src/pages/seller-meal-voucher/VoucherInfoStep.tsx')
    expect(s).toMatch(/<DiscountPriceFields price=\{form\.price\} originalPrice=\{form\.original_price\} update=\{update\} \/>/)
    expect(s).not.toMatch(/update\('price', Number\(e\.target\.value\)\)/)
  })
  it('할인 값은 폼에 저장하지 않는다(판매가만 쓴다)', () => {
    const c = readCode('src/pages/seller-meal-voucher/DiscountPriceFields.tsx')
    expect(c).not.toMatch(/update\('discount/)
  })
})
