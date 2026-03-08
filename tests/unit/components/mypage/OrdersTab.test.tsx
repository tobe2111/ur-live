import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { OrdersTab } from '@/components/mypage/OrdersTab'

describe('OrdersTab', () => {
  const mockOnCancelOrder = vi.fn()
  const mockOnSelectOrder = vi.fn()

  const mockOrders = [
    {
      id: 1,
      order_number: 'ORDER-001',
      user_id: 1,
      seller_id: 1,
      status: 'pending' as const,
      total_amount: 50000,
      shipping_name: '홍길동',
      shipping_phone: '010-1234-5678',
      shipping_postal_code: '12345',
      shipping_address: '서울시 강남구 테헤란로 123',
      shipping_address_detail: '456호',
      created_at: '2024-03-01T10:00:00Z',
      items: [
        {
          product_id: 1,
          product_name: 'Test Product 1',
          quantity: 2,
          price_snapshot: 20000,
          option_value: 'Large',
        },
        {
          product_id: 2,
          product_name: 'Test Product 2',
          quantity: 1,
          price_snapshot: 10000,
        },
      ],
    },
    {
      id: 2,
      order_number: 'ORDER-002',
      user_id: 1,
      seller_id: 1,
      status: 'shipping' as const,
      total_amount: 30000,
      shipping_name: '김철수',
      shipping_phone: '010-9876-5432',
      shipping_postal_code: '54321',
      shipping_address: '서울시 송파구 올림픽로 456',
      created_at: '2024-03-05T14:30:00Z',
      courier: 'CJ대한통운',
      tracking_number: '123456789',
      items: [
        {
          product_id: 3,
          product_name: 'Shipping Product',
          quantity: 1,
          price_snapshot: 30000,
        },
      ],
    },
  ]

  beforeEach(() => {
    mockOnCancelOrder.mockClear()
    mockOnSelectOrder.mockClear()
  })

  it('renders all status filter buttons', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    expect(screen.getAllByText('전체').length).toBeGreaterThan(0)
    expect(screen.getAllByText('결제완료').length).toBeGreaterThan(0)
    expect(screen.getAllByText('상품준비중').length).toBeGreaterThan(0)
    expect(screen.getAllByText('배송중').length).toBeGreaterThan(0)
    expect(screen.getAllByText('배송완료').length).toBeGreaterThan(0)
    expect(screen.getAllByText('취소/환불').length).toBeGreaterThan(0)
  })

  it('shows all orders by default', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    expect(screen.getByText(/ORDER-001/)).toBeDefined()
    expect(screen.getByText(/ORDER-002/)).toBeDefined()
  })

  it('filters orders by status', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    // Click on "배송중" filter
    const shippingButtons = screen.getAllByText('배송중')
    fireEvent.click(shippingButtons[0]) // Click the filter button

    // Should only show shipping order
    expect(screen.getByText(/ORDER-002/)).toBeDefined()
    expect(screen.queryByText(/ORDER-001/)).toBeNull()
  })

  it('displays empty state when no orders', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={[]} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    expect(screen.getByText('주문 내역이 없습니다')).toBeDefined()
    expect(screen.getByText('라이브에서 마음에 드는 상품을 구매해보세요')).toBeDefined()
    expect(screen.getByText('라이브 보러가기')).toBeDefined()
  })

  it('renders order details correctly', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    // Check order number
    expect(screen.getByText(/ORDER-001/)).toBeDefined()
    
    // Check product name
    expect(screen.getByText('Test Product 1')).toBeDefined()
    
    // Check shipping name
    expect(screen.getByText('홍길동')).toBeDefined()
    
    // Check total amount
    expect(screen.getByText('50,000원')).toBeDefined()
  })

  it('shows product options when available', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    expect(screen.getByText(/옵션: Large/)).toBeDefined()
  })

  it('displays shipping address correctly', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    expect(screen.getByText(/서울시 강남구 테헤란로 123/)).toBeDefined()
    expect(screen.getByText('456호')).toBeDefined()
  })

  it('shows tracking information when available', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    expect(screen.getByText(/CJ대한통운/)).toBeDefined()
    expect(screen.getByText(/123456789/)).toBeDefined()
    expect(screen.getByText('배송조회')).toBeDefined()
  })

  it('shows cancel button for pending orders', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    const cancelButtons = screen.getAllByText('주문취소')
    expect(cancelButtons.length).toBeGreaterThan(0)
  })

  it('calls onCancelOrder when cancel button is clicked', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    const cancelButton = screen.getAllByText('주문취소')[0]
    fireEvent.click(cancelButton)

    expect(mockOnCancelOrder).toHaveBeenCalledWith(1, 'ORDER-001')
  })

  it('shows detail button for all orders', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    const detailButtons = screen.getAllByText('상세보기')
    expect(detailButtons.length).toBe(2)
  })

  it('calls onSelectOrder when detail button is clicked', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    const detailButton = screen.getAllByText('상세보기')[0]
    fireEvent.click(detailButton)

    expect(mockOnSelectOrder).toHaveBeenCalledWith(mockOrders[0])
  })

  it('displays correct status badge for each order', () => {
    const ordersWithDifferentStatuses = [
      { ...mockOrders[0], status: 'delivered' as const },
      { ...mockOrders[1], status: 'cancelled' as const },
    ]

    render(
      <BrowserRouter>
        <OrdersTab 
          orders={ordersWithDifferentStatuses} 
          onCancelOrder={mockOnCancelOrder} 
          onSelectOrder={mockOnSelectOrder} 
        />
      </BrowserRouter>
    )

    // Multiple instances - one in filter, one in badge
    expect(screen.getAllByText('배송완료').length).toBeGreaterThan(0)
    expect(screen.getAllByText('취소/환불').length).toBeGreaterThan(0)
  })

  it('shows first 2 items and count for more', () => {
    const orderWithManyItems = {
      ...mockOrders[0],
      items: [
        { product_id: 1, product_name: 'Item 1', quantity: 1, price_snapshot: 10000 },
        { product_id: 2, product_name: 'Item 2', quantity: 1, price_snapshot: 10000 },
        { product_id: 3, product_name: 'Item 3', quantity: 1, price_snapshot: 10000 },
        { product_id: 4, product_name: 'Item 4', quantity: 1, price_snapshot: 10000 },
      ],
    }

    render(
      <BrowserRouter>
        <OrdersTab 
          orders={[orderWithManyItems]} 
          onCancelOrder={mockOnCancelOrder} 
          onSelectOrder={mockOnSelectOrder} 
        />
      </BrowserRouter>
    )

    expect(screen.getByText('Item 1')).toBeDefined()
    expect(screen.getByText('Item 2')).toBeDefined()
    expect(screen.getByText('외 2개')).toBeDefined()
  })

  it('applies active styling to selected filter', () => {
    const { container } = render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    const allButton = screen.getByText('전체')
    expect(allButton.classList.contains('bg-[#007aff]')).toBe(true)
    expect(allButton.classList.contains('text-white')).toBe(true)
  })

  it('formats date correctly', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    // Date should be formatted in Korean locale - there can be multiple dates
    expect(screen.getAllByText(/2024년/).length).toBeGreaterThan(0)
  })

  it('calculates item total correctly', () => {
    render(
      <BrowserRouter>
        <OrdersTab orders={mockOrders} onCancelOrder={mockOnCancelOrder} onSelectOrder={mockOnSelectOrder} />
      </BrowserRouter>
    )

    // 2 items × 20,000 = 40,000
    expect(screen.getByText(/40,000원/)).toBeDefined()
  })
})
