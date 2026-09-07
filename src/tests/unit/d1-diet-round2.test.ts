/**
 * 📏 D1 읽기 다이어트 2차 — 2026-09-02 18:25 KST 유료 전환 직후 **첫 계량**이 가리킨 상위 둘.
 *
 *   ① `review-gen-tuning` 최근 실리뷰 2,000건 조회 — 12만 행 정렬 → 부분 인덱스로 2,000행
 *   ② `group-buy-deadline-push` 마감 창 조회 — products 전수 ×3 → 활성+마감 부분 인덱스
 *
 * 플래너 실증(node:sqlite): 인덱스 DDL 을 `index-repairs.ts` 에서 **그대로** 읽어 실제 쿼리 문장이 그 인덱스를 타는지 본다.
 * ⚠️ 못 막는 것: 라이브 D1 의 ANALYZE 통계·실제 행 분포. 여기선 "인덱스를 고를 수 있는가"만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { INDEX_REPAIRS } from '@/worker/routes/repair-schema/index-repairs'

const TUNING = readFileSync('src/worker/utils/review-gen-tuning.ts', 'utf8')
const PUSH = readFileSync('src/worker/cron/group-buy-deadline-push.ts', 'utf8')
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const plan = (db: InstanceType<typeof DatabaseSync>, sql: string) =>
  db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((x: Record<string, unknown>) => String(x.detail)).join(' | ')
const ddlOf = (name: string) => {
  const r = INDEX_REPAIRS.find((x) => x.name === name)
  expect(r, name).toBeTruthy()
  return r!.sql
}

describe('① 실리뷰 최근 2,000건 — 부분 인덱스', () => {
  it('쿼리의 WHERE 가 인덱스 WHERE 와 글자까지 같다(함의 인정 조건)', () => {
    expect(TUNING).toMatch(/WHERE COALESCE\(is_generated,0\) = 0 AND content IS NOT NULL/)
    expect(ddlOf('idx_product_reviews_real_created')).toContain('WHERE COALESCE(is_generated,0) = 0')
  })
  it('🔒 플래너가 부분 인덱스를 탄다(정렬 임시 B-tree 없음)', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE product_reviews (id INTEGER PRIMARY KEY, product_id INTEGER, content TEXT, rating INTEGER, is_generated INTEGER, created_at TEXT)')
    db.exec(ddlOf('idx_product_reviews_real_created'))
    const ins = db.prepare('INSERT INTO product_reviews (product_id, content, rating, is_generated, created_at) VALUES (?,?,?,?,?)')
    for (let i = 1; i <= 5000; i++) ins.run(i % 300, 'r' + i, 5, i % 10 === 0 ? 0 : 1, '2026-08-' + String(1 + (i % 28)).padStart(2, '0'))
    const p = plan(db, `SELECT content FROM product_reviews WHERE COALESCE(is_generated,0) = 0 AND content IS NOT NULL AND LENGTH(TRIM(content)) > 0 ORDER BY created_at DESC LIMIT 2000`)
    expect(p).toContain('idx_product_reviews_real_created')
    expect(p).not.toMatch(/USE TEMP B-TREE FOR ORDER BY/)
    db.close()
  })
})

describe('② 공구 마감 창 조회 — 활성+마감 부분 인덱스', () => {
  it('쿼리가 활성 + 마감 NOT NULL 을 명시한다(부분 인덱스 함의 조건)', () => {
    expect(PUSH).toMatch(/WHERE group_buy_status = 'active'\s+AND group_buy_deadline IS NOT NULL/)
  })
  it('🔒 플래너가 부분 인덱스를 탄다(products 전수 스캔 아님)', () => {
    const db = new DatabaseSync(':memory:')
    db.exec("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, restaurant_name TEXT, group_buy_current INTEGER, group_buy_target INTEGER, group_buy_status TEXT, group_buy_deadline TEXT, deadline_pushed_3h INTEGER DEFAULT 0, deadline_pushed_1h INTEGER DEFAULT 0)")
    db.exec(ddlOf('idx_products_gb_deadline_active'))
    const ins = db.prepare('INSERT INTO products (name, group_buy_status, group_buy_deadline) VALUES (?,?,?)')
    for (let i = 1; i <= 3000; i++) ins.run('p' + i, i % 7 === 0 ? 'active' : 'ended', i % 5 === 0 ? '2026-09-03 12:00:00' : null)
    const p = plan(db, `SELECT id, name, restaurant_name, group_buy_current, group_buy_target FROM products WHERE group_buy_status = 'active' AND group_buy_deadline IS NOT NULL AND deadline_pushed_3h = 0 AND datetime(group_buy_deadline) BETWEEN datetime('now', '+2.9 hours') AND datetime('now', '+3.1 hours') LIMIT 50`)
    expect(p).toContain('idx_products_gb_deadline_active')
    expect(p).not.toMatch(/SCAN products(?! USING)/)
    db.close()
  })
})
