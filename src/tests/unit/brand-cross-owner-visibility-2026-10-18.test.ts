/**
 * 🏷️ 2026-10-18 브랜드 3단계 후속 — "누가 무엇을 보나" (대표 "응" — 개선 1~3).
 *
 *   ① 손님 상세: 다른 점주 지점 수를 같은 주인 지점과 **섞지 않고** 따로 말한다(소개 링크 이용권은 거기서 못 쓴다 — 결재 ②)
 *   ② 판 지점 사장님 주문 상세: 다른 점주 지점이 받았으면 그 지점 이름 + "정산도 그 지점으로" 를 보여 준다
 *   ③ 어드민 정산 화면: 다른 점주 사용 내역(쓴 지점이 정산받는 건)을 읽는다
 *
 * 전부 읽기 — 돈·상태 무접촉. 실제 SQLite 에서 판정한다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 화면이 실제로 그 줄을 보기 좋게 그리는지(렌더는 눈으로) · 브라우저에서의 레이아웃
 * - 기록 테이블이 D1 에서 처음 생기는 시점(첫 다른 점주 사용) — 그 전엔 조인이 던지고 종전 조회로 떨어진다(②에서 그 길을 잰다)
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { brandBranchesLabel } from '@/pages/group-buy/brand-branches-label'
import { enrichSellerOrderRows } from '@/worker/utils/order-list-enrich'
import { adminBrandCrossOwnerRoutes } from '@/features/admin/api/admin-brand-cross-owner.routes'
import { CROSS_OWNER_GATE_KEY } from '@/worker/utils/brand-cross-owner'

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
  return { prepare: stmt } as unknown as D1Database
}

/** 지점 1(판 지점 '본점') · 3('가맹 3호점'). 이용권 V1(주문 501, 3호점이 받음) · V2(주문 501, 판 지점이 씀) · V3(주문 502, 환불). */
function fresh(opts: { redeemTable?: boolean; gate?: boolean } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, name TEXT)`)
  db.exec(`INSERT INTO sellers VALUES (1,'본점',NULL),(3,'가맹 3호점',NULL)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT)`)
  db.exec(`INSERT INTO products VALUES (100,1,'점심 세트')`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, code TEXT, status TEXT,
    used_at TEXT, expires_at TEXT, applied_price INTEGER)`)
  db.exec(`INSERT INTO vouchers VALUES (1,501,100,'111111','used','2026-10-18 03:00:00',NULL,10000),
    (2,501,100,'222222','used','2026-10-18 02:00:00',NULL,10000),(3,502,100,'333333','refunded',NULL,NULL,8000)`)
  db.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  if (opts.gate) db.exec(`INSERT INTO platform_settings VALUES ('${CROSS_OWNER_GATE_KEY}','true')`)
  if (opts.redeemTable) {
    db.exec(`CREATE TABLE voucher_redeem_stores (voucher_id INTEGER PRIMARY KEY, store_seller_id INTEGER NOT NULL,
      sold_seller_id INTEGER NOT NULL, cross_owner INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT (datetime('now')))`)
    db.exec(`INSERT INTO voucher_redeem_stores (voucher_id,store_seller_id,sold_seller_id,cross_owner) VALUES (1,3,1,1),(3,3,1,1)`)
  }
  return { db, DB: d1(db) }
}

describe('① 손님 상세 — 다른 점주 지점은 따로 말한다', () => {
  it('다른 점주 지점이 없으면 종전 문구 그대로("어디서나")', () => {
    expect(brandBranchesLabel({ name: '브랜드', branch_count: 4, usable_branches: 3 })).toEqual({
      main: '브랜드 3곳 어디서나 사용 가능 · 지점 보기', note: null,
    })
    expect(brandBranchesLabel({ name: '브랜드', branch_count: 4, usable_branches: 0 }).main).toBe('브랜드 다른 지점 3곳 보기')
  })
  it('다른 점주 지점이 있으면 "어디서나" 에 섞지 않고, 소개 링크 주의 한 줄을 붙인다', () => {
    const l = brandBranchesLabel({ name: '브랜드', branch_count: 4, usable_branches: 2, cross_owner_branches: 1 })
    expect(l.main).toBe('브랜드 2곳 + 가맹점 1곳에서 사용 가능 · 지점 보기')
    expect(l.main).not.toMatch(/어디서나/)
    expect(l.note).toMatch(/소개 링크/)
  })
  it('같은 주인 지점 없이 다른 점주 지점만 받는 경우', () => {
    const l = brandBranchesLabel({ name: '브랜드', branch_count: 4, usable_branches: 1, cross_owner_branches: 2 })
    expect(l.main).toBe('브랜드 가맹점 2곳에서도 사용 가능 · 지점 보기')
    expect(l.note).not.toBeNull()
  })
  it('서버가 다른 점주 지점 수를 사용 순간과 같은 판정(crossOwnerOk)으로 세어 따로 싣는다', () => {
    const src = stripComments(readFileSync('src/features/brands/api/brands-public.routes.ts', 'utf8'))
    expect(src).toMatch(/cross_owner_branches\s*=\s*siblings\.filter\(\(s\)\s*=>\s*!s\.accepting\s*&&\s*s\.crossOwnerOk\)\.length/)
    expect(src).toMatch(/usable_branches,\s*cross_owner_branches\s*\}/)
  })
  it('화면은 문구를 이 함수에서만 받는다(두 벌 금지)', () => {
    const ui = stripComments(readFileSync('src/pages/group-buy/BrandBranchesLink.tsx', 'utf8'))
    expect(ui).toMatch(/brandBranchesLabel\(data\)/)
    expect(ui).not.toMatch(/어디서나 사용 가능/)
  })
})

