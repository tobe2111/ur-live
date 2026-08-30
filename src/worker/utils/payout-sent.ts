/**
 * 💸 정산 송금 완료 처리 — 단건·일괄 공용 SSOT (2026-08-27)
 *
 * ## 왜 뽑았나
 * 대표 요청("어드민에서 정산을 최대한 간편하게")으로 **일괄 송금 완료**를 붙이는데, 단건
 * 핸들러(`PATCH /admin/payouts/:id/sent`)에는 2026-07-08 머니 감사로 들어간 가드 세 겹이 있다:
 *   ① 계좌 누락이면 차단(실제 이체가 불가능한 상태를 '송금됨'으로 만들지 않는다)
 *   ② 동일 수령자·기간이 이미 sent 면 차단(이중지급)
 *   ③ CAS 선점(동시 실행 시 단일 실행)
 *
 * 일괄 처리를 **따로 구현하면 이 가드가 갈린다.** 그리고 갈린 쪽이 조용히 이중지급을 만든다.
 * 그래서 판정과 전이를 여기 한 곳에 두고 **양쪽이 같은 함수를 부른다.**
 *
 * ⚠️ 이 함수는 **돈이 실제로 나갔다는 기록**을 남긴다. 은행 이체를 대신 수행하지 않는다 —
 *   운영자가 이체한 뒤 그 사실을 적는 것이다. 그래서 `transaction_id`(은행 거래번호)가 필수다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface PayoutRow {
  id: number
  status: string
  payee_type: string
  payee_id: string
  amount: number
  bank_name: string | null
  account_number: string | null
  account_holder?: string | null
  period_start: string | null
  period_end: string | null
}

export type SentFailCode =
  | 'NOT_FOUND' | 'ALREADY_PROCESSED' | 'PAYOUT_NO_ACCOUNT' | 'PAYOUT_ALREADY_SENT_PERIOD'

export interface SentResult {
  id: number
  ok: boolean
  code?: SentFailCode
  error?: string
  /** 성공 시 알림톡에 필요한 정보(호출부가 waitUntil 로 보낸다 — 여기선 보내지 않는다). */
  row?: PayoutRow
}

/**
 * 송금 완료 처리 1건. **가드 → CAS** 순서를 바꾸지 말 것 —
 * CAS 를 먼저 하면 계좌 없는 건이 잠깐 'sent' 가 됐다가 되돌려야 한다.
 */
export async function markPayoutSent(
  DB: D1Database,
  id: number,
  txId: string,
  adminMemo?: string | null,
): Promise<SentResult> {
  const row = await DB.prepare('SELECT * FROM payouts WHERE id = ?').bind(id)
    .first<PayoutRow>().catch(() => null)
  if (!row) return { id, ok: false, code: 'NOT_FOUND', error: '정산 건을 찾을 수 없습니다' }
  if (!['pending', 'approved'].includes(row.status)) {
    return { id, ok: false, code: 'ALREADY_PROCESSED', error: '이미 처리된 건입니다' }
  }

  // ① 계좌 누락 → 이체가 불가능한 상태다. '송금됨'으로 적으면 장부만 맞고 돈은 안 간다.
  if (!row.account_number) {
    return {
      id, ok: false, code: 'PAYOUT_NO_ACCOUNT',
      error: '수령자 계좌번호가 없어 송금 완료로 처리할 수 없습니다',
    }
  }

  // ② 같은 수령자·같은 기간이 이미 송금됐으면 중복이다(생성 UNIQUE 를 우회한 재생성 대비).
  if (row.period_start && row.period_end) {
    const dup = await DB.prepare(
      `SELECT id FROM payouts
        WHERE payee_type = ? AND payee_id = ? AND period_start = ? AND period_end = ?
          AND status = 'sent' AND id != ? LIMIT 1`,
    ).bind(row.payee_type, row.payee_id, row.period_start, row.period_end, id)
      .first<{ id: number }>().catch(() => null)
    if (dup) {
      return {
        id, ok: false, code: 'PAYOUT_ALREADY_SENT_PERIOD',
        error: '이 수령자·기간의 정산이 이미 송금 완료되었습니다',
      }
    }
  }

  // ③ CAS 선점 — 동시 실행이면 한 번만 통과한다(이중 알림톡·transaction_id 덮어쓰기 방지).
  const res = await DB.prepare(
    `UPDATE payouts SET status = 'sent', sent_at = datetime('now'), transaction_id = ?, admin_memo = ?
      WHERE id = ? AND status IN ('pending','approved')`,
  ).bind(txId, adminMemo || null, id).run()
  if ((res.meta?.changes ?? 0) === 0) {
    return { id, ok: false, code: 'ALREADY_PROCESSED', error: '이미 처리된 건입니다' }
  }
  return { id, ok: true, row }
}

/**
 * 은행 일괄이체 파일에 실을 수 있는 건인지 — 계좌 3종이 모두 있어야 한다.
 * 하나라도 비면 은행이 그 행을 거부하고, **파일 전체가 반려되는 은행도 있다.**
 */
export function isTransferable(row: Pick<PayoutRow, 'bank_name' | 'account_number' | 'account_holder'>): boolean {
  return !!(row.bank_name && row.account_number && row.account_holder)
}
