import { describe, it, expect } from 'vitest'
import { splitVat } from '@/features/supply/api/tax-documents'

describe('tax-documents — splitVat (VAT 포함액 분리)', () => {
  it('입력은 VAT 포함 총액 → 공급가액 추출(÷1.1), VAT 가산하지 않음', () => {
    // 11000(포함) → 공급 10000 + VAT 1000
    expect(splitVat(11000)).toEqual({ supply: 10000, vat: 1000, total: 11000 })
  })

  it('합계는 입력 총액과 항상 일치 (거래액 보존)', () => {
    for (const gross of [0, 1, 999, 12345, 100000, 9999999]) {
      const { supply, vat, total } = splitVat(gross)
      expect(total).toBe(Math.round(gross))
      expect(supply + vat).toBe(total) // 반올림 오차가 vat 로 흡수돼 합 보존
    }
  })

  it('음수/소수 방어', () => {
    expect(splitVat(-500)).toEqual({ supply: 0, vat: 0, total: 0 })
    expect(splitVat(1100.4)).toEqual({ supply: 1000, vat: 100, total: 1100 })
  })
})
