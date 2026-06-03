import { describe, it, expect } from 'vitest'
import { creditInfluencerStoreIntroCommission } from '@/worker/utils/influencer-store-intro-commission'

/**
 * 🛡️ 2026-06-01 영입자 매장 commission 적립 로직 테스트 (실제 송금되는 돈, 테스트 0개였음).
 *   commission = floor(매출 × pct). 멱등/블록/영입자없음 가드 검증 — mock DB 로 INSERT 캡처.
 */

interface MockCfg {
  introducerId?: number | string | null
  blocked?: boolean
  existing?: boolean
  pct?: number | null
}
function makeDB(cfg: MockCfg) {
  const inserts: { sql: string; args: unknown[] }[] = []
  const firstFor = (sql: string) => {
    if (sql.includes('introduced_by_influencer_id')) return { introduced_by_influencer_id: cfg.introducerId ?? null }
    if (sql.includes('seller_blocked_influencers')) return cfg.blocked ? { 1: 1 } : null
    if (sql.includes('influencer_attributions WHERE order_id')) return cfg.existing ? { 1: 1 } : null
    if (sql.includes('platform_settings')) return cfg.pct == null ? null : { value: String(cfg.pct) }
    return null
  }
  const db = {
    prepare(sql: string) {
      // 실제 D1: prepare() 결과에 first/run/all 직접 + bind() 도 같은 인터페이스 반환.
      const make = (args: unknown[]) => ({
        first: async () => firstFor(sql),
        run: async () => { inserts.push({ sql, args }); return { meta: { last_row_id: 1 } } },
        all: async () => ({ results: [] }),
      })
      return { ...make([]), bind: (...args: unknown[]) => make(args) }
    },
  }
  return { db: db as never, inserts }
}

function attributionInsert(inserts: { sql: string; args: unknown[] }[]) {
  return inserts.find((i) => i.sql.includes('INSERT INTO influencer_attributions'))
}

describe('creditInfluencerStoreIntroCommission — 적립 계산/가드', () => {
  it('정상: 매출 100,000 × 1.5% = 1,500 적립 INSERT', async () => {
    const { db, inserts } = makeDB({ introducerId: 77, pct: 1.5 })
    await creditInfluencerStoreIntroCommission(db, { id: 1, seller_id: 9, total_amount: 100_000 })
    const ins = attributionInsert(inserts)
    expect(ins).toBeTruthy()
    // bind 순서: influencerId, orderId, sellerId, commission, availableAt
    expect(ins!.args[0]).toBe('77')
    expect(ins!.args[3]).toBe(1500)
  })

  it('pct 설정값 적용 (3% → 3,000) + floor', async () => {
    const { db, inserts } = makeDB({ introducerId: 5, pct: 3 })
    await creditInfluencerStoreIntroCommission(db, { id: 2, seller_id: 9, total_amount: 99_999 })
    expect(attributionInsert(inserts)!.args[3]).toBe(Math.floor(99_999 * 3 / 100)) // 2999
  })

  it('영입자 없음 → 적립 INSERT 없음', async () => {
    const { db, inserts } = makeDB({ introducerId: null })
    await creditInfluencerStoreIntroCommission(db, { id: 3, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(inserts)).toBeUndefined()
  })

  it('블록된 영입자 → 적립 없음', async () => {
    const { db, inserts } = makeDB({ introducerId: 77, blocked: true })
    await creditInfluencerStoreIntroCommission(db, { id: 4, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(inserts)).toBeUndefined()
  })

  it('멱등: 이미 적립된 주문 → 중복 INSERT 없음', async () => {
    const { db, inserts } = makeDB({ introducerId: 77, existing: true })
    await creditInfluencerStoreIntroCommission(db, { id: 5, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(inserts)).toBeUndefined()
  })

  it('금액/seller 누락 → 적립 없음', async () => {
    const { db, inserts } = makeDB({ introducerId: 77 })
    await creditInfluencerStoreIntroCommission(db, { id: 6, seller_id: null, total_amount: 100_000 })
    await creditInfluencerStoreIntroCommission(db, { id: 7, seller_id: 9, total_amount: 0 })
    expect(attributionInsert(inserts)).toBeUndefined()
  })

  it('commission 0 (소액) → 적립 없음', async () => {
    const { db, inserts } = makeDB({ introducerId: 77, pct: 1.5 })
    await creditInfluencerStoreIntroCommission(db, { id: 8, seller_id: 9, total_amount: 50 }) // 50*1.5/100=0.75→floor 0
    expect(attributionInsert(inserts)).toBeUndefined()
  })
})
