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

/**
 * 💰 멱등 보상환불 (미완료/실패 예치금 주문) — 신뢰 마커 = wholesale_orders.refunded_amount CAS.
 *   best-effort 인 refund 원장(txt)과 무관하게 '주문행 1회 환불'을 원자적으로 보장 → 동시/재시도/cron
 *   어디서 호출해도 이중환불 불가. 보상(주문 미완료)용이라 status='FAILED'. (관리자 사후환불=REFUNDED 은 별도 경로.)
 *   반환: true=이번 호출이 실제 환불 수행 / false=이미 환불됨(또는 PAID/REFUNDED, 금액부적합).
 */
export async function compensateDepositOrderOnce(
  DB: D1Database, orderId: number, sellerId: number, amount: number, memo: string,
): Promise<boolean> {
  const amt = Math.floor(amount)
  if (!Number.isFinite(amt) || amt <= 0) return false
  const cas = await DB.prepare(
    "UPDATE wholesale_orders SET refunded_amount = ?, status = 'FAILED', updated_at = datetime('now') WHERE id = ? AND COALESCE(refunded_amount,0) = 0 AND status NOT IN ('REFUNDED','PAID')"
  ).bind(amt, orderId).run().catch(() => ({ meta: { changes: 0 } }))
  if (((cas as { meta?: { changes?: number } }).meta?.changes ?? 0) === 0) return false
  const bal = await refundDeposit(DB, sellerId, amt)
  await recordDepositTxn(DB, sellerId, 'refund', amt, bal, String(orderId), memo)
  return true
}

/**
 * 💰 미완료 예치금 주문 reconcile(크래시 복구, cron) — 차감('order' txn)은 됐는데 PAID 도달 못 하고
 *   환불도 안 된 주문(PENDING/EXPIRED/FAILED, refunded_amount=0, 15분 경과)을 멱등 보상환불.
 *   윈도우: 차감 후 PAID 전환 직전 isolate 종료/CPU 한도 크래시 → 돈 묶임 → 자동 복구(미회수 0).
 */
export async function reconcileOrphanedDepositOrders(DB: D1Database): Promise<{ refunded: number; scanned: number }> {
  let refunded = 0
  const { results } = await DB.prepare(
    `SELECT o.id AS id, o.distributor_seller_id AS seller_id, o.subtotal AS subtotal
       FROM wholesale_orders o
      WHERE o.payment_key = 'deposit'
        AND o.status IN ('PENDING','EXPIRED','FAILED')
        AND COALESCE(o.refunded_amount,0) = 0
        AND o.created_at < datetime('now','-15 minutes')
        AND EXISTS (SELECT 1 FROM wholesale_deposit_txns t WHERE t.type = 'order' AND t.ref_id = CAST(o.id AS TEXT))
      LIMIT 100`
  ).all<{ id: number; seller_id: number; subtotal: number }>().catch(() => ({ results: [] as Array<{ id: number; seller_id: number; subtotal: number }> }))
  const rows = results || []
  for (const r of rows) {
    const ok = await compensateDepositOrderOnce(DB, r.id, r.seller_id, r.subtotal, `미완료 주문 자동 복구 환불 #${r.id}`).catch(() => false)
    if (ok) refunded++
  }
  return { refunded, scanned: rows.length }
}
