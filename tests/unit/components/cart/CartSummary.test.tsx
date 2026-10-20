import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CartSummary } from '@/components/cart/CartSummary'

describe('CartSummary Component', () => {
  it('총 결제금액을 올바르게 계산하여 표시한다', () => {
    render(
      <CartSummary
        totalItems={3}
        subtotal={50000}
        shippingFee={3000}
        total={53000}
      />
    )

    expect(screen.getByText('상품금액 (3개)')).toBeInTheDocument()
    expect(screen.getByText('50,000원')).toBeInTheDocument()
    expect(screen.getByText('3,000원')).toBeInTheDocument()
    expect(screen.getByText('53,000원')).toBeInTheDocument()
  })

  it('무료배송일 때 "무료"로 표시한다', () => {
    render(
      <CartSummary
        totalItems={5}
        subtotal={150000}
        shippingFee={0}
        total={150000}
      />
    )

    expect(screen.getByText('무료')).toBeInTheDocument()
  })

  it('10만원 미만일 때 무료배송 안내 메시지를 표시한다', () => {
    render(
      <CartSummary
        totalItems={2}
        subtotal={70000}
        shippingFee={3000}
        total={73000}
      />
    )

    expect(screen.getByText(/30,000원 더 담으면 무료배송/)).toBeInTheDocument()
  })

  it('10만원 이상일 때 무료배송 안내 메시지를 표시하지 않는다', () => {
    render(
      <CartSummary
        totalItems={5}
        subtotal={150000}
        shippingFee={0}
        total={150000}
      />
    )

    expect(screen.queryByText(/더 담으면 무료배송/)).not.toBeInTheDocument()
  })

  it('상품금액이 0원일 때 무료배송 안내를 표시하지 않는다', () => {
    render(
      <CartSummary
        totalItems={0}
        subtotal={0}
        shippingFee={0}
        total={0}
      />
    )

    expect(screen.queryByText(/더 담으면 무료배송/)).not.toBeInTheDocument()
  })

  it('숫자를 천 단위로 포맷팅한다', () => {
    render(
      <CartSummary
        totalItems={10}
        subtotal={1234567}
        shippingFee={3000}
        total={1237567}
      />
    )

    expect(screen.getByText('1,234,567원')).toBeInTheDocument()
    expect(screen.getByText('1,237,567원')).toBeInTheDocument()
  })
})
