/**
 * 🏭 2026-06-29 도매몰 — 판매사 리포팅/문서/내보내기 라우트 (wholesale.routes.ts God 파일 분해).
 *   동작 불변(byte-identical 핸들러 추출). 등록: registerWholesaleDocumentRoutes(app) — 원위치에서 호출해 라우트 등록 순서 보존.
 *   포함: GET /proposals · /statement · /documents · /documents/:id/html · /catalog-export · /catalog/export · /order-template
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { resolveDistributorPrice, effectiveGrade } from '@/lib/distributor-pricing'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { ensureSupplyVisibilitySchema, visibilityWhere, gradeExposureWhere } from './supply-visibility'
import { ensureOrderTables, ensureQtyConstraintSchema, sellerIdFrom, loadGradeTable, loadSellerGrade } from './wholesale-helpers'
import { ensureTaxDocSchema, renderTaxDocHtml, type TaxDocRow } from './tax-documents'
import { buildCsv, csvResponse } from './supply-csv'
import { buildXlsx, xlsxResponse } from './xlsx'
import { getSupplyMeta } from '@/worker/utils/product-supply-meta'
import { ensureCodeMap } from './wholesale-code-map'

export function registerWholesaleDocumentRoutes(app: Hono<{ Bindings: Env }>) {
app.get('/proposals', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB) // supply_margin_override_pct 컬럼 보장 (cold isolate)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
      note TEXT, status TEXT NOT NULL DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
    )`).run().catch(swallow('wholesale:ensure-proposals'))
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const { results } = await DB.prepare(`
      SELECT wp.id, wp.note, wp.created_at, p.id AS product_id, p.name, p.image_url, p.stock,
             COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, p.supply_margin_override_pct AS margin_override
      FROM wholesale_proposals wp
      JOIN products p ON p.id = wp.product_id
      WHERE wp.distributor_seller_id = ? AND wp.status = 'active'
        AND p.is_active = 1 AND p.is_supply_product = 1
      ORDER BY wp.created_at DESC LIMIT 50
    `).bind(sellerId).all<{ id: number; note: string | null; created_at: string; product_id: number; name: string; image_url: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const items = (results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return { id: r.id, note: r.note, product_id: r.product_id, name: r.name, image_url: r.image_url, stock: r.stock, distributor_price: price }
    })
    return c.json({ success: true, proposals: items })
  } catch (err) {
    return safeError(c, err, '제안 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /statement?from=&to= — 거래내역서 (판매사 매입 내역) ──────────────────
app.get('/statement', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const from = (c.req.query('from') || '').slice(0, 10)
    const to = (c.req.query('to') || '').slice(0, 10)
    // 2026-06-27: ACCEPTED/DONE/PARTIAL_REFUNDED 누락으로 수락·구매확정·부분환불 주문이 거래내역서에서
    //   통째로 빠지던 것 — 활성 집합 + REFUNDED 로 확장. (취소/거절은 매입 0이라 제외 유지.)
    let where = "distributor_seller_id = ? AND status IN ('PAID','ACCEPTED','SHIPPED','PARTIAL_REFUNDED','DONE','REFUNDED')"
    const binds: unknown[] = [sellerId]
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where += ' AND date(COALESCE(paid_at, created_at)) >= ?'; binds.push(from) }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where += ' AND date(COALESCE(paid_at, created_at)) <= ?'; binds.push(to) }
    const { results } = await DB.prepare(`
      SELECT id, status,
             COALESCE(subtotal, 0) AS subtotal,
             COALESCE(shipping_total, 0) AS shipping_total,
             COALESCE(refunded_amount, 0) AS refunded_amount,
             (COALESCE(subtotal, 0) + COALESCE(shipping_total, 0)) AS grand_total,
             grade, paid_at, created_at
      FROM wholesale_orders WHERE ${where} ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 500
    `).bind(...binds).all<{ id: number; status: string; subtotal: number; shipping_total: number; refunded_amount: number; grand_total: number; grade: string | null; paid_at: string | null; created_at: string }>()
    const rows = results || []
    // 💰 2026-06-25: 예치금은 subtotal+배송비(grand_total) 로 차감되므로 매입은 grand_total 기준.
    //   2026-06-27: 부분환불(PARTIAL_REFUNDED) 반영 — net 은 활성주문 gross 에서 부분환불액 차감(전액환불은
    //   매입 합계에서 이미 제외). 전액/부분 환불 합계는 refunded_amount(환불 helper 가 신뢰성있게 기록).
    const grossActive = rows.filter(r => r.status !== 'REFUNDED').reduce((s, r) => s + (r.grand_total || 0), 0)
    const partialRefunds = rows.filter(r => r.status !== 'REFUNDED').reduce((s, r) => s + (r.refunded_amount || 0), 0)
    const fullRefunds = rows.filter(r => r.status === 'REFUNDED').reduce((s, r) => s + (r.grand_total || 0), 0)
    return c.json({ success: true, orders: rows, summary: { count: rows.length, total_paid: grossActive, total_refunded: partialRefunds + fullRefunds, net: grossActive - partialRefunds } })
  } catch (err) {
    return safeError(c, err, '거래내역 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /documents — 판매사 본인 발행 자료(거래명세서/세금계산서, sales 방향만) ──────

app.get('/documents', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureTaxDocSchema(DB)
    // sales = 유통스타트→판매사(본인 수취 자료). 매입(purchase)은 제조사 자료라 비노출.
    const { results } = await DB.prepare(
      `SELECT id, doc_type, period_month, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at, nts_confirm_num
       FROM tax_documents WHERE distributor_seller_id = ? AND direction = 'sales'
       ORDER BY period_month DESC, id DESC LIMIT 200`
    ).bind(sellerId).all()
    return c.json({ success: true, documents: results || [] })
  } catch (err) {
    return safeError(c, err, '자료 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /documents/:id/html — 인쇄용 HTML (본인 sales 문서만, IDOR 가드) ──────────
app.get('/documents/:id/html', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.text('로그인이 필요합니다', 401)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.text('잘못된 문서 ID', 400)
  try {
    await ensureTaxDocSchema(DB)
    const doc = await DB.prepare(
      `SELECT id, doc_type, direction, period_month, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at
       FROM tax_documents WHERE id = ? AND distributor_seller_id = ? AND direction = 'sales'`
    ).bind(id, sellerId).first<TaxDocRow>()
    if (!doc) return c.text('문서를 찾을 수 없습니다', 404)
    return c.html(renderTaxDocHtml(doc))
  } catch {
    return c.text('문서를 열 수 없습니다', 500)
  }
})

// ── 엑셀 — 판매사 등급가 카탈로그 다운로드(.xlsx) + 주문 양식(.csv 재업로드용) ─────

// GET /catalog-export — 내 등급가 카탈로그 .xlsx (제조사 신원 비노출 — 등급가만)
app.get('/catalog-export', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
      ORDER BY p.name LIMIT 10000
    `).bind(sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    // 🏭 #8 상품코드(제조사 등록, full) — 대량발주 매칭 참고용. 비가격 정보.
    const catMeta = await getSupplyMeta(DB, (rows.results || []).map(r => r.id)).catch(() => new Map<number, Record<string, string>>())
    const out = (rows.results || []).map(r => {
      const { price, grade } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.id, (catMeta.get(r.id)?.product_code || '').trim(), r.name, r.category || '', r.stock, price, grade]
    })
    return xlsxResponse(buildXlsx(['product_id', '상품코드', '상품명', '카테고리', '재고', '공급가(내등급)', '적용등급'], out), `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '카탈로그 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── BIZ-8 (2026-06-08) GET /catalog/export?format=csv — 판매사 등급가 단가표 CSV ──────
//   엑셀로 바로 여는 단가표. 컬럼: 상품명/바코드/공급가(등급가)/MOQ/박스단위(order_multiple)/재고.
//   ⚠️ 가격 = 카탈로그가 보여주는 것과 동일한 서버계산 등급가(resolveDistributorPrice) — 다른 등급가
//      누출 절대 없음(내 등급 1개만 계산). supply_price(제조사 원가)/supplier_id(신원) 미노출.
//   PDF 는 범위 밖(follow-up). format 파라미터는 csv 만 지원(미지정/그외 → csv).
app.get('/catalog/export', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // pack_size / order_multiple 컬럼 보장(SELECT 전).
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.barcode, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
      ORDER BY p.category, p.name LIMIT 10000
    `).bind(sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; barcode: string | null; category: string | null; stock: number; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    // 🏭 #8 상품코드(제조사 등록, full) — 대량발주 매칭 참고용. 비가격 정보(supply_price/supplier_id 비노출 불변).
    const plMeta = await getSupplyMeta(DB, (rows.results || []).map(r => r.id)).catch(() => new Map<number, Record<string, string>>())
    const header = ['상품코드', 'product_id', '상품명', '바코드', '공급가(내등급)', 'MOQ', '박스단위', '재고']
    const out = (rows.results || []).map(r => {
      // ⚠️ 내 등급 단가만 계산 — 타 등급가 누출 없음(카탈로그/주문과 동일 SSOT).
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [(plMeta.get(r.id)?.product_code || '').trim(), r.id, r.name, r.barcode || '', price, Math.max(1, r.moq || 1), Math.max(1, r.order_multiple || 1), r.stock]
    })
    return csvResponse(buildCsv(header, out), `wholesale-pricelist-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch (err) {
    return safeError(c, err, '단가표 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// GET /order-template — 주문 양식 CSV. 로그인 시 내 카탈로그(등급가 포함) 프리필 →
//   판매사는 '주문수량' 칸만 채워 업로드. 비로그인은 빈 양식(헤더만).
app.get('/order-template', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  // 📦 2026-06-29 (대표 — 대량발주 드랍십): 카탈로그(참고) + 받는사람별 직배(드랍십) 입력칸을 한 양식에.
  //   한 행 = 한 명에게 보내는 1건. 같은 상품을 여러 명에게 보내려면 그 행을 복사해 받는사람만 바꿔 입력.
  //   매칭 = product_id(우선) 또는 상품코드(판매사 학습 맵/제조사 ext_code). 빈칸은 판매사가 채움.
  const header = ['product_id', '상품코드', '상품명', '카테고리', '재고', '공급가(내등급)', 'MOQ', '박스단위', '옵션(상품상세)', '주문수량', '받는사람', '전화번호', '우편번호', '주소', '배송메시지']
  if (!sellerId) {
    return csvResponse(buildCsv(header, [['예: 123', '예: FD000BKJ', '상품명(참고용)', '식품', '500', '9000', '1', '1', '화이트', '10', '홍길동', '010-1234-5678', '06236', '서울시 강남구 …', '부재시 경비실에']]), 'wholesale-order-template.csv')
  }
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    await ensureQtyConstraintSchema(DB) // order_multiple 컬럼 보장(SELECT 전).
    const [sg, table] = await Promise.all([loadSellerGrade(DB, sellerId), loadGradeTable(DB)])  // 🏭 2026-06-07: 순차 await → 병렬(1 RTT 절약)
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
             COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.order_multiple,1) AS order_multiple,
             p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
        AND ${gradeExposureWhere('p')}
      ORDER BY p.category, p.name LIMIT 10000
    `).bind(sellerId, effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; moq: number; order_multiple: number; margin_override: number | null }>()
    // 🔁 상품코드 프리필 — ① 제조사 등록 코드(#8, product_supply_meta.product_code, full) 우선 →
    //   ② 판매사 학습 맵(이전 업로드에서 product_id+코드 동시 입력으로 학습된 코드). 둘 다 없으면 빈칸.
    //   ⇒ 제조사가 등록한 코드가 판매사 대량발주 양식에 바로 떠서 #8→#13 즉시 사용 가능.
    await ensureCodeMap(DB)
    const tplIds = (rows.results || []).map(r => r.id)
    const tplMeta = await getSupplyMeta(DB, tplIds).catch(() => new Map<number, Record<string, string>>())
    const codeByPid = new Map<number, string>()
    const cm = await DB.prepare('SELECT code, product_id FROM wholesale_product_code_map WHERE seller_id = ?')
      .bind(sellerId).all<{ code: string; product_id: number }>().catch(() => ({ results: [] as Array<{ code: string; product_id: number }> }))
    for (const r of cm.results || []) if (!codeByPid.has(r.product_id)) codeByPid.set(r.product_id, r.code)
    const out = (rows.results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, retailPrice: (r as { retail_price?: number }).retail_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      const regCode = (tplMeta.get(r.id)?.product_code || '').trim() // 🏭 #8 제조사 등록 코드(full) 우선
      // product_id·상품코드·카탈로그 정보는 프리필, 옵션/주문수량/받는사람~배송메시지는 빈칸(판매사 입력).
      return [r.id, regCode || codeByPid.get(r.id) || '', r.name, r.category || '', r.stock, price, Math.max(1, r.moq || 1), Math.max(1, r.order_multiple || 1), '', '', '', '', '', '', '']
    })
    return csvResponse(buildCsv(header, out), `wholesale-order-form-${new Date().toISOString().slice(0, 10)}.csv`)
  } catch (err) {
    return safeError(c, err, '주문 양식 생성 중 오류가 발생했습니다', '[wholesale]')
  }
})
}
