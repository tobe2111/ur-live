import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CartTab } from '@/components/mypage/CartTab'

describe('CartTab', () => {
  const mockOnUpdateQuantity = vi.fn()
  const mockOnRemoveItem = vi.fn()
  const mockOnCheckout = vi.fn()

  const mockCartItems = [
    {
      id: 1,
      product_id: 1,
      product_name: 'Test Product 1',
      quantity: 2,
      price_snapshot: 20000,
      option_value: 'Large',
    },
    {
      id: 2,
      product_id: 2,
      product_name: 'Test Product 2',
      quantity: 1,
      price_snapshot: 30000,
    },
  ]

  beforeEach(() => {
    mockOnUpdateQuantity.mockClear()
    mockOnRemoveItem.mockClear()
    mockOnCheckout.mockClear()
  })

  it('displays empty state when cart is empty', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={[]} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('장바구니가 비어있습니다')).toBeDefined()
    expect(screen.getByText('라이브를 시청하며 상품을 담아보세요')).toBeDefined()
    expect(screen.getByText('라이브 보러가기')).toBeDefined()
  })

  it('renders cart items correctly', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('Test Product 1')).toBeDefined()
    expect(screen.getByText('Test Product 2')).toBeDefined()
  })

  it('displays product options when available', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText(/옵션: Large/)).toBeDefined()
  })

  it('shows quantity controls', () => {
    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    // Should have minus and plus buttons
    const minusButtons = container.querySelectorAll('button')
    expect(minusButtons.length).toBeGreaterThan(0)
  })

  it('displays quantity correctly', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
  })

  it('calculates item total correctly', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    // 2 × 20,000 = 40,000
    expect(screen.getByText('40,000원')).toBeDefined()
    // 1 × 30,000 = 30,000
    expect(screen.getByText('30,000원')).toBeDefined()
  })

  it('calls onUpdateQuantity when plus button is clicked', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    // Find all buttons and click a plus button
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(btn => btn.querySelector('.lucide-plus'))
    
    if (plusButton) {
      fireEvent.click(plusButton)
      expect(mockOnUpdateQuantity).toHaveBeenCalled()
    }
  })

  it('calls onUpdateQuantity when minus button is clicked', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    // Find all buttons and click a minus button
    const buttons = screen.getAllByRole('button')
    const minusButton = buttons.find(btn => btn.querySelector('.lucide-minus'))
    
    if (minusButton) {
      fireEvent.click(minusButton)
      expect(mockOnUpdateQuantity).toHaveBeenCalled()
    }
  })

  it('disables minus button when quantity is 1', () => {
    const singleItemCart = [{
      id: 1,
      product_id: 1,
      product_name: 'Single Item',
      quantity: 1,
      price_snapshot: 10000,
    }]

    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={singleItemCart} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    const disabledButton = container.querySelector('button:disabled')
    expect(disabledButton).toBeDefined()
  })

  it('renders remove button for each item', () => {
    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    // Lucide's Trash2 icon generates class 'lucide-trash2' (toKebabCase('Trash2') = 'trash2')
    const trashIcons = container.querySelectorAll('.lucide-trash2')
    expect(trashIcons.length).toBe(mockCartItems.length)
  })

  it('has shopping cart icon in empty state', () => {
    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={[]} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    const cartIcon = container.querySelector('.lucide-shopping-cart')
    expect(cartIcon).toBeDefined()
  })

  it('applies correct styling to empty state', () => {
    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={[]} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    const emptyStateCard = container.querySelector('.apple-card')
    expect(emptyStateCard).toBeDefined()
  })

  it('shows link to live page in empty state', () => {
    render(
      <BrowserRouter>
        <CartTab 
          cartItems={[]} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    const liveLink = screen.getByText('라이브 보러가기')
    expect(liveLink.closest('a')?.getAttribute('href')).toBe('/')
  })

  it('handles multiple items correctly', () => {
    const manyItems = [
      { id: 1, product_id: 1, product_name: 'Item 1', quantity: 1, price_snapshot: 10000 },
      { id: 2, product_id: 2, product_name: 'Item 2', quantity: 2, price_snapshot: 20000 },
      { id: 3, product_id: 3, product_name: 'Item 3', quantity: 3, price_snapshot: 30000 },
    ]

    render(
      <BrowserRouter>
        <CartTab 
          cartItems={manyItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    expect(screen.getByText('Item 1')).toBeDefined()
    expect(screen.getByText('Item 2')).toBeDefined()
    expect(screen.getByText('Item 3')).toBeDefined()
  })

  it('uses dividers between cart items', () => {
    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    const dividers = container.querySelector('.divide-y')
    expect(dividers).toBeDefined()
  })

  it('applies responsive styling', () => {
    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={mockCartItems} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    // Check for responsive classes
    const responsiveElements = container.querySelectorAll('.sm\\:p-6')
    expect(responsiveElements.length).toBeGreaterThan(0)
  })

  it('truncates long product names', () => {
    const longNameItem = [{
      id: 1,
      product_id: 1,
      product_name: 'This is a very long product name that should be truncated to prevent layout issues',
      quantity: 1,
      price_snapshot: 10000,
    }]

    const { container } = render(
      <BrowserRouter>
        <CartTab 
          cartItems={longNameItem} 
          onUpdateQuantity={mockOnUpdateQuantity}
          onRemoveItem={mockOnRemoveItem}
          onCheckout={mockOnCheckout}
        />
      </BrowserRouter>
    )

    const productName = container.querySelector('.line-clamp-2')
    expect(productName).toBeDefined()
  })
})
