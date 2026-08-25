/**
 * 💸 **쇼핑 원장도 채널 요율을 쓴다** (2026-08-25 — 비대칭 마감).
 *
 * ## 무엇이 있었나
 *
 * 채널 요율(직접 입점 10% / 중개 5%)을 승격할 때 **이용권 원장에만** 배선했다. 일반 쇼핑
 * 원장(`creditSellerOrderToLedger`)은 `orders.commission_rate ?? 5` 를 그대로 썼고
 * `store_channel` 을 **한 번도 읽지 않았다**(참조 0건 실측).
 *
 * ⇒ 게이트를 켜면 **같은 직접 입점 매장이 이용권 10%, 쇼핑 5%** 로 갈린다. 화면에도 에러에도
 *   안 나타나고 원장을 합산해야만 보인다 — 이 레포가 반복해 만난 "조용한 어긋남".
 *
 * ⚠️ **이 테스트가 못 막는 것**: 실제 결제 흐름에서 `creditSellerOrderToLedger` 가 호출되는지
 *   (그건 `payment.routes` 의 게이트드 배선이고 `SHOPPING_LEDGER_ENABLED` 로 따로 잠긴다).
 *   여기서 고정하는 것은 **불렸을 때 요율을 어디서 가져오는가** 하나다.
 */
import { describe, it, expect } from 'vitest'
import { creditSellerOrderToLedger } from '../../worker/utils/order-ledger-credit'

type Row = Record<string, unknown>

/** 최소 D1 흉내 — SQL 문자열로 분기한다(실제 엔진이 아니라 '어느 값을 읽는가'를 본다). */
function fakeDb(opts: { channel?: string; gate?: string; directPct?: string; commissionRate?: number }) {
  const written: Row[] = []
  const db = {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, ' ')
      let binds: unknown[] = []
      const api = {
        bind(...b: unknown[]) { binds = b; return api },
        async first<T>(): Promise<T | null> {
          if (s.includes('FROM orders WHERE id')) {
            return { id: 1, order_number: 'ORD-1', user_id: 9, seller_id: 42,
              total_amount: 100_000, commission_rate: opts.commissionRate ?? 5 } as T
          }
          if (s.includes("key = 'fee_channel_rates_enabled'")) return (opts.gate ? { value: opts.gate } : null) as T
          if (s.includes("key = 'platform_fee_pct_direct'")) return (opts.directPct ? { value: opts.directPct } : null) as T
          if (s.includes("key = 'promo_funding_source'")) return null as T
          if (s.includes('COUNT(*) AS n FROM order_items')) return { n: 0 } as T
          if (s.includes('FROM ledger_entries')) return null as T
          if (s.includes('seller_meta') || s.includes('store_channel')) {
            return (opts.channel ? { seller_id: 42, key: 'store_channel', value: opts.channel } : null) as T
          }
          return null as T
        },
        async all<T>() {
          if (s.includes('seller_meta')) {
            return { results: (opts.channel ? [{ seller_id: 42, key: 'store_channel', value: opts.channel }] : []) as T[] }
          }
          return { results: [] as T[] }
        },
        async run() { written.push({ sql: s, binds }); return { meta: { changes: 1 } } },
      }
      return api
    },
    async batch() { return [] },
  }
  return { db, written }
}

/** 기록된 원장 INSERT 에서 fee_amount 를 꺼낸다. */
function feeOf(written: Row[]): number | null {
  for (const w of written) {
    const sql = String(w.sql)
    if (!sql.includes('ledger_entries')) continue
    const binds = w.binds as unknown[]
    const n = binds.map(Number).filter((x) => Number.isFinite(x))
    // fee_amount 는 총액(100000) 다음에 오는 금액 — 금액 후보 중 100000 이 아닌 최댓값.
    const fees = n.filter((x) => x !== 100_000 && x > 0 && x <= 100_000)
    if (fees.length) return Math.max(...fees)
  }
  return null
}

describe('쇼핑 원장 — 채널 요율', () => {
  it('🔴 직접 입점 + 게이트 ON → 10% (5% 가 아니다)', async () => {
    const { db, written } = fakeDb({ channel: 'direct', gate: 'true' })
    await creditSellerOrderToLedger(db as never, 1)
    expect(feeOf(written), '직접 입점인데 5% 만 뗐다 — 이용권과 갈린다').toBe(10_000)
  })

  it('중개 매장 → 종전 요율(5%) 유지', async () => {
    const { db, written } = fakeDb({ channel: 'brokered', gate: 'true' })
    await creditSellerOrderToLedger(db as never, 1)
    expect(feeOf(written)).toBe(5_000)
  })

  it('🔴 게이트 OFF → 채널 무관하게 종전 요율 (기본 OFF 는 byte-동일해야 한다)', async () => {
    const { db, written } = fakeDb({ channel: 'direct' })
    await creditSellerOrderToLedger(db as never, 1)
    expect(feeOf(written), '게이트를 안 켰는데 요율이 바뀌었다').toBe(5_000)
  })

  it('채널 미지정 → 낮은 쪽으로 떨어진다 (모르는데 더 떼지 않는다)', async () => {
    const { db, written } = fakeDb({ gate: 'true' })
    await creditSellerOrderToLedger(db as never, 1)
    expect(feeOf(written)).toBe(5_000)
  })

  it('어드민이 직접 요율을 8% 로 조정하면 그 값을 쓴다', async () => {
    const { db, written } = fakeDb({ channel: 'direct', gate: 'true', directPct: '8' })
    await creditSellerOrderToLedger(db as never, 1)
    expect(feeOf(written)).toBe(8_000)
  })

  it('🔴 배선이 살아 있다 — 소스가 channelPlatformRate 를 실제로 부른다', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/worker/utils/order-ledger-credit.ts', 'utf8')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    expect(src, '주석에만 남고 호출이 사라지면 조용히 flat 5% 로 돌아간다')
      .toMatch(/await channelPlatformRate\(DB,\s*order\.seller_id\)/)
  })
})
