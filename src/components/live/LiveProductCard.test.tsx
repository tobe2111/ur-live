import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiveProductCard } from '@/components/live/LiveProductCard'

describe('LiveProductCard Component', () => {
  const mockProduct = {
    id: 1,
    name: '테스트 상품',
    price: 29900,
    originalPrice: 39900,
    image: '/test-product.jpg',
    rating: 4.5,
    sold: 1234,
    stock: 50,
  }

  const mockOnAddToCart = vi.fn()

  it('상품 정보를 올바르게 렌더링한다', () => {
    render(
      <LiveProductCard
        product={mockProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    expect(screen.getByText('테스트 상품')).toBeInTheDocument()
    expect(screen.getByText('29,900원')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('1,234개 판매')).toBeInTheDocument()
    expect(screen.getByText('재고: 50개')).toBeInTheDocument()
  })

  it('할인율을 올바르게 계산하여 표시한다', () => {
    render(
      <LiveProductCard
        product={mockProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    // (39900 - 29900) / 39900 * 100 = 25%
    expect(screen.getByText('25% OFF')).toBeInTheDocument()
    expect(screen.getByText('39,900원')).toBeInTheDocument()
  })

  it('장바구니 추가 버튼이 작동한다', () => {
    render(
      <LiveProductCard
        product={mockProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    const addButton = screen.getByRole('button', { name: /장바구니 담기/ })
    fireEvent.click(addButton)

    expect(mockOnAddToCart).toHaveBeenCalledWith(1)
  })

  it('품절 상품은 품절 오버레이와 비활성화된 버튼을 표시한다', () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 }
    
    render(
      <LiveProductCard
        product={outOfStockProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    expect(screen.getByText('품절')).toBeInTheDocument()
    const addButton = screen.getByRole('button', { name: /품절/ })
    expect(addButton).toBeDisabled()
  })

  it('장바구니 추가 중일 때 버튼이 비활성화되고 로딩 텍스트를 표시한다', () => {
    render(
      <LiveProductCard
        product={mockProduct}
        onAddToCart={mockOnAddToCart}
        isAddingToCart={true}
      />
    )

    const addButton = screen.getByRole('button', { name: /추가 중.../ })
    expect(addButton).toBeDisabled()
  })

  it('할인이 없는 상품은 할인 배지를 표시하지 않는다', () => {
    const noDiscountProduct = { ...mockProduct, originalPrice: undefined }
    
    render(
      <LiveProductCard
        product={noDiscountProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    expect(screen.queryByText(/OFF/)).not.toBeInTheDocument()
  })

  it('평점이 없는 상품은 평점을 표시하지 않는다', () => {
    const noRatingProduct = { ...mockProduct, rating: undefined }
    
    render(
      <LiveProductCard
        product={noRatingProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    expect(screen.queryByText(/4.5/)).not.toBeInTheDocument()
  })

  it('재고 정보가 없는 상품은 재고를 표시하지 않는다', () => {
    const noStockProduct = { ...mockProduct, stock: undefined }
    
    render(
      <LiveProductCard
        product={noStockProduct}
        onAddToCart={mockOnAddToCart}
      />
    )

    expect(screen.queryByText(/재고:/)).not.toBeInTheDocument()
  })
})
