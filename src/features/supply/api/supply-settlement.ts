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
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';

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
  // 🛡️ 2026-06-08 PAY-idempotency: 기존엔 order_id 에 settlement 가 1건이라도 있으면 전체 주문을
  //   skip(return 0) → 일부 라인만 적립된 부분실패 주문의 *남은 라인이 영구 미적립*되는
  //   under-credit 엣지가 있었다. 이제 per-line ON CONFLICT(order_id,product_id,source) 가 멱등을
  //   내재적으로 보장하므로 이 early-return 을 제거 — 각 라인이 개별적으로 멱등 INSERT 된다
  //   (이미 적립된 라인은 DO NOTHING 으로 무시, 미적립 라인만 새로 적립).

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
    // 💰 금액/반올림/split 계산은 SSOT(calcSupplySplit) — 미변경.
    const split = calcSupplySplit({ retail_amount: retail, supply_price: supplyTotal, platform_rate: platformRate });
    if (split.supplier_amount <= 0) continue;

    const availableAt = new Date(Date.now() + SUPPLIER_REFUND_WINDOW_DAYS * 86400_000).toISOString();
    // 🛡️ 2026-06-08 PAY-idempotency + PAY-3(atomicity):
    //   (1) settlement INSERT 를 idx_supplier_settle_unique(order_id, product_id, source) 에
    //       의존하는 ON CONFLICT DO NOTHING 으로 전환 → 멱등이 *내재적*(상위 CAS 가 우회돼도 안전,
    //       per-line 루프라 라인별 중복도 차단). source 기본 'consumer' 명시(인덱스 매칭).
    //   (2) DB.batch([INSERT, balance recompute]) 로 두 write 를 단일 트랜잭션으로 원자 적용 →
    //       크래시 시 'settlement 만 있고 잔고 캐시 미반영' 드리프트 차단.
    //   (3) balance 는 ±증분 대신 settlements(권위 출처) SUM 재계산(자가치유). 중복 INSERT 가
    //       DO NOTHING 으로 무시돼도 SUM 은 그대로 → 재크레딧 시 balance 이중 증가 없음
    //       (meta.changes 분기 없이도 멱등). available/paid 도 함께 재산정(드리프트 방지).
    const batchRes = await DB.batch([
      DB.prepare(`
        INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'consumer')
        ON CONFLICT(order_id, product_id, source) DO NOTHING
      `).bind(r.supplier_id, orderId, r.product_id, r.seller_id ?? null, retail, split.supplier_amount, availableAt),
      DB.prepare(`
        INSERT INTO supplier_balances (supplier_id, pending_amount, available_amount, paid_amount, updated_at)
        VALUES (
          ?,
          COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'pending'), 0),
          COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0),
          COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'paid'), 0),
          datetime('now')
        )
        ON CONFLICT(supplier_id) DO UPDATE SET
          pending_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'pending'), 0),
          available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'available'), 0),
          paid_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'paid'), 0),
          updated_at = datetime('now')
      `).bind(r.supplier_id, r.supplier_id, r.supplier_id, r.supplier_id),
    ]);
    // batch 는 순서대로 결과 반환 — [0]=INSERT. 신규 행이 아니면(changes===0) 멱등 skip 으로 카운트 안 함.
    const inserted = (batchRes?.[0]?.meta?.changes ?? 0) > 0;
    if (!inserted) continue; // 이미 적립된 라인 — 멱등 skip (잔고는 SUM 재계산이라 무영향)
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
 * 🛡️ 2026-06-08 PAY-4: 공급자 잔고 캐시(supplier_balances)를 settlements(권위 출처) 의 status별
 *   SUM 으로 *재계산*(자가치유). 환불 역전/클로백 후 per-row 스냅샷 status 로 버킷을 추정 감산하면
 *   만기(matureSupplierSettlements) 와의 레이스로 드리프트가 생기므로, 항상 SUM 재산정으로 통일.
 *   - clawback row(음수 supply_amount, status='available')가 available SUM 에 포함되므로
 *     available 이 자연히 순감(net-out) — 다음 payout 이 음수분만큼 적게 지급해 회수.
 *   - 원본 paid 정산은 그대로(append-only) 남아 paid_amount SUM 은 과거 지급 사실을 정확히 보존.
 */
