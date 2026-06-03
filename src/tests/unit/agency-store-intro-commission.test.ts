import { describe, it, expect } from 'vitest'
import { creditAgencyStoreIntroCommission } from '@/worker/utils/agency-store-intro-commission'

/**
 * 🛡️ 2026-06-01 에이전시 입점 commission 적립 테스트 (테스트 0개였음).
 *   signup_bonus(₩30,000 첫결제 1회) + sales_commission(매출×pct, default 2%) 적립 분기.
 */

interface Cfg { agencyId?: number | null; pct?: number | null; hasBonus?: boolean }
function makeDB(cfg: Cfg) {
  const inserts: { sql: string; args: unknown[] }[] = []
  const firstFor = (sql: string) => {
    if (sql.includes('introduced_by_agency_id')) return { introduced_by_agency_id: cfg.agencyId ?? null }
    if (sql.includes('FROM agencies')) return cfg.pct == null ? null : { pct: cfg.pct }
    if (sql.includes("type = 'signup_bonus' LIMIT 1")) return cfg.hasBonus ? { id: 1 } : null
    return null
  }
  const db = {
    prepare(sql: string) {
      const make = (args: unknown[]) => ({
        first: async () => firstFor(sql),
        run: async () => { inserts.push({ sql, args }); return { meta: {} } },
        all: async () => ({ results: [] }),
      })
      return { ...make([]), bind: (...args: unknown[]) => make(args) }
    },
  }
  return { db: db as never, inserts }
}
const ins = (arr: { sql: string; args: unknown[] }[], type: string) => arr.find((i) => i.sql.includes('INSERT INTO agency_store_intro_commissions') && i.sql.includes(`'${type}'`))

describe('creditAgencyStoreIntroCommission', () => {
  it('첫 결제: signup_bonus ₩30,000 + sales_commission(2%) 둘 다 적립', async () => {
    const { db, inserts } = makeDB({ agencyId: 3, pct: 2, hasBonus: false })
    await creditAgencyStoreIntroCommission(db, { id: 1, seller_id: 9, total_amount: 100_000 })
    expect(ins(inserts, 'signup_bonus')!.args).toContain(30000)
    expect(ins(inserts, 'sales_commission')!.args).toContain(2000) // 100,000 × 2%
  })

  it('재결제(signup_bonus 이미 있음): sales_commission 만, bonus 중복 없음', async () => {
    const { db, inserts } = makeDB({ agencyId: 3, pct: 2, hasBonus: true })
    await creditAgencyStoreIntroCommission(db, { id: 2, seller_id: 9, total_amount: 50_000 })
    expect(ins(inserts, 'signup_bonus')).toBeUndefined()
    expect(ins(inserts, 'sales_commission')!.args).toContain(1000) // 50,000 × 2%
  })

  it('default pct 2% 적용(설정 null)', async () => {
    const { db, inserts } = makeDB({ agencyId: 3, pct: null, hasBonus: true })
    await creditAgencyStoreIntroCommission(db, { id: 3, seller_id: 9, total_amount: 200_000 })
    expect(ins(inserts, 'sales_commission')!.args).toContain(4000) // 200,000 × 2%
  })

  it('영입 에이전시 없음 → 적립 없음', async () => {
    const { db, inserts } = makeDB({ agencyId: null })
    await creditAgencyStoreIntroCommission(db, { id: 4, seller_id: 9, total_amount: 100_000 })
    expect(inserts.filter((i) => i.sql.includes('INSERT INTO agency_store_intro_commissions'))).toHaveLength(0)
  })

  it('seller/금액 누락 → noop', async () => {
    const { db, inserts } = makeDB({ agencyId: 3, pct: 2 })
    await creditAgencyStoreIntroCommission(db, { id: 5, seller_id: null, total_amount: 100_000 })
    expect(inserts).toHaveLength(0)
  })

  it('commission 0(소액)이면 sales_commission INSERT 없음(bonus는 가능)', async () => {
    const { db, inserts } = makeDB({ agencyId: 3, pct: 2, hasBonus: true })
    await creditAgencyStoreIntroCommission(db, { id: 6, seller_id: 9, total_amount: 40 }) // 40×2%=0.8→0
    expect(ins(inserts, 'sales_commission')).toBeUndefined()
  })
})
