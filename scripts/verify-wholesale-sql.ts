/**
 * 🏭 2026-06-03 도매몰 — 실제 SQLite(miniflare D1) SQL 검증 스크립트.
 *
 *   실행: npx vite-node scripts/verify-wholesale-sql.ts   (npm run verify:sql)
 *   목적: mock 단위테스트가 못 잡는 SQL 문법/의미 오류를 진짜 SQLite 엔진으로 확인.
 *         (ALTER, EXISTS 가시성, SUM(MAX()), ON CONFLICT sentinel, DB.batch, 일일 정산 한도)
 *   jsdom setup 비의존 — vite-node 가 @/ alias + TS 해석.
 */
import assert from 'node:assert'
import { Miniflare } from 'miniflare'
import { ensureSupplyVisibilitySchema, visibilityWhere, recordSupplyPriceChange } from '@/features/supply/api/supply-visibility'
import { ensureTaxDocSchema, splitVat } from '@/features/supply/api/tax-documents'
import { ensureOemSchema } from '@/features/supply/api/oem-requests'

const BASE_SCHEMA = `
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, price INTEGER, supply_price INTEGER,
  stock INTEGER, image_url TEXT, category TEXT, product_type TEXT, is_active INTEGER DEFAULT 1,
  is_supply_product INTEGER DEFAULT 0, supplier_id INTEGER, supply_source_id INTEGER,
  supply_approval_status TEXT, sold_count INTEGER DEFAULT 0, slug TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_grade TEXT, special_discount_until TEXT, business_number TEXT, business_name TEXT, name TEXT, email TEXT, phone TEXT);
CREATE TABLE suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT);
CREATE TABLE wholesale_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER, status TEXT, subtotal INTEGER DEFAULT 0, refunded_amount INTEGER DEFAULT 0, paid_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE wholesale_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, wholesale_order_id INTEGER, product_id INTEGER, supplier_id INTEGER, name TEXT, qty INTEGER, base_supply_price INTEGER, distributor_unit_price INTEGER, line_total INTEGER, line_status TEXT DEFAULT 'PENDING');
CREATE TABLE supplier_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, amount INTEGER, status TEXT, created_at TEXT DEFAULT (datetime('now')));
`

let passed = 0
function ok(label: string) { passed++; console.log(`  ✓ ${label}`) }

