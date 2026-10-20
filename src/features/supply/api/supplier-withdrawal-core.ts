/**
 * 🏦 2026-06-09 유통스타트 제조사(공급자) 정산금 출금 — 공유 코어(스키마 ensure + 원자적 예약/복원).
 *
 * 💰 머니-크리티컬 (예치금 충전 흐름의 *역방향* 미러):
 *   - 입금(deposit): 판매사 무통장 → 충전요청(pending) → 어드민 입금확인 → 잔액 += (적립)
 *   - 출금(withdrawal): 제조사 정산 available → 출금신청(requested) → 어드민 송금확인 → available -= (인출)
 *
 * 출금 가능 잔액의 권위 출처 = supplier_balances.available_amount
 *   (= SUM(supplier_settlements.supply_amount WHERE status='available'), 여러 경로가 SUM 으로 self-heal).
 *   여러 코드 경로가 available_amount/pending_amount/paid_amount 를 SUM 으로 *덮어쓰므로*,
 *   출금 예약을 그 컬럼에 직접 차감하면 다음 recompute 가 되돌려버린다.
 *
 *   → 그래서 recompute 가 *절대 건드리지 않는* 별도 컬럼 reserved_amount 에 예약을 누적.
 *     실가용(spendable) = available_amount - reserved_amount.
 *     - 출금신청: reserved += amount (CAS, spendable >= amount 일 때만 → 음수·초과인출 불가)
 *     - 반려:    reserved -= amount (복원)
 *     - 송금완료(paid): reserved -= amount + supplier_settlements 에 음수 'withdrawal' row INSERT
 *                      → 다음 recompute 가 available_amount 를 실제로 차감(클로백 net-out 패턴 미러).
 *
 * 멱등/원자성: 모든 reserve/restore 는 단일 UPDATE … WHERE 의 meta.changes 로 검증.
 *   요청/승인/반려 row 상태전환은 wholesale_settlement_withdrawals.status CAS 로 1회만.
 */

import { swallow } from '@/worker/utils/swallow'

const _withdrawalEnsured = new WeakSet<object>()

