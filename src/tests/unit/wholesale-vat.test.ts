import { describe, it, expect } from 'vitest'
import { splitWholesaleVat } from '@/features/supply/api/wholesale-tax-invoices'

/**
 * 🏦 2026-06-09 도매 전자세금계산서 VAT 분리 — 거래액 보존 불변식 고정.
 *   공급대가(VAT 포함) → 공급가액=round(gross/1.1), 세액=gross−공급가액. 공급+세 == 합(반올림 오차 vat 흡수).
 */
describe('wholesale-tax — splitWholesaleVat (부가세 포함 공급대가 분리)', () => {
  it('11000(포함) → 공급 10000 + VAT 1000, 합계 보존', () => {
    expect(splitWholesaleVat(11000)).toEqual({ supply: 10000, vat: 1000, total: 11000 })
  })

  it('합계 == 입력 + 공급+세 == 합 (모든 케이스, 음수 없음)', () => {
    for (const g of [0, 1, 999, 12345, 100000, 9999999, 333333, 50500]) {
      const { supply, vat, total } = splitWholesaleVat(g)
      expect(total).toBe(Math.round(g))
      expect(supply + vat).toBe(total)
      expect(supply).toBeGreaterThanOrEqual(0)
      expect(vat).toBeGreaterThanOrEqual(0)
    }
  })

  it('음수/소수 방어', () => {
    expect(splitWholesaleVat(-500)).toEqual({ supply: 0, vat: 0, total: 0 })
    expect(splitWholesaleVat(1100.4)).toEqual({ supply: 1000, vat: 100, total: 1100 })
  })
})