async function recomputeSupplierBalance(DB: D1Database, supplierId: number): Promise<void> {
  await DB.prepare(
    `INSERT INTO supplier_balances (supplier_id, pending_amount, available_amount, paid_amount, updated_at)
     VALUES (
       ?,
       COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'pending'), 0),
       COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0),
       COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'paid'), 0),
       datetime('now')
     )
     ON CONFLICT(supplier_id) DO UPDATE SET
       pending_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'pending'), 0),
       available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'available'), 0),
       paid_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = supplier_balances.supplier_id AND status = 'paid'), 0),
       updated_at = datetime('now')`
  ).bind(supplierId, supplierId, supplierId, supplierId).run();
}

/**
 * 환불 시 공급자 적립 역전. 비례 없이 주문 단위 전액 취소.
 * 🛡️ 2026-06-08 PAY-1(클로백) + PAY-4(SUM 재계산):
 *   - pending/available(미지급) 정산: 기존처럼 'cancelled' 로 취소.
 *   - **이미 paid 된 정산**: 기존엔 SKIP → 플랫폼이 손실을 떠안았다. 이제 *음수 클로백 row*
 *     (append-only ledger, supply_amount 음수, source 동일, note='clawback') 를 INSERT →
 *     available SUM 이 순감 → 다음 payout 에서 자동 상계(net-out). 미래 잔고가 부족하면(음수로
 *     떨어지면) 어드민 ops 알림(supplier_clawback_shortfall) 발송.
 *   - 잔고는 per-row 감산 대신 supplier별 SUM 재계산(레이스 제거).
 * @returns 역전된 라인 수 (취소 + 클로백 합산)
 */
