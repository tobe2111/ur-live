/**
 * 🛡️ 2026-05-15: Double-entry bookkeeping ledger.
 *
 * 각 financial event 는 debit/credit 짝으로 기록 → 정합성 검증 가능 (Σdebit == Σcredit).
 * point_transactions (단일 entry) 와 별개로 ledger_entries 테이블 유지.
 *
 * 사용:
 *   await recordLedger(DB, {
 *     event_type: 'group_buy_join',
 *     reference_id: orderNumber,
 *     amount: 50000,
 *     debit_account: `user:${userId}`,         // 유저 wallet 차감
 *     credit_account: `seller:${sellerId}`,    // 셀러 receivable 증가
 *     fee_amount: 2500,                         // 플랫폼 수수료
 *     fee_account: 'platform:commission',
 *   })
 *
 * 정합성 검증 (cron): SELECT account, SUM(debit) - SUM(credit) FROM ... GROUP BY account
 */

interface LedgerEntry {
  event_type: string  // group_buy_join | refund | charge | settlement | dispute_refund
  reference_id: string  // order_number / voucher_id / dispute_id
  amount: number
  debit_account: string
  credit_account: string
  fee_amount?: number
  fee_account?: string  // 'platform:commission' | 'platform:pg_fee'
  metadata?: Record<string, unknown>
}

let DDL_DONE = false

async function ensureLedgerTable(DB: D1Database): Promise<void> {
  if (_done_ensureLedgerTable) return
  _done_ensureLedgerTable = true
  if (DDL_DONE) return
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        amount INTEGER NOT NULL,         -- KRW (정수, 음수 X)
        debit_account TEXT NOT NULL,
        credit_account TEXT NOT NULL,
        fee_amount INTEGER DEFAULT 0,
        fee_account TEXT,
        metadata TEXT,                   -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(reference_id)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_event ON ledger_entries(event_type, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_debit ON ledger_entries(debit_account, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ledger_credit ON ledger_entries(credit_account, created_at DESC)`).run()
    DDL_DONE = true
  } catch { /* exists */ }
}

export async function recordLedger(DB: D1Database, entry: LedgerEntry): Promise<void> {
  await ensureLedgerTable(DB)
  if (!Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 100_000_000_000) {
    throw new Error('Invalid ledger amount')
  }
  if (!entry.debit_account || !entry.credit_account) {
    throw new Error('Missing accounts')
  }
  try {
    await DB.prepare(`
      INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount, fee_account, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.event_type,
      entry.reference_id,
      Math.round(entry.amount),
      entry.debit_account,
      entry.credit_account,
      Math.round(entry.fee_amount ?? 0),
      entry.fee_account || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ).run()
  } catch (err) {
    console.error('[ledger] record failed', err)
    // ledger 실패해도 본 트랜잭션은 진행 (audit-only, best-effort)
  }
}

/** 계정별 잔액 조회 (debit - credit 합) */
export async function getAccountBalance(DB: D1Database, account: string): Promise<number> {
  await ensureLedgerTable(DB)
  const row = await DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN debit_account = ? THEN amount ELSE 0 END), 0) AS debit_total,
      COALESCE(SUM(CASE WHEN credit_account = ? THEN amount ELSE 0 END), 0) AS credit_total
    FROM ledger_entries
    WHERE debit_account = ? OR credit_account = ?
  `).bind(account, account, account, account).first<{ debit_total: number; credit_total: number }>()
  return Number(row?.credit_total ?? 0) - Number(row?.debit_total ?? 0)
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureLedgerTable = false
