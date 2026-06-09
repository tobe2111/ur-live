/**
 * 🏦 2026-06-09 유통스타트 예치금 결제 — 공유 코어(스키마 ensure + 잔액/원장 + 차감/복원).
 *
 * 💰 머니-크리티컬: 모든 적립/차감은 CAS(원자적 UPDATE … WHERE) 로만. 음수 잔액 불가.
 *    이 모듈을 wholesale-deposit.routes(어드민/유통사) + wholesale.routes(주문 차감/환불) 가 공유.
 *
 * 원장(txn) type: 'charge'(+입금확인) | 'order'(-주문) | 'refund'(+환불) | 'adjust'(±보정).
 *   amount 는 signed: +적립 / -차감. balance_after 는 적용 직후 잔액 스냅샷.
 */

const _depositEnsured = new WeakSet<object>()

/** 예치금 3 테이블 멱등 ensure (ensureCreditSchema 패턴). */
export async function ensureDepositSchema(DB: D1Database): Promise<void> {
  if (_depositEnsured.has(DB)) return
  _depositEnsured.add(DB)
  // 유통사별 잔액(seller_id PK — 1행/유통사).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_deposits (
    seller_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => { /* best-effort (cold isolate concurrent create) */ })
  // 거래 원장(감사 이력).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_deposit_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    ref_id TEXT,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => {})
  // 무통장입금 충전 요청(어드민 확인 대상).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_deposit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    depositor_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    confirmed_at TEXT
  )`).run().catch(() => {})
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_deposit_txns_seller ON wholesale_deposit_txns(seller_id, id DESC)').run().catch(() => {})
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_wholesale_deposit_requests_status ON wholesale_deposit_requests(status, id DESC)").run().catch(() => {})
  // 🔁 주문 멱등 — 같은 체크아웃 재시도(더블클릭/네트워크 retry)가 예치금 이중차감·이중주문 안 하도록.
  //   부분 UNIQUE: 동시 경쟁이면 2번째 INSERT 가 충돌 → 호출측 보상환불(자금 안전). 순차 재시도는 사전조회로 기존 주문 반환.
  await DB.prepare('ALTER TABLE wholesale_orders ADD COLUMN idempotency_key TEXT').run().catch(() => { /* 이미 있으면 무시 */ })
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_orders_idem ON wholesale_orders(distributor_seller_id, idempotency_key) WHERE idempotency_key IS NOT NULL').run().catch(() => {})
}

/** 현재 잔액(행 없으면 0). */
export async function loadDepositBalance(DB: D1Database, sellerId: number): Promise<number> {
  const row = await DB.prepare('SELECT balance FROM wholesale_deposits WHERE seller_id = ?')
    .bind(sellerId).first<{ balance: number }>().catch(() => null)
  return Math.max(0, Math.floor(Number(row?.balance) || 0))
}

/** 최근 거래내역(기본 20건, 최신순). */
export async function recentDepositTxns(DB: D1Database, sellerId: number, limit = 20): Promise<Array<{ type: string; amount: number; balance_after: number; memo: string | null; created_at: string }>> {
  const lim = Math.min(100, Math.max(1, Math.floor(limit)))
  const { results } = await DB.prepare(
    `SELECT type, amount, balance_after, memo, created_at FROM wholesale_deposit_txns
     WHERE seller_id = ? ORDER BY id DESC LIMIT ${lim}`
  ).bind(sellerId).all<{ type: string; amount: number; balance_after: number; memo: string | null; created_at: string }>().catch(() => ({ results: [] as Array<{ type: string; amount: number; balance_after: number; memo: string | null; created_at: string }> }))
  return results || []
}

/**
 * 💰 예치금 차감(주문 결제). 원자적 CAS: balance>=amount 일 때만 차감.
 *   성공 시 { ok:true, balanceAfter } · 부족 시 { ok:false, balance }(현재 잔액).
 *   ⚠️ 원장(txn 'order') 기록은 호출측이 order_id 확보 후 recordDepositTxn 으로 — ref_id 정합.
 */
export async function deductDeposit(DB: D1Database, sellerId: number, amount: number): Promise<{ ok: true; balanceAfter: number } | { ok: false; balance: number }> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) {
    const bal = await loadDepositBalance(DB, sellerId)
    return { ok: false, balance: bal }
  }
  // 행 보장(없으면 0) — 차감은 절대 행을 만들지 않음(아래 CAS 가 changes=0 → 부족 처리).
  await DB.prepare('INSERT OR IGNORE INTO wholesale_deposits (seller_id, balance) VALUES (?, 0)').bind(sellerId).run().catch(() => {})
  // CAS — balance >= amount 일 때만 차감(동시 주문이 잔액 동시 소진하는 것 차단).
  const up = await DB.prepare(
    "UPDATE wholesale_deposits SET balance = balance - ?, updated_at = datetime('now') WHERE seller_id = ? AND balance >= ?"
  ).bind(amt, sellerId, amt).run().catch(() => ({ meta: { changes: 0 } }))
  if ((up.meta?.changes ?? 0) === 0) {
    const bal = await loadDepositBalance(DB, sellerId)
    return { ok: false, balance: bal }
  }
  const balanceAfter = await loadDepositBalance(DB, sellerId)
  return { ok: true, balanceAfter }
}

/**
 * 💰 예치금 복원(환불·보상). 원자적 += amount. 행 보장 후 적립.
 *   성공 시 balanceAfter 반환. (음수 검증 불필요 — 적립이므로 항상 증가.)
 */
export async function refundDeposit(DB: D1Database, sellerId: number, amount: number): Promise<number> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) return loadDepositBalance(DB, sellerId)
  await DB.prepare('INSERT OR IGNORE INTO wholesale_deposits (seller_id, balance) VALUES (?, 0)').bind(sellerId).run().catch(() => {})
  await DB.prepare(
    "UPDATE wholesale_deposits SET balance = balance + ?, updated_at = datetime('now') WHERE seller_id = ?"
  ).bind(amt, sellerId).run().catch(() => {})
  return loadDepositBalance(DB, sellerId)
}

/** 원장 1줄 기록(best-effort — 잔액 정합은 wholesale_deposits 가 SSOT). */
export async function recordDepositTxn(
  DB: D1Database,
  sellerId: number,
  type: 'charge' | 'order' | 'refund' | 'adjust',
  amount: number,
  balanceAfter: number,
  refId: string | null,
  memo: string | null,
): Promise<void> {
  await DB.prepare(
    'INSERT INTO wholesale_deposit_txns (seller_id, type, amount, balance_after, ref_id, memo) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sellerId, type, Math.floor(amount), Math.floor(balanceAfter), refId, memo).run().catch(() => { /* best-effort */ })
}

/** 멱등 환불 가드 — 이 주문(order_id)에 이미 refund txn 이 있으면 true(이중복원 차단). */
export async function hasDepositRefundTxn(DB: D1Database, orderId: number): Promise<boolean> {
  const row = await DB.prepare(
    "SELECT 1 AS x FROM wholesale_deposit_txns WHERE type = 'refund' AND ref_id = ? LIMIT 1"
  ).bind(String(orderId)).first<{ x: number }>().catch(() => null)
  return !!row
}
