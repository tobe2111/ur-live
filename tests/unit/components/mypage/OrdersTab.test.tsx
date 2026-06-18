import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { OrdersTab } from '@/components/mypage/OrdersTab'

// 🛡️ 2026-06-18: 무신사 스타일 리디자인 — 종류 탭(상품/교환권/공구) + 썸네일 + 날짜그룹.
//   기존 상태 탭/주문번호 카드 노출 테스트는 새 설계에 맞게 교체.

const wrap = (ui: React.ReactElement) => render(<BrowserRouter>{ui}</BrowserRouter>)
// 탭은 항상 카드보다 먼저 렌더 → 같은 텍스트가 카드에도 있으면 [0] 이 탭.
const tab = (label: string) => screen.getAllByText(new RegExp(label))[0]

describe('OrdersTab', () => {
  const onCancel = vi.fn()
  const onSelect = vi.fn()

  const productOrder = {
    id: 1, order_number: 'ORDER-001', user_id: 1, seller_id: 1,
    status: 'pending' as const, total_amount: 50000, seller_name: '테스트셀러',
    created_at: '2024-03-01T10:00:00Z',
    items: [
      { product_id: 1, product_name: 'Test Product 1', quantity: 2, price_snapshot: 20000, option_value: 'Large' },
      { product_id: 2, product_name: 'Test Product 2', quantity: 1, price_snapshot: 10000 },
    ],
  }
  const shippingOrder = {
    id: 2, order_number: 'ORDER-002', user_id: 1, seller_id: 1,
    status: 'shipping' as const, total_amount: 30000,
    created_at: '2024-03-05T14:30:00Z',
    courier: 'CJ대한통운', tracking_number: '123456789',
    items: [{ product_id: 3, product_name: 'Shipping Product', quantity: 1, price_snapshot: 30000 }],
  }
  const voucherOrder = {
    id: 3, order_number: 'ORDER-003', user_id: 1, seller_id: 2,
    status: 'done' as const, total_amount: 8000,
    created_at: '2024-03-06T09:00:00Z',
    items: [{ product_id: 4, product_name: '커피 교환권', quantity: 1, price_snapshot: 8000, deal_only: 1, category: 'meal_voucher' }],
  }
  const mockOrders = [productOrder, shippingOrder, voucherOrder]

  beforeEach(() => { onCancel.mockClear(); onSelect.mockClear() })

  it('renders kind tabs (전체/상품/교환권/공구)', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(tab('전체')).toBeDefined()
    expect(tab('상품')).toBeDefined()
    expect(tab('교환권')).toBeDefined()
    expect(screen.getByText('공구')).toBeDefined() // count 0 → 단일 텍스트
  })

  it('shows all orders by default (product names)', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(screen.getByText('Test Product 1')).toBeDefined()
    expect(screen.getByText('Shipping Product')).toBeDefined()
    expect(screen.getByText('커피 교환권')).toBeDefined()
  })

  it('filters by kind — 교환권 tab shows only voucher order', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    fireEvent.click(tab('교환권'))
    expect(screen.getByText('커피 교환권')).toBeDefined()
    expect(screen.queryByText('Test Product 1')).toBeNull()
  })

  it('filters by kind — 상품 tab hides voucher order', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    fireEvent.click(tab('상품'))
    expect(screen.getByText('Test Product 1')).toBeDefined()
    expect(screen.queryByText('커피 교환권')).toBeNull()
  })

  it('displays empty state when no orders', () => {
    wrap(<OrdersTab orders={[]} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(screen.getByText('주문 내역이 없습니다')).toBeDefined()
    expect(screen.getByText('둘러보기')).toBeDefined()
  })

  it('shows product option text', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(screen.getByText(/Large/)).toBeDefined()
  })

  it('shows tracking info for product order with courier', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(screen.getByText(/CJ대한통운/)).toBeDefined()
    expect(screen.getByText(/123456789/)).toBeDefined()
    expect(screen.getAllByText('배송조회').length).toBeGreaterThan(0)
  })

  it('shows cancel button for pending order and calls onCancelOrder', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    const cancelButtons = screen.getAllByText('취소')
    expect(cancelButtons.length).toBeGreaterThan(0)
    fireEvent.click(cancelButtons[0])
    expect(onCancel).toHaveBeenCalledWith(1, 'ORDER-001')
  })

  it('shows detail button per order and calls onSelectOrder', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    const detailButtons = screen.getAllByText('상세')
    expect(detailButtons.length).toBe(3)
    fireEvent.click(detailButtons[0])
    expect(onSelect).toHaveBeenCalledWith(productOrder)
  })

  it('computes item line total from price_snapshot fallback', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    // 2개 × 20,000 = 40,000 (subtotal/unit_price 없을 때 price_snapshot 폴백)
    expect(screen.getByText('40,000')).toBeDefined()
  })

  it('renders YY.MM.DD(요일) date group header', () => {
    wrap(<OrdersTab orders={mockOrders} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(screen.getByText(/24\.03\.01/)).toBeDefined()
  })

  it('shows first 3 items and 외 N개 for more', () => {
    const many = {
      ...productOrder,
      items: [
        { product_id: 1, product_name: 'I1', quantity: 1, price_snapshot: 1000 },
        { product_id: 2, product_name: 'I2', quantity: 1, price_snapshot: 1000 },
        { product_id: 3, product_name: 'I3', quantity: 1, price_snapshot: 1000 },
        { product_id: 4, product_name: 'I4', quantity: 1, price_snapshot: 1000 },
      ],
    }
    wrap(<OrdersTab orders={[many]} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    expect(screen.getByText('I1')).toBeDefined()
    expect(screen.getByText('I3')).toBeDefined()
    expect(screen.getByText('외 1개')).toBeDefined()
  })
})
