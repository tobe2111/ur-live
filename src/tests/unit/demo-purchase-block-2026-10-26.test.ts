/**
 * 🧪 2026-10-26 (대표 "데모 숙소에도 실제로 결제가 되면 안돼"): 데모 상품(slug 'demo-*')은 누구도 결제 못 한다.
 *
 * 종전 방어는 추첨 게이트(fcfs-gate) 하나였고 구멍이 셋이었다:
 *   ① 숙소 예약 서버(stays-public)는 그 게이트를 아예 안 불렀다 — API 를 직접 부르면 데모 숙소가 결제됐다
 *   ② fcfs_enabled 가 안 붙은 데모(유어샵 예시 등)는 게이트를 그냥 통과했다
 *   ③ 게이트 조회가 실패하면 fail-open 으로 통과했다
 * 이 시험은 진짜 함수(checkFcfsPurchasable · isDemoProductForPurchase)를 가짜 DB 위에서 돌려 판정하고,
 * 숙소 세 경로(create · create-multi · confirm 과금 직전)의 배선을 소스로 고정한다.
 *
 * ⚠️ 못 보는 것: 실제 Toss 결제창(브라우저) · 데모가 아닌데 slug 가 'demo-' 로 시작하는 상품(그런 상품은 만들지 말 것).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { checkFcfsPurchasable, isDemoProductForPurchase } from '../../worker/utils/fcfs-gate'

type Row = Record<string, unknown> | null
function fakeDb(opts: { slug?: string | null; failSlug?: boolean; meta?: Record<string, string>; app?: string | null }) {
  return {
    prepare(sql: string) {
      return {
        bind() { return this },
        async run() { return { meta: { changes: 0 } } },
        async first() {
          if (/SELECT slug FROM products/.test(sql)) {
            if (opts.failSlug) throw new Error('db down')
            return opts.slug === undefined ? null : ({ slug: opts.slug } as Row)
          }
          if (/fcfs_applications/.test(sql)) return opts.app ? ({ status: opts.app } as Row) : null
          return null
        },
        async all() {
          if (/product_supply_meta/.test(sql)) {
            return { results: Object.entries(opts.meta || {}).map(([key, value]) => ({ product_id: 1, key, value })) }
          }
          return { results: [] }
        },
      }
    },
  } as unknown as Parameters<typeof checkFcfsPurchasable>[0]
}

describe('데모 상품은 결제 불가', () => {
  it('데모 slug 면 추첨 설정이 없어도 막는다', async () => {
    const r = await checkFcfsPurchasable(fakeDb({ slug: 'demo-stay-12' }), 1, 'u1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('DEMO_NOT_PURCHASABLE')
  })

  it('데모면 당첨 상태(selected)여도 막는다', async () => {
    const r = await checkFcfsPurchasable(fakeDb({ slug: 'demo-deal-3', meta: { fcfs_enabled: '1' }, app: 'selected' }), 1, 'u1')
    expect(r.ok).toBe(false)
  })

  it('반대 방향 — 실상품은 그대로 통과한다(slug 없음 · 일반 slug)', async () => {
    expect((await checkFcfsPurchasable(fakeDb({ slug: null }), 1, 'u1')).ok).toBe(true)
    expect((await checkFcfsPurchasable(fakeDb({ slug: 'kimbap-heaven' }), 1, 'u1')).ok).toBe(true)
  })

  it('반대 방향 — 조회가 실패해도 정상 상품 결제를 막지 않는다', async () => {
    expect(await isDemoProductForPurchase(fakeDb({ failSlug: true }), 1)).toBe(false)
  })

  it('실상품의 추첨 게이트는 종전대로 동작한다', async () => {
    const r = await checkFcfsPurchasable(fakeDb({ slug: null, meta: { fcfs_enabled: '1' }, app: 'applied' }), 1, 'u1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('FCFS_WINNER_ONLY')
  })
})

describe('숙소 예약 서버 배선', () => {
  const src = readCode('src/features/group-buy/api/stays-public.routes.ts')
  const handler = (path: string) => {
    const i = src.indexOf(`staysPublicRoutes.post('${path}'`)
    expect(i).toBeGreaterThan(-1)
    const j = src.indexOf('staysPublicRoutes.', i + 10)
    return src.slice(i, j < 0 ? undefined : j)
  }

  it('create · create-multi 가 객실 조회 전에 데모를 막는다', () => {
    for (const p of ['/stays/bookings/create', '/stays/bookings/create-multi']) {
      const h = handler(p)
      const at = h.indexOf('isDemoProductForPurchase(c.env.DB, productId)')
      expect(at, p).toBeGreaterThan(-1)
      expect(at, p).toBeLessThan(h.indexOf('FROM product_stay_rooms'))
    }
  })

  it('confirm 이 Toss 승인 전에 예약 상품마다 데모를 다시 확인한다', () => {
    const h = handler('/stays/bookings/confirm')
    const at = h.indexOf('isDemoProductForPurchase(c.env.DB, pid)')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(h.indexOf('confirmTossPayment('))
  })
})
