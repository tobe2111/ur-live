import { describe, it, expect } from 'vitest'
import { creditInfluencerStoreIntroCommission, isStoreIntroExpired } from '@/worker/utils/influencer-store-intro-commission'

/**
 * 🛡️ 2026-06-01 영입자 매장 commission 적립 로직 테스트 (실제 송금되는 돈, 테스트 0개였음).
 *   commission = floor(매출 × pct). 멱등/블록/영입자없음 가드 검증 — mock DB 로 INSERT 캡처.
 */

interface MockCfg {
  introducerId?: number | string | null
  blocked?: boolean
  existing?: boolean
  pct?: number | null
  months?: number | null
  /** 매장 행의 기간 관련 컬럼 — 미지정이면 undefined(=기준 시각 불명 → 만료 판정 안 함). */
  seller?: { referral_bonus_until?: string | null; introduced_at?: string | null; created_at?: string | null }
  /**
   * 🏪 2026-08-31 — 영입 2% 가 **직접 입점(`store_channel='direct'`) 매장에만** 붙게 됐다.
   * 이 파일의 관심사는 금액 계산·멱등·블록·만료라 채널은 기본 `'direct'` 로 둔다(그 전 동작과 동일).
   * 채널 게이트 자체는 `store-intro-direct-only.test.ts` 가 본다.
   */
  channel?: string | null
}
function makeDB(cfg: MockCfg) {
  const inserts: { sql: string; args: unknown[] }[] = []
  const firstFor = (sql: string) => {
    if (sql.includes('introduced_by_influencer_id')) return { introduced_by_influencer_id: cfg.introducerId ?? null, ...(cfg.seller ?? {}) }
    if (sql.includes('seller_blocked_influencers')) return cfg.blocked ? { 1: 1 } : null
    if (sql.includes('influencer_attributions WHERE order_id')) return cfg.existing ? { 1: 1 } : null
    if (sql.includes('influencer_store_intro_months')) return cfg.months == null ? null : { value: String(cfg.months) }
    if (sql.includes('platform_settings')) return cfg.pct == null ? null : { value: String(cfg.pct) }
    return null
  }
  const db = {
    prepare(sql: string) {
      // 실제 D1: prepare() 결과에 first/run/all 직접 + bind() 도 같은 인터페이스 반환.
      const make = (args: unknown[]) => ({
        first: async () => firstFor(sql),
        run: async () => { inserts.push({ sql, args }); return { meta: { last_row_id: 1 } } },
        all: async () => {
          // seller_meta 조회 — 채널 게이트(isDirectChannelStore)가 여기서 읽는다.
          if (sql.includes('FROM seller_meta')) {
            const ch = cfg.channel === undefined ? 'direct' : cfg.channel
            return ch == null ? { results: [] } : { results: [{ seller_id: 9, key: 'store_channel', value: ch }] }
          }
          return { results: [] }
        },
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


/**
 * ⏳ 2026-08-27 대표 확정 — **영입 2% 의 유효기간 1년**("2%의 유효기간 1년으로 하자").
 *
 * 그 전까지 이 축엔 만료 검사가 **아예 없었다**(무기한). 에이전시 1% 는 `referral_bonus_until` 을
 * 검사하는데(ledger.ts) 인플루언서만 빠져 있었고, 정작 `repair-schema` 백필은 **두 축을 똑같이**
 * `introduced_at + 12개월`로 채우고 있었다 — 데이터는 1년을 전제하는데 적립 코드가 안 봤다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 D1 의 시각 문자열 형식(`Z` 없는 UTC)이 바뀌는 경우.
 * `parseUTCDate` SSOT 를 쓰므로 그쪽 테스트가 담당한다.
 */
describe('isStoreIntroExpired — 영입 커미션 유효기간', () => {
  const now = new Date('2026-08-27T00:00:00Z')

  it('기준 시각을 모르면 만료로 보지 않는다 (미지급이 더 위험)', () => {
    expect(isStoreIntroExpired({}, 12, now)).toBe(false)
    expect(isStoreIntroExpired(null, 12, now)).toBe(false)
  })

  it('introduced_at 기준 12개월 — 11개월 지났으면 유효, 13개월이면 만료', () => {
    expect(isStoreIntroExpired({ introduced_at: '2025-09-27 00:00:00' }, 12, now)).toBe(false)
    expect(isStoreIntroExpired({ introduced_at: '2025-07-27 00:00:00' }, 12, now)).toBe(true)
  })

  it('경계: 정확히 12개월 되는 날은 아직 만료 아님', () => {
    expect(isStoreIntroExpired({ introduced_at: '2025-08-27 00:00:00' }, 12, now)).toBe(false)
  })

  it('introduced_at 이 없으면 created_at 으로 — 백필의 COALESCE 와 같은 순서', () => {
    expect(isStoreIntroExpired({ created_at: '2024-01-01 00:00:00' }, 12, now)).toBe(true)
    expect(isStoreIntroExpired({ created_at: '2026-08-01 00:00:00' }, 12, now)).toBe(false)
  })

  it('어드민이 넣은 referral_bonus_until 이 계산값보다 우선한다', () => {
    // 영입은 어제인데 어드민이 만료일을 과거로 박았으면 → 만료
    expect(isStoreIntroExpired(
      { referral_bonus_until: '2026-01-01 00:00:00', introduced_at: '2026-08-26 00:00:00' }, 12, now)).toBe(true)
    // 영입은 3년 전인데 어드민이 연장해 뒀으면 → 유효
    expect(isStoreIntroExpired(
      { referral_bonus_until: '2027-01-01 00:00:00', introduced_at: '2023-01-01 00:00:00' }, 12, now)).toBe(false)
  })

  it('UTC-naive 문자열을 로컬로 오해석하지 않는다 (9시간 어긋남 클래스)', () => {
    // D1 은 'Z' 없는 UTC 를 준다. KST 로 읽으면 9시간 앞당겨져 경계에서 판정이 뒤집힌다.
    const boundary = new Date('2026-08-27T05:00:00Z')
    expect(isStoreIntroExpired({ introduced_at: '2025-08-27 08:00:00' }, 12, boundary)).toBe(false)
  })
})

describe('creditInfluencerStoreIntroCommission — 유효기간 배선', () => {
  it('유효기간이 지난 매장은 적립하지 않는다', async () => {
    const { db, inserts } = makeDB({
      introducerId: 77, pct: 2,
      seller: { introduced_at: '2020-01-01 00:00:00' },
    })
    await creditInfluencerStoreIntroCommission(db, { id: 42, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(inserts)).toBeUndefined()
  })

  it('유효기간 안이면 2% 적립된다', async () => {
    const soon = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 19).replace('T', ' ')
    const { db, inserts } = makeDB({ introducerId: 77, pct: 2, seller: { introduced_at: soon } })
    await creditInfluencerStoreIntroCommission(db, { id: 43, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(inserts)?.args).toContain(2000)
  })

  it('개월 수는 어드민 설정으로 조정된다 (기본 12)', async () => {
    const sixMonthsAgo = new Date(Date.now() - 190 * 86400_000).toISOString().slice(0, 19).replace('T', ' ')
    // 기본 12개월이면 유효
    const a = makeDB({ introducerId: 77, pct: 2, seller: { introduced_at: sixMonthsAgo } })
    await creditInfluencerStoreIntroCommission(a.db, { id: 44, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(a.inserts)).toBeDefined()
    // 3개월로 줄이면 만료
    const b = makeDB({ introducerId: 77, pct: 2, months: 3, seller: { introduced_at: sixMonthsAgo } })
    await creditInfluencerStoreIntroCommission(b.db, { id: 45, seller_id: 9, total_amount: 100_000 })
    expect(attributionInsert(b.inserts)).toBeUndefined()
  })
})
