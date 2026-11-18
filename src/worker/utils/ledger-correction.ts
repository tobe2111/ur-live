/**
 * 🧾 **장부 조정** — 잘못 쌓인 원장 금액을 *기록이 남는 정식 경로*로 바로잡는다 (2026-11-18 대표 *"장부 조정 기능도 만들어줘"*).
 *
 * ## 왜 필요했나
 * 실측 두 건을 고칠 방법이 없었다:
 *   ① 매장 14 — 같은 구매가 두 번 적립(옛 `group_buy_join` 1,000원[순 950] + 새 흐름의 `voucher_used` 950원).
 *      지급 대기 #1 이 16,150원(정답 15,200원)으로 만들어졌다.
 *   ② 운영사 자기 거래의 중개사 몫 620원(`broker_share` seller:26 → influencer:3) — 받으면 안 되는 몫.
 * `payouts/:id/cancel` 은 취소분이 다음 생성 때 **그대로 되살아나** 못 고치고, 원장 SQL 직접 수정은 금지 규칙이다.
 *
 * ## 규칙
 *   - 원장은 **지우지 않는다** — 반대 방향 행을 하나 더 적는다(`event_type='admin_adjustment'`).
 *   - 멱등 = `reference_id = 'adj:{key}'` + 부분 UNIQUE + `INSERT OR IGNORE`(머니 룰 #3). 같은 키를 두 번 보내면 두 번째는 아무것도 안 한다.
 *   - 지급 대기 행과 함께 고칠 때는 **그 행을 먼저 선점**(CAS: `status='pending' AND amount >= ?`) → 원장 → 원장이 중복이면 되돌린다(머니 룰 #1).
 *   - 계정은 정해진 모양만(`seller:N` 등 + `platform:*`), 금액은 1~1,000,000원 정수, 사유 필수.
 *
 * ⚠️ 못 막는 것: 이미 **송금된**(sent) 돈은 이 경로로 돌려받지 못한다 — 원장만 바뀌고 돈은 이미 나갔다. 그 경우는 호출 전에 사람이 판단.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ensureLedgerTable } from './ledger'
import { ledgerAccountAliases, payoutRowLedgerAccount } from './payout-account'
import { reverseAttributionLedgerShares } from './attribution-ledger-reversal'

export const ADJUSTMENT_EVENT = 'admin_adjustment'
export const ADJUSTMENT_MAX = 1_000_000

const ACCOUNT_RE = /^(?:(?:seller|merchant|influencer|agency|user):\d+|platform:[a-z_]+)$/

export function isAdjustableAccount(a: unknown): a is string {
  return typeof a === 'string' && ACCOUNT_RE.test(a)
}

export interface AdjustmentInput {
  debitAccount: string
  creditAccount: string
  amount: number
  reason: string
  key: string
  adminId: number | string | null
  /** 함께 줄일 지급 대기 행 — 그 payee 가 debit 계정이어야 한다. */
  payoutId?: number | null
}

export type AdjustmentResult =
  | { ok: true; duplicate: boolean; payoutAmount?: number }
  | { ok: false; code: string; error: string }

export function validateAdjustment(p: Partial<AdjustmentInput>): { ok: true } | { ok: false; code: string; error: string } {
  if (!isAdjustableAccount(p.debitAccount) || !isAdjustableAccount(p.creditAccount)) return { ok: false, code: 'BAD_ACCOUNT', error: '계정 이름이 올바르지 않습니다' }
  if (p.debitAccount === p.creditAccount) return { ok: false, code: 'SAME_ACCOUNT', error: '같은 계정끼리는 조정할 수 없습니다' }
  if (!Number.isInteger(p.amount) || (p.amount as number) < 1 || (p.amount as number) > ADJUSTMENT_MAX) return { ok: false, code: 'BAD_AMOUNT', error: `금액은 1~${ADJUSTMENT_MAX.toLocaleString('ko-KR')}원 정수여야 합니다` }
  if (typeof p.reason !== 'string' || p.reason.trim().length < 4) return { ok: false, code: 'NO_REASON', error: '사유를 적어 주세요(4자 이상)' }
  if (typeof p.key !== 'string' || !/^[A-Za-z0-9_.:-]{3,80}$/.test(p.key)) return { ok: false, code: 'BAD_KEY', error: '조정 키는 영문·숫자 3~80자입니다' }
  return { ok: true }
}