/** 출금 신청 테이블 + reserved_amount 컬럼 멱등 ensure (ensureDepositSchema 패턴). */
export async function ensureWithdrawalSchema(DB: D1Database): Promise<void> {
  if (_withdrawalEnsured.has(DB)) return
  _withdrawalEnsured.add(DB)
  // 출금 신청(어드민 송금확인 대상). 신청 시점의 제조사 계좌 스냅샷 동봉.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_settlement_withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    bank_name TEXT,
    bank_account TEXT,
    account_holder TEXT,
    admin_memo TEXT,
    requested_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
  )`).run().catch(() => { /* best-effort (cold isolate concurrent create) */ })
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_wholesale_settlement_withdrawals_supplier ON wholesale_settlement_withdrawals(supplier_id, id DESC)'
  ).run().catch(swallow('withdrawal:idx-supplier'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_wholesale_settlement_withdrawals_status ON wholesale_settlement_withdrawals(status, id DESC)'
  ).run().catch(swallow('withdrawal:idx-status'))
  // supplier_balances.reserved_amount — 출금 예약 락(미지급 출금이 잠근 금액). recompute 가 안 건드리는 컬럼.
  await DB.prepare('ALTER TABLE supplier_balances ADD COLUMN reserved_amount INTEGER NOT NULL DEFAULT 0')
    .run().catch(() => { /* 이미 존재 — 무시 */ })
  // 🛡️ 2026-06-28 (잔여 P1 후속): held_at 보장 — 분쟁/환불 보류 중인 available 정산을 출금가능액에서 제외하기 위함.
  await DB.prepare('ALTER TABLE supplier_settlements ADD COLUMN held_at DATETIME').run().catch(() => { /* 이미 존재 */ })
  // 🛡️ 2026-07-02 (감사 — 출금 이중지급 방지): 출금 확정 시 음수 net-out row 의 멱등 UNIQUE.
  //   settleWithdrawalLedger 가 INSERT OR IGNORE 로 재시도/스윕 재적용해도 중복 차감 안 되도록 per-withdrawal 유일키.
  //   기존 idx_supplier_settle_unique(order_id, product_id, source) 는 withdrawal 행의 order_id=NULL 이라
  //   NULL-distinct 로 dedup 안 됨 → 전용 partial unique(product_id=-withdrawalId, source='withdrawal').
  await DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_settle_withdrawal ON supplier_settlements(product_id, source) WHERE source = 'withdrawal'")
    .run().catch(() => { /* 이미 존재 / 중복행 — 무시(스윕이 정리) */ })
}

/**
 * 🛡️ 2026-06-28 보류(held) 중인 available 정산 합계 — 출금가능액에서 제외할 금액.
 *   fail-safe: held_at 컬럼이 아직 없는 DB(repair 전)면 쿼리 throw → catch → 0 반환(=기존 동작, 회귀 0).
 *   컬럼이 있으면 분쟁/환불로 보류된 available 정산을 정확히 합산해 spendable 에서 차감.
 */
async function heldAvailable(DB: D1Database, supplierId: number): Promise<number> {
  const r = await DB.prepare(
    "SELECT COALESCE(SUM(supply_amount), 0) AS held FROM supplier_settlements WHERE supplier_id = ? AND status = 'available' AND held_at IS NOT NULL"
  ).bind(supplierId).first<{ held: number }>().catch(() => null)
  return Math.max(0, Math.floor(Number(r?.held) || 0))
}

/** 실가용(spendable) 잔액 = available_amount - reserved_amount - held(보류) (행 없으면 0, 음수 클램프).
 *  🛡️ 2026-06-28: 분쟁/환불로 보류(held_at)된 available 정산은 출금 불가 → spendable 에서 차감. */
export async function loadSpendable(DB: D1Database, supplierId: number): Promise<{ available: number; reserved: number; spendable: number }> {
  const row = await DB.prepare(
    'SELECT COALESCE(available_amount,0) AS available, COALESCE(reserved_amount,0) AS reserved FROM supplier_balances WHERE supplier_id = ?'
  ).bind(supplierId).first<{ available: number; reserved: number }>().catch(() => null)
  const available = Math.max(0, Math.floor(Number(row?.available) || 0))
  const reserved = Math.max(0, Math.floor(Number(row?.reserved) || 0))
  const held = await heldAvailable(DB, supplierId)
  return { available, reserved, spendable: Math.max(0, available - reserved - held) }
}

/**
 * 💰 출금 예약(원자적). spendable(=available-reserved) >= amount 일 때만 reserved += amount.
 *   동시 출금신청 2건이 같은 잔액을 동시에 인출하는 것을 CAS 로 차단(초과/음수 불가).
 *   @returns ok 시 예약 후 spendable, 부족 시 현재 spendable.
 */
export async function reserveForWithdrawal(
  DB: D1Database, supplierId: number, amount: number,
): Promise<{ ok: true; spendableAfter: number } | { ok: false; spendable: number }> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) {
    const cur = await loadSpendable(DB, supplierId)
    return { ok: false, spendable: cur.spendable }
  }
  // CAS — 행이 있고(잔액이 있으려면 settlement 적립으로 행이 생성됨) spendable >= amt 일 때만.
  //   🛡️ 2026-06-28: 보류(held) 정산 제외 — available - reserved - held >= amt  ⟺  available - reserved >= amt + held.
  //   held 는 fail-safe(컬럼 없으면 0=기존 동작). reserved += amt(실제 예약분만), threshold 만 held 만큼 상향.
  const held = await heldAvailable(DB, supplierId)
  const up = await DB.prepare(
    "UPDATE supplier_balances SET reserved_amount = COALESCE(reserved_amount,0) + ?, updated_at = datetime('now') WHERE supplier_id = ? AND (COALESCE(available_amount,0) - COALESCE(reserved_amount,0)) >= ?"
  ).bind(amt, supplierId, amt + held).run().catch(() => ({ meta: { changes: 0 } }))
  if (((up as { meta?: { changes?: number } }).meta?.changes ?? 0) === 0) {
    const cur = await loadSpendable(DB, supplierId)
    return { ok: false, spendable: cur.spendable }
  }
  const after = await loadSpendable(DB, supplierId)
  return { ok: true, spendableAfter: after.spendable }
}

/**
 * 💰 출금 예약 복원(반려). reserved -= amount (음수 클램프 — reserved 미만으로 안 내려감).
 *   멱등 보호는 호출측(withdrawal row status CAS)이 보장 — 실제 반려 전환이 일어난 1회만 호출.
 */
export async function releaseReservation(DB: D1Database, supplierId: number, amount: number): Promise<void> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) return
  await DB.prepare(
    "UPDATE supplier_balances SET reserved_amount = MAX(0, COALESCE(reserved_amount,0) - ?), updated_at = datetime('now') WHERE supplier_id = ?"
  ).bind(amt, supplierId).run().catch(() => { /* best-effort */ })
}

/**
 * 💰 출금 확정(송금완료) — 예약을 실제 잔액 차감으로 전환.
 *   1) reserved -= amount (락 해제)
 *   2) supplier_settlements 에 음수 'withdrawal' row INSERT (status='available', supply_amount = -amount)
 *      → 다음 recomputeSupplierBalance / matureSupplierSettlements 가 available_amount 를 실제로 순감
 *        (클로백 net-out 패턴 미러). available SUM 이 -amount 만큼 줄어 출금분이 잔액에서 빠짐.
 *   3) 즉시 일관성을 위해 available_amount 도 동시 차감(다음 recompute 전까지 대시보드 정합).
 *   product_id 음수(= -withdrawalId)로 두어 source='withdrawal' 과 함께 행 식별/중복방지 가능.
 *   호출측(withdrawal row status CAS requested→paid)이 멱등을 보장 — 실제 전환 1회만 호출.
 */
export async function settleWithdrawalLedger(DB: D1Database, supplierId: number, withdrawalId: number, amount: number): Promise<boolean> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) return false
  await ensureWithdrawalSchema(DB) // 멱등 UNIQUE 인덱스 보장(INSERT OR IGNORE dedup 근거).

  // 🛡️ 2026-07-02 (감사 — 이중지급 근본수정): 음수 net-out row 가 **유일한 권위 차감**(recompute 가
  //   available_amount = SUM(status='available') 로 덮어쓰므로, 이 음수 row 만이 출금분을 지속 반영).
  //   기존엔 이 INSERT 가 best-effort(.catch(()=>{}))라, 일시 실패 시 아래 UPDATE 의 available 차감을
  //   다음 recompute 가 되돌려 → 출금액이 다시 available 로 복원 → **재출금(이중지급)**. 이제:
  //     1) INSERT OR IGNORE (per-withdrawal UNIQUE) — 신규 삽입(changes=1)일 때만 잔액을 1회 차감.
  //     2) 음수 row 확정 실패(삽입 0 + 조회도 없음) → reserved 를 **풀지 않고** false 반환
  //        → 그 금액은 reserved 에 잠긴 채 남아 재출금 불가(안전). 스윕(reconcileWithdrawalLedgers)이 후속 완료.
  const negProductId = -Math.abs(withdrawalId)
  const ins = await DB.prepare(
    `INSERT OR IGNORE INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source, note)
     VALUES (?, NULL, ?, NULL, 0, ?, 'available', datetime('now','-1 second'), 'withdrawal', ?)`
  ).bind(supplierId, negProductId, -amt, `출금 확정 #${withdrawalId}`).run().catch(() => ({ meta: { changes: 0 } }))
  const fresh = ((ins as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1

  if (fresh) {
    // 신규 net-out row 확정 → 예약 해제 + 즉시 available 차감(대시보드 즉시 정합, recompute 도 음수 row 로 동일 결과 → 이중차감 없음).
    await DB.prepare(
      "UPDATE supplier_balances SET reserved_amount = MAX(0, COALESCE(reserved_amount,0) - ?), available_amount = MAX(0, COALESCE(available_amount,0) - ?), updated_at = datetime('now') WHERE supplier_id = ?"
    ).bind(amt, amt, supplierId).run().catch(() => { /* best-effort: 권위 차감은 위 음수 row(recompute 반영) */ })
    return true
  }

  // changes=0 — 이미 확정(멱등 재실행)인지 진짜 실패인지 판별.
  const exist = await DB.prepare(
    "SELECT 1 AS x FROM supplier_settlements WHERE product_id = ? AND source = 'withdrawal' LIMIT 1"
  ).bind(negProductId).first<{ x: number }>().catch(() => null)
  //   존재 → 이전 호출이 이미 차감(잔액도 그때 반영) → 이번엔 잔액 재차감 없이 true(멱등).
  //   부재 → net-out row 미확정(진짜 실패) → reserved 잠금 유지(재출금 불가) + false(스윕 후속 완료).
  return !!exist
}

/**
 * 🛡️ 2026-07-02 (감사 — 자가복구 스윕): status='paid' 인데 net-out settlement row 가 없는 출금 확정을 멱등 완료.
 *   settleWithdrawalLedger 가 (하드크래시/일시오류로) 음수 row 를 못 남긴 케이스를 cron 이 자동 치유 →
 *   그 사이 reserved 에 잠긴 금액이 계속 재출금 불가로 안전하게 유지되다가, 여기서 확정되며 예약 해제·available 차감.
 *   (reconcileOrphanedDepositOrders 의 출금판 미러.) 멱등·fail-soft.
 * @returns { settled, scanned }
 */
export async function reconcileWithdrawalLedgers(DB: D1Database): Promise<{ settled: number; scanned: number }> {
  await ensureWithdrawalSchema(DB)
  const { results } = await DB.prepare(
    `SELECT w.id AS id, w.supplier_id AS supplier_id, w.amount AS amount
       FROM wholesale_settlement_withdrawals w
      WHERE w.status = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM supplier_settlements s
           WHERE s.source = 'withdrawal' AND s.product_id = -w.id
        )
      LIMIT 100`
  ).bind().all<{ id: number; supplier_id: number; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; supplier_id: number; amount: number }> }))
  const rows = results || []
  let settled = 0
  for (const r of rows) {
    const ok = await settleWithdrawalLedger(DB, r.supplier_id, r.id, Math.floor(Number(r.amount) || 0)).catch(() => false)
    if (ok) settled++
  }
  return { settled, scanned: rows.length }
}
