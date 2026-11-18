/**
 * 📇 2026-11-18 리뷰 이름 백필이 매일 11.8만 행을 다 읽던 것 — 빈 이름만 담는 부분 색인.
 * 지키는 것: 색인이 repair 목록에 있고, **백필 UPDATE 가 진짜 SQLite 에서 그 색인을 탄다**(WHERE 글자가 어긋나면 안 탄다).
 * 못 막는 것: 라이브에 색인이 실제로 생겼는지(배포 repair-schema 가 만든다 — sqlite_master 로 판정).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const IDX = fs.readFileSync('src/worker/routes/repair-schema/index-repairs.ts', 'utf8')
const LANE = fs.readFileSync('src/worker/cron/daily-lane.ts', 'utf8')

describe('리뷰 이름 백필 색인', () => {
  it('백필 UPDATE 가 부분 색인을 탄다', () => {
    const ddl = /sql: `(CREATE INDEX IF NOT EXISTS idx_product_reviews_name_missing[^`]+)`/.exec(IDX)?.[1]
    expect(ddl).toBeTruthy()
    const upd = /(UPDATE product_reviews[\s\S]+?)`\)\.run\(\)/.exec(LANE)?.[1]
    expect(upd).toBeTruthy()
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT); CREATE TABLE product_reviews (id INTEGER PRIMARY KEY, user_id INT, user_name TEXT)')
    db.exec(ddl!)
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${upd}`).all() as Array<{ detail: string }>).map((r) => r.detail).join(' | ')
    expect(plan).toMatch(/USING INDEX idx_product_reviews_name_missing/)
  })
})
