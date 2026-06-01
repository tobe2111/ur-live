/**
 * 🛡️ 2026-05-31 도매몰 INC-5a: 공급(B2B) 정산 배선 헬퍼.
 *   판매 시 공급상품(supply_source_id) 라인의 공급가를 공급자(supplier)에게 적립(즉시 split, D2),
 *   환불 시 역전. 경제 계산은 `lib/supply-split.ts` (단위테스트 완료) 재사용.
 *
 * 연결: 셀러 판매상품(products.supply_source_id) → 원본 공급상품(products.supplier_id) → 공급자.
 * 권위 출처: supplier_settlements(status별 SUM) → supplier_balances 는 즉시 일관성용.
 * 멱등: 같은 order_id 에 이미 supplier_settlements 있으면 재적립 안 함.
 *
 * INC-5b(결제 흐름 배선)에서 호출 — payment 확정 시 creditSupplierOnOrder, 환불 시 reverseSupplierOnRefund.
 */
import { calcSupplySplit } from '@/lib/supply-split';
import { recordLedger } from '@/worker/utils/ledger';

const SUPPLIER_REFUND_WINDOW_DAYS = 7;

interface SupplyLine {
  qty: number;
  unit_price: number;
  product_id: number;
  seller_id: number | null;
  supply_price: number;
  supplier_id: number;
}

/**
 * 주문의 공급상품 라인을 공급자에게 적립 (pending). 멱등.
 * @returns 적립된 라인 수
 */
export async function creditSupplierOnOrder(
  DB: D1Database,
  orderId: number,
  platformRate = 5,
): Promise<number> {
  if (!orderId) return 0;
  // 멱등 가드 — 이미 처리된 주문이면 skip.
  const existing = await DB.prepare('SELECT 1 FROM supplier_settlements WHERE order_id = ? LIMIT 1')
    .bind(orderId).first().catch(() => null);
  if (existing) return 0;

  // 판매상품(sp) → 원본 공급상품(src) → supplier_id. 공급상품 라인만.
  const rows = await DB.prepare(`
    SELECT oi.quantity AS qty, oi.price AS unit_price, oi.product_id AS product_id,
           sp.seller_id AS seller_id, COALESCE(sp.supply_price, 0) AS supply_price,
           src.supplier_id AS supplier_id
    FROM order_items oi
    JOIN products sp ON sp.id = oi.product_id
    LEFT JOIN products src ON src.id = sp.supply_source_id
    WHERE oi.order_id = ?
      AND sp.supply_source_id IS NOT NULL
      AND COALESCE(sp.supply_price, 0) > 0
      AND src.supplier_id IS NOT NULL
  `).bind(orderId).all<SupplyLine>().catch(() => ({ results: [] as SupplyLine[] }));

  let credited = 0;
  for (const r of rows.results || []) {
    const qty = Math.max(1, Math.floor(Number(r.qty) || 1));
    const retail = Math.floor(Number(r.unit_price) || 0) * qty;
    const supplyTotal = Math.floor(Number(r.supply_price) || 0) * qty;
    const split = calcSupplySplit({ retail_amount: retail, supply_price: supplyTotal, platform_rate: platformRate });
    if (split.supplier_amount <= 0) continue;

    const availableAt = new Date(Date.now() + SUPPLIER_REFUND_WINDOW_DAYS * 86400_000).toISOString();
    await DB.prepare(`
      INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(r.supplier_id, orderId, r.product_id, r.seller_id ?? null, retail, split.supplier_amount, availableAt).run();
    await DB.prepare(`
      INSERT INTO supplier_balances (supplier_id, pending_amount, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(supplier_id) DO UPDATE SET pending_amount = pending_amount + excluded.pending_amount, updated_at = datetime('now')
    `).bind(r.supplier_id, split.supplier_amount).run();
    try {
      await recordLedger(DB, {
        event_type: 'supplier_commission', reference_id: String(orderId), amount: split.supplier_amount,
        debit_account: `seller:${r.seller_id ?? 0}`, credit_account: `supplier:${r.supplier_id}`,
        metadata: { product_id: r.product_id, retail, supply: split.supplier_amount },
      });
    } catch { /* ledger best-effort */ }
    credited++;
  }
  return credited;
}

/**
 * 환불 시 공급자 적립 역전 (pending/available 만, paid 제외). 비례 없이 주문 단위 전액 취소.
 * @returns 역전된 라인 수
 */
export async function reverseSupplierOnRefund(
  DB: D1Database,
  orderId: number,
  reason: string,
): Promise<number> {
  if (!orderId) return 0;
  const rows = await DB.prepare(
    "SELECT id, supplier_id, supply_amount, status FROM supplier_settlements WHERE order_id = ? AND status IN ('pending','available') AND paid_at IS NULL"
  ).bind(orderId).all<{ id: number; supplier_id: number; supply_amount: number; status: string }>().catch(() => ({ results: [] as { id: number; supplier_id: number; supply_amount: number; status: string }[] }));

  let reversed = 0;
  for (const a of rows.results || []) {
    await DB.prepare("UPDATE supplier_settlements SET status = 'cancelled', note = ? WHERE id = ?").bind(reason, a.id).run();
    if (a.status === 'pending') {
      await DB.prepare("UPDATE supplier_balances SET pending_amount = MAX(0, pending_amount - ?), updated_at = datetime('now') WHERE supplier_id = ?")
        .bind(a.supply_amount, a.supplier_id).run();
    } else {
      await DB.prepare("UPDATE supplier_balances SET available_amount = MAX(0, available_amount - ?), updated_at = datetime('now') WHERE supplier_id = ?")
        .bind(a.supply_amount, a.supplier_id).run();
    }
    reversed++;
  }
  return reversed;
}
