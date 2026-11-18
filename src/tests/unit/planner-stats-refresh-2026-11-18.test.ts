/**
 * 📊 2026-11-18 쿼리 플래너 통계 갱신 — 라이브 `sqlite_stat1` 이 products=10행(실제 2,572)으로 멈춰 있어
 *   목록 쿼리가 좋은 색인을 두고 활성 상품 94% 를 읽은 뒤 임시 정렬을 했다(하루 수백만 행).
 *
 * 지키는 것: 매일 청소가 통계를 다시 잰다 · 인자 없는 `PRAGMA optimize` 로 바꾸지 않는다(새 연결에선 아무 일도 안 한다).
 * 진짜 SQLite 로: 오래된 통계가 `optimize=0x10002` 로 실제 행 수에 맞게 바뀐다.
 * 못 막는 것: D1 이 PRAGMA 를 거절하는지(그때는 ANALYZE 로 넘어간다 — 결과 `stats_refresh` 값으로 판정).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const SRC = fs.readFileSync('src/worker/cron/scheduled-cleanup-daily.ts', 'utf8')

describe('쿼리 플래너 통계 갱신', () => {
  it('매일 청소가 표를 가리지 않고 통계를 다시 잰다', () => {
    expect(SRC).toMatch(/DB\.prepare\('PRAGMA optimize=0x10002'\)\.run\(\)/)
    expect(SRC).toMatch(/ANALYZE \$\{t\}/)
  })
  it('진짜 SQLite: 10행 때 잰 통계가 실제 행 수로 바뀐다', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, is_active INT, created_at TEXT); CREATE INDEX idx_a ON products(is_active)')
    const ins = db.prepare("INSERT INTO products (is_active, created_at) VALUES (1, datetime('now'))")
    for (let i = 0; i < 10; i++) ins.run()
    db.exec('ANALYZE')
    db.exec('BEGIN'); for (let i = 0; i < 3000; i++) ins.run(); db.exec('COMMIT')
    const before = (db.prepare("SELECT stat FROM sqlite_stat1 WHERE idx='idx_a'").get() as { stat: string }).stat
    expect(before.startsWith('10 ')).toBe(true)
    db.exec('PRAGMA optimize=0x10002')
    const after = (db.prepare("SELECT stat FROM sqlite_stat1 WHERE idx='idx_a'").get() as { stat: string }).stat
    expect(Number(after.split(' ')[0])).toBeGreaterThan(1000)
  })
})
