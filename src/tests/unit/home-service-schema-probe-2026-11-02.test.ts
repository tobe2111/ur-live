/**
 * 🐢 2026-11-02 대표 *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"* — 생활(home-service) 표 확인을 왕복 1회로.
 *
 * 종전 `ensureHomeServiceTables` 는 서버가 새로 켜질 때마다 DDL 34문장을 **하나씩** 미국 DB 에 보냈다
 * (라이브 `/api/home-service/config` 서버 시간 1,424ms · 같은 서버 재요청 42ms). 이제 "다 있나" 를 batch 한 번으로 묻고
 * 다 있으면 DDL 을 건너뛴다. 이 시험은 **진짜 SQLite** 위에서 양쪽을 고정한다:
 *   ① 표가 다 있으면 왕복은 batch 1회뿐(DDL 0문장)
 *   ② 칸 하나·색인 하나라도 빠지면 종전처럼 DDL 을 전부 돌아 채운다(빨리 가려다 표를 빠뜨리지 않는다)
 * ⚠️ 못 보는 것: 실제 D1 의 왕복 시간(라이브 Server-Timing 으로 판정) · D1 batch 의 세부 오류 형태.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { HS_TABLES_SQL, buildSchemaProbe, ensureHomeServiceTables } from '@/features/home-service/api/home-service-db'
import { SEEDING_TABLES_SQL, ensureSeedingTables } from '@/features/seeding/api/seeding-db'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/** DatabaseSync 위의 최소 D1 흉내 — 왕복(prepare 실행 · batch)을 센다. */
function d1(db: InstanceType<typeof DatabaseSync>) {
  const count = { runs: 0, batches: 0 }
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    _exec: () => db.prepare(sql).all(...(args as never[])),
    run: async () => { count.runs++; db.prepare(sql).run(...(args as never[])); return { meta: { changes: 0 } } },
    all: async () => { count.runs++; return { results: db.prepare(sql).all(...(args as never[])) } },
    first: async () => { count.runs++; return db.prepare(sql).get(...(args as never[])) ?? null },
  })
  const api = {
    prepare: (sql: string) => stmt(sql),
    batch: async (ss: Array<{ _exec: () => unknown[] }>) => { count.batches++; return ss.map((s) => ({ results: s._exec() })) },
  }
  return { DB: api as unknown as D1Database, count }
}

const fullSchema = () => {
  const db = new DatabaseSync(':memory:')
  for (const sql of HS_TABLES_SQL) { try { db.exec(sql) } catch { /* 이미 있는 칸 */ } }
  return db
}

describe('생활 표 확인 — 왕복 1회', () => {
  it('확인 질문이 모든 DDL 을 알아본다(모르는 모양이 있으면 빈 배열 → 매번 DDL 전체로 느려진다)', () => {
    const probe = buildSchemaProbe()
    expect(probe.length).toBeGreaterThan(1)
    const creates = HS_TABLES_SQL.filter((s) => /^\s*CREATE (TABLE|(UNIQUE )?INDEX)/i.test(s)).length
    expect(probe[0].expect).toBe(creates)
    const alters = HS_TABLES_SQL.filter((s) => /^\s*ALTER TABLE/i.test(s)).map((s) => /ADD COLUMN (\w+)/i.exec(s)![1])
    const colSql = probe.slice(1).map((p) => p.sql).join(' ')
    for (const c of alters) expect(colSql).toContain(c)
    expect(buildSchemaProbe(['DROP TABLE x'])).toEqual([])
  })

  it('표가 다 있으면 batch 1회로 끝 — DDL 은 한 문장도 안 보낸다', async () => {
    const { DB, count } = d1(fullSchema())
    await ensureHomeServiceTables(DB)
    expect(count).toEqual({ runs: 0, batches: 1 })
  })

  it('빈 DB 면 DDL 을 전부 돌아 표를 만든다', async () => {
    const db = new DatabaseSync(':memory:')
    const { DB, count } = d1(db)
    await ensureHomeServiceTables(DB)
    expect(count.runs).toBe(HS_TABLES_SQL.length)
    const again = d1(db)
    await ensureHomeServiceTables(again.DB)
    expect(again.count).toEqual({ runs: 0, batches: 1 })
  })

  it('칸 하나가 빠졌으면 DDL 로 채운다(가장 최근 ALTER)', async () => {
    const db = new DatabaseSync(':memory:')
    const last = HS_TABLES_SQL.filter((s) => /^\s*ALTER/i.test(s)).at(-1)!
    for (const sql of HS_TABLES_SQL) { if (sql === last) continue; try { db.exec(sql) } catch { /* */ } }
    const { DB, count } = d1(db)
    await ensureHomeServiceTables(DB)
    expect(count.runs).toBe(HS_TABLES_SQL.length)
    const col = /ADD COLUMN (\w+)/i.exec(last)![1]
    const table = /ALTER TABLE (\w+)/i.exec(last)![1]
    expect((db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[]).map((r) => r.name)).toContain(col)
  })

  it('머니 멱등 UNIQUE 색인이 빠졌으면 DDL 로 다시 만든다', async () => {
    const db = fullSchema()
    db.exec('DROP INDEX idx_hs_credit_tx_kind_ref')
    const { DB, count } = d1(db)
    await ensureHomeServiceTables(DB)
    expect(count.runs).toBe(HS_TABLES_SQL.length)
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_hs_credit_tx_kind_ref'`).get()).toBeTruthy()
  })

  it('/config 는 엣지 캐시 + 두 읽기를 나란히', () => {
    const src = readFileSync('src/features/home-service/api/home-service.routes.ts', 'utf8')
    const block = src.slice(src.indexOf("homeServiceRoutes.get('/config'"), src.indexOf("homeServiceRoutes.get('/config'") + 600)
    expect(block).toMatch(/get\('\/config', publicCache\(\d+\)/)
    expect(block).toMatch(/Promise\.all\(\[\s*homeServiceStopped/)
  })

  it('팔아보기(seeding)도 같은 확인 — 다 있으면 batch 1회, 빈 DB 면 DDL 전부', async () => {
    const full = new DatabaseSync(':memory:')
    for (const sql of SEEDING_TABLES_SQL) { try { full.exec(sql) } catch { /* */ } }
    const a = d1(full); await ensureSeedingTables(a.DB)
    expect(a.count).toEqual({ runs: 0, batches: 1 })
    const empty = d1(new DatabaseSync(':memory:')); await ensureSeedingTables(empty.DB)
    expect(empty.count.runs).toBe(SEEDING_TABLES_SQL.length)
    expect(buildSchemaProbe(SEEDING_TABLES_SQL).length).toBeGreaterThan(1)
  })
})
