import { describe, it, expect } from 'vitest'
import { checkVoucherLimit, canEnableReferral } from '@/worker/utils/seller-tier-limits'

/**
 * 🛡️ 2026-06-01 셀러 등급별 voucher 발행 한도 + referral 권한 테스트 (테스트 0개였음).
 *   default 5개/월, 다이아(-1) 무제한, 한도초과 차단. referral 은 실버+ (referral_allowed=1).
 */

function makeEnv(opts: { limit?: number | null; tierName?: string | null; count?: number; referralAllowed?: number }) {
  const firstFor = (sql: string) => {
    if (sql.includes('voucher_monthly_limit')) return { name: opts.tierName ?? null, voucher_monthly_limit: opts.limit ?? null }
    if (sql.includes('COUNT(*) as cnt')) return { cnt: opts.count ?? 0 }
    if (sql.includes('referral_allowed')) return { allowed: opts.referralAllowed ?? 0 }
    return null
  }
  return {
    DB: {
      prepare(sql: string) {
        const api = { bind: (..._a: unknown[]) => api, first: async () => firstFor(sql), run: async () => ({ meta: {} }), all: async () => ({ results: [] }) }
        return api
      },
    },
  } as never
}

describe('checkVoucherLimit', () => {
  it('한도 내(limit 5, 현재 3) → ok', async () => {
    const r = await checkVoucherLimit(makeEnv({ limit: 5, tierName: '실버', count: 3 }), 1)
    expect(r.ok).toBe(true)
    expect(r.monthly_limit).toBe(5)
    expect(r.current_count).toBe(3)
  })

  it('한도 도달(limit 5, 현재 5) → 차단 + reason', async () => {
    const r = await checkVoucherLimit(makeEnv({ limit: 5, tierName: '브론즈', count: 5 }), 1)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('한도')
  })

  it('다이아 무제한(-1) → 항상 ok', async () => {
    const r = await checkVoucherLimit(makeEnv({ limit: -1, tierName: '다이아', count: 999 }), 1)
    expect(r.ok).toBe(true)
    expect(r.monthly_limit).toBe(-1)
  })

  it('등급 정보 없음 → default 한도 5, 브론즈', async () => {
    const r = await checkVoucherLimit(makeEnv({ limit: null, tierName: null, count: 2 }), 1)
    expect(r.monthly_limit).toBe(5)
    expect(r.tier_name).toBe('브론즈')
    expect(r.ok).toBe(true)
  })
})

describe('canEnableReferral', () => {
  it('referral_allowed=1 → true', async () => {
    expect(await canEnableReferral(makeEnv({ referralAllowed: 1 }), 1)).toBe(true)
  })
  it('referral_allowed=0/없음 → false', async () => {
    expect(await canEnableReferral(makeEnv({ referralAllowed: 0 }), 1)).toBe(false)
    expect(await canEnableReferral(makeEnv({}), 1)).toBe(false)
  })
})