async function main() {
  const mf = new Miniflare({ modules: true, script: 'export default {};', d1Databases: { DB: 'wholesale-verify' } })
  const DB = await mf.getD1Database('DB') as unknown as D1Database

  for (const stmt of BASE_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) await DB.prepare(stmt).run()
  await ensureSupplyVisibilitySchema(DB)
  await ensureTaxDocSchema(DB)
  await ensureOemSchema(DB)

  // 1) ensure 컬럼/테이블
  const cols = await DB.prepare("SELECT name FROM pragma_table_info('products')").all<{ name: string }>()
  const cnames = (cols.results || []).map(r => r.name)
  for (const c of ['supply_visibility', 'barcode', 'is_brand_product']) assert(cnames.includes(c), `products.${c} 누락`)
  const tbls = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>()
  const tnames = (tbls.results || []).map(r => r.name)
  for (const t of ['product_distributor_access', 'supply_price_history', 'tax_documents', 'oem_requests']) assert(tnames.includes(t), `${t} 누락`)
  ok('스키마 ensure (ALTER/CREATE) — 컬럼/테이블 생성 확인')

  // 2) 가시성 EXISTS
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility) VALUES (1,'전체',1000,1,1,NULL,'ALL')").run()
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility) VALUES (2,'제한',1000,1,1,NULL,'UTONGSTART_ONLY')").run()
  const visQ = `SELECT p.id FROM products p WHERE p.is_supply_product=1 AND p.is_active=1 AND p.supply_source_id IS NULL AND ${visibilityWhere('p')} ORDER BY p.id`
  let r = await DB.prepare(visQ).bind(77).all<{ id: number }>()
  assert.deepStrictEqual((r.results || []).map(x => x.id), [1], '제한상품이 숨겨지지 않음')
  await DB.prepare('INSERT INTO product_distributor_access (product_id, distributor_seller_id) VALUES (2, ?)').bind(77).run()
  r = await DB.prepare(visQ).bind(77).all<{ id: number }>()
  assert.deepStrictEqual((r.results || []).map(x => x.id), [1, 2], '허용목록 추가 후에도 노출 안 됨')
  ok('가시성 가드 EXISTS — 제한상품 숨김/허용목록 노출')

  // 3) 세금 순매출(부분환불 차감) + VAT 추출 + upsert 멱등
  await DB.prepare("INSERT INTO sellers (id, business_name, name) VALUES (10,'유통사A','A')").run()
  await DB.prepare("INSERT INTO wholesale_orders (id, distributor_seller_id, status, subtotal, refunded_amount, paid_at) VALUES (100,10,'PARTIAL_REFUNDED',11000,1100,'2026-06-10 00:00:00')").run()
  const agg = await DB.prepare(`
    SELECT COALESCE(SUM(MAX(0, o.subtotal - COALESCE(o.refunded_amount,0))),0) AS total
    FROM wholesale_orders o
    WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
  `).bind('2026-06').first<{ total: number }>()
  assert.strictEqual(Number(agg?.total), 9900, `순매출 기대 9900, 실제 ${agg?.total}`)
  const { supply, vat } = splitVat(Number(agg?.total))
  assert(supply === 9000 && vat === 900, `VAT 추출 오류 supply=${supply} vat=${vat}`)
  const upsert = `INSERT INTO tax_documents (doc_type,direction,period_month,distributor_seller_id,supplier_id,party_name,supply_amount,vat_amount,total_amount,order_count,status,issued_at)
    VALUES ('tax_invoice','sales','2026-06',10,0,'유통사A',?,?,?,1,'issued',datetime('now'))
    ON CONFLICT(doc_type,direction,period_month,distributor_seller_id,supplier_id)
    DO UPDATE SET supply_amount=excluded.supply_amount`
  await DB.prepare(upsert).bind(supply, vat, 9900).run()
  await DB.prepare(upsert).bind(supply, vat, 9900).run()
  const tcnt = await DB.prepare("SELECT COUNT(*) AS n FROM tax_documents").first<{ n: number }>()
  assert.strictEqual(Number(tcnt?.n), 1, `세금계산서 upsert 멱등 실패 (n=${tcnt?.n})`)
  ok('세금 순매출(부분환불 차감) + VAT 추출 + 발행 upsert 멱등')

  // 4) 대량 INSERT batch
  const stmts = Array.from({ length: 250 }, (_, i) =>
    DB.prepare("INSERT INTO products (name, supply_price, is_supply_product, supplier_id, supply_approval_status, is_active) VALUES (?,500,1,9,'pending',0)").bind(`bulk-${i}`))
  for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100))
  const bcnt = await DB.prepare("SELECT COUNT(*) AS n FROM products WHERE supplier_id=9").first<{ n: number }>()
  assert.strictEqual(Number(bcnt?.n), 250, `batch INSERT 실패 (n=${bcnt?.n})`)
  ok('대량 INSERT DB.batch (250건 청크)')

  // 5) 일일 정산 한도 집계
  await DB.prepare("INSERT INTO supplier_payouts (supplier_id, amount, status) VALUES (1, 60000000, 'paid')").run()
  await DB.prepare("INSERT INTO supplier_payouts (supplier_id, amount, status) VALUES (2, 30000000, 'paid')").run()
  const today = await DB.prepare("SELECT COALESCE(SUM(amount),0) AS amt FROM supplier_payouts WHERE status='paid' AND date(created_at)=date('now')").first<{ amt: number }>()
  assert.strictEqual(Number(today?.amt), 90000000, '오늘 지급 합계 오류')
  assert(Number(today?.amt) + 20000000 > 100000000, '1억 캡 판정 오류')
  ok('일일 정산 한도 집계 (오늘 지급 SUM)')

  // 6) 공급가 이력 — 변경분만
  await recordSupplyPriceChange(DB, 1, 9, 1000, 1200, 'supplier:9')
  await recordSupplyPriceChange(DB, 1, 9, 1200, 1200, 'supplier:9')
  const hcnt = await DB.prepare("SELECT COUNT(*) AS n FROM supply_price_history WHERE product_id=1").first<{ n: number }>()
  assert.strictEqual(Number(hcnt?.n), 1, `공급가 이력 기록 오류 (n=${hcnt?.n})`)
  ok('공급가 이력 — 변경분만 기록')

  await mf.dispose()
  console.log(`\n✅ 도매몰 실 SQLite 검증 통과 — ${passed}/6\n`)
}

main().catch((e) => { console.error('\n❌ 검증 실패:', e?.message || e); process.exit(1) })
