/**
 * 🏷️ 2026-10-18 대표 *"다른 지점에서도 쓸 지는 선택하게 하는게 좋지 않아?"* → *"응 진행해줘"*
 *   — 브랜드 전 지점 사용(이용권마다 켬 · 같은 주인 지점만 · 정산은 판 지점 그대로).
 *
 * 실제 SQLite 에서 판정한다:
 *   ① 주인 SQL(`STORE_OWNER_SQL`)이 `resolveStoreOwnerUserId` 와 같은 사람을 고르는가(두 벌 대조)
 *   ② 받아 주는 지점 = 같은 주인 + 정산 가능 상태. 가맹점(주인 다름)·심사 중 지점은 받지 않는다
 *   ③ 이용권이 꺼져 있으면 아무 지점도 받지 않는다(기본값)
 *   ④ 카운터 CAS — 형제 지점 id 를 넘겨도 **비밀은 문장 안에서 다시 대조**한다. 안 넘기면 문장은 종전과 같다
 *   ⑤ 손님 셀프 — scan_only 지점은 제외, 판 지점 코드는 종전 경로 그대로
 *   ⑥ 배선 — 세 사용 경로가 이 판정을 부르고, 원장(정산)은 판 지점 그대로
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - D1 과 node:sqlite 의 차이 · 라이브에 같은 주인 두 지점을 가진 브랜드가 실제로 있는지(E4 는 라이브 판정)
 * - 화면(스위치)의 생김새 — 그건 렌더로 본다
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import {
  STORE_OWNER_SQL, brandSiblingsOf, canStoreRedeemProduct, findBrandBranchByStoreCode,
  checkBrandWideSettable, isBrandWideEnabled, BRAND_WIDE_META_KEY,
} from '@/worker/utils/brand-wide-redeem'
import { resolveStoreOwnerUserId } from '@/worker/utils/seller-operators'
import { checkSelfRedeemGate } from '@/worker/utils/self-redeem-gate'
import { redeemByCounterSecret } from '@/worker/utils/counter-redeem'

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
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

/**
 * 판 지점 1(주인 10, linked) · 2(주인 10, owner 좌석 — /store/new 사장님) · 3(주인 20 — 가맹점)
 * · 4(주인 10, 심사 중) · 5(주인 10, scan_only) · 6(브랜드 없음, 주인 30). 브랜드 1 = {1,2,3,4,5}.
 * 상품 100 = 지점 1 · 켜짐. 상품 101 = 지점 1 · 꺼짐.
 */
function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, status TEXT)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, store_verify_pin TEXT)`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, product_id INTEGER, status TEXT,
    used_at TEXT, expires_at TEXT)`)
  db.exec(`INSERT INTO sellers VALUES (1,10,'approved'),(2,NULL,'active'),(3,20,'approved'),(4,10,'pending'),(5,10,'approved'),(6,30,'approved')`)
  // 지점 2 — 운영자 좌석이 먼저 있어도 주인은 owner 좌석이다(회수된 owner 는 무시)
  db.exec(`INSERT INTO seller_operators (seller_id,user_id,role,granted_at,revoked_at) VALUES
    (2,99,'operator','2026-01-01',NULL),(2,77,'owner','2026-01-02','2026-02-01'),(2,10,'owner','2026-03-01',NULL)`)
  db.exec(`CREATE TABLE store_brands (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    created_by_user_id INTEGER NOT NULL, created_at DATETIME, deleted_at DATETIME)`)
  db.exec(`CREATE TABLE store_brand_members (seller_id INTEGER PRIMARY KEY, brand_id INTEGER NOT NULL, added_by_user_id INTEGER NOT NULL, added_at DATETIME)`)
  db.exec(`INSERT INTO store_brands (id,slug,name,created_by_user_id) VALUES (1,'kimbap','김밥천국',10)`)
  db.exec(`INSERT INTO store_brand_members (seller_id,brand_id,added_by_user_id) VALUES (1,1,10),(2,1,10),(3,1,10),(4,1,10),(5,1,10)`)
  db.exec(`CREATE TABLE seller_redemption_settings (seller_id INTEGER PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'store_code', store_code TEXT, updated_at DATETIME)`)
  db.exec(`INSERT INTO seller_redemption_settings (seller_id,mode,store_code) VALUES
    (1,'store_code','111111'),(2,'store_code','222222'),(3,'store_code','333333'),(4,'store_code','444444'),(5,'scan_only','555555')`)
  db.exec(`CREATE TABLE product_supply_meta (product_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT, updated_at DATETIME, PRIMARY KEY (product_id,key))`)
  db.exec(`INSERT INTO products VALUES (100,1,NULL),(101,1,NULL)`)
  db.exec(`INSERT INTO product_supply_meta (product_id,key,value) VALUES (100,'${BRAND_WIDE_META_KEY}','1'),(101,'${BRAND_WIDE_META_KEY}','0')`)
  db.exec(`INSERT INTO vouchers (code,product_id,status) VALUES ('V100A',100,'unused'),('V100B',100,'unused'),('V101',101,'unused')`)
  return { db, DB: d1(db) }
}

