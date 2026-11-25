/**
 * 🚪 탈퇴할 때 받을 소개비를 포기 처리한다 (2026-11-25 대표 *"포기 동의 후 탈퇴로 해주고"*)
 *
 * 첫 판은 "받을 소개비가 있으면 탈퇴를 막는다" 였다. 현금 정산 기준(10만원)에 못 미치는 사람은 고객센터를 거쳐야만
 * 나갈 수 있어서, 대표가 **포기에 동의하면 탈퇴** 로 바꿨다. 화면이 금액을 보여 주고 동의를 받는다(`AccountDeleteWarningPage`).
 * 서버는 동의(`forfeit_commission: true`) 없이는 탈퇴시키지 않는다 — 모르고 잃는 일이 없게.
 *
 * 하는 일: 그 사람의 `influencer_balances`(대기 + 확정)를 0 으로 내리고, 내린 금액을 원장에 한 줄 적는다
 * (`influencer:{id}` → `platform:forfeited_commission`). **포기된 돈을 매장에 돌려줄지 유어딜이 가질지는 정하지 않았다** —
 * 그래서 수익 계정이 아니라 따로 모아 두는 계정에 적는다(대표 결정 사항).
 *
 * 순서: 탈퇴가 **끝난 뒤에** 부른다. 먼저 내렸다가 탈퇴가 실패하면 소개비만 잃는다.
 * 멱등: 행마다 "읽은 값 그대로일 때만" 내린다 — 두 번 불려도 원장에 두 번 적히지 않는다.
 */
import { recordLedger } from './ledger'

export const FORFEIT_ACCOUNT = 'platform:forfeited_commission'

export async function forfeitEarnedCommission(DB: D1Database, userIds: Array<string | number>): Promise<number> {
  const ids = [...new Set(userIds.map((v) => String(v)).filter(Boolean))].slice(0, 2)
  if (!ids.length) return 0
  const rows = (await DB.prepare(
    `SELECT influencer_id, COALESCE(pending_amount, 0) AS pending, COALESCE(available_amount, 0) AS available
       FROM influencer_balances WHERE influencer_id IN (${ids.map(() => '?').join(',')})`, // d1-bind-ok: 최대 2개
  ).bind(...ids).all<{ influencer_id: string; pending: number; available: number }>()).results || []
  let total = 0
  for (const r of rows) {
    const amount = Math.max(0, Math.floor(Number(r.pending) || 0)) + Math.max(0, Math.floor(Number(r.available) || 0))
    if (amount <= 0) continue
    const claim = await DB.prepare(
      `UPDATE influencer_balances SET pending_amount = 0, available_amount = 0, updated_at = datetime('now')
        WHERE influencer_id = ? AND COALESCE(pending_amount, 0) = ? AND COALESCE(available_amount, 0) = ?`,
    ).bind(r.influencer_id, r.pending, r.available).run()
    if ((claim.meta?.changes ?? 0) === 0) continue
    total += amount
    await recordLedger(DB, {
      event_type: 'commission_forfeit',
      reference_id: `account-delete-${r.influencer_id}`,
      amount,
      debit_account: `influencer:${r.influencer_id}`,
      credit_account: FORFEIT_ACCOUNT,
      metadata: { reason: 'account_deleted', pending: r.pending, available: r.available },
    }).catch(() => { /* 원장 실패가 탈퇴를 되돌리지는 않는다 — 잔액은 이미 0 이다 */ })
  }
  return total
}
