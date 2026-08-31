import { describe, it, expect } from 'vitest'
import {
  creditInfluencerStoreIntroCommission,
  computeInfluencerStoreIntroRequest,
} from '@/worker/utils/influencer-store-intro-commission'

/**
 * 🏪 2026-08-31 대표 확정 — **영입 2% 는 직접 입점(`store_channel='direct'`) 매장에만.**
 *
 * 왜 막는가(경제): 채널별 플랫폼 수수료가 직접 10% / 중개 5% 인데, 중개에 2% 를 얹으면
 *   5% − PG준비금 2.75% − 2% = **+0.25%** 로 사실상 0 이고, 커미션이 하나만 더 겹치면 적자다.
 *
 * 이 테스트가 고정하는 것:
 *   R1 직접 입점(`direct`) → 적립된다 (게이트가 전부를 막아 버리는 회귀 방지)
 *   R2 중개(`brokered`) → 적립 없음
 *   R3 **미지정 → 적립 없음** (대표 명시 결정. 미지급은 되돌릴 수 있고 과지급은 못 되돌린다)
 *   R4 메타 조회가 터져도 적립 없음 (fail-soft 의 방향이 미지급이어야 한다)
 *   R5 **compute 와 credit 이 같은 판정** — 갈리면 예산 아비터가 요청액을 잡아 두고
 *      적립은 0 이 되어 예산이 새는 쪽으로 샌다
 *
 * 못 막는 것: 채널이 실제로 채워지는지(운영), 요율 자체가 맞는지(platform_settings).
 */

interface Cfg { channel?: string | null; metaThrows?: boolean }

function makeDB(cfg: Cfg) {
  const inserts: { sql: string; args: unknown[] }[] = []
  const rowFor = (sql: string): Record<string, unknown> | null => {
    if (sql.includes('introduced_by_influencer_id')) {
      // 만료 검사를 통과시키려면 기준 시각이 최근이어야 한다.
      return { introduced_by_influencer_id: 77, referral_bonus_until: null, introduced_at: null, created_at: null }
    }
    if (sql.includes('influencer_store_intro_pct')) return { value: '2' }
    if (sql.includes('influencer_store_intro_months')) return { value: '12' }
    if (sql.includes('seller_blocked_influencers')) return null
    if (sql.includes('SELECT user_id FROM orders')) return { user_id: 999 } // 영입자(77) 아님
    if (sql.includes('influencer_attributions') && sql.includes('SELECT')) return null
    return null
  }
  const db = {
    prepare(sql: string) {
      if (sql.includes('seller_meta') && cfg.metaThrows) {
        throw new Error('meta down')
      }
      const make = (args: unknown[]) => ({
        first: async () => rowFor(sql),
        run: async () => { inserts.push({ sql, args }); return { meta: {} } },
        all: async () => {
          if (sql.includes('FROM seller_meta')) {
            return cfg.channel == null
              ? { results: [] }
              : { results: [{ seller_id: 9, key: 'store_channel', value: cfg.channel }] }
          }
          return { results: [] }
        },
      })
      return { ...make([]), bind: (...args: unknown[]) => make(args) }
    },
  }
  return { db: db as never, inserts }
}

const credited = (arr: { sql: string; args: unknown[] }[]) =>
  arr.filter((i) => i.sql.includes('INSERT INTO influencer_attributions'))

const order = { id: 1, seller_id: 9, total_amount: 100_000 }

describe('영입 2% — 직접 입점 매장에만 (미지정은 미지급)', () => {
  it('R1 direct → 적립된다 (게이트가 전부를 막지 않는다)', async () => {
    const { db, inserts } = makeDB({ channel: 'direct' })
    await creditInfluencerStoreIntroCommission(db, order)
    expect(credited(inserts)).toHaveLength(1)
    expect(credited(inserts)[0].args).toContain(2000) // 100,000 × 2%
  })

  it('R2 brokered → 적립 없음 (5% 매장은 적자 구간)', async () => {
    const { db, inserts } = makeDB({ channel: 'brokered' })
    await creditInfluencerStoreIntroCommission(db, order)
    expect(credited(inserts)).toHaveLength(0)
  })

  it('R3 미지정 → 적립 없음 (대표 확정: 미지급이 과지급보다 안전)', async () => {
    const { db, inserts } = makeDB({ channel: null })
    await creditInfluencerStoreIntroCommission(db, order)
    expect(credited(inserts)).toHaveLength(0)
  })

  it('R4 메타 조회 실패 → 적립 없음 (fail-soft 의 방향이 미지급)', async () => {
    const { db, inserts } = makeDB({ channel: 'direct', metaThrows: true })
    await creditInfluencerStoreIntroCommission(db, order)
    expect(credited(inserts)).toHaveLength(0)
  })

  it.each([
    ['direct', 2000],
    ['brokered', 0],
    [null, 0],
  ])('R5 compute 도 같은 판정 — channel=%s → 요청액 %i', async (channel, expected) => {
    const { db } = makeDB({ channel: channel as string | null })
    expect(await computeInfluencerStoreIntroRequest(db, order)).toBe(expected)
  })
})