const _idx = new WeakSet<object>()
async function ensureAdjustmentIndex(DB: D1Database): Promise<void> {
  if (_idx.has(DB)) return
  _idx.add(DB)
  await ensureLedgerTable(DB)
  await DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_admin_adjustment ON ledger_entries(reference_id) WHERE event_type = '${ADJUSTMENT_EVENT}'`,
  ).run()
}

export async function postLedgerAdjustment(DB: D1Database, p: AdjustmentInput): Promise<AdjustmentResult> {
  const v = validateAdjustment(p)
  if (!v.ok) return v
  await ensureAdjustmentIndex(DB)
  const ref = `adj:${p.key}`
  const prior = await DB.prepare(`SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = '${ADJUSTMENT_EVENT}'`)
    .bind(ref).first<{ id: number }>()
  if (prior) return { ok: true, duplicate: true }

  // ① 지급 대기 행 선점 — 그 행의 payee 가 돈을 내는 쪽(debit)이어야 한다.
  let claimed = false
  if (p.payoutId != null) {
    const row = await DB.prepare('SELECT payee_type, payee_id, amount, status FROM payouts WHERE id = ?')
      .bind(p.payoutId).first<{ payee_type: string; payee_id: string; amount: number; status: string }>()
    if (!row) return { ok: false, code: 'PAYOUT_NOT_FOUND', error: '지급 행이 없습니다' }
    if (row.status !== 'pending') return { ok: false, code: 'PAYOUT_NOT_PENDING', error: '지급 대기 상태가 아닙니다(승인·송금된 건은 이 경로로 못 줄입니다)' }
    const payeeAccount = payoutRowLedgerAccount(row.payee_type, row.payee_id)
    const debitKeys = payeeAccount ? ledgerAccountAliases(payeeAccount) : []
    if (!debitKeys.includes(p.debitAccount)) return { ok: false, code: 'PAYOUT_PAYEE_MISMATCH', error: '지급 대상과 차감 계정이 다릅니다' }
    const r = await DB.prepare(
      `UPDATE payouts SET amount = amount - ?, admin_memo = TRIM(COALESCE(admin_memo, '') || ' [장부 조정 ' || ? || ' −' || ? || '원]')
        WHERE id = ? AND status = 'pending' AND amount >= ?`,
    ).bind(p.amount, p.key, p.amount, p.payoutId, p.amount).run()
    if ((r.meta?.changes ?? 0) !== 1) return { ok: false, code: 'PAYOUT_CLAIM_FAILED', error: '지급 행이 바뀌었습니다. 새로고침 후 다시 시도해 주세요' }
    claimed = true
  }

  // ② 원장 — 지우지 않고 반대 방향 한 줄.
  const ins = await DB.prepare(
    `INSERT OR IGNORE INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount, fee_account, metadata)
     VALUES ('${ADJUSTMENT_EVENT}', ?, ?, ?, ?, 0, NULL, ?)`,
  ).bind(ref, p.amount, p.debitAccount, p.creditAccount, JSON.stringify({
    kind: 'admin_adjustment', reason: p.reason.trim().slice(0, 300), admin_id: p.adminId ?? null, payout_id: p.payoutId ?? null,
  })).run().then((r) => ({ changes: Number(r.meta?.changes ?? 0), failed: false }), (e) => {
    console.error('[ledger-correction] 원장 기록 실패', p.key, e)
    return { changes: 0, failed: true }
  })
  if (ins.changes !== 1) {
    if (claimed) {
      await DB.prepare(`UPDATE payouts SET amount = amount + ? WHERE id = ? AND status = 'pending'`).bind(p.amount, p.payoutId).run()
    }
    // 실패와 중복을 구분한다 — "이미 됐다" 로 읽히면 사람이 다시 시도하지 않는다.
    return ins.failed ? { ok: false, code: 'LEDGER_WRITE_FAILED', error: '원장 기록에 실패해 아무것도 바꾸지 않았습니다' } : { ok: true, duplicate: true }
  }
  if (claimed) {
    const after = await DB.prepare('SELECT amount FROM payouts WHERE id = ?').bind(p.payoutId).first<{ amount: number }>()
    return { ok: true, duplicate: false, payoutAmount: Number(after?.amount ?? 0) }
  }
  return { ok: true, duplicate: false }
}

/**
 * 🔙 **받으면 안 되는 몫(중개사 몫·인플루언서 추천) 취소** — 아직 지급 전(pending/available)인 것만.
 *   attribution 을 선점(`clawed_back`)한 뒤 잔액을 빼고, 원장은 기존 역전 함수(`reverseAttributionLedgerShares`)로 되돌린다.
 */
export async function cancelAttributionShare(
  DB: D1Database,
  p: { attributionId: number; reason: string },
): Promise<{ ok: true; amount: number; ledgerReversed: boolean } | { ok: false; code: string; error: string }> {
  if (!Number.isInteger(p.attributionId) || p.attributionId <= 0) return { ok: false, code: 'BAD_ID', error: '잘못된 ID' }
  if (typeof p.reason !== 'string' || p.reason.trim().length < 4) return { ok: false, code: 'NO_REASON', error: '사유를 적어 주세요(4자 이상)' }
  const a = await DB.prepare(
    `SELECT id, influencer_id, order_id, commission_amount, status, source FROM influencer_attributions WHERE id = ?`,
  ).bind(p.attributionId).first<{ id: number; influencer_id: string; order_id: number | null; commission_amount: number; status: string; source: string | null }>()
  if (!a) return { ok: false, code: 'NOT_FOUND', error: '없는 적립입니다' }
  if (a.status !== 'pending' && a.status !== 'available') return { ok: false, code: 'NOT_CANCELLABLE', error: '이미 지급됐거나 취소된 적립입니다' }
  const amount = Number(a.commission_amount) || 0
  const claim = await DB.prepare(
    `UPDATE influencer_attributions SET status = 'clawed_back', commission_amount = 0, clawback_reason = ?
      WHERE id = ? AND status = ? AND paid_at IS NULL`,
  ).bind(p.reason.trim().slice(0, 300), a.id, a.status).run()
  if ((claim.meta?.changes ?? 0) !== 1) return { ok: false, code: 'CLAIM_FAILED', error: '적립 상태가 바뀌었습니다. 다시 시도해 주세요' }
  const col = a.status === 'pending' ? 'pending_amount' : 'available_amount'
  await DB.prepare(`UPDATE influencer_balances SET ${col} = MAX(0, ${col} - ?), updated_at = datetime('now') WHERE influencer_id = ?`)
    .bind(amount, a.influencer_id).run()
  const rev = await reverseAttributionLedgerShares(DB, {
    orderId: a.order_id, voucherId: 0, reason: `관리자 취소: ${p.reason.trim().slice(0, 200)}`,
    shares: [{ attributionId: a.id, influencerId: a.influencer_id, source: a.source, share: amount }],
  })
  return { ok: true, amount, ledgerReversed: rev.reversed > 0 }
}
