/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 제조사(공급자) 정산 배선 (Phase 2 후속).
 *
 * B2B 선결제 주문(유통사→유통스타트) 결제완료 시, 각 라인의 제조사 공급가(base × qty)를
 * 제조사(supplier)에게 적립 → 기존 공급자 지급 파이프라인(matureSupplierSettlements →
 * payoutSupplier)이 7일 환불창 성숙 후 자동 지급.
 *
 * 충돌 방지: supplier_settlements.source='wholesale' 로 consumer(드랍쉽) 정산과 분리.
 *   - consumer 정산: source='consumer' (default). reverseSupplierOnRefund 가 wholesale 제외.
 *   - wholesale 정산: 이 파일에서만 적립/역전.
 * 멱등: 같은 wholesale_order_id + source='wholesale' 이미 있으면 재적립 안 함.
 */
import { recordLedger } from '@/worker/utils/ledger'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

const REFUND_WINDOW_DAYS = 7

const _sourceEnsured = new WeakSet<object>()
/** supplier_settlements.source 컬럼 보장 (repair-schema CI 불안정 대비). */
async function ensureSourceColumn(DB: D1Database): Promise<void> {
  if (_sourceEnsured.has(DB)) return
  _sourceEnsured.add(DB)
  await DB.prepare("ALTER TABLE supplier_settlements ADD COLUMN source TEXT DEFAULT 'consumer'")
    .run().catch(() => { /* 이미 존재 — 무시 */ })
}

interface WholesaleLine {
  product_id: number
  supplier_id: number
  qty: number
  base_supply_price: number
  distributor_unit_price: number
}

/**
 * 도매 주문의 제조사 라인을 공급자에게 적립 (pending). 멱등.
 * @returns 적립된 라인 수
 */
export async function creditSupplierOnWholesaleOrder(DB: D1Database, wholesaleOrderId: number): Promise<number> {
  if (!wholesaleOrderId) return 0
  await ensureSourceColumn(DB)

  // 멱등 가드.
  const existing = await DB.prepare(
    "SELECT 1 FROM supplier_settlements WHERE order_id = ? AND source = 'wholesale' LIMIT 1"
  ).bind(wholesaleOrderId).first().catch(() => null)
  if (existing) return 0

  // 🛡️ 스펙 정산 분기: 브랜드제품(is_brand_product=1) = 판매 후 당일(즉시 available) / 일반제품 = 7일 환불창 성숙.
  //   products.is_brand_product 없을 수 있어 LEFT JOIN + COALESCE(0).
  const rows = await DB.prepare(`
    SELECT i.product_id, i.supplier_id, i.qty, i.base_supply_price, i.distributor_unit_price,
           COALESCE(p.is_brand_product, 0) AS is_brand_product
    FROM wholesale_order_items i LEFT JOIN products p ON p.id = i.product_id
    WHERE i.wholesale_order_id = ? AND i.supplier_id IS NOT NULL AND i.base_supply_price > 0
  `).bind(wholesaleOrderId).all<WholesaleLine & { is_brand_product: number }>().catch(() => ({ results: [] as (WholesaleLine & { is_brand_product: number })[] }))

  let credited = 0
  const notifySuppliers = new Set<number>()
  const generalAvailableAt = new Date(Date.now() + REFUND_WINDOW_DAYS * 86400_000).toISOString()
  const nowIso = new Date().toISOString()
  for (const r of rows.results || []) {
    const qty = Math.max(1, Math.floor(Number(r.qty) || 1))
    const supplyAmount = Math.floor(Number(r.base_supply_price) || 0) * qty
    if (supplyAmount <= 0) continue
    const retailAmount = Math.floor(Number(r.distributor_unit_price) || 0) * qty // 유통사 지불액(참고)
    const isBrand = Number(r.is_brand_product) === 1
    const availableAt = isBrand ? nowIso : generalAvailableAt
    const noteText = isBrand ? 'B2B 도매주문(브랜드 — 당일정산)' : 'B2B 도매주문(일반 — 7일성숙)'

    await DB.prepare(`
      INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source, note)
      VALUES (?, ?, ?, NULL, ?, ?, 'pending', ?, 'wholesale', ?)
    `).bind(r.supplier_id, wholesaleOrderId, r.product_id, retailAmount, supplyAmount, availableAt, noteText).run()

    await DB.prepare(`
      INSERT INTO supplier_balances (supplier_id, pending_amount, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(supplier_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')
    `).bind(r.supplier_id, supplyAmount).run()

    try {
      await recordLedger(DB, {
        event_type: 'supplier_wholesale', reference_id: `whs-${wholesaleOrderId}`, amount: supplyAmount,
        debit_account: 'platform:wholesale', credit_account: `supplier:${r.supplier_id}`,
        metadata: { product_id: r.product_id, qty, wholesale_order_id: wholesaleOrderId },
      })
    } catch { /* ledger best-effort */ }
    notifySuppliers.add(r.supplier_id)
    credited++
  }

  // 제조사 대시보드 알림 — 주문 접수 시 발송 준비 안내 (제조사당 1회, best-effort).
  for (const sid of notifySuppliers) {
    try {
      await createDashboardNotification(
        DB, 'supplier', String(sid), 'wholesale_order',
        '새 도매 주문', '도매 주문이 접수되었습니다. 발송을 준비해주세요.', '/supplier/wholesale-orders',
      )
    } catch { /* best-effort */ }
  }
  return credited
}

/**
 * 도매 주문 환불 시 제조사 적립 역전 (pending/available 만, paid 제외). 멱등.
 * @param supplierId 지정 시 해당 제조사 라인만 역전(부분환불). 미지정 시 주문 전체.
 * @returns 역전된 라인 수
 */
export async function reverseSupplierOnWholesaleRefund(
  DB: D1Database,
  wholesaleOrderId: number,
  reason: string,
  supplierId?: number,
): Promise<number> {
  if (!wholesaleOrderId) return 0
  await ensureSourceColumn(DB)
  const scoped = Number.isFinite(supplierId) && (supplierId as number) > 0
  const rows = await DB.prepare(
    `SELECT id, supplier_id, supply_amount, status FROM supplier_settlements
     WHERE order_id = ? AND source = 'wholesale' AND status IN ('pending','available') AND paid_at IS NULL
     ${scoped ? 'AND supplier_id = ?' : ''}`
  ).bind(...(scoped ? [wholesaleOrderId, supplierId] : [wholesaleOrderId]))
    .all<{ id: number; supplier_id: number; supply_amount: number; status: string }>()
    .catch(() => ({ results: [] as { id: number; supplier_id: number; supply_amount: number; status: string }[] }))

  let reversed = 0
  for (const a of rows.results || []) {
    await DB.prepare("UPDATE supplier_settlements SET status = 'cancelled', note = ? WHERE id = ?").bind(reason, a.id).run()
    const col = a.status === 'pending' ? 'pending_amount' : 'available_amount'
    await DB.prepare(`UPDATE supplier_balances SET ${col} = MAX(0, ${col} - ?), updated_at = datetime('now') WHERE supplier_id = ?`)
      .bind(a.supply_amount, a.supplier_id).run()
    reversed++
  }
  return reversed
}
