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
  if (_done_ensureLedgerTable.has(DB)) return
  _done_ensureLedgerTable.add(DB)
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

/** 계정별 잔액 조회 (credit - debit 합) — credit 양수, debit 음수 의미. */
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

/**
 * 🛡️ 2026-05-21 Phase C: voucher 사용 완료 시점 정산 entries 자동 생성.
 *
 * 호출 시점: voucher.status='used' 로 atomic UPDATE 성공 직후.
 * 결과: ledger_entries 에 3개 row INSERT
 *   1) escrow → merchant_payable (업체 외상)
 *   2) escrow → seller_commission (셀러 외상)
 *   3) escrow → platform_fee (플랫폼 수익 확정)
 *
 * 멱등: voucher_id 중복 호출 시 entry 중복 방지 (reference_id + event_type unique check).
 * 영구성: 환불 시 reverse entry 생성 (recordRefundLedger).
 */
export async function recordVoucherUsedLedger(
  DB: D1Database,
  params: {
    voucher_id: number | string
    order_amount: number          // 사용자 결제 총액
    merchant_id: number | string  // store_owner seller_id
    seller_id?: number | string | null // 인플루언서 (위탁 판매 시)
    platform_rate?: number        // 0.05 default (5%)
    seller_rate?: number          // 0.10 default (10%) — seller_id 있을 때만
  },
): Promise<{ merchant_amount: number; seller_amount: number; platform_amount: number }> {
  await ensureLedgerTable(DB)
  const platformRate = params.platform_rate ?? 0.05
  const sellerRate = params.seller_id ? (params.seller_rate ?? 0.10) : 0
  const merchantRate = 1 - platformRate - sellerRate
  const platformAmount = Math.floor(params.order_amount * platformRate)
  const sellerAmount = Math.floor(params.order_amount * sellerRate)
  const merchantAmount = params.order_amount - platformAmount - sellerAmount
  const ref = `voucher:${params.voucher_id}`

  // 멱등 — 이미 처리한 voucher 면 skip
  const existing = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = 'voucher_used' LIMIT 1`,
  ).bind(ref).first().catch(() => null)
  if (existing) {
    return { merchant_amount: merchantAmount, seller_amount: sellerAmount, platform_amount: platformAmount }
  }

  // 1) 업체 receivable
  await recordLedger(DB, {
    event_type: 'voucher_used',
    reference_id: ref,
    amount: merchantAmount,
    debit_account: 'platform:escrow',
    credit_account: `merchant:${params.merchant_id}`,
    metadata: { kind: 'merchant_payable', voucher_id: params.voucher_id },
  })
  // 2) 셀러 commission (위탁 판매 시만)
  if (params.seller_id && sellerAmount > 0) {
    await recordLedger(DB, {
      event_type: 'voucher_used',
      reference_id: ref,
      amount: sellerAmount,
      debit_account: 'platform:escrow',
      credit_account: `seller:${params.seller_id}`,
      metadata: { kind: 'seller_commission', voucher_id: params.voucher_id },
    })
  }
  // 3) 플랫폼 fee (수익 인식)
  await recordLedger(DB, {
    event_type: 'voucher_used',
    reference_id: ref,
    amount: platformAmount,
    debit_account: 'platform:escrow',
    credit_account: 'platform:revenue',
    metadata: { kind: 'platform_fee', voucher_id: params.voucher_id },
  })

  return { merchant_amount: merchantAmount, seller_amount: sellerAmount, platform_amount: platformAmount }
}

/**
 * 환불 시 reverse entries (멱등 보장).
 */
export async function recordRefundLedger(
  DB: D1Database,
  params: {
    voucher_id: number | string
    reason: string
    amount: number
  },
): Promise<void> {
  await ensureLedgerTable(DB)
  const ref = `voucher:${params.voucher_id}:refund`
  const existing = await DB.prepare(
    `SELECT id FROM ledger_entries WHERE reference_id = ? LIMIT 1`,
  ).bind(ref).first().catch(() => null)
  if (existing) return
  await recordLedger(DB, {
    event_type: 'voucher_refund',
    reference_id: ref,
    amount: params.amount,
    debit_account: 'platform:revenue', // 모든 분배 취소 (단순화 — admin 이 세분화 가능)
    credit_account: 'platform:escrow',
    metadata: { reason: params.reason, voucher_id: params.voucher_id },
  })
}

/** 정산 가능 잔액 (특정 payee 의 credit 합 - 이미 payout 처리된 amount 합) */
export async function getPayablePending(
  DB: D1Database,
  payeeAccount: string,
): Promise<number> {
  await ensureLedgerTable(DB)
  const credit = await DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE credit_account = ?`,
  ).bind(payeeAccount).first<{ total: number }>().catch(() => ({ total: 0 }))
  const paid = await DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payouts
      WHERE (payee_type || ':' || payee_id) = ? AND status IN ('approved','sent')`,
  ).bind(payeeAccount).first<{ total: number }>().catch(() => ({ total: 0 }))
  return Number(credit?.total ?? 0) - Number(paid?.total ?? 0)
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureLedgerTable = new WeakSet<object>()
