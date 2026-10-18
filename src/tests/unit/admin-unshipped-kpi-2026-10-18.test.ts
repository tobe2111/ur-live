/**
 * 📦 어드민 '미발송 주문' 은 배송이 있는 주문만 센다 — 실제 SQLite 로 판정.
 * 이용권(voucher 카테고리)·교환권(deal_only=1) 주문은 보낼 물건이 없어 영원히 미발송으로 쌓였다.
 * ⚠️ 못 막는 것: 품목 행이 없는 주문(옛 데이터)은 그대로 센다 — 종류를 모르면 숨기지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { NO_SHIPPING_ITEM_EXCLUDE } from '@/features/admin/api/admin-stats.routes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

describe('미발송 주문 KPI', () => {
  it('이용권·교환권 주문은 빼고 쇼핑·품목 미상 주문은 센다', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT);
      CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER);
      CREATE TABLE products (id INTEGER PRIMARY KEY, category TEXT, deal_only INTEGER);
      INSERT INTO products VALUES (1,'meal_voucher',0),(2,'lifestyle',1),(3,'lifestyle',0),(4,'stay_voucher',NULL);
      INSERT INTO orders VALUES (10,'PAID'),(11,'PREPARING'),(12,'DONE'),(13,'PAID'),(14,'PAID'),(15,'SHIPPING');
      INSERT INTO order_items (order_id, product_id) VALUES (10,1),(11,2),(12,3),(13,4),(15,3);
    `)
    const rows = db.prepare(`SELECT o.id FROM orders o WHERE UPPER(o.status) IN ('PAID','DONE','PREPARING')${NO_SHIPPING_ITEM_EXCLUDE} ORDER BY o.id`).all() as { id: number }[]
    expect(rows.map(r => r.id)).toEqual([12, 14])
  })
  it('대시보드 쿼리가 그 조건을 붙인다', () => {
    const src = readFileSync('src/features/admin/api/admin-stats.routes.ts', 'utf8')
    expect(src).toMatch(/IN \('PAID','DONE','PREPARING'\)\$\{orderScope\}\$\{NO_SHIPPING_ITEM_EXCLUDE\}/)
  })
})
