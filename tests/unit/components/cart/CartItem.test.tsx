import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CartItemComponent } from '@/components/cart/CartItem'

describe('CartItem Component', () => {
  const mockItem = {
    id: 1,
    product_id: 100,
    product_name: '테스트 상품',
    image_url: '/test-image.jpg',
    quantity: 2,
    price_snapshot: 10000,
    option_value: '블랙 / L',
  }

  const mockHandlers = {
    onToggleSelect: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onRemove: vi.fn(),
    onOpenOption: vi.fn(),
  }

  it('상품 정보를 올바르게 렌더링한다', () => {
    render(
      <CartItemComponent
        item={mockItem}
        isSelected={true}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('테스트 상품')).toBeInTheDocument()
    expect(screen.getByText('블랙 / L')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('20,000원')).toBeInTheDocument()
  })

  it('수량 증가 버튼이 작동한다', () => {
    render(
      <CartItemComponent
        item={mockItem}
        isSelected={true}
        {...mockHandlers}
      />
    )

    const buttons = screen.getAllByRole('button')
    const increaseButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-plus'))
    fireEvent.click(increaseButton!)

    expect(mockHandlers.onUpdateQuantity).toHaveBeenCalledWith(1, 1)
  })

  it('수량 감소 버튼이 작동한다', () => {
    render(
      <CartItemComponent
        item={mockItem}
        isSelected={true}
        {...mockHandlers}
      />
    )

    const buttons = screen.getAllByRole('button')
    const decreaseButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-minus'))
    fireEvent.click(decreaseButton!)

    expect(mockHandlers.onUpdateQuantity).toHaveBeenCalledWith(1, -1)
  })

  it('수량이 1일 때 감소 버튼이 비활성화된다', () => {
    const itemWithQuantityOne = { ...mockItem, quantity: 1 }
    
    render(
      <CartItemComponent
        item={itemWithQuantityOne}
        isSelected={true}
        {...mockHandlers}
      />
    )

    const buttons = screen.getAllByRole('button')
    const decreaseButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-minus'))
    expect(decreaseButton).toBeDisabled()
  })

  it('삭제 버튼이 작동한다', () => {
    render(
      <CartItemComponent
        item={mockItem}
        isSelected={true}
        {...mockHandlers}
      />
    )

    const buttons = screen.getAllByRole('button')
    const deleteButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-x'))
    fireEvent.click(deleteButton!)

    expect(mockHandlers.onRemove).toHaveBeenCalledWith(1)
  })

  it('체크박스 선택이 작동한다', () => {
    render(
      <CartItemComponent
        item={mockItem}
        isSelected={false}
        {...mockHandlers}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(mockHandlers.onToggleSelect).toHaveBeenCalledWith(1)
  })

  it('업데이트 중일 때 버튼들이 비활성화된다', () => {
    render(
      <CartItemComponent
        item={mockItem}
        isSelected={true}
        isUpdating={true}
        {...mockHandlers}
      />
    )

    const buttons = screen.getAllByRole('button')
    const increaseButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-plus'))
    const decreaseButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-minus'))
    const deleteButton = buttons.find(btn => btn.querySelector('svg')?.classList.contains('lucide-x'))

    expect(increaseButton).toBeDisabled()
    expect(decreaseButton).toBeDisabled()
    expect(deleteButton).toBeDisabled()
  })
})
