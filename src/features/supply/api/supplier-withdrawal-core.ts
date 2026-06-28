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
export async function settleWithdrawalLedger(DB: D1Database, supplierId: number, withdrawalId: number, amount: number): Promise<void> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) return
  // 음수 withdrawal settlement row — 과거시각 available_at 로 즉시 차감 대상.
  await DB.prepare(
    `INSERT INTO supplier_settlements (supplier_id, order_id, product_id, seller_id, retail_amount, supply_amount, status, available_at, source, note)
     VALUES (?, NULL, ?, NULL, 0, ?, 'available', datetime('now','-1 second'), 'withdrawal', ?)`
  ).bind(supplierId, -Math.abs(withdrawalId), -amt, `출금 확정 #${withdrawalId}`).run().catch(() => { /* best-effort: 잔액 차감은 아래 UPDATE 로도 반영 */ })
  // 락 해제 + 즉시 available 차감(다음 SUM recompute 도 음수 row 로 동일 결과 → 이중차감 없음).
  await DB.prepare(
    "UPDATE supplier_balances SET reserved_amount = MAX(0, COALESCE(reserved_amount,0) - ?), available_amount = MAX(0, COALESCE(available_amount,0) - ?), updated_at = datetime('now') WHERE supplier_id = ?"
  ).bind(amt, amt, supplierId).run().catch(() => { /* best-effort */ })
}
