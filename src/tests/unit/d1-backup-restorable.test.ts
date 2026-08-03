/**
 * 💾 주간 D1 백업이 **복구 가능한 형태**인지 고정한다.
 *
 * ## 왜 (2026-08-03 복구 리허설 실측)
 * 첫 백업이 `ok=true` 로 성공했다(18.9 MB). 그런데 덤프 생성기는 `sqlite_master` 에서
 * **`type='table'` 만** 뽑고 있었다. 프로덕션 실측: 인덱스 **610**(그중 UNIQUE **46**) ·
 * 트리거 7 · 뷰 1 — 전부 백업에 안 담겼다.
 *
 * 축소판으로 실제 복구를 돌려 확인한 결과(파이썬 sqlite3, 같은 알고리즘 이식):
 *   - 복구본에서 `idx_ledger_ref` 같은 UNIQUE 가 사라져 **같은 ref 로 두 번 적립이 통과**했다.
 *     `INSERT OR IGNORE + partial UNIQUE` 로 지키던 멱등(머니 룰 #3)이 복구 직후 무력화된다.
 *   - FTS5 그림자 테이블(`*_data` BLOB / `*_idx` WITHOUT ROWID)을 그대로 실어 나르느라
 *     매주 "dump 실패 테이블 3개" 경고가 났고, BLOB 은 `String(v)` 로 뭉개져 있었다.
 *
 * ⚠️ 이 테스트가 **못 하는 것**: 실제 R2 객체를 받아 복구해 보지는 않는다(권한·환경 밖).
 *    "덤프에 무엇이 담기는가"만 고정한다. 진짜 판정은 `docs/BACKUP_RESTORE.md` 의 분기 리허설이고,
 *    그 절차의 검증 쿼리도 행 수만 세면 이 결함을 못 잡는다 — 스키마 객체 수를 함께 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { dumpDatabase } from '../../worker/cron/d1-backup'

/** 프로덕션과 같은 형태의 최소 sqlite_master (외부콘텐츠 FTS5 + 그림자 + D1 내부 테이블). */
const MASTER = [
  { type: 'table', name: '_cf_KV', tbl_name: '_cf_KV', sql: 'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID' },
  { type: 'table', name: 'ledger_entries', tbl_name: 'ledger_entries', sql: 'CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY, ref TEXT)' },
  { type: 'table', name: 'products', tbl_name: 'products', sql: 'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)' },
  { type: 'table', name: 'products_fts', tbl_name: 'products_fts', sql: "CREATE VIRTUAL TABLE products_fts USING fts5(name, content=products, content_rowid=id)" },
  { type: 'table', name: 'products_fts_data', tbl_name: 'products_fts_data', sql: "CREATE TABLE 'products_fts_data'(id INTEGER PRIMARY KEY, block BLOB)" },
  { type: 'table', name: 'products_fts_idx', tbl_name: 'products_fts_idx', sql: "CREATE TABLE 'products_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID" },
  { type: 'index', name: 'idx_ledger_ref', tbl_name: 'ledger_entries', sql: 'CREATE UNIQUE INDEX idx_ledger_ref ON ledger_entries(ref)' },
  { type: 'index', name: 'sqlite_autoindex_products_1', tbl_name: 'products', sql: null },
  { type: 'index', name: 'products_fts_idx_shadow', tbl_name: 'products_fts_idx', sql: 'CREATE INDEX products_fts_idx_shadow ON products_fts_idx(term)' },
  { type: 'trigger', name: 'products_fts_insert', tbl_name: 'products', sql: 'CREATE TRIGGER products_fts_insert AFTER INSERT ON products BEGIN SELECT 1; END' },
  { type: 'view', name: 'v_users', tbl_name: 'v_users', sql: 'CREATE VIEW v_users AS SELECT 1' },
]

const ROWS: Record<string, Record<string, unknown>[]> = {
  ledger_entries: [{ id: 1, ref: "order:1'quote" }],
  products: [{ id: 1, name: '아메리카노' }],
}

/**
 * 최소 D1 흉내 — dumpDatabase 가 실제로 발행하는 쿼리 형태에만 답한다.
 *
 * ⚠️ 커서는 `pragma_table_info` 로 고른 단일 INTEGER PK 다(2026-08-03 PR #995 — `SELECT rowid, *`
 *    는 D1 100컬럼 한도를 넘겨 `products`/`sellers` 를 통째로 날렸다). 이 가짜 DB 도 그 경로를
 *    그대로 태워야 실제와 같은 것을 검사하게 된다.
 */
