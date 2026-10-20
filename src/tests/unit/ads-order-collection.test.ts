import { describe, it, expect } from 'vitest'
import { extractProductOrderIds, mapOrders } from '@/features/marketing/api/order-collection'

/**
 * 🆕 2026-06-30 유어애즈 발주수집 — 커머스 API 응답 방어 파싱(스키마 변화 내성) 검증.
 *   실계정 없이 응답 형태만으로 파싱 정확성 잠금(네이버 응답 구조 변경 시 조용히 깨지는 것 방지).
 */
describe('order-collection — extractProductOrderIds', () => {
  it('data.lastChangeStatuses 우선 추출 + 중복 제거', () => {
    const ids = extractProductOrderIds({ data: { lastChangeStatuses: [
      { productOrderId: 'A1' }, { productOrderId: 'A2' }, { productOrderId: 'A1' },
    ] } })
    expect(ids).toEqual(['A1', 'A2'])
  })
  it('lastChangeStatuses 없으면 data 배열 폴백', () => {
    expect(extractProductOrderIds({ data: [{ productOrderId: 'B1' }, { productOrderId: 'B2' }] })).toEqual(['B1', 'B2'])
  })
  it('비어있음/잘못된 형태 → 빈 배열(크래시 없음)', () => {
    expect(extractProductOrderIds(null)).toEqual([])
    expect(extractProductOrderIds({})).toEqual([])
    expect(extractProductOrderIds({ data: { lastChangeStatuses: [{ nope: 1 }] } })).toEqual([])
  })
})

describe('order-collection — mapOrders', () => {
  it('productOrder/order 중첩 구조 파싱 + 금액 폴백', () => {
    const orders = mapOrders({ data: [{
      productOrder: { productOrderId: 'P1', productName: '무선이어폰', quantity: 2, totalPaymentAmount: 30000, productOrderStatus: 'PAYED', orderDate: '2026-06-01' },
      order: { orderId: 'O1', ordererName: '홍길동', orderDate: '2026-06-01T10:00:00' },
    }] })
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ productOrderId: 'P1', orderId: 'O1', productName: '무선이어폰', quantity: 2, totalAmount: 30000, status: 'PAYED', ordererName: '홍길동' })
  })
  it('totalPaymentAmount 없으면 totalProductAmount 폴백, quantity 기본 1', () => {
    const orders = mapOrders({ data: [{ productOrder: { productOrderId: 'P2', totalProductAmount: 12000 } }] })
    expect(orders[0].totalAmount).toBe(12000)
    expect(orders[0].quantity).toBe(1)
  })
  it('평평한 구조(productOrder 래핑 없음)도 처리', () => {
    const orders = mapOrders({ data: [{ productOrderId: 'P3', productName: '상품', quantity: 1 }] })
    expect(orders[0].productOrderId).toBe('P3')
  })
  it('productOrderId 없는 행은 스킵, 잘못된 입력 → 빈 배열', () => {
    expect(mapOrders({ data: [{ productOrder: { productName: 'x' } }] })).toEqual([])
    expect(mapOrders(null)).toEqual([])
    expect(mapOrders({ data: 'not-array' })).toEqual([])
  })
})
