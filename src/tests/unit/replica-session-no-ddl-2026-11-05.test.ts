/**
 * 🌏 2026-11-05 — 읽기 사본 세션 안에서 **정상 경로에 쓰기를 보내지 않는다**.
 *   라이브 표본(한국 HKG 콜로 → `primary:ENAM`)을 판정하다 찾았다: 홈 섹션이 사본 세션으로 부르는
 *   `listActiveBanners` 가 isolate 마다 `ALTER TABLE` 2번을 무조건 보냈다. 쓰기는 사본이 못 받아 미국 원본까지 가고
 *   (한국에서 왕복 ≈0.2초 × 2), 같은 세션의 뒤 읽기까지 원본으로 끌려갈 수 있다.
 *   ⇒ 칸이 있는지 **읽기(LIMIT 0)** 로 먼저 보고, 없을 때만 ALTER 한다.
 *
 * ⚠️ 못 보는 것: 실제 D1 세션이 쓰기 뒤 읽기를 어디로 보내는지(라이브 `X-D1-Served` 로만 판정).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { ensureBannerColumns } from '@/features/banners/api/banners.routes'
import { schemaPresent } from '@/worker/utils/d1-read-replica'
import { ensureSellerMetaTable } from '@/worker/utils/seller-meta'
import { ensureSupplyMetaTable } from '@/worker/utils/product-supply-meta'
import { ensureVoucherGiftTable } from '@/worker/utils/voucher-gift'
import { ensureReviewScoreTable } from '@/worker/utils/review-level'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
/** 진짜 SQLite + 보낸 문장 기록 */
function sqliteDb() {
  const db = new DatabaseSync(':memory:')
  const sent: string[] = []
  const D1 = {
    prepare(sql: string) {
      let a: unknown[] = []
      const st = {
        bind: (...x: unknown[]) => { a = x; return st },
        first: async () => { sent.push(sql); return db.prepare(sql).get(...(a as never[])) ?? null },
        all: async () => { sent.push(sql); return { results: db.prepare(sql).all(...(a as never[])) } },
        run: async () => { sent.push(sql); db.prepare(sql).run(...(a as never[])); return { meta: {} } },
      }
      return st
    },
  } as unknown as D1Database
  return { db, D1, sent }
}
const writes = (sent: string[]) => sent.filter((q) => /^\s*(CREATE|ALTER|INSERT|UPDATE|DELETE)\b/i.test(q))

function fakeDb(probeOk: boolean) {
  const sent: string[] = []
  const db = {
    prepare(sql: string) {
      const st = {
        bind: () => st,
        all: async () => { sent.push(sql); if (/LIMIT 0/.test(sql) && !probeOk) throw new Error('no such column'); return { results: [] } },
        run: async () => { sent.push(sql); return { meta: {} } },
        first: async () => { sent.push(sql); return null },
      }
      return st
    },
  } as unknown as D1Database
  return { db, sent }
}

describe('배너 칸 보장 — 정상 경로는 읽기만', () => {
  it('칸이 이미 있으면 ALTER 를 하나도 안 보낸다', async () => {
    const { db, sent } = fakeDb(true)
    await ensureBannerColumns(db)
    expect(sent.some((q) => /ALTER\s+TABLE/i.test(q)), '쓰기는 사본이 못 받아 미국 원본까지 간다').toBe(false)
    expect(sent.length).toBe(1)
  })
  it('칸이 없으면(옛 스키마) 종전대로 ALTER 로 만든다', async () => {
    const { db, sent } = fakeDb(false)
    await ensureBannerColumns(db)
    expect(sent.filter((q) => /ALTER\s+TABLE banners ADD COLUMN/.test(q))).toHaveLength(2)
  })
  it('isolate 당 한 번만 확인한다(메모)', async () => {
    const { db, sent } = fakeDb(true)
    await ensureBannerColumns(db); await ensureBannerColumns(db)
    expect(sent.length).toBe(1)
  })
})

describe('공용 확인 schemaPresent — 진짜 SQLite', () => {
  it('표·색인·칸이 다 있을 때만 true, 하나라도 없으면 false', async () => {
    const { db, D1 } = sqliteDb()
    db.exec('CREATE TABLE t (a TEXT, b TEXT); CREATE INDEX ix_t ON t(a)')
    expect(await schemaPresent(D1, { tables: ['t'], indexes: ['ix_t'], columns: [{ table: 't', cols: ['a', 'b'] }] })).toBe(true)
    expect(await schemaPresent(D1, { tables: ['t', 'nope'] })).toBe(false)
    expect(await schemaPresent(D1, { indexes: ['ix_nope'] })).toBe(false)
    expect(await schemaPresent(D1, { columns: [{ table: 't', cols: ['c'] }] })).toBe(false)
    expect(await schemaPresent(D1, { columns: [{ table: 't; DROP TABLE t', cols: ['a'] }] }), '이름은 낱말만').toBe(false)
    expect(await schemaPresent(D1, {}), '확인할 게 없으면 있다고 하지 않는다').toBe(false)
  })
})

describe('손님 읽기 경로의 표 보장 — 두 번째 isolate 부터는 쓰기 0', () => {
  const cases: Array<[string, (D: D1Database) => Promise<void>]> = [
    ['seller_meta', ensureSellerMetaTable],
    ['product_supply_meta', ensureSupplyMetaTable],
    ['voucher_gifts', ensureVoucherGiftTable],
    ['user_review_scores', ensureReviewScoreTable],
  ]
  it.each(cases)('%s — 처음엔 만들고, 이미 있으면 읽기만', async (_name, ensure) => {
    const { db, D1, sent } = sqliteDb()
    await ensure(D1) // 빈 DB → 만든다
    expect(writes(sent).length).toBeGreaterThan(0)
    // 새 isolate 흉내 — 메모는 DB 객체 기준이라 새 래퍼면 처음 보는 DB 다
    const fresh = { prepare: (sql: string) => { sent2.push(sql); return D1.prepare(sql) } } as unknown as D1Database
    const sent2: string[] = []
    await ensure(fresh)
    expect(writes(sent2), '이미 있는 표에 CREATE 를 보내면 미국 원본까지 간다').toEqual([])
    void db
  })
  it('유어샵 공개 화면(ensureCuratorTables)도 같은 확인을 먼저 한다', () => {
    const src = readFileSync('src/worker/routes/curator.routes.ts', 'utf8')
    const fn = src.slice(src.indexOf('async function ensureCuratorTables'), src.indexOf('async function ensureCuratorTables') + 900)
    expect(fn.indexOf('schemaPresent(')).toBeGreaterThan(0)
    expect(fn.indexOf('schemaPresent(')).toBeLessThan(fn.indexOf('CREATE TABLE IF NOT EXISTS product_pins'))
  })
})
