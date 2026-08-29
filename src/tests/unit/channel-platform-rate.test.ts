import { describe, it, expect } from 'vitest'
import { recordVoucherUsedLedger } from '../../worker/utils/ledger'

/**
 * 💸 채널별 플랫폼 요율 — **직접 입점 10% / 중개 5%**(대표 최종 2026-08-20).
 *
 * 🩸 이 규칙은 `fee-resolver.ts` 에 두 달째 있었지만 **그림자**(계산만 기록)였고,
 *   실제 정산 경로(`recordVoucherUsedLedger`)는 채널을 몰라 단일 요율만 봤다 —
 *   **직접 입점 매장도 5% 만 뗐다는 뜻이다.**
 *
 * ⚠️ 이 테스트가 못 막는 것: 매장이 실제로 어느 채널로 등록됐는지(운영 데이터).
 *   요율이 틀리면 매장에서 떼는 돈이 달라지므로 staging 실결제가 여전히 필요하다.
 */
function fakeDb(settings: Record<string, string>, meta: Record<string, string>) {
  const written: Array<Record<string, unknown>> = []
  return {
    written,
    prepare(sql: string) {
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async first<T>() {
          // 🩸 2026-08-27: 채널 요율 조회가 리터럴(`key = 'x'`)에서 **바인드(`key = ?`)** 로 바뀌었다
          //   (채널마다 키가 달라졌으므로). 리터럴만 보던 이 fake 는 그때 조용히 null 을 돌려주고
          //   기본값 폴백을 태워 **"어드민 설정을 쓴다" 검사를 통과시켜 버렸다** — 바인드도 읽는다.
          const lit = /key = '([a-z_]+)'/.exec(sql)
          if (lit) return (settings[lit[1]] !== undefined ? { value: settings[lit[1]] } : null) as T | null
          if (/key = \?/.test(sql)) {
            const k = String(args[0] ?? '')
            return (settings[k] !== undefined ? { value: settings[k] } : null) as T | null
          }
          return null as T | null
        },
        async all<T>() {
          if (/FROM seller_meta/.test(sql)) {
            return { results: Object.entries(meta).map(([k, v]) => ({ seller_id: 7, key: k, value: v })) as T[] }
          }
          if (/platform_fee_pct'/.test(sql)) {
            const out = Object.entries(settings)
              .filter(([k]) => k === 'platform_fee_pct' || k === 'seller_commission_pct')
              .map(([key, value]) => ({ key, value }))
            return { results: out as T[] }
          }
          return { results: [] as T[] }
        },
        async run() {
          if (/INSERT INTO ledger_entries/.test(sql)) written.push({ amount: args[2], fee: args[5] })
          return { meta: { changes: 1 } }
        },
      }
      return self
    },
  } as never
}

const call = (db: never) => recordVoucherUsedLedger(db, {
  voucher_id: 1, order_amount: 10_000, merchant_id: 7, seller_id: null,
})

describe('채널별 플랫폼 요율 (직접 10% / 중개 5%)', () => {
  it('🔑 게이트 ON + 직접 입점 → 10%', async () => {
    const r = await call(fakeDb({ fee_channel_rates_enabled: 'true' }, { store_channel: 'direct' }))
    expect(r.platform_amount, '직접 입점인데 10% 가 아니다').toBe(1_000)
  })

  it('게이트 ON + 중개 → 5% (종전과 동일)', async () => {
    const r = await call(fakeDb({ fee_channel_rates_enabled: 'true' }, { store_channel: 'brokered' }))
    expect(r.platform_amount).toBe(500)
  })

  it('🛡️ 게이트 OFF 면 직접 입점이어도 종전 5% (기본 OFF = 라이브 무변화)', async () => {
    const r = await call(fakeDb({}, { store_channel: 'direct' }))
    expect(r.platform_amount, '게이트가 꺼졌는데 요율이 바뀌었다').toBe(500)
  })

  it('🩸 채널 미지정은 낮은 쪽(5%)으로 — 모르면 더 떼지 않는다', async () => {
    const r = await call(fakeDb({ fee_channel_rates_enabled: 'true' }, {}))
    expect(r.platform_amount).toBe(500)
  })

  it('🔑 대행사 요율은 이제 **자기 키**에서 온다 (폴백에 기대지 않는다)', async () => {
    // 🩸 그전엔 중개 매장이 undefined → `platform_fee_pct` 로 떨어져서 5% 가 나왔다. 맞는 값이었지만
    //   "종전 경로가 마침 5% 다" 라는 전제에 기댄 것이었고, 라이브에서 그 전제가 깨져 있었다.
    const r = await call(fakeDb(
      { fee_channel_rates_enabled: 'true', platform_fee_pct_brokered: '5', platform_fee_pct: '10' },
      { store_channel: 'brokered' },
    ))
    expect(r.platform_amount, '대행사 요율이 platform_fee_pct 폴백에 끌려갔다').toBe(500)
  })

  it('어드민이 직접 요율을 바꾸면 그 값을 쓴다', async () => {
    const r = await call(fakeDb(
      { fee_channel_rates_enabled: 'true', platform_fee_pct_direct: '8' }, { store_channel: 'direct' },
    ))
    expect(r.platform_amount).toBe(800)
  })
})