describe('① 주인 판정 — SQL 판과 resolveStoreOwnerUserId 가 같은 사람을 고른다', () => {
  it('지점 1~6 전부 일치', async () => {
    const { db, DB } = fresh()
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const sql = db.prepare(`SELECT ${STORE_OWNER_SQL} AS o FROM sellers s WHERE s.id = ?`).get(id) as { o: number | null }
      const fn = await resolveStoreOwnerUserId(DB, id)
      expect(sql.o == null ? null : Number(sql.o), `지점 ${id}`).toBe(fn ?? null)
    }
    // 대조가 헛돌지 않게 — owner 좌석 경로(지점 2)가 실제로 10 을 낸다
    expect(await resolveStoreOwnerUserId(DB, 2)).toBe(10)
  })
})

describe('② 받아 주는 지점 = 같은 주인 + 정산 가능 상태', () => {
  it('지점 1 의 형제: 2·5 만 받는다(3 가맹점 · 4 심사 중 제외)', async () => {
    const { DB } = fresh()
    const { ownerId, siblings } = await brandSiblingsOf(DB, 1)
    expect(ownerId).toBe(10)
    expect(siblings.map((s) => s.seller_id).sort()).toEqual([2, 3, 4, 5])
    expect(siblings.filter((s) => s.accepting).map((s) => s.seller_id).sort()).toEqual([2, 5])
  })
  it('삭제된 브랜드는 묶음이 아니다', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE store_brands SET deleted_at = '2026-10-18'`)
    expect((await brandSiblingsOf(DB, 1)).siblings).toEqual([])
  })
  it('사장님 스캔 경로 판정', async () => {
    const { DB } = fresh()
    expect(await canStoreRedeemProduct(DB, 100, 1, 1)).toBe(true) // 판 지점 자신 — 종전 그대로
    expect(await canStoreRedeemProduct(DB, 100, 1, 2)).toBe(true)
    expect(await canStoreRedeemProduct(DB, 100, 1, 3)).toBe(false) // 가맹점
    expect(await canStoreRedeemProduct(DB, 100, 1, 4)).toBe(false) // 심사 중
    expect(await canStoreRedeemProduct(DB, 100, 1, 6)).toBe(false) // 브랜드 밖
  })
})

describe('③ 꺼진 이용권은 아무 지점도 받지 않는다(기본값)', () => {
  it('상품 101(꺼짐) · 메타 없는 상품', async () => {
    const { db, DB } = fresh()
    expect(await isBrandWideEnabled(DB, 101)).toBe(false)
    expect(await canStoreRedeemProduct(DB, 101, 1, 2)).toBe(false)
    expect(await findBrandBranchByStoreCode(DB, 101, 1, '222222', { allowScanOnly: true })).toBeNull()
    db.exec(`INSERT INTO products VALUES (102,1,NULL)`)
    expect(await isBrandWideEnabled(DB, 102)).toBe(false)
  })
})

describe('④ 카운터 CAS — 비밀은 문장 안에서 다시 대조한다', () => {
  it('형제 지점 id 없이 형제 코드를 넣으면 0행(종전 동작)', async () => {
    const { DB } = fresh()
    const r = await redeemByCounterSecret(DB, 'V100A', '222222')
    expect(r.meta.changes).toBe(0)
  })
  it('형제 지점 id + 그 지점 코드 → 1행', async () => {
    const { DB } = fresh()
    const r = await redeemByCounterSecret(DB, 'V100A', '222222', 2)
    expect(r.meta.changes).toBe(1)
  })
  it('형제 지점 id 를 넘겨도 다른 지점 코드면 0행(id 만 믿지 않는다)', async () => {
    const { DB } = fresh()
    expect((await redeemByCounterSecret(DB, 'V100A', '333333', 2)).meta.changes).toBe(0)
    expect((await redeemByCounterSecret(DB, 'V100A', '', 2)).meta.changes).toBe(0)
  })
  it('판 지점 코드는 종전대로 통과', async () => {
    const { DB } = fresh()
    expect((await redeemByCounterSecret(DB, 'V100B', '111111')).meta.changes).toBe(1)
  })
  it('형제 지점 id 를 안 넘기면 문장이 형제 구문을 품지 않는다', () => {
    const src = stripComments(readFileSync('src/worker/utils/counter-redeem.ts', 'utf8'))
    expect(src).toMatch(/\$\{brandBranchSellerId \? BRAND_BRANCH_CLAUSE : ''\}/)
    expect(src).toMatch(/brandBranchSellerId \? \[Number\(brandBranchSellerId\), secret\] : \[\]/)
  })
})

describe('⑤ 손님 셀프 — 형제 코드 수용, scan_only 지점 제외', () => {
  it('findBrandBranchByStoreCode', async () => {
    const { DB } = fresh()
    expect(await findBrandBranchByStoreCode(DB, 100, 1, '222222', { allowScanOnly: false })).toBe(2)
    expect(await findBrandBranchByStoreCode(DB, 100, 1, ' 222222 ', { allowScanOnly: false })).toBe(2)
    expect(await findBrandBranchByStoreCode(DB, 100, 1, '333333', { allowScanOnly: true })).toBeNull() // 가맹점
    expect(await findBrandBranchByStoreCode(DB, 100, 1, '444444', { allowScanOnly: true })).toBeNull() // 심사 중
    expect(await findBrandBranchByStoreCode(DB, 100, 1, '555555', { allowScanOnly: false })).toBeNull() // scan_only
    expect(await findBrandBranchByStoreCode(DB, 100, 1, '555555', { allowScanOnly: true })).toBe(5)
    expect(await findBrandBranchByStoreCode(DB, 100, 1, '111111', { allowScanOnly: true })).toBeNull() // 판 지점 코드는 종전 경로
  })
  it('checkSelfRedeemGate — productId 를 줄 때만 형제 코드를 받는다', async () => {
    const { DB } = fresh()
    expect((await checkSelfRedeemGate(DB, 1, '222222', 100)).ok).toBe(true)
    expect((await checkSelfRedeemGate(DB, 1, '222222')).ok).toBe(false) // 종전 호출 그대로
    expect((await checkSelfRedeemGate(DB, 1, '222222', 101)).ok).toBe(false) // 꺼진 이용권
    expect((await checkSelfRedeemGate(DB, 1, '333333', 100)).ok).toBe(false) // 가맹점
    expect((await checkSelfRedeemGate(DB, 1, '555555', 100)).ok).toBe(false) // scan_only
    expect((await checkSelfRedeemGate(DB, 1, '111111', 100)).ok).toBe(true) // 판 지점
    expect((await checkSelfRedeemGate(DB, 1, '', 100)).ok).toBe(false)
  })
  it('판 지점이 scan_only 여도 판 지점 코드는 여전히 막는다', async () => {
    const { db, DB } = fresh()
    db.exec(`UPDATE seller_redemption_settings SET mode='scan_only' WHERE seller_id=1`)
    const g = await checkSelfRedeemGate(DB, 1, '111111', 100)
    expect(g.ok).toBe(false)
    expect(g.ok ? '' : g.code).toBe('SCAN_ONLY_MODE')
  })
})

describe('⑤-2 켤 수 있나 — 판 지점 주인만, 받아 줄 지점이 있을 때만', () => {
  it('checkBrandWideSettable', async () => {
    const { DB } = fresh()
    expect(await checkBrandWideSettable(DB, 10, 1)).toEqual({ ok: true, acceptingCount: 2 })
    expect(await checkBrandWideSettable(DB, 99, 1)).toEqual({ ok: false, code: 'NOT_OWNER' }) // 운영자
    expect(await checkBrandWideSettable(DB, 20, 3)).toEqual({ ok: false, code: 'NO_SAME_OWNER_BRANCH' }) // 가맹점 주인
    expect(await checkBrandWideSettable(DB, 30, 6)).toEqual({ ok: false, code: 'NO_BRAND' })
  })
})

describe('⑥ 배선 — 세 사용 경로 + 정산은 판 지점', () => {
  it('카운터: 형제 판정을 가드보다 먼저 하고 CAS 에 넘긴다', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))
    expect(src).toMatch(/findBrandBranchForVoucherCode\(DB, code, pin, \{ allowScanOnly: true \}\)/)
    expect(src).toMatch(/brandBranch \? null : await checkStoreCodeRequired\(/)
    expect(src).toMatch(/redeemByCounterSecret\(DB, code, pin, brandBranch\)/)
  })
  it('사장님 스캔: 형제 지점이면 403 대신 판정 함수', () => {
    const src = stripComments(readFileSync('src/worker/utils/voucher-seller-redeem.ts', 'utf8'))
    expect(src).toMatch(/!\(await canStoreRedeemProduct\(DB, Number\(voucher\.product_id\), voucher\.seller_id, Number\(actorSellerId\)\)\)/)
  })
  it('손님 셀프(잠금 파일): 상품 id 를 게이트에 넘긴다 — 승인된 두 줄', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/group-buy-public.routes.ts', 'utf8'))
    expect(src).toMatch(/SELECT v\.id, v\.status, v\.product_id, p\.seller_id FROM vouchers v/)
    expect(src).toMatch(/checkSelfRedeemGate\(DB, pre\.seller_id, String\(body\.store_code \|\| ''\), pre\.product_id\)/)
  })
  it('원장 상인은 여전히 판 지점(voucher.seller_id)', () => {
    const src = stripComments(readFileSync('src/worker/utils/voucher-seller-redeem.ts', 'utf8'))
    expect(src).toMatch(/const merchantId = voucher\.consigned_from_seller_id \?\? voucher\.seller_id/)
    expect(src).toMatch(/merchant_id: merchantId/)
  })
})

describe('⑦ /v 화면의 처리 버튼(can_redeem)도 같은 판정을 쓴다', () => {
  it('형제 지점이면 canStoreRedeemProduct 로 판정 — 표시와 실제 처리가 갈리지 않는다', () => {
    const src = stripComments(readFileSync('src/features/group-buy/api/voucher-can-redeem.ts', 'utf8'))
    expect(src).toMatch(/if \(Number\(productSellerId\) === Number\(u\.id\)\) return true/)
    expect(src).toMatch(/await canStoreRedeemProduct\(DB, Number\(v\.product_id\), Number\(productSellerId\), Number\(u\.id\)\)/)
  })
})
