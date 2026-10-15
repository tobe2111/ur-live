/**
 * 🛍️ 유어샵 '누적 구매' = 이 유어샵을 거쳐 팔린 수 — 2026-10-15 대표 *"바꾸자"*.
 *
 * 종전 값은 진열 상품들의 `sold_count`(어디서 팔렸든 전체) 합이었다. 이 시험은
 *   ① 진짜 `node:sqlite` 에 기록·집계를 돌려 **유어샵을 거친 것만** 세는지(취소·환불·남의 유어샵·자기 구매 제외)
 *   ② 구매 경로 셋(딜 /join · 카드 확정 · 장바구니)이 전부 기록하는지
 *   ③ 화면·서버 첫 화면이 같은 값을 읽는지 를 본다.
 *
 * ⚠️ 이 시험이 못 보는 것: 라이브 D1 에서 표가 실제로 생기는지 · waitUntil 이 실제로 끝까지 도는지 ·
 *   셀러 id 와 유저 id 가 같은 숫자일 때(형식만으로는 못 가른다 — handle 있는 유저만 받는 것으로 줄였다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readCode } from '../helpers/source-text'
import { recordUShopSale, countUShopSales, ushopRefUserId } from '@/worker/utils/ushop-sales'
import { curatorSoldTotal } from '@/shared/curator-pin-order'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(sql, b),
    first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
    _run: () => db.prepare(sql).run(...(binds as never[])),
  })
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: Array<{ _run: () => unknown }>) => list.map(s => s._run()),
  } as unknown as D1Database
}

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, handle TEXT);
           CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT);
           INSERT INTO users VALUES (3, 'jiwon1228'), (5, NULL), (9, 'other');`)
  return { db, DB: d1(db) }
}

describe('① 유어샵을 거친 것만 센다', () => {
  it('기록 → 집계, 취소·환불·자기 구매·handle 없는 ref·남의 유어샵 제외', async () => {
    const { db, DB } = setup()
    db.exec(`INSERT INTO orders VALUES (1,'PAID'),(2,'PAID'),(3,'REFUNDED'),(4,'CANCELLED'),(5,'PAID'),(6,'PAID'),(7,'PAID')`)
    await recordUShopSale(DB, { orderId: 1, ref: '3', buyerId: '42', items: [{ productId: 10, qty: 2 }] })
    await recordUShopSale(DB, { orderId: 2, ref: 3, buyerId: '42', items: [{ productId: 11, qty: 1 }, { productId: 12, qty: 3 }] }) // 장바구니 여러 줄
    await recordUShopSale(DB, { orderId: 3, ref: '3', buyerId: '42', items: [{ productId: 10, qty: 5 }] }) // 환불 → 안 셈
    await recordUShopSale(DB, { orderId: 4, ref: '3', buyerId: '42', items: [{ productId: 10, qty: 5 }] }) // 취소 → 안 셈
    await recordUShopSale(DB, { orderId: 5, ref: '3', buyerId: '3', items: [{ productId: 10, qty: 9 }] }) // 자기 구매 → 기록 안 함
    await recordUShopSale(DB, { orderId: 6, ref: '5', buyerId: '42', items: [{ productId: 10, qty: 9 }] }) // handle 없음 → 유어샵 아님
    await recordUShopSale(DB, { orderId: 7, ref: '9', buyerId: '42', items: [{ productId: 10, qty: 4 }] }) // 남의 유어샵
    await recordUShopSale(DB, { orderId: 1, ref: '3', buyerId: '42', items: [{ productId: 10, qty: 2 }] }) // 같은 주문 재시도 → 멱등
    expect(await countUShopSales(DB, 3)).toBe(2 + 1 + 3)
    expect(await countUShopSales(DB, 9)).toBe(4)
    expect(await countUShopSales(DB, 5)).toBe(0)
  })

  it('표가 없어도 0 이고 던지지 않는다(아직 아무도 안 샀다)', async () => {
    const { DB } = setup()
    expect(await countUShopSales(DB, 3)).toBe(0)
  })

  it('ref 형식: 숫자 유저 id 만 · 자기 자신 제외', () => {
    expect(ushopRefUserId('3', '42')).toBe(3)
    expect(ushopRefUserId(3, 42)).toBe(3)
    expect(ushopRefUserId('3', '3')).toBeNull()
    expect(ushopRefUserId('', '42')).toBeNull()
    expect(ushopRefUserId('seller:3', '42')).toBeNull()
    expect(ushopRefUserId('0', '42')).toBeNull()
    expect(ushopRefUserId(null, '42')).toBeNull()
  })
})

describe('② 구매 경로 셋이 전부 기록한다', () => {
  const gb = readCode('src/features/group-buy/api/group-buy.routes.ts')
  const cart = readCode('src/features/group-buy/api/cart-checkout.routes.ts')
  it('딜 /join 과 카드 확정 — 둘 다(한쪽만이면 결제수단에 따라 숫자가 갈린다)', () => {
    const calls = gb.match(/recordUShopSale\(DB, \{ orderId: newOrderId, ref: referralInfluencerId/g) ?? []
    expect(calls.length).toBe(2)
  })
  it('장바구니 — 줄마다', () => {
    expect(cart).toMatch(/recordUShopSale\(DB, \{ orderId: newOrderId, ref: referralInfluencerId, buyerId: userId, items: priced\.lines\.map/)
  })
})

describe('③ 화면·서버가 같은 값을 읽는다', () => {
  it('SSOT 는 curator.ushop_sold — 상품 판매수(sold_count)로 되돌아가지 않는다', () => {
    expect(curatorSoldTotal({ ushop_sold: 7 })).toBe(7)
    expect(curatorSoldTotal({ ushop_sold: null })).toBe(0)
    expect(curatorSoldTotal({ ushop_sold: -1 })).toBe(0)
    expect(curatorSoldTotal(undefined)).toBe(0)
    expect(readCode('src/shared/curator-pin-order.ts')).not.toMatch(/sold_count\)/)
  })
  it('서버 API 가 싣고, 화면 둘과 서버 첫 화면이 그 값을 쓴다', () => {
    expect(readCode('src/worker/routes/curator.routes.ts')).toMatch(/ushop_sold: ushopSold/)
    expect(readCode('src/pages/CuratorPage.tsx')).toMatch(/soldTotal=\{curatorSoldTotal\(curator\)\}/)
    expect(readCode('src/pages/SellerPublicPage.tsx')).toMatch(/soldTotal=\{curatorSoldTotal\(curator\)\}/)
    expect(readCode('src/worker/utils/curator-ssr-body.ts')).toMatch(/curatorSoldTotal\(c\)/)
  })
})
