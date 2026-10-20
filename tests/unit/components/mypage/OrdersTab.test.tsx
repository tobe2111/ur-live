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

  it('classifies voucher-category (non deal_only) order as 공구, not 상품', () => {
    // 🛡️ 2026-06-18: group_buy_status 가 아니라 category(교환권 카테고리)로 공구 판정.
    //   일반 상품은 group_buy_status='active' 기본값이라 그 신호로는 오분류됨.
    const groupbuy = {
      id: 9, order_number: 'ORDER-009', user_id: 1, seller_id: 1,
      status: 'done' as const, total_amount: 5000,
      created_at: '2024-03-07T09:00:00Z',
      // category=meal_voucher, deal_only 없음, group_buy_status='active'(기본값 모사)
      items: [{ product_id: 9, product_name: '동네 김밥 세트', quantity: 1, price_snapshot: 5000, category: 'meal_voucher', group_buy_status: 'active' }],
    }
    // 일반 상품도 group_buy_status='active' 기본값을 가짐 → 그래도 상품으로 분류돼야 함
    const plain = {
      id: 10, order_number: 'ORDER-010', user_id: 1, seller_id: 1,
      status: 'done' as const, total_amount: 9000,
      created_at: '2024-03-07T10:00:00Z',
      items: [{ product_id: 10, product_name: '일반 티셔츠', quantity: 1, price_snapshot: 9000, category: 'general', group_buy_status: 'active' }],
    }
    wrap(<OrdersTab orders={[groupbuy, plain]} onCancelOrder={onCancel} onSelectOrder={onSelect} />)
    fireEvent.click(tab('공구'))
    expect(screen.getByText('동네 김밥 세트')).toBeDefined()
    expect(screen.queryByText('일반 티셔츠')).toBeNull()      // 공구 탭엔 안 보임
    fireEvent.click(tab('상품'))
    expect(screen.getByText('일반 티셔츠')).toBeDefined()       // 상품 탭엔 보임 (group_buy_status 무시)
    expect(screen.queryByText('동네 김밥 세트')).toBeNull()
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
