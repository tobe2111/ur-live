/**
 * 🏢 운영사(유어팀) 계정이 영입한 매장 = 직접 10% (2026-11-16 대표 *"내 유어딜 계정 있지? 그걸로 매장 영입할 때는 그렇게 해줘"*)
 *
 * 라이브 실측(11-16): 매장 20·25·26 이 `store_channel='brokered'` + `broker_user_id=3`(대표 본인) →
 * 떼어 줄 제3자가 없는데 5% 만 걷혔다. 이 시험은 실제 `channelPlatformRate` 를 가짜 DB 로 돌려 고정한다:
 *   ① 운영사가 중개사인 중개 매장 → 10%   ② 남이 중개사인 중개 매장 → 5%(그대로)
 *   ③ 미지정 → undefined(fail-soft 그대로)   ④ 중개사 몫 적립이 운영사에게는 안 나간다(소스)
 * ⚠️ 못 막는 것: 실제 정산 10% 는 결제가 있어야 안다(staging 실결제 — 결재 기록 참조).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { channelPlatformRate, operatorBrokeredAsDirect, PLATFORM_OPERATOR_USER_IDS, PLATFORM_OPERATOR_AGENCY_IDS } from '@/worker/utils/ledger-commission-policy'

function fakeDB(meta: Record<string, string>, opAgencyLinked = false) {
  const settings: Record<string, string> = { fee_channel_rates_enabled: 'true', platform_fee_pct_direct: '10', platform_fee_pct_brokered: '5' }
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { args = a; return stmt },
        async first() {
          if (sql.includes('agency_store_links')) return opAgencyLinked && String(args[1]).includes('1') ? { ok: 1 } : null
          if (sql.includes("'fee_channel_rates_enabled'")) return { value: settings.fee_channel_rates_enabled }
          if (sql.includes('platform_settings')) return { value: settings[String(args[0])] }
          return null
        },
        async all() {
          if (sql.includes('seller_meta')) return { results: Object.entries(meta).map(([key, value]) => ({ seller_id: 26, key, value })) }
          return { results: [] }
        },
        async run() { return { meta: { changes: 0 } } },
      }
      return stmt
    },
    async exec() { return {} },
    async batch() { return [] },
  } as never
}

describe('운영사 영입 매장 = 직접 10%', () => {
  it('대표 계정은 users.id=3 이다(30 아님)', () => {
    expect(PLATFORM_OPERATOR_USER_IDS).toEqual([3])
  })
  it('① 운영사가 중개사인 중개 매장 → 10%', async () => {
    expect(await channelPlatformRate(fakeDB({ store_channel: 'brokered', broker_user_id: '3' }), 26)).toBe(0.1)
  })
  it('② 남이 중개사인 중개 매장 → 5% 그대로', async () => {
    expect(await channelPlatformRate(fakeDB({ store_channel: 'brokered', broker_user_id: '35' }), 26)).toBe(0.05)
    expect(await channelPlatformRate(fakeDB({ store_channel: 'brokered' }), 26)).toBe(0.05)
  })
  it('③ 미지정은 미지정 — 운영사라도 10% 로 끌어올리지 않는다', async () => {
    expect(await channelPlatformRate(fakeDB({ broker_user_id: '3' }), 26)).toBeUndefined()
    expect(operatorBrokeredAsDirect(undefined, '3')).toBeUndefined()
  })
  it('④ 중개사 몫 적립은 운영사에게 나가지 않는다', () => {
    const src = readFileSync('src/worker/utils/broker-share.ts', 'utf8')
    expect(src).toMatch(/PLATFORM_OPERATOR_USER_IDS\.includes\(terms\.brokerUserId\)\) return \{ credited: 0/)
  })
  it('⑤ 운영사 에이전시(유어팀, agency 1)가 맡은 중개 매장 → 10%', async () => {
    expect(PLATFORM_OPERATOR_AGENCY_IDS).toEqual([1])
    expect(await channelPlatformRate(fakeDB({ store_channel: 'brokered', broker_user_id: '35' }, true), 26)).toBe(0.1)
    expect(await channelPlatformRate(fakeDB({ store_channel: 'brokered', broker_user_id: '35' }, false), 26)).toBe(0.05)
  })
  it('⑥ 운영사 에이전시에는 에이전시 몫이 안 나가고 중개사 몫도 막는다(matched)', () => {
    const src = readFileSync('src/worker/utils/agency-share-payout.ts', 'utf8')
    expect(src).toMatch(/PLATFORM_OPERATOR_AGENCY_IDS\.includes\(ag\.agencyId\)\) return \{ credited: 0, agencyId: ag\.agencyId, matched: true \}/)
  })
})
