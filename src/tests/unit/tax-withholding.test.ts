import { describe, it, expect } from 'vitest'
import { withholdAndLog, WITHHOLDING_RATES } from '@/worker/utils/tax-withholding'

/**
 * 🛡️ 2026-06-01 원천징수(withholding) 계산 로직 테스트 — 실제 돈이 깎이는 math. 테스트 0개였음.
 *
 * CLAUDE.md: "원천징수율 hardcode 절대 금지 / withholdAndLog() 만 호출 / WITHHOLDING_RATES SSOT".
 * 이 테스트가 막는 것: 비율 오변경(3.3↔8.8), floor 라운딩 회귀, 사업자 면제 로직 깨짐.
 *
 * 실 DB 없이 mock DB 로 계산 분기만 검증.
 */

interface MockOpts { bizStatus: string | null; taxType: 'business_income' | 'other_income'; ytd: number }
function mockEnv(opts: MockOpts) {
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind() {
            return {
              first: async () => {
                if (sql.includes('business_registration_status')) return { business_registration_status: opts.bizStatus }
                if (sql.includes('tax_type')) return { tax_type: opts.taxType }
                if (sql.includes('SUM(gross_amount)')) return { total: opts.ytd }
                return null
              },
              run: async () => ({ meta: { last_row_id: 1 } }),
            }
          },
        }
      },
    },
  } as never
}

describe('WITHHOLDING_RATES — SSOT 비율 잠금', () => {
  it('사업소득 3.3%, 기타소득 8.8%', () => {
    expect(WITHHOLDING_RATES.business_income).toBe(0.033)
    expect(WITHHOLDING_RATES.other_income).toBe(0.088)
  })
})

describe('withholdAndLog — 원천징수 계산', () => {
  it('사업소득(3.3%): 1,000,000 → 33,000 차감, net 967,000', async () => {
    const r = await withholdAndLog(mockEnv({ bizStatus: 'pending', taxType: 'business_income', ytd: 0 }), {
      sellerId: 1, grossAmount: 1_000_000, sourceType: 'settlement_cash',
    })
    expect(r.withheld).toBe(true)
    expect(r.withholding_amount).toBe(33_000)
    expect(r.net_amount).toBe(967_000)
    expect(r.withholding_rate).toBeCloseTo(3.3)
    expect(r.tax_type).toBe('business_income')
    // 사업소득은 누계 무관 reportable
    expect(r.reportable).toBe(true)
  })

  it('기타소득(8.8%): 1,000,000 → 88,000 차감, net 912,000', async () => {
    const r = await withholdAndLog(mockEnv({ bizStatus: 'pending', taxType: 'other_income', ytd: 0 }), {
      sellerId: 2, grossAmount: 1_000_000, sourceType: 'settlement_cash',
    })
    expect(r.withholding_amount).toBe(88_000)
    expect(r.net_amount).toBe(912_000)
    expect(r.withholding_rate).toBeCloseTo(8.8)
    expect(r.tax_type).toBe('other_income')
  })

  it('기타소득: 연 300만 이하면 non-reportable, 초과면 reportable', async () => {
    const under = await withholdAndLog(mockEnv({ bizStatus: 'pending', taxType: 'other_income', ytd: 0 }), {
      sellerId: 3, grossAmount: 1_000_000, sourceType: 'settlement_cash',
    })
    expect(under.reportable).toBe(false) // ytd 0 + 100만 = 100만 < 300만
    const over = await withholdAndLog(mockEnv({ bizStatus: 'pending', taxType: 'other_income', ytd: 2_500_000 }), {
      sellerId: 3, grossAmount: 1_000_000, sourceType: 'settlement_cash',
    })
    expect(over.reportable).toBe(true) // 250만 + 100만 = 350만 > 300만
  })

  it('사업자 등록(verified): 원천징수 면제 — net = gross', async () => {
    const r = await withholdAndLog(mockEnv({ bizStatus: 'verified', taxType: 'business_income', ytd: 0 }), {
      sellerId: 4, grossAmount: 1_000_000, sourceType: 'settlement_cash',
    })
    expect(r.withheld).toBe(false)
    expect(r.withholding_amount).toBe(0)
    expect(r.net_amount).toBe(1_000_000)
    expect(r.tax_type).toBe('none')
  })

  it('floor 라운딩: 12,345 × 3.3% = 407.385 → 407 차감', async () => {
    const r = await withholdAndLog(mockEnv({ bizStatus: 'pending', taxType: 'business_income', ytd: 0 }), {
      sellerId: 5, grossAmount: 12_345, sourceType: 'voucher_order',
    })
    expect(r.withholding_amount).toBe(407)
    expect(r.net_amount).toBe(12_345 - 407)
  })

  it('음수/소수 gross 는 floor+clamp (음수→0)', async () => {
    const r = await withholdAndLog(mockEnv({ bizStatus: 'pending', taxType: 'business_income', ytd: 0 }), {
      sellerId: 6, grossAmount: -500, sourceType: 'deal_redeem',
    })
    expect(r.gross_amount).toBe(0)
    expect(r.net_amount).toBe(0)
  })
})
