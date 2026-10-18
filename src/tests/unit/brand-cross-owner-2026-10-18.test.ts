/**
 * 🏷️ 2026-10-18 브랜드 3단계 — 점주가 다른 가맹점끼리 이용권 사용 + 쓴 지점 정산
 *   (결재 docs/decisions/2026-10-18-franchise-cross-owner-redeem.md — 대표 "결재해줄게" + ①②③ 권장안).
 *
 * 실제 SQLite 에서 판정한다:
 *   ① 게이트 OFF 면 1·2단계와 같다(가맹점은 받지 않는다)
 *   ② 게이트 ON + 받는 점주 동의 + 판매 비용 없는 이용권 → 받는다. 이용권을 모르면(voucherId 없음) 받지 않는다
 *   ③ 판매 비용(소개비·추천 적립)이 붙은 이용권은 받지 않는다 — 회수·취소된 것은 비용이 아니다
 *   ④ 손님 셀프(잠금 파일이 이용권 id 를 안 넘긴다)는 가맹점을 받지 않는다(fail-closed)
 *   ⑤ 쓴 지점 기록 → 정산 두 레일(원장 settlementMerchantFor · 주간 REDEEM_STORE_SETTLEMENT_SQL)이 같은 지점을 고른다
 *   ⑥ 배선 — 사용 경로 2곳이 원장보다 먼저 기록하고, 주간 정산이 같은 조각을 쓴다
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 실제 결제·원장 금액(그건 staging S-BRANDX) · D1 과 node:sqlite 의 차이
 * - 이미 쓴 이용권을 사용 취소(분쟁)한 뒤 다른 지점에서 다시 쓰는 경우의 원장 — 원장이 voucher 당 1회 멱등이라
 *   첫 기록이 남는다(1·2단계 이전부터 있는 성질 — 사용 취소가 원장을 되돌리지 않는다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import {
  BRAND_WIDE_META_KEY, canStoreRedeemProduct, checkBrandWideSettable, findBrandBranchForVoucherCode,
} from '@/worker/utils/brand-wide-redeem'
import {
  CROSS_OWNER_ACCEPT_META, CROSS_OWNER_GATE_KEY, REDEEM_STORE_SETTLEMENT_SQL,
  recordVoucherRedeemStore, settlementMerchantFor, voucherHasSunkCost,
} from '@/worker/utils/brand-cross-owner'
import { checkSelfRedeemGate } from '@/worker/utils/self-redeem-gate'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = db.prepare(sql).run(...(binds as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    }
    return self
  }
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const x of list) out.push(await x.run()); return out },
  } as unknown as D1Database
}

/**
 * 판 지점 1(주인 10) · 2(주인 10) · 3(주인 20 — 가맹점, 승인) · 4(주인 30 — 가맹점, 심사 중). 브랜드 1 = {1,2,3,4}.
 * 상품 100 = 지점 1 · 브랜드 전 지점 켬. 이용권 V1(주문 501 — 비용 없음) · V2(주문 502 — 소개비 있음)
 * · V3(주문 503 — 회수된 소개비) · V4(주문 504 — 추천 적립 있음) · V5(주문 없음).
 */
