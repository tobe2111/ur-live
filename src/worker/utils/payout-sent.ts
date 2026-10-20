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
import { canonicalPaidPayee } from './payout-account'
import { resolvePayeeAccount } from './payout-payee-account'

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
  /** 'handover_closeout' 이면 손바뀜 마감 — 옛 주인 계좌 스냅샷이 의도다. */
  kind?: string | null
}

export type SentFailCode =
  | 'NOT_FOUND' | 'ALREADY_PROCESSED' | 'PAYOUT_NO_ACCOUNT' | 'PAYOUT_ALREADY_SENT_PERIOD'
  | AccountCheckCode

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

  // ①-b 계좌 변경 후 미재확인 · 생성 이후 계좌가 바뀐 스냅샷 → 그 계좌로 보내면 안 된다(아래 함수 머리말).
  const acct = await checkPayeeAccountCurrent(DB, row)
  if (!acct.ok) return { id, ok: false, code: acct.code, error: acct.error }

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

export type AccountCheckCode = 'PAYOUT_ACCOUNT_UNVERIFIED' | 'PAYOUT_ACCOUNT_STALE'

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/**
 * 🔐 **지금 이 payout 의 계좌로 돈을 보내도 되는가** (2026-10-10 감사 — 승인·송금·이체파일 공용).
 *
 * 셀러가 정산 계좌를 바꾸면 `seller-profile.routes` 가 `sellers.is_verified=0` 으로 내리고, 어드민이
 * `POST /sellers/:id/verify-account` 로 육안 대조 후 1 로 되돌린다. 그 게이트를 **출금 신청**만 읽고
 * 주간 정산(payouts)의 승인·송금은 안 읽었다 ⇒ 세션·메일을 탈취해 계좌를 바꾸면 다음 주 정산이
 * 그 계좌로 그대로 나간다(계좌 변경 알림이 가도 막는 장치가 없었다).
 *
 * 두 가지를 막는다 — 둘 다 **셀러(매장) payee 만**:
 *   - `PAYOUT_ACCOUNT_UNVERIFIED` — 지금 계좌가 재확인 전이다.
 *   - `PAYOUT_ACCOUNT_STALE` — payout 이 만들어진 **뒤** 계좌가 바뀌었다. 행에 박힌 번호는 옛 계좌다.
 *     🩸 이게 없으면: 탈취자가 계좌를 바꾼 직후 cron 이 그 계좌를 스냅샷 → 사장님이 원래 계좌로 되돌림 →
 *     어드민이 (되돌린) 계좌를 재확인 → 그런데 행에는 **탈취자 계좌**가 박혀 있다. 재확인이 통과시킨다.
 *     처리: 이 건을 취소하면 다음 생성(주간 cron·수동 생성)이 지금 계좌로 다시 만든다(외상은 원장에 그대로).
 *
 * ⚠️ 손바뀜 마감(`kind='handover_closeout'`)은 제외 — **옛 주인 계좌로 보내는 것이 그 행의 목적**이다.
 * ⚠️ 막기만 한다. 생성은 막지 않는다 — 받을 돈은 실재한다(`payouts-generate`).
 */
export async function checkPayeeAccountCurrent(
  DB: D1Database,
  row: Pick<PayoutRow, 'payee_type' | 'payee_id' | 'account_number' | 'kind'>,
): Promise<{ ok: true } | { ok: false; code: AccountCheckCode; error: string }> {
  if (row.kind === 'handover_closeout') return { ok: true }
  const payee = canonicalPaidPayee(row.payee_type, row.payee_id)
  if (!payee || payee.kind !== 'seller') return { ok: true }
  const acct = await resolvePayeeAccount(DB, payee)
  if (!acct.accountVerified) {
    return {
      ok: false, code: 'PAYOUT_ACCOUNT_UNVERIFIED',
      error: '셀러가 정산 계좌를 바꾼 뒤 아직 관리자 재확인 전입니다. 셀러 관리에서 계좌를 대조·재검증한 뒤 진행하세요',
    }
  }
  if (acct.accountNumber && row.account_number && digits(acct.accountNumber) !== digits(row.account_number)) {
    return {
      ok: false, code: 'PAYOUT_ACCOUNT_STALE',
      error: '이 정산을 만든 뒤 셀러 계좌가 바뀌었습니다(행에는 옛 계좌가 있습니다). 이 건을 취소하면 다음 생성 때 지금 계좌로 다시 만들어집니다',
    }
  }
  return { ok: true }
}