function fakeDB(): D1Database {
  const answer = (sql: string, binds: unknown[]) => {
    if (/pragma_table_info/.test(sql)) {
      const table = String(binds[0] ?? '')
      const cols = Object.keys(ROWS[table]?.[0] || {})
      return cols.map((name) => ({ name, type: name === 'id' ? 'INTEGER' : 'TEXT', pk: name === 'id' ? 1 : 0 }))
    }
    if (/FROM sqlite_master/.test(sql) && /type IN/.test(sql)) {
      return MASTER.filter((m) => ['index', 'trigger', 'view'].includes(m.type) && m.sql && !m.name.startsWith('sqlite_'))
    }
    if (/FROM sqlite_master/.test(sql) && /name = \?/.test(sql)) {
      return MASTER.filter((m) => m.type === 'table' && m.name === binds[0])
    }
    if (/FROM sqlite_master/.test(sql)) {
      return MASTER.filter((m) => m.type === 'table' && !m.name.startsWith('sqlite_'))
    }
    const table = /FROM (\w+)/.exec(sql)?.[1] || ''
    if (/WITHOUT ROWID/.test(MASTER.find((m) => m.name === table)?.sql || '')) {
      throw new Error('no such column: rowid')
    }
    const lastId = Number(binds[0] ?? 0)
    return (ROWS[table] || []).filter((r) => Number(r.id) > lastId)
  }
  const prepare = (sql: string) => {
    const run = (binds: unknown[]) => ({
      all: async () => ({ results: answer(sql, binds) }),
      first: async () => answer(sql, binds)[0] ?? null,
    })
    return { bind: (...b: unknown[]) => run(b), ...run([]) }
  }
  return { prepare } as unknown as D1Database
}

describe('D1 백업 덤프 — 복구 가능성', () => {
  it('인덱스·트리거·뷰를 담는다 (0 이면 통과가 아니라 실패)', async () => {
    const { sql, objectCount } = await dumpDatabase(fakeDB())
    expect(objectCount, '스키마 객체가 0 = 추출 고장').toBeGreaterThan(0)
    expect(sql, 'UNIQUE 인덱스 소실 = 복구본에서 중복 적립 통과').toContain('CREATE UNIQUE INDEX idx_ledger_ref')
    expect(sql).toContain('CREATE TRIGGER products_fts_insert')
    expect(sql).toContain('CREATE VIEW v_users')
  })

  it('인덱스/트리거는 데이터 INSERT 뒤에 온다 (적재 중 트리거 재발화 방지)', async () => {
    const { sql } = await dumpDatabase(fakeDB())
    expect(sql.indexOf('CREATE UNIQUE INDEX idx_ledger_ref')).toBeGreaterThan(sql.lastIndexOf('INSERT INTO ledger_entries'))
  })

  it('자동 인덱스와 FTS 그림자 객체는 제외한다 (복구 시 에러 유발)', async () => {
    const { sql } = await dumpDatabase(fakeDB())
    expect(sql).not.toContain('sqlite_autoindex')
    expect(sql).not.toContain('products_fts_idx_shadow')
    expect(sql).not.toContain("CREATE TABLE 'products_fts_data'")
  })

  it('FTS5 는 그림자 대신 rebuild 로 재생성한다', async () => {
    const { sql, errorTables } = await dumpDatabase(fakeDB())
    expect(sql).toContain("INSERT INTO products_fts(products_fts) VALUES('rebuild');")
    // 가상 테이블 본체에 데이터 INSERT 를 넣으면 외부콘텐츠 FTS 가 깨진다
    expect(sql).not.toMatch(/INSERT INTO products_fts \(/)
    // WITHOUT ROWID / D1 내부 테이블을 건드리지 않으니 실패 테이블이 없어야 한다
    expect(errorTables, 'dump 실패 테이블이 남아 있으면 매주 무결성 경고가 난다').toEqual([])
  })

  it('D1 내부 테이블(_cf_KV)은 덤프 대상이 아니다', async () => {
    const { sql } = await dumpDatabase(fakeDB())
    expect(sql).not.toContain('_cf_KV')
  })

  it("문자열의 작은따옴표는 이스케이프한다 (replay 중단 방지)", async () => {
    const { sql } = await dumpDatabase(fakeDB())
    expect(sql).toContain("'order:1''quote'")
  })
})
