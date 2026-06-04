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
  source_product_id: number | null;
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
  // 멱등 가드 — 이미 처리된 주문이면 skip. (wholesale 정산은 order_id 공간 분리 — 제외)
  const existing = await DB.prepare("SELECT 1 FROM supplier_settlements WHERE order_id = ? AND COALESCE(source,'consumer') != 'wholesale' LIMIT 1")
    .bind(orderId).first().catch(() => null);
  if (existing) return 0;

  // 판매상품(sp) → 원본 공급상품(src) → supplier_id. 공급상품 라인만.
  const rows = await DB.prepare(`
    SELECT oi.quantity AS qty, oi.price AS unit_price, oi.product_id AS product_id,
           sp.seller_id AS seller_id, COALESCE(sp.supply_price, 0) AS supply_price,
           src.supplier_id AS supplier_id, sp.supply_source_id AS source_product_id
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

    // 🛡️ 2026-06-01 INC-8(위탁/드랍쉽): 공급자 원본 재고 차감 — 공급자가 실재고 기준 발송.
    //   셀러 복제본 재고(reserveStock)와 별개로 원본(공급자) 공유 재고를 같이 줄여 공급자 대시보드 정확.
    //   이 루프는 멱등 가드(supplier_settlements 존재) 안이라 주문당 1회만 실행.
    if (r.source_product_id) {
      await DB.prepare(
        "UPDATE products SET stock = MAX(0, COALESCE(stock,0) - ?), sold_count = COALESCE(sold_count,0) + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(qty, qty, r.source_product_id).run().catch(() => { /* best-effort */ });
    }
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
  // 🏭 2026-06-01: wholesale 정산(source='wholesale')은 도매 환불 경로에서 별도 역전 — order_id 충돌 방지.
  const rows = await DB.prepare(
    "SELECT id, supplier_id, supply_amount, status FROM supplier_settlements WHERE order_id = ? AND COALESCE(source,'consumer') != 'wholesale' AND status IN ('pending','available') AND paid_at IS NULL"
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

  // 🛡️ 2026-06-01 INC-8(위탁/드랍쉽): 환불 시 공급자 원본 재고 복원 — 반품 역물류.
  //   settlement 가 실제 역전된 경우(reversed>0)만 복원 — 비공급/미적립 주문 무영향.
  if (reversed > 0) {
    const lines = await DB.prepare(`
      SELECT oi.quantity AS qty, sp.supply_source_id AS source_product_id
      FROM order_items oi
      JOIN products sp ON sp.id = oi.product_id
      WHERE oi.order_id = ? AND sp.supply_source_id IS NOT NULL
    `).bind(orderId).all<{ qty: number; source_product_id: number | null }>().catch(() => ({ results: [] as { qty: number; source_product_id: number | null }[] }));
    for (const l of lines.results || []) {
      if (!l.source_product_id) continue;
      const qty = Math.max(1, Math.floor(Number(l.qty) || 1));
      await DB.prepare(
        "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ?"
      ).bind(qty, qty, l.source_product_id).run().catch(() => { /* best-effort */ });
    }
  }
  return reversed;
}

/**
 * 🛡️ 2026-06-01 지급 실행: 환불창(available_at) 지난 pending 정산을 available 로 성숙.
 *   공급자별로 pending_amount → available_amount 이동. 멱등(이미 available 인 건 제외).
 *   cron(일배치) + 어드민 공급자 목록 조회 시 호출.
 * @returns 성숙된 라인 수
 */
export async function matureSupplierSettlements(DB: D1Database): Promise<number> {
  // 성숙 대상(환불창 경과) 공급자별 합계.
  const due = await DB.prepare(
    "SELECT supplier_id, SUM(supply_amount) AS amt, COUNT(*) AS cnt FROM supplier_settlements WHERE status = 'pending' AND available_at IS NOT NULL AND available_at <= datetime('now') GROUP BY supplier_id"
  ).all<{ supplier_id: number; amt: number; cnt: number }>().catch(() => ({ results: [] as { supplier_id: number; amt: number; cnt: number }[] }));

  let matured = 0;
  for (const d of due.results || []) {
    const amt = Math.max(0, Math.floor(Number(d.amt) || 0));
    if (amt <= 0) continue;
    // 상태 전환 먼저(멱등 보장) → 잔고 이동.
    const upd = await DB.prepare(
      "UPDATE supplier_settlements SET status = 'available' WHERE supplier_id = ? AND status = 'pending' AND available_at IS NOT NULL AND available_at <= datetime('now')"
    ).bind(d.supplier_id).run();
    const changed = upd.meta?.changes ?? 0;
    if (changed <= 0) continue;
    // 🛡️ 2026-06-04: 잔고 캐시를 settlements(권위 출처)에서 재계산 — 증분(±amt) 대신 SUM 재산정으로
    //   SUM-then-claim 레이스 드리프트를 영구 차단(자가치유). paid_amount 는 payout 에서만 변경되므로 미수정.
    await DB.prepare(
      `UPDATE supplier_balances SET
         pending_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'pending'), 0),
         available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0),
         updated_at = datetime('now')
       WHERE supplier_id = ?`
    ).bind(d.supplier_id, d.supplier_id, d.supplier_id).run();
    matured += changed;
  }
  return matured;
}

export interface PayoutResult {
  ok: boolean;
  amount: number;
  settlement_count: number;
  payout_id?: number;
  error?: string;
}

/**
 * 🛡️ 2026-06-01 지급 실행: 공급자의 available 정산 전액을 지급 처리.
 *   available 정산 → 'paid' + paid_at, 잔고 available→paid 이동, supplier_payouts 기록, ledger.
 *   원자성: 정산 claim(UPDATE) 의 changes 로 동시 지급 중복 차단.
 */
export async function payoutSupplier(
  DB: D1Database,
  supplierId: number,
  opts: { adminId?: string; note?: string } = {},
): Promise<PayoutResult> {
  if (!supplierId) return { ok: false, amount: 0, settlement_count: 0, error: 'invalid_supplier' };

  // 지급 대상 합계(available).
  const agg = await DB.prepare(
    "SELECT COALESCE(SUM(supply_amount), 0) AS amt, COUNT(*) AS cnt FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'"
  ).bind(supplierId).first<{ amt: number; cnt: number }>().catch(() => null);
  const amount = Math.max(0, Math.floor(Number(agg?.amt) || 0));
  const count = Number(agg?.cnt) || 0;
  if (amount <= 0 || count <= 0) return { ok: false, amount: 0, settlement_count: 0, error: 'no_available_balance' };

  // 🛡️ 플랫폼 1일 정산 한도(기본 1억). platform_settings.supplier_daily_payout_cap 로 조정 가능, 0/미설정이면 기본.
  const DEFAULT_DAILY_CAP = 100_000_000;
  const capRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'supplier_daily_payout_cap'")
    .first<{ value: string }>().catch(() => null);
  const dailyCap = Math.max(0, Math.floor(Number(capRow?.value) || 0)) || DEFAULT_DAILY_CAP;
  const todayPaid = await DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS amt FROM supplier_payouts WHERE status = 'paid' AND date(created_at) = date('now')"
  ).first<{ amt: number }>().catch(() => null);
  const paidToday = Math.max(0, Math.floor(Number(todayPaid?.amt) || 0));
  if (paidToday + amount > dailyCap) {
    return { ok: false, amount: 0, settlement_count: 0, error: 'daily_cap_exceeded' };
  }

  // 정산 claim — available → paid (동시 지급 중복 차단).
  const claim = await DB.prepare(
    "UPDATE supplier_settlements SET status = 'paid', paid_at = datetime('now') WHERE supplier_id = ? AND status = 'available'"
  ).bind(supplierId).run();
  const claimed = claim.meta?.changes ?? 0;
  if (claimed <= 0) return { ok: false, amount: 0, settlement_count: 0, error: 'already_paid' };

  // 잔고 이동.
  await DB.prepare(
    "UPDATE supplier_balances SET available_amount = MAX(0, available_amount - ?), paid_amount = paid_amount + ?, updated_at = datetime('now') WHERE supplier_id = ?"
  ).bind(amount, amount, supplierId).run();

  // 계좌 스냅샷 + payout 기록.
  const sup = await DB.prepare('SELECT bank_name, bank_account, account_holder FROM suppliers WHERE id = ?')
    .bind(supplierId).first<{ bank_name: string | null; bank_account: string | null; account_holder: string | null }>().catch(() => null);
  const ins = await DB.prepare(
    `INSERT INTO supplier_payouts (supplier_id, amount, settlement_count, status, bank_name, bank_account, account_holder, note, created_by, created_at)
     VALUES (?, ?, ?, 'paid', ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(supplierId, amount, claimed, sup?.bank_name ?? null, sup?.bank_account ?? null, sup?.account_holder ?? null, opts.note ?? null, opts.adminId ?? null).run();

  try {
    await recordLedger(DB, {
      event_type: 'supplier_payout', reference_id: String(ins.meta?.last_row_id ?? supplierId), amount,
      debit_account: `supplier:${supplierId}`, credit_account: 'platform:payout',
      metadata: { settlement_count: claimed, admin_id: opts.adminId ?? null },
    });
  } catch { /* ledger best-effort */ }

  return { ok: true, amount, settlement_count: claimed, payout_id: Number(ins.meta?.last_row_id) || undefined };
}