function fresh(opts: { gate?: boolean; accept?: number[] } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, status TEXT, business_name TEXT, commission_rate REAL)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, store_verify_pin TEXT)`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY, code TEXT UNIQUE, product_id INTEGER, order_id INTEGER, status TEXT)`)
  db.exec(`INSERT INTO sellers VALUES (1,10,'approved','본점',5),(2,10,'approved','2호점',5),(3,20,'approved','가맹 3호점',10),(4,30,'pending','가맹 4호점',10)`)
  db.exec(`CREATE TABLE store_brands (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, created_by_user_id INTEGER, created_at DATETIME, deleted_at DATETIME)`)
  db.exec(`CREATE TABLE store_brand_members (seller_id INTEGER PRIMARY KEY, brand_id INTEGER NOT NULL, added_by_user_id INTEGER NOT NULL, added_at DATETIME)`)
  db.exec(`INSERT INTO store_brands (id,slug,name,created_by_user_id) VALUES (1,'b','브랜드',10)`)
  db.exec(`INSERT INTO store_brand_members (seller_id,brand_id,added_by_user_id) VALUES (1,1,10),(2,1,10),(3,1,10),(4,1,10)`)
  db.exec(`CREATE TABLE seller_redemption_settings (seller_id INTEGER PRIMARY KEY, mode TEXT, store_code TEXT, updated_at DATETIME)`)
  db.exec(`INSERT INTO seller_redemption_settings VALUES (1,'store_code','111111',NULL),(2,'store_code','222222',NULL),(3,'store_code','333333',NULL),(4,'store_code','444444',NULL)`)
  db.exec(`CREATE TABLE product_supply_meta (product_id INTEGER, key TEXT, value TEXT, updated_at DATETIME, PRIMARY KEY (product_id,key))`)
  db.exec(`INSERT INTO products VALUES (100,1,NULL)`)
  db.exec(`INSERT INTO product_supply_meta (product_id,key,value) VALUES (100,'${BRAND_WIDE_META_KEY}','1')`)
  db.exec(`INSERT INTO vouchers VALUES (1,'V1',100,501,'unused'),(2,'V2',100,502,'unused'),(3,'V3',100,503,'unused'),(4,'V4',100,504,'unused'),(5,'V5',100,NULL,'unused')`)
  db.exec(`CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY, order_id INTEGER, commission_amount INTEGER, status TEXT)`)
  db.exec(`INSERT INTO influencer_attributions (order_id,commission_amount,status) VALUES (502,500,'pending'),(503,500,'clawed_back')`)
  db.exec(`CREATE TABLE affiliate_earnings (id INTEGER PRIMARY KEY, order_id INTEGER, commission INTEGER, status TEXT)`)
  db.exec(`INSERT INTO affiliate_earnings (order_id,commission,status) VALUES (504,200,'pending'),(501,200,'cancelled')`)
  db.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  if (opts.gate) db.exec(`INSERT INTO platform_settings VALUES ('${CROSS_OWNER_GATE_KEY}','true')`)
  db.exec(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT, updated_at DATETIME, PRIMARY KEY (seller_id,key))`)
  for (const id of opts.accept ?? []) db.exec(`INSERT INTO seller_meta (seller_id,key,value) VALUES (${id},'${CROSS_OWNER_ACCEPT_META}','1')`)
  return { db, DB: d1(db) }
}

describe('① 게이트 OFF — 1·2단계와 같다', () => {
  it('받기를 켠 가맹점도 받지 않는다 · 같은 주인 지점은 종전대로', async () => {
    const { DB } = fresh({ gate: false, accept: [3] })
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 1)).toBe(false)
    expect(await findBrandBranchForVoucherCode(DB, 'V1', '333333', { allowScanOnly: true })).toBeNull()
    expect(await canStoreRedeemProduct(DB, 100, 1, 2, 1)).toBe(true)
    expect(await checkBrandWideSettable(DB, 10, 1)).toEqual({ ok: true, acceptingCount: 1, sameOwnerCount: 1, crossOwnerCount: 0 })
  })
})

describe('② 게이트 ON — 받는 점주 동의(①)가 있어야 받는다', () => {
  it('동의한 승인 가맹점은 받는다, 이용권을 알 때만', async () => {
    const { DB } = fresh({ gate: true, accept: [3] })
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 1)).toBe(true)
    expect(await canStoreRedeemProduct(DB, 100, 1, 3)).toBe(false) // 이용권 id 없음 → fail-closed
    expect(await findBrandBranchForVoucherCode(DB, 'V1', '333333', { allowScanOnly: true })).toBe(3)
    expect(await checkBrandWideSettable(DB, 10, 1)).toEqual({ ok: true, acceptingCount: 2, sameOwnerCount: 1, crossOwnerCount: 1 })
  })
  it('동의 안 한 가맹점 · 심사 중 가맹점은 받지 않는다', async () => {
    const { DB } = fresh({ gate: true, accept: [4] })
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 1)).toBe(false) // 동의 없음
    expect(await canStoreRedeemProduct(DB, 100, 1, 4, 1)).toBe(false) // 동의했지만 심사 중
    expect(await findBrandBranchForVoucherCode(DB, 'V1', '444444', { allowScanOnly: true })).toBeNull()
  })
  it('동의 값이 "1" 이 아니면(꺼짐 "0") 받지 않는다', async () => {
    const { db, DB } = fresh({ gate: true })
    db.exec(`INSERT INTO seller_meta (seller_id,key,value) VALUES (3,'${CROSS_OWNER_ACCEPT_META}','0')`)
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 1)).toBe(false)
  })
  it('브랜드 전 지점이 꺼진 이용권은 가맹점도 받지 않는다', async () => {
    const { db, DB } = fresh({ gate: true, accept: [3] })
    db.exec(`UPDATE product_supply_meta SET value='0'`)
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 1)).toBe(false)
  })
})

describe('③ 판매 비용이 붙은 이용권은 받지 않는다(②)', () => {
  it('voucherHasSunkCost', async () => {
    const { DB } = fresh({ gate: true, accept: [3] })
    expect(await voucherHasSunkCost(DB, 1)).toBe(false) // 추천 적립이 취소됨
    expect(await voucherHasSunkCost(DB, 2)).toBe(true) // 소개비 살아 있음
    expect(await voucherHasSunkCost(DB, 3)).toBe(false) // 소개비 회수됨
    expect(await voucherHasSunkCost(DB, 4)).toBe(true) // 추천 적립 살아 있음
    expect(await voucherHasSunkCost(DB, 5)).toBe(false) // 주문 없음
    expect(await voucherHasSunkCost(DB, 999)).toBe(false) // 없는 이용권 = 주문 없음
  })
  it('가맹점은 비용 붙은 이용권을 거절하고, 같은 주인 지점은 그대로 받는다', async () => {
    const { DB } = fresh({ gate: true, accept: [3] })
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 2)).toBe(false)
    expect(await canStoreRedeemProduct(DB, 100, 1, 3, 4)).toBe(false)
    expect(await findBrandBranchForVoucherCode(DB, 'V2', '333333', { allowScanOnly: true })).toBeNull()
    expect(await canStoreRedeemProduct(DB, 100, 1, 2, 2)).toBe(true)
  })
  it('비용 테이블이 아예 없으면 비용 없음 · 그 밖의 조회 실패는 비용 있음(받지 않는다)', async () => {
    const { db, DB } = fresh({ gate: true, accept: [3] })
    db.exec(`DROP TABLE influencer_attributions`)
    db.exec(`DROP TABLE affiliate_earnings`)
    expect(await voucherHasSunkCost(DB, 2)).toBe(false)
    const broken = { prepare: (sql: string) => {
      const s = DB.prepare(sql) as unknown as { bind: (...a: unknown[]) => unknown }
      if (/influencer_attributions/.test(sql)) return { bind: () => ({ first: async () => { throw new Error('D1_ERROR: network') } }) }
      return s
    } } as unknown as D1Database
    expect(await voucherHasSunkCost(broken, 1)).toBe(true)
  })
})

describe('④ 손님 셀프는 가맹점을 받지 않는다(이용권 id 를 모른다)', () => {
  it('게이트 ON + 동의여도 셀프 게이트는 가맹점 코드를 거절, 같은 주인 코드는 받는다', async () => {
    const { DB } = fresh({ gate: true, accept: [3] })
    expect((await checkSelfRedeemGate(DB, 1, '333333', 100)).ok).toBe(false)
    expect((await checkSelfRedeemGate(DB, 1, '222222', 100)).ok).toBe(true)
  })
})

describe('⑤ 쓴 지점 기록 → 정산 두 레일이 같은 지점을 고른다', () => {
  it('가맹점이 받으면 cross_owner=1 · 원장·주간 정산 모두 그 지점', async () => {
    const { db, DB } = fresh({ gate: true, accept: [3] })
    await recordVoucherRedeemStore(DB, { voucherId: 1, soldSellerId: 1, storeSellerId: 3 })
    expect(db.prepare('SELECT store_seller_id, sold_seller_id, cross_owner FROM voucher_redeem_stores WHERE voucher_id = 1').get())
      .toEqual({ store_seller_id: 3, sold_seller_id: 1, cross_owner: 1 })
    expect(await settlementMerchantFor(DB, 1, 1)).toBe(3)
    const rows = db.prepare(`SELECT v.id, ${REDEEM_STORE_SETTLEMENT_SQL} AS seller_id FROM vouchers v JOIN products p ON p.id = v.product_id ORDER BY v.id`).all()
    expect(rows).toEqual([
      { id: 1, seller_id: 3 }, { id: 2, seller_id: 1 }, { id: 3, seller_id: 1 }, { id: 4, seller_id: 1 }, { id: 5, seller_id: 1 },
    ])
  })
  it('같은 주인 지점이 받으면 기록은 남아도 정산은 판 지점(cross_owner=0)', async () => {
    const { db, DB } = fresh({ gate: true })
    await recordVoucherRedeemStore(DB, { voucherId: 1, soldSellerId: 1, storeSellerId: 2 })
    expect((db.prepare('SELECT cross_owner FROM voucher_redeem_stores WHERE voucher_id = 1').get() as { cross_owner: number }).cross_owner).toBe(0)
    expect(await settlementMerchantFor(DB, 1, 1)).toBe(1)
    // 주간 정산(Rail A) 조각도 같은 판단 — 같은 주인 기록은 판 지점으로 묶는다
    const row = db.prepare(`SELECT ${REDEEM_STORE_SETTLEMENT_SQL} AS seller_id FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.id = 1`).get()
    expect(row).toEqual({ seller_id: 1 })
  })
  it('판 지점이 다시 받으면 옛 기록을 지운다 — 사용 취소 뒤 재사용이 엉뚱한 지점으로 정산되지 않게', async () => {
    const { db, DB } = fresh({ gate: true, accept: [3] })
    await recordVoucherRedeemStore(DB, { voucherId: 1, soldSellerId: 1, storeSellerId: 3 })
    await recordVoucherRedeemStore(DB, { voucherId: 1, soldSellerId: 1, storeSellerId: 1 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM voucher_redeem_stores').get()).toEqual({ n: 0 })
    expect(await settlementMerchantFor(DB, 1, 1)).toBe(1)
  })
  it('주인을 모르는 지점이면 cross_owner=0(정산은 판 지점 그대로)', async () => {
    const { db, DB } = fresh({ gate: true })
    db.exec(`UPDATE sellers SET linked_user_id = NULL WHERE id = 3`)
    await recordVoucherRedeemStore(DB, { voucherId: 1, soldSellerId: 1, storeSellerId: 3 })
    expect(await settlementMerchantFor(DB, 1, 1)).toBe(1)
  })
  it('정산은 게이트를 다시 보지 않는다 — 사용 뒤 게이트를 꺼도 받은 지점 그대로', async () => {
    const { db, DB } = fresh({ gate: true, accept: [3] })
    await recordVoucherRedeemStore(DB, { voucherId: 1, soldSellerId: 1, storeSellerId: 3 })
    db.exec(`DELETE FROM platform_settings`)
    expect(await settlementMerchantFor(DB, 1, 1)).toBe(3)
  })
})

describe('⑥ 배선', () => {
  it('사장님 스캔: CAS 직후 await 로 기록 → 원장은 settlementMerchantFor', () => {
    const src = stripComments(readFileSync('src/worker/utils/voucher-seller-redeem.ts', 'utf8'))
    const cas = src.indexOf("SET status = 'used'")
    const rec = src.indexOf('await recordVoucherRedeemStore(DB')
    const ledger = src.indexOf('recordVoucherUsedLedger(DB')
    expect(cas).toBeGreaterThan(0)
    expect(rec).toBeGreaterThan(cas)
    expect(ledger).toBeGreaterThan(rec)
    expect(src).toMatch(/storeSellerId: Number\(opts\.actorSellerId\)/)
    expect(src).toMatch(/const merchantId = await settlementMerchantFor\(DB, Number\(voucher\.id\)/)
  })
  it('카운터: 받은 지점(형제 지점 id ?? 판 지점)을 원장보다 먼저 기록하고 원장은 settlementMerchantFor', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))
    const rec = src.indexOf('await recordVoucherRedeemStore(DB')
    const ledger = src.indexOf('recordVoucherUsedLedger(DB')
    expect(rec).toBeGreaterThan(0)
    expect(ledger).toBeGreaterThan(rec)
    expect(src).toMatch(/storeSellerId: brandBranch \?\? meta\.seller_id/)
    expect(src).toMatch(/await settlementMerchantFor\(DB, Number\(meta\.voucher_id\)/)
  })
  it('주간 정산(Rail A): 같은 조각으로 묶고 테이블을 먼저 보장한다 · 수수료율은 그 지점', () => {
    const src = stripComments(readFileSync('src/worker/cron/auto-settlement.ts', 'utf8'))
    const ens = src.indexOf('await ensureRedeemStoreTable(DB)')
    const q = src.indexOf('${REDEEM_STORE_SETTLEMENT_SQL} AS seller_id')
    expect(ens).toBeGreaterThan(0)
    expect(q).toBeGreaterThan(ens)
    expect(src).toMatch(/LEFT JOIN sellers s ON s\.id = \$\{REDEEM_STORE_SETTLEMENT_SQL\}/)
  })
  it('받기 동의 API: 지금 좌석의 지점 · 주인만 · 켜기는 게이트가 열렸을 때만', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-brands.routes.ts', 'utf8'))
    expect(src).toMatch(/app\.put\('\/cross-owner-accept'/)
    expect(src).toMatch(/getSellerIdFromToken\(c\.req\.header\('Authorization'\)/)
    // GET·PUT 둘 다 주인만 — 한쪽만 남으면 운영자가 남의 지점 정산 방향을 바꿀 수 있다
    expect(src.match(/!\(await isStoreOwner\(c\.env\.DB, sellerId, userId\)\)/g)?.length).toBe(2)
    expect(src).toMatch(/b\.enabled && !\(await isCrossOwnerRedeemEnabled\(c\.env\.DB\)\)/)
  })
  it('게이트가 설정 검증 목록과 어드민 게이트 목록에 있다', () => {
    expect(readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf8')).toMatch(/brand_cross_owner_redeem_enabled: boolStr/)
    expect(readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')).toMatch(/key: 'brand_cross_owner_redeem_enabled'/)
  })
})
