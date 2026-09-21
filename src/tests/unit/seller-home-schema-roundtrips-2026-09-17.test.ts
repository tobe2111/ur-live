/**
 * 🐌 셀러 홈 "내 이용권" 이 늦게 뜨던 것 — 데이터 읽기 **전에** 도는 스키마 보정의 왕복 수.
 *
 * 2026-09-17, 대표 *"내 이용권이 너무 늦게 떠. 로딩이 느려."*
 *
 * ## 무엇이 느렸나 (라이브 실측)
 * `ensureTables`(group-buy helpers)가 `products` 에 **ALTER 20개를 무조건 직렬로** 던졌다.
 * 그런데 `PRAGMA table_info` 로 재 보니 **20개 전부 이미 존재**한다 — 전부 실패하는 왕복이었다.
 * 셀러 홈의 이용권 목록은 그걸 다 기다린 뒤에야 자기 쿼리를 시작했고, 에러가 없어 아무도 못 봤다.
 * (DB 자체는 빠르다: 실행계획이 `idx_products_seller_id` 를 타고 `order_items` 는 79행뿐이다.)
 *
 * ## 이 시험이 지키는 불변식
 * 1. 컬럼이 이미 다 있으면 **ALTER 를 한 번도 안 던진다**.
 * 2. 없으면 **없는 것만** 던진다(self-heal 이 약해지지 않는다 — 새 D1 이 여전히 살아난다).
 * 3. 컬럼 목록을 못 읽으면 **전부 시도**한다(종전 동작 — 조용히 덜 고치면 안 된다).
 * 4. 라우트는 두 보정을 **동시에 시작**한다(직렬로 더하지 않는다).
 *
 * ## ⚠️ 이 시험이 못 재는 것
 * 실제 ms. D1 왕복 지연은 런타임 것이라 여기선 **왕복 횟수**만 센다 — 판정은 라이브에서.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { stripComments } from '../helpers/source-text'

// 🧱 `import 'node:sqlite'` 를 직접 쓰면 vite 가 번들하려다 죽는다 — 같은 레포의
//   `danggeun-approval-gates-2026-09-16.test.ts` 가 쓰는 우회를 그대로 쓴다.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/** 실제 SQLite 를 D1 처럼 감싸고, 나간 SQL 을 전부 기록한다. */
function fakeD1(db: InstanceType<typeof DatabaseSync>, log: string[]) {
  return {
    prepare(sql: string) {
      return {
        async all<T>() {
          log.push(sql)
          try { return { results: db.prepare(sql).all() as T[] } } catch { throw new Error('sql failed') }
        },
        async run() {
          log.push(sql)
          db.prepare(sql).run()
          return { meta: {} }
        },
        bind() { return this },
        async first() { log.push(sql); return null },
      }
    },
    async batch() { return [] },
  }
}

async function freshModule() {
  // `ensureTables` 는 **모듈 전역** 메모이즈(`_ensuredTables`)를 쓴다 — 한 번 돌면 이후 전부 skip 이다.
  //   매 시험마다 모듈을 새로 불러와야 실제로 돈다(안 그러면 ②③ 이 0건을 보고 조용히 통과한다).
  vi.resetModules()
  return import('../../features/group-buy/api/helpers')
}

const PRODUCT_COLS = [
  'restaurant_name', 'restaurant_address', 'restaurant_phone', 'restaurant_lat', 'restaurant_lng',
  'voucher_expiry', 'voucher_terms', 'group_buy_target', 'group_buy_current', 'group_buy_deadline',
  'group_buy_status', 'store_verify_pin', 'store_owner_token', 'group_buy_tiers',
  'milestone_notified_50', 'milestone_notified_80', 'milestone_notified_lastone',
]

function makeDb(withCols: boolean) {
  const db = new DatabaseSync(':memory:')
  const extra = withCols ? ', ' + PRODUCT_COLS.map((c) => `${c} TEXT`).join(', ') : ''
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT${extra})`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY${withCols ? ', applied_discount_pct INTEGER, applied_price INTEGER, is_experience INTEGER' : ''})`)
  db.exec(`CREATE TABLE gift_catalog (gift_code TEXT)`)
  return db
}

const alters = (log: string[]) => log.filter((s) => /ALTER TABLE/i.test(s))

describe('셀러 홈 — 이용권 목록 앞의 스키마 보정 왕복', () => {
  it('① 컬럼이 이미 다 있으면 ALTER 를 한 번도 안 던진다 (라이브가 이 경우다)', async () => {
    const db = makeDb(true)
    const log: string[] = []
    const { ensureTables } = await freshModule()
    await ensureTables(fakeD1(db, log) as never)
    expect(alters(log), `ALTER 가 나갔다:\n${alters(log).join('\n')}`).toHaveLength(0)
  })

  it('② 없으면 없는 것만 던진다 — self-heal 이 약해지지 않는다', async () => {
    const db = makeDb(false)
    const log: string[] = []
    const { ensureTables } = await freshModule()
    await ensureTables(fakeD1(db, log) as never)
    const sent = alters(log)
    // products 17 + vouchers 3 = 20. 하나도 빠지면 콜드 D1 이 "no such column" 으로 죽는다.
    expect(sent.length).toBe(20)
    for (const c of PRODUCT_COLS) {
      expect(sent.some((s) => s.includes(`ADD COLUMN ${c}`)), `${c} 를 안 고쳤다`).toBe(true)
    }
    // 그리고 실제로 컬럼이 생겼는지 — 문자열이 아니라 스키마를 본다
    const after = new Set((db.prepare(`SELECT name FROM pragma_table_info('products')`).all() as { name: string }[]).map((r) => r.name))
    for (const c of PRODUCT_COLS) expect(after.has(c), `${c} 가 실제로 안 생겼다`).toBe(true)
  })

  it('③ 컬럼 목록을 못 읽으면 전부 시도한다 (조용히 덜 고치지 않는다)', async () => {
    const db = makeDb(false)
    const log: string[] = []
    const broken = fakeD1(db, log) as never as { prepare: (s: string) => unknown }
    const inner = broken.prepare.bind(broken)
    ;(broken as { prepare: (s: string) => unknown }).prepare = (sql: string) => {
      if (/pragma_table_info/i.test(sql)) {
        return { async all() { throw new Error('pragma unavailable') }, bind() { return this } }
      }
      return inner(sql)
    }
    const { ensureTables } = await freshModule()
    await ensureTables(broken as never)
    expect(alters(log).length).toBe(20)
  })

  it('④ 라우트는 두 보정을 동시에 시작한다 — 직렬로 더하지 않는다', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf-8'))
    expect(src).toMatch(/await Promise\.all\(\[\s*ensureSupplyVisibilitySchema\(db\),\s*ensureGroupBuyColumns\(db\)\s*\]\)/)
    // 옛 직렬 형태가 돌아오면 빨간불
    expect(src).not.toMatch(/await ensureSupplyVisibilitySchema\(db\);[\s\S]{0,80}await ensureGroupBuyColumns\(db\)/)
  })
})