describe('② 판 지점 사장님 주문 상세 — 어느 지점에서 쓰였고 정산이 넘어갔는지', () => {
  it('다른 점주 지점이 받은 이용권에만 그 지점 이름이 붙는다', async () => {
    const { DB } = fresh({ redeemTable: true })
    const rows: Record<string, unknown>[] = [{ id: 501 }, { id: 502 }]
    await enrichSellerOrderRows(DB, rows)
    const vs = rows[0].vouchers as Array<{ code: string; redeemed_store_name: string | null }>
    expect(vs.map((v) => [v.code, v.redeemed_store_name])).toEqual([['111111', '가맹 3호점'], ['222222', null]])
  })
  it('기록 테이블이 아직 없으면(첫 사용 전) 종전 조회로 떨어져 이용권 코드는 그대로 나온다', async () => {
    const { DB } = fresh({ redeemTable: false })
    const rows: Record<string, unknown>[] = [{ id: 501 }]
    await enrichSellerOrderRows(DB, rows)
    const vs = rows[0].vouchers as Array<{ code: string; redeemed_store_name?: string | null }>
    expect(vs.map((v) => v.code)).toEqual(['111111', '222222'])
    expect(vs.every((v) => v.redeemed_store_name == null)).toBe(true)
  })
  it('화면이 그 이름을 정산 안내와 함께 보여 준다', () => {
    const ui = stripComments(readFileSync('src/pages/seller-orders/VoucherCodes.tsx', 'utf8'))
    expect(ui).toMatch(/v\.redeemed_store_name\s*\?/)
    expect(ui).toMatch(/voucherRedeemedElsewhere/)
    for (const lang of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(readFileSync(`public/locales/${lang}/translation.json`, 'utf8'))
      expect(j.seller?.voucherRedeemedElsewhere, `${lang} 번역 누락`).toMatch(/\{\{store\}\}/)
    }
  })
})

describe('③ 어드민 — 다른 점주 사용 내역', () => {
  async function get(DB: D1Database, q = '') {
    const res = await adminBrandCrossOwnerRoutes.request(`/brand-cross-owner/redemptions${q}`, {}, { DB })
    return res.json() as Promise<{ success: boolean; data: { enabled: boolean; total_count: number; total_amount: number; rows: Array<Record<string, unknown>> } }>
  }
  it('쓴 이용권만 센다(환불된 기록은 제외) · 판 지점/쓴 지점 이름을 싣는다', async () => {
    const { DB } = fresh({ redeemTable: true, gate: true })
    const r = await get(DB)
    expect(r.success).toBe(true)
    expect(r.data.enabled).toBe(true)
    expect(r.data.total_count).toBe(1)
    expect(r.data.total_amount).toBe(10000)
    expect(r.data.rows).toHaveLength(1)
    expect(r.data.rows[0]).toMatchObject({ voucher_id: 1, sold_store_name: '본점', store_name: '가맹 3호점', product_name: '점심 세트' })
  })
  it('기록 테이블이 없어도 빈 목록(500 아님) · 게이트 꺼짐을 그대로 말한다', async () => {
    const { DB } = fresh({ redeemTable: false, gate: false })
    const r = await get(DB)
    expect(r.success).toBe(true)
    expect(r.data).toMatchObject({ enabled: false, total_count: 0, rows: [] })
  })
  it('비숫자 limit 에도 깨지지 않는다(intParam)', async () => {
    const { DB } = fresh({ redeemTable: true })
    expect((await get(DB, '?limit=abc')).success).toBe(true)
  })
  it('어드민 앱(관리자 인증 아래)에 마운트되고, 정산 화면이 카드를 그린다', () => {
    const idx = readFileSync('src/worker/index.ts', 'utf8')
    expect(idx).toMatch(/adminApp\.route\('\/', adminBrandCrossOwnerRoutes\)/)
    const page = stripComments(readFileSync('src/pages/AdminSettlementPage.tsx', 'utf8'))
    expect(page).toMatch(/<CrossOwnerRedemptionsCard \/>/)
  })
  it('읽기 전용 — 쓰기 SQL 이 없다', () => {
    const src = stripComments(readFileSync('src/features/admin/api/admin-brand-cross-owner.routes.ts', 'utf8'))
    expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/)
    expect(src).not.toMatch(/\.(post|put|patch|delete)\(/)
  })
})
