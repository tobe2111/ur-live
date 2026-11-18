/**
 * 📇 2026-11-18 라이브 텔레메트리 후속 — 대표 "개선할 것 더 찾아줘".
 *  1. 상품 목록이 `(is_active, created_at DESC, id DESC)` 색인을 타서 **임시 정렬이 없다**(진짜 SQLite EXPLAIN — 리포지토리의 실제 WHERE 로).
 *  2. 유어애즈 연결 유저 조회가 부분 색인을 못 박는다(라이브: 연결 0건인데 58만 줄).
 * 못 막는 것: 라이브에 색인이 실제로 생겼는지(배포 repair-schema — sqlite_master 로 판정).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const R = (p: string) => fs.readFileSync(p, 'utf8')

describe('목록 색인', () => {
  it('상품 목록이 정렬 없이 색인 순서로 읽힌다', () => {
    const ddl = /sql: `(CREATE INDEX IF NOT EXISTS idx_products_active_created [^`]+)`/.exec(R('src/worker/routes/repair-schema/index-repairs.ts'))?.[1]
    expect(ddl).toBeTruthy()
    const repo = R('src/features/products/repositories/ProductRepository.ts')
    const where = /FROM products (WHERE is_active = 1[\s\S]*?seller_id IS NULL\))`/.exec(repo)?.[1]
    expect(where, 'findAll 의 WHERE 를 못 찾았다 — 시험이 낡았다').toBeTruthy()
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, is_active INT);
      CREATE TABLE products (id INTEGER PRIMARY KEY, is_active INT, seller_id INT, is_supply_product INT, supply_source_id INT, category TEXT, created_at TEXT);
      CREATE INDEX idx_products_active ON products(is_active);`)
    db.exec(ddl!)
    const ins = db.prepare("INSERT INTO products (is_active, seller_id, category, created_at) VALUES (?, 1, 'voucher', datetime('now', '-' || ? || ' minutes'))")
    db.exec('BEGIN'); for (let i = 0; i < 2000; i++) ins.run(i % 16 ? 1 : 0, i); db.exec('COMMIT'); db.exec('ANALYZE')
    const plan = (db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM products ${where} ORDER BY created_at DESC, id DESC LIMIT 20`).all() as Array<{ detail: string }>).map((r) => r.detail).join(' | ')
    expect(plan).toMatch(/USING INDEX idx_products_active_created/)
    expect(plan).not.toMatch(/TEMP B-TREE/)
  })

  it('유어애즈 연결 유저 조회가 부분 색인을 못 박는다', () => {
    expect(R('src/features/marketing/api/lead-claim.ts')).toMatch(/FROM ad_influencer_leads INDEXED BY idx_ad_leads_linked_user WHERE account_id = \? AND linked_user_id IS NOT NULL/)
  })
})