export async function reverseSupplierOnRefund(
  DB: D1Database,
  orderId: number,
  reason: string,
): Promise<number> {
  if (!orderId) return 0;
  // 🏭 2026-06-01: wholesale 정산(source='wholesale')은 도매 환불 경로에서 별도 역전 — order_id 충돌 방지.
  //   🛡️ 2026-06-08 PAY-1: paid 도 함께 조회(클로백 대상). 이미 'cancelled'/'clawback' 인 row 는 제외(멱등).
  const rows = await DB.prepare(
    "SELECT id, supplier_id, product_id, supply_amount, status, COALESCE(source,'consumer') AS source FROM supplier_settlements WHERE order_id = ? AND COALESCE(source,'consumer') != 'wholesale' AND status IN ('pending','available','paid') AND note IS NOT 'clawback'"
  ).bind(orderId).all<{ id: number; supplier_id: number; product_id: number; supply_amount: number; status: string; source: string }>().catch(() => ({ results: [] as { id: number; supplier_id: number; product_id: number; supply_amount: number; status: string; source: string }[] }));

  let reversed = 0;
  const touchedSuppliers = new Set<number>();
  for (const a of rows.results || []) {
    const amt = Math.max(0, Math.floor(Number(a.supply_amount) || 0));
    // 🛡️ 2026-06-08 PAY-6(1) 원장 대칭: 적립 시 `debit seller → credit supplier:N` 로 기록한 공급자
    //   외상을, 역전(취소/클로백) 시 *대칭 반대 entry*(debit supplier:N → credit platform:refund)로
    //   기록한다. ledger_entries.amount 는 음수 불가(helper 가 거부)이므로 부호 대신 account 를
    //   swap — getAccountBalance('supplier:N') = Σcredit − Σdebit 이 그만큼 순감해 잔고 캐시
    //   (supplier_balances, settlements SUM 재계산)와 다시 정합(Σ-invariant 회복).
    //   cancel/clawback 모두 공급자 순채무가 amt 만큼 줄므로 동일하게 1회 reverse entry 기록.
    //   ⚠️ 멱등: 이 reverse entry 는 *실제 상태 전환이 일어난 row* 에만 기록한다. paid row 는 환불
    //   2회 호출 시 원본이 계속 status='paid'(note≠'clawback')라 재선택되므로, ledger 를 무조건
    //   기록하면 over-reverse 로 Σ-invariant 가 깨진다. 따라서 clawback INSERT 가 *실제 삽입*됐을
    //   때(ON CONFLICT no-op 아님) 또는 cancel UPDATE 가 *실제 변경*됐을 때만 entry 를 남긴다.
    //   best-effort(audit-only) — 본 역전 트랜잭션은 ledger 실패와 무관하게 진행.
    let effected = false;
    if (a.status === 'paid') {
      // 🛡️ PAY-1 클로백: 이미 지급된 정산은 취소(과거 지급 사실 보존)하지 않고, 음수 보정 row 를 추가.
      //   status='available' + 음수 supply_amount → available SUM 이 순감 → 다음 payout 이 그만큼
      //   적게 지급(net-out). available_at=과거시각이라 만기 대기 없이 즉시 차감 대상.
      //   멱등: 같은 환불 2회 호출 시 원본 paid row 가 다시 잡히지만(note≠'clawback'), 클로백 INSERT 의
      //   product_id 를 음수로 두어 idx_supplier_settle_unique(order_id, -product_id, source) 가 동일 →
      //   ON CONFLICT DO NOTHING 으로 중복 차단(이중 차감 방지).
      const cb = await DB.prepare(
        `INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source, note)
         VALUES (?, ?, ?, NULL, 0, ?, 'available', datetime('now','-1 second'), ?, 'clawback')
         ON CONFLICT(order_id, product_id, source) DO NOTHING`
      ).bind(a.supplier_id, orderId, -Math.abs(a.product_id || 0), -amt, a.source).run().catch(() => null);
      effected = (cb?.meta?.changes ?? 0) > 0; // 신규 클로백 삽입 시에만 reverse entry/카운트.
    } else {
      // pending/available 미지급분 — 단순 취소.
      const upd = await DB.prepare("UPDATE supplier_settlements SET status = 'cancelled', note = ? WHERE id = ? AND status IN ('pending','available')").bind(reason, a.id).run();
      effected = (upd.meta?.changes ?? 0) > 0; // 실제 취소된 경우에만.
    }
    if (!effected) continue; // 멱등 no-op (이미 처리된 row) — ledger/카운트/잔고 무영향.
    // 대칭 reverse entry — 실제 상태 전환이 일어난 이 호출에서만 1회.
    if (amt > 0) {
      try {
        await recordLedger(DB, {
          event_type: 'supplier_commission_reversal', reference_id: String(orderId), amount: amt,
          debit_account: `supplier:${a.supplier_id}`, credit_account: 'platform:refund',
          metadata: { product_id: a.product_id, source: a.source, prior_status: a.status, reason },
        });
      } catch { /* ledger best-effort */ }
    }
    reversed++;
    touchedSuppliers.add(a.supplier_id);
  }

  // 🛡️ PAY-4: 영향받은 공급자별 잔고를 SUM 으로 재계산(레이스 없는 단일 진실).
  for (const sid of touchedSuppliers) {
    await recomputeSupplierBalance(DB, sid).catch(() => { /* best-effort */ });
    // 🛡️ PAY-1 부족분 알림: 클로백으로 available 이 음수(미래 정산으로 못 메움)면 어드민 ops 경보.
    const bal = await DB.prepare(
      "SELECT COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0) AS avail"
    ).bind(sid).first<{ avail: number }>().catch(() => null);
    const avail = Math.floor(Number(bal?.avail) || 0);
    if (avail < 0) {
      try {
        await createDashboardNotification(
          DB, 'admin', null, 'supplier_clawback_shortfall',
          '제조사 클로백 잔고 부족',
          `제조사 #${sid} 의 지급 후 환불 클로백을 향후 정산으로 상계하지 못했습니다(부족 ₩${Math.abs(avail).toLocaleString()}). 직접 회수가 필요합니다. (주문 #${orderId})`,
          `/admin/suppliers`,
        );
      } catch { /* 알림 best-effort */ }
    }
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
  // 🏭 BIZ-1 (2026-06-08): 클레임/분쟁으로 HOLD 된 정산은 성숙에서 제외(분쟁 중 공급자 지급 보류).
  //   held_at 컬럼이 없는 cold DB 도 안전하도록 best-effort ADD COLUMN(이미 있으면 무시) 후 가드 적용.
  await DB.prepare("ALTER TABLE supplier_settlements ADD COLUMN held_at DATETIME").run().catch(() => { /* 이미 존재 — 무시 */ });
  // 성숙 대상(환불창 경과 + HOLD 아님) 공급자별 합계.
  const due = await DB.prepare(
    "SELECT supplier_id, SUM(supply_amount) AS amt, COUNT(*) AS cnt FROM supplier_settlements WHERE status = 'pending' AND available_at IS NOT NULL AND available_at <= datetime('now') AND held_at IS NULL GROUP BY supplier_id"
  ).all<{ supplier_id: number; amt: number; cnt: number }>().catch(() => ({ results: [] as { supplier_id: number; amt: number; cnt: number }[] }));

  let matured = 0;
  for (const d of due.results || []) {
    const amt = Math.max(0, Math.floor(Number(d.amt) || 0));
    if (amt <= 0) continue;
    // 상태 전환 먼저(멱등 보장) → 잔고 이동. HOLD 된 row 는 제외(held_at IS NULL).
    const upd = await DB.prepare(
      "UPDATE supplier_settlements SET status = 'available' WHERE supplier_id = ? AND status = 'pending' AND available_at IS NOT NULL AND available_at <= datetime('now') AND held_at IS NULL"
    ).bind(d.supplier_id).run();
    const changed = upd.meta?.changes ?? 0;
    if (changed <= 0) continue;
    // 🛡️ 2026-06-04: 잔고 캐시를 settlements(권위 출처)에서 재계산 — 증분(±amt) 대신 SUM 재산정으로
    //   SUM-then-claim 레이스 드리프트를 영구 차단(자가치유).
    // 🛡️ 2026-06-08 PAY-3: paid_amount 도 SUM(supply_amount WHERE status='paid') 으로 재산정.
    //   기존엔 payout 의 증분(+amount)에만 의존 → payout 중간 크래시(claim 됐는데 잔고 이동 실패)
    //   시 paid_amount 가 *영구 드리프트*. 만기 배치마다 SUM 으로 self-heal 하면 자동 수렴.
    //   (cancelled/clawback 음수 row 는 paid status 가 아니므로 paid SUM 에 미포함 — 정확.)
    await DB.prepare(
      `UPDATE supplier_balances SET
         pending_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'pending'), 0),
         available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0),
         paid_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'paid'), 0),
         updated_at = datetime('now')
       WHERE supplier_id = ?`
    ).bind(d.supplier_id, d.supplier_id, d.supplier_id, d.supplier_id).run();
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

  // 계좌 스냅샷 (payout 기록용 — claim 전에 읽어도 무방, 금액과 무관).
  const sup = await DB.prepare('SELECT bank_name, bank_account, account_holder FROM suppliers WHERE id = ?')
    .bind(supplierId).first<{ bank_name: string | null; bank_account: string | null; account_holder: string | null }>().catch(() => null);

  // 🛡️ 2026-06-08 PAY-2(원자적 일일 캡) + PAY-3(batch 원자성):
  //   기존엔 (SELECT SUM today → JS 비교 → 나중 INSERT) 의 check-then-insert 라 동시 지급이
  //   1억 한도를 넘길 수 있었다. 이제 *조건부 payout-row INSERT 를 batch 의 첫 statement* 로 두어
  //   (오늘 지급합 + 이번금액 <= 캡) 일 때만 행이 들어가고, 뒤따르는 정산 claim/잔고 이동을 모두
  //   "이번 호출의 payout 행이 방금 들어갔는가" 에 종속시킨다 — 별도 롤백/보상 없이 all-or-nothing.
  //   순서가 핵심:
  //     [0] 조건부 INSERT: today_sum_before + amount <= cap 일 때만 1행. (캡 초과면 0행 → 이후 전부 no-op)
  //     [1] claim: available→paid, 단 *방금 이 supplier 의 payout 행이 오늘 갱신됐을 때만*.
  //         payout INSERT 직후라 today 의 그 supplier 행이 존재 → EXISTS 가드로 캡 통과 여부 반영.
  //     [2] 잔고: claim 반영 후 SUM 재계산(자가치유).
  //   D1 batch 는 단일 트랜잭션·순차 실행이라 [0] 이 만든 행을 [1] 의 서브쿼리가 본다.
  //   claim 의 changes 가 곧 settlement_count — payout 행의 settlement_count(사전 count)와 99% 일치
  //   하나, 동시 만기/환불로 available 행이 바뀌어도 ledger/응답은 실제 claimed 를 권위로 사용.
  const payoutTag = `payout:${supplierId}:${Date.now()}`; // 이번 호출 payout 행 식별(note 에 부착, 가드 EXISTS 용)
  const stmts = [
    // [0] 조건부 payout-row INSERT — 일일 캡을 단일 statement 안에서 원자 검증. note 에 고유 태그.
    DB.prepare(
      `INSERT INTO supplier_payouts (supplier_id, amount, settlement_count, status, bank_name, bank_account, account_holder, note, created_by, created_at)
       SELECT ?, ?, ?, 'paid', ?, ?, ?, ?, ?, datetime('now')
       WHERE (SELECT COALESCE(SUM(amount), 0) FROM supplier_payouts WHERE status = 'paid' AND date(created_at) = date('now')) + ? <= ?`
    ).bind(
      supplierId, amount, count, sup?.bank_name ?? null, sup?.bank_account ?? null, sup?.account_holder ?? null,
      payoutTag, opts.adminId ?? null, amount, dailyCap,
    ),
    // [1] 정산 claim — available → paid. 단 [0] 의 payout 행(payoutTag)이 실제로 들어갔을 때만(캡 통과).
    //     캡 초과로 [0] 이 0행이면 EXISTS=false → claim 0행(no-op). 동시 지급 중복은 status CAS 로 차단.
    DB.prepare(
      `UPDATE supplier_settlements SET status = 'paid', paid_at = datetime('now')
       WHERE supplier_id = ? AND status = 'available'
         AND EXISTS (SELECT 1 FROM supplier_payouts WHERE supplier_id = ? AND note = ?)`
    ).bind(supplierId, supplierId, payoutTag),
    // [2] 잔고 이동 — claim 반영 후 SUM 재계산(자가치유, 증분 드리프트 방지).
    DB.prepare(
      `UPDATE supplier_balances SET
         available_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'available'), 0),
         paid_amount = COALESCE((SELECT SUM(supply_amount) FROM supplier_settlements WHERE supplier_id = ? AND status = 'paid'), 0),
         updated_at = datetime('now')
       WHERE supplier_id = ?`
    ).bind(supplierId, supplierId, supplierId),
  ];
  const batchRes = await DB.batch(stmts);
  const payoutInserted = (batchRes?.[0]?.meta?.changes ?? 0) > 0;
  const claimed = batchRes?.[1]?.meta?.changes ?? 0;

  // 🛡️ PAY-2: payout 행이 안 들어갔으면(캡 초과) claim 도 EXISTS 가드로 자동 no-op → 보상 불필요.
  if (!payoutInserted) {
    return { ok: false, amount: 0, settlement_count: 0, error: 'daily_cap_exceeded' };
  }
  // payout 행은 들어갔는데 claim 이 0 이면(동시 지급이 available 을 먼저 가져감) — 빈 payout 행 정리 후 반환.
  if (claimed <= 0) {
    await DB.prepare("DELETE FROM supplier_payouts WHERE supplier_id = ? AND note = ?").bind(supplierId, payoutTag).run().catch(() => { /* best-effort */ });
    return { ok: false, amount: 0, settlement_count: 0, error: 'already_paid' };
  }

  const payoutId = Number(batchRes?.[0]?.meta?.last_row_id) || undefined;
  // 사용자 note 를 payout 행에 반영(태그를 실제 note 로 교체) — 식별 태그는 내부용.
  await DB.prepare("UPDATE supplier_payouts SET note = ? WHERE supplier_id = ? AND note = ?")
    .bind(opts.note ?? null, supplierId, payoutTag).run().catch(() => { /* best-effort, 태그여도 기능 무해 */ });
  try {
    await recordLedger(DB, {
      event_type: 'supplier_payout', reference_id: String(payoutId ?? supplierId), amount,
      debit_account: `supplier:${supplierId}`, credit_account: 'platform:payout',
      metadata: { settlement_count: claimed, admin_id: opts.adminId ?? null },
    });
  } catch { /* ledger best-effort */ }

  return { ok: true, amount, settlement_count: claimed, payout_id: payoutId };
}
