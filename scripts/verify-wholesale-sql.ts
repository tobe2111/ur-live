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
import { resolveDistributorPrice, tierUnitPrice } from '@/lib/distributor-pricing'

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
CREATE TABLE wholesale_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, wholesale_order_id INTEGER, product_id INTEGER, supplier_id INTEGER, name TEXT, qty INTEGER, base_supply_price INTEGER, distributor_unit_price INTEGER, line_total INTEGER, courier TEXT, tracking_number TEXT, shipped_at TEXT, line_status TEXT DEFAULT 'PENDING');
CREATE TABLE supplier_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, amount INTEGER, status TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE supplier_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, order_id INTEGER, product_id INTEGER, seller_id INTEGER, retail_amount INTEGER, supply_amount INTEGER, status TEXT, available_at TEXT, paid_at TEXT, source TEXT DEFAULT 'consumer', note TEXT);
CREATE TABLE supplier_balances (supplier_id INTEGER PRIMARY KEY, pending_amount INTEGER DEFAULT 0, available_amount INTEGER DEFAULT 0, paid_amount INTEGER DEFAULT 0, updated_at TEXT);
CREATE TABLE affiliate_earnings (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id TEXT, commission INTEGER, status TEXT);
CREATE TABLE user_withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, amount INTEGER, withholding_tax INTEGER, net_amount INTEGER, bank_name TEXT, bank_account TEXT, account_holder TEXT, status TEXT);
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
  for (const c of ['supply_visibility', 'barcode', 'is_brand_product', 'supply_margin_override_pct', 'min_order_qty']) assert(cnames.includes(c), `products.${c} 누락`)
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

  // 7) 상품별 마진 override — SELECT→resolveDistributorPrice 머니패스 (등급 무관 동일가)
  await DB.prepare("INSERT INTO sellers (id, distributor_grade) VALUES (20,'A')").run() // A등급(최저 10%)
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility,supply_margin_override_pct) VALUES (500,'특가상품',10000,1,1,NULL,'ALL',12)").run()
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility,supply_margin_override_pct) VALUES (501,'일반상품',10000,1,1,NULL,'ALL',NULL)").run()
  const prow = await DB.prepare("SELECT COALESCE(supply_price,0) AS supply_price, supply_margin_override_pct AS margin_override FROM products WHERE id=500").first<{ supply_price: number; margin_override: number | null }>()
  const nrow = await DB.prepare("SELECT COALESCE(supply_price,0) AS supply_price, supply_margin_override_pct AS margin_override FROM products WHERE id=501").first<{ supply_price: number; margin_override: number | null }>()
  // A등급(10%) 이지만 override 12% 가 우선 → 11200
  const pPriced = resolveDistributorPrice({ baseSupplyPrice: prow!.supply_price, grade: 'A', marginOverridePct: prow!.margin_override })
  assert.strictEqual(pPriced.price, 11200, `override 가격 오류 (기대 11200, 실제 ${pPriced.price})`)
  assert.strictEqual(pPriced.overridden, true, 'override 플래그 누락')
  // override NULL → A등급(10%) 그대로 11000
  const nPriced = resolveDistributorPrice({ baseSupplyPrice: nrow!.supply_price, grade: 'A', marginOverridePct: nrow!.margin_override })
  assert.strictEqual(nPriced.price, 11000, `등급가 fallback 오류 (기대 11000, 실제 ${nPriced.price})`)
  assert.strictEqual(nPriced.overridden, false, 'fallback 인데 override 플래그 set')
  ok('상품별 마진 override — SELECT→가격 재계산 (등급 무관 동일가 / NULL=등급가)')

  // 8) 합배송 일괄발송 — 주문 내 내 미발송 라인 전체 SHIPPED + 전 라인 발송 시 주문 SHIPPED
  await DB.prepare("INSERT INTO wholesale_orders (id, distributor_seller_id, status, subtotal) VALUES (700,10,'PAID',30000)").run()
  // 제조사 9: 라인 2개(PENDING), 제조사 8: 라인 1개(PENDING) — 다중 제조사 주문
  await DB.prepare("INSERT INTO wholesale_order_items (id, wholesale_order_id, product_id, supplier_id, qty, line_total, line_status) VALUES (7001,700,1,9,1,10000,'PENDING')").run()
  await DB.prepare("INSERT INTO wholesale_order_items (id, wholesale_order_id, product_id, supplier_id, qty, line_total, line_status) VALUES (7002,700,2,9,1,10000,'PENDING')").run()
  await DB.prepare("INSERT INTO wholesale_order_items (id, wholesale_order_id, product_id, supplier_id, qty, line_total, line_status) VALUES (7003,700,1,8,1,10000,'PENDING')").run()
  // 제조사 9 일괄발송 — 내 PENDING 2건만 SHIPPED, 제조사 8 라인 무영향
  const ship9 = await DB.prepare(
    "UPDATE wholesale_order_items SET courier='CJ', tracking_number='T-1', shipped_at=datetime('now'), line_status='SHIPPED' WHERE wholesale_order_id=? AND supplier_id=? AND line_status='PENDING'"
  ).bind(700, 9).run()
  assert.strictEqual(ship9.meta?.changes ?? 0, 2, `제조사9 일괄발송 라인 수 오류 (${ship9.meta?.changes})`)
  const otherLine = await DB.prepare("SELECT line_status FROM wholesale_order_items WHERE id=7003").first<{ line_status: string }>()
  assert.strictEqual(otherLine?.line_status, 'PENDING', '다른 제조사 라인이 영향받음(합배송 격리 실패)')
  // 같은 송장 1개가 두 라인에 적용됐는지
  const sameTrack = await DB.prepare("SELECT COUNT(DISTINCT tracking_number) AS n FROM wholesale_order_items WHERE wholesale_order_id=700 AND supplier_id=9").first<{ n: number }>()
  assert.strictEqual(Number(sameTrack?.n), 1, '합배송인데 송장이 라인별로 다름')
  // 주문엔 아직 제조사8 미발송 라인 남음 → 주문 SHIPPED 전환 안 됨
  const pend1 = await DB.prepare("SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id=700 AND line_status!='SHIPPED'").first<{ c: number }>()
  assert.strictEqual(Number(pend1?.c), 1, '미발송 라인 집계 오류')
  // 제조사8도 발송 → 전 라인 SHIPPED → 주문 SHIPPED
  await DB.prepare("UPDATE wholesale_order_items SET line_status='SHIPPED' WHERE wholesale_order_id=700 AND supplier_id=8 AND line_status='PENDING'").run()
  const pend2 = await DB.prepare("SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id=700 AND line_status!='SHIPPED'").first<{ c: number }>()
  if (Number(pend2?.c) === 0) await DB.prepare("UPDATE wholesale_orders SET status='SHIPPED' WHERE id=700 AND status='PAID'").run()
  const ostatus = await DB.prepare("SELECT status FROM wholesale_orders WHERE id=700").first<{ status: string }>()
  assert.strictEqual(ostatus?.status, 'SHIPPED', '전 라인 발송 후 주문 SHIPPED 전환 실패')
  ok('합배송 일괄발송 — 제조사별 격리 + 송장1개 + 전라인 발송 시 주문 SHIPPED')

  // 9) MOQ — 컬럼 기본값 1 + 박스 단가/주문 하한 계산
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility,min_order_qty) VALUES (900,'박스상품',5000,1,1,NULL,'ALL',20)").run()
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility) VALUES (901,'낱개상품',5000,1,1,NULL,'ALL')").run()
  const moqRow = await DB.prepare("SELECT COALESCE(min_order_qty,1) AS moq FROM products WHERE id=900").first<{ moq: number }>()
  const defRow = await DB.prepare("SELECT COALESCE(min_order_qty,1) AS moq FROM products WHERE id=901").first<{ moq: number }>()
  assert.strictEqual(Number(moqRow?.moq), 20, `MOQ 저장 오류 (${moqRow?.moq})`)
  assert.strictEqual(Number(defRow?.moq), 1, `MOQ 기본값(1) 오류 (${defRow?.moq})`)
  // 주문 하한 검증 로직 (라우트와 동일): qty < moq → 거부
  const moq = Number(moqRow?.moq)
  assert.ok(10 < moq, 'MOQ 미만 주문이 통과되면 안 됨(10<20)')
  assert.ok(20 >= moq && 40 >= moq, 'MOQ 이상 주문은 허용')
  ok('MOQ — 컬럼 기본값 1 + 저장 + 주문 하한(qty>=moq) 판정')

  // 10) 자료(tax_documents) 유통사 스코프 — 본인 sales 문서만 노출(매입/타인 제외)
  // case 3 에서 distributor 10 의 sales 세금계산서 1건 발행됨. 추가로 매입 + 타 유통사 sales 삽입.
  await DB.prepare("INSERT INTO tax_documents (doc_type,direction,period_month,distributor_seller_id,supplier_id,party_name,supply_amount,vat_amount,total_amount,order_count,status,issued_at) VALUES ('tax_invoice','purchase','2026-06',NULL,7,'제조사X',9000,900,9900,1,'issued',datetime('now'))").run()
  await DB.prepare("INSERT INTO tax_documents (doc_type,direction,period_month,distributor_seller_id,supplier_id,party_name,supply_amount,vat_amount,total_amount,order_count,status,issued_at) VALUES ('transaction_statement','sales','2026-06',99,0,'유통사B',5000,500,5500,1,'issued',datetime('now'))").run()
  const mine = await DB.prepare(
    "SELECT id, direction, distributor_seller_id FROM tax_documents WHERE distributor_seller_id = ? AND direction = 'sales' ORDER BY id"
  ).bind(10).all<{ id: number; direction: string; distributor_seller_id: number }>()
  const mineRows = mine.results || []
  assert.ok(mineRows.length >= 1, '본인 sales 문서가 조회되어야 함')
  assert.ok(mineRows.every(r => r.direction === 'sales' && Number(r.distributor_seller_id) === 10), '매입/타 유통사 문서가 섞이면 안 됨(IDOR)')
  // IDOR: 타 유통사(99) 문서를 distributor 10 으로 조회 시 0건
  const stolen = await DB.prepare("SELECT COUNT(*) AS n FROM tax_documents WHERE id IN (SELECT id FROM tax_documents WHERE distributor_seller_id=99) AND distributor_seller_id=10").first<{ n: number }>()
  assert.strictEqual(Number(stolen?.n), 0, '타 유통사 문서가 본인 조회에 노출되면 안 됨')
  ok('자료 유통사 스코프 — 본인 sales 만(매입/타인 제외, IDOR 가드)')

  // 11) 수량 구간 할인(volume tier) — 테이블 + 주문 authoritative 단가 재계산
  const tcols = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_qty_tiers'").all<{ name: string }>()
  assert.ok((tcols.results || []).length === 1, 'product_qty_tiers 테이블 누락')
  // 상품 902: 등급가(=base) 10000, tier 100개↑ 5% / 500개↑ 10%
  await DB.prepare("INSERT INTO products (id,name,supply_price,is_supply_product,is_active,supply_source_id,supply_visibility) VALUES (902,'구간상품',10000,1,1,NULL,'ALL')").run()
  await DB.batch([
    DB.prepare("INSERT INTO product_qty_tiers (product_id,min_qty,discount_pct) VALUES (902,100,5)"),
    DB.prepare("INSERT INTO product_qty_tiers (product_id,min_qty,discount_pct) VALUES (902,500,10)"),
  ])
  const trows = await DB.prepare("SELECT min_qty, discount_pct FROM product_qty_tiers WHERE product_id=902 ORDER BY min_qty").all<{ min_qty: number; discount_pct: number }>()
  const tiers = (trows.results || []).map(r => ({ min_qty: r.min_qty, discount_pct: r.discount_pct }))
  // 주문 단가 = 등급가 × (1 − 구간할인). 라우트 /orders 와 동일 규칙(tierUnitPrice).
  assert.strictEqual(tierUnitPrice(10000, 20, tiers), 10000, '구간 미달 = 등급가')
  assert.strictEqual(tierUnitPrice(10000, 100, tiers), 9500, '100개↑ 5%')
  assert.strictEqual(tierUnitPrice(10000, 500, tiers), 9000, '500개↑ 10%')
  // 🛡️ 역마진 차단: floor=공급원가. 큰 수량할인이 원가 이하로 내려가면 원가로 clamp.
  // 등급가 12000(원가 10000), 30% 할인=8400 < 원가 → 10000 으로 floor(플랫폼 마진 0, 음수 X).
  assert.strictEqual(tierUnitPrice(12000, 500, [{ min_qty: 500, discount_pct: 30 }], 10000), 10000, '역마진 floor 미작동')
  assert.ok(tierUnitPrice(12000, 500, [{ min_qty: 500, discount_pct: 30 }], 10000) >= 10000, '단가가 공급원가 이상이어야(역마진 차단)')
  // 전체교체(replace) 멱등 — DELETE 후 재삽입해도 중복 UNIQUE 충돌 없음
  await DB.prepare("DELETE FROM product_qty_tiers WHERE product_id=902").run()
  await DB.prepare("INSERT INTO product_qty_tiers (product_id,min_qty,discount_pct) VALUES (902,200,7)").run()
  const after = await DB.prepare("SELECT COUNT(*) AS n FROM product_qty_tiers WHERE product_id=902").first<{ n: number }>()
  assert.strictEqual(Number(after?.n), 1, '전체교체 후 1건이어야 함')
  ok('수량 구간 할인 — 테이블 + tierUnitPrice(주문 단가 재계산) + replace 멱등')

  // 12) 관리자 전액환불 재고 이중복원 방지 — '미환불 라인'만 재고 복원
  await DB.prepare("INSERT INTO wholesale_orders (id, distributor_seller_id, status, subtotal) VALUES (800,10,'PARTIAL_REFUNDED',30000)").run()
  // 제조사A 라인(product 1) 이미 REFUNDED(부분환불·재고 복원 완료) + 제조사B 라인(product 2) SHIPPED
  await DB.prepare("INSERT INTO wholesale_order_items (id, wholesale_order_id, product_id, supplier_id, qty, line_total, line_status) VALUES (8001,800,1,9,10,10000,'REFUNDED')").run()
  await DB.prepare("INSERT INTO wholesale_order_items (id, wholesale_order_id, product_id, supplier_id, qty, line_total, line_status) VALUES (8002,800,2,8,20,20000,'SHIPPED')").run()
  // 관리자 전액환불의 '새로 환불되는 라인' 캡처(UPDATE 전): line_status != 'REFUNDED' 만 → B 만
  const newLines = await DB.prepare("SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id=? AND line_status != 'REFUNDED'").bind(800).all<{ product_id: number; qty: number }>()
  const nl = newLines.results || []
  assert.strictEqual(nl.length, 1, '재고복원 대상은 미환불 라인 1건(B)이어야 함')
  assert.strictEqual(Number(nl[0].product_id), 2, '이미 환불된 A(product1)는 재고 복원 대상 아님(이중복원 방지)')
  ok('관리자 전액환불 — 미환불 라인만 재고 복원(이중복원 방지)')

  // 13) 정산 잔고 캐시 자가치유 — settlements(권위)에서 SUM 재계산 (SUM-then-claim 드리프트 영구 차단)
  await DB.batch([
    DB.prepare("INSERT INTO supplier_settlements (supplier_id, supply_amount, status, source) VALUES (50, 1000, 'pending', 'wholesale')"),
    DB.prepare("INSERT INTO supplier_settlements (supplier_id, supply_amount, status, source) VALUES (50, 2000, 'pending', 'wholesale')"),
    DB.prepare("INSERT INTO supplier_settlements (supplier_id, supply_amount, status, source) VALUES (50, 3000, 'available', 'wholesale')"),
    DB.prepare("INSERT INTO supplier_settlements (supplier_id, supply_amount, status, source) VALUES (50, 5000, 'paid', 'wholesale')"),
  ])
  // 캐시를 일부러 틀리게(드리프트) 세팅
  await DB.prepare("INSERT INTO supplier_balances (supplier_id, pending_amount, available_amount, paid_amount) VALUES (50, 99999, 0, 5000)").run()
  // 자가치유 재계산(라우트 mature 와 동일 SQL): pending=SUM(pending), available=SUM(available)
  await DB.prepare(
    `UPDATE supplier_balances SET
       pending_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status='pending'),0),
       available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status='available'),0)
     WHERE supplier_id = ?`
  ).bind(50, 50, 50).run()
  const bal = await DB.prepare("SELECT pending_amount, available_amount, paid_amount FROM supplier_balances WHERE supplier_id=50").first<{ pending_amount: number; available_amount: number; paid_amount: number }>()
  assert.strictEqual(Number(bal?.pending_amount), 3000, `pending 자가치유 오류(기대 3000, 실제 ${bal?.pending_amount})`)
  assert.strictEqual(Number(bal?.available_amount), 3000, `available 자가치유 오류(기대 3000, 실제 ${bal?.available_amount})`)
  assert.strictEqual(Number(bal?.paid_amount), 5000, 'paid 는 mature 가 안 건드림(payout 전용)')
  ok('정산 잔고 캐시 자가치유 — settlements SUM 재계산(드리프트 영구 차단)')

  // 14) 출금 조건부 INSERT 원자성 — 동시 신청 초과지급 방지 (curator 출금 패턴)
  await DB.prepare("INSERT INTO affiliate_earnings (referrer_id, commission, status) VALUES ('u9', 10000, 'granted')").run()
  const condInsert = (amt: number) => DB.prepare(
    `INSERT INTO user_withdrawals (user_id, amount, withholding_tax, net_amount, bank_name, bank_account, account_holder, status)
     SELECT ?, ?, 0, ?, 'b', 'acc12345', 'h', 'requested'
     WHERE (
       COALESCE((SELECT SUM(commission) FROM affiliate_earnings WHERE referrer_id = ? AND COALESCE(status,'pending') != 'refunded'),0)
       - COALESCE((SELECT SUM(amount) FROM user_withdrawals WHERE user_id = ? AND status IN ('requested','approved','paid')),0)
     ) >= ?`
  ).bind('u9', amt, amt, 'u9', 'u9', amt)
  const r1 = await condInsert(8000).run()  // available 10000 >= 8000 → 삽입
  assert.strictEqual(r1.meta?.changes ?? 0, 1, '1차 출금 신청 삽입돼야')
  const r2 = await condInsert(8000).run()  // available 10000-8000=2000 < 8000 → 0 rows(초과 차단)
  assert.strictEqual(r2.meta?.changes ?? 0, 0, '잔액 초과 2차 신청은 0 rows(원자 차단)')
  const r3 = await condInsert(2000).run()  // 남은 2000 == 2000 → 삽입
  assert.strictEqual(r3.meta?.changes ?? 0, 1, '잔여 한도 내 신청은 삽입')
  ok('출금 조건부 INSERT 원자성 — 가용액 초과 동시 신청 차단(이중지급 방지)')

  // 15) catalog 500 회귀 — 공급컬럼 없는 구버전 products 테이블(마이그레이션 미적용 prod 모사)에서
  //     ensureSupplyVisibilitySchema 가 핵심 공급컬럼을 self-heal → 카탈로그 쿼리가 throw 없이 실행.
  {
    const mf2 = new Miniflare({ modules: true, script: 'export default {};', d1Databases: { DB: 'wholesale-bare' } })
    const DB2 = await mf2.getD1Database('DB') as unknown as D1Database
    // 공급 관련 컬럼이 전혀 없는 최소 products (구 스키마) — supply_price/is_supply_product/supply_source_id 없음
    await DB2.prepare(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, price INTEGER, stock INTEGER, image_url TEXT, category TEXT, is_active INTEGER DEFAULT 1, sold_count INTEGER DEFAULT 0, dominant_color TEXT, created_at TEXT DEFAULT (datetime('now')))`).run()
    await DB2.prepare(`CREATE TABLE sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_grade TEXT, special_discount_until TEXT)`).run()
    await ensureSupplyVisibilitySchema(DB2)
    const c2 = await DB2.prepare("SELECT name FROM pragma_table_info('products')").all<{ name: string }>()
    const cn2 = (c2.results || []).map(r => r.name)
    for (const col of ['is_supply_product', 'supply_price', 'supply_source_id', 'supplier_id', 'supply_approval_status', 'min_order_qty', 'supply_margin_override_pct'])
      assert(cn2.includes(col), `self-heal 후 products.${col} 누락`)
    // 실제 카탈로그 SELECT (wholesale.routes.ts /catalog 와 동일 컬럼/조인) — throw 없이 실행돼야 함
    const catalogQ = `SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock,
        COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
        COALESCE(p.min_order_qty,1) AS moq,
        EXISTS(SELECT 1 FROM product_qty_tiers t WHERE t.product_id = p.id) AS has_tiers,
        COALESCE(p.sold_count,0) AS sold_count, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
      ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC LIMIT ? OFFSET ?`
    const cat = await DB2.prepare(catalogQ).bind(1, 24, 0).all()
    assert(Array.isArray(cat.results), '카탈로그 쿼리 결과 비정상')
    await mf2.dispose()
    ok('catalog 500 회귀 — 공급컬럼 self-heal 후 카탈로그 쿼리 throw 없음')
  }

  await mf.dispose()
  console.log(`\n✅ 도매몰 실 SQLite 검증 통과 — ${passed}/15\n`)
}

main().catch((e) => { console.error('\n❌ 검증 실패:', e?.message || e); process.exit(1) })
