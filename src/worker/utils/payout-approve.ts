/**
 * ✅ 정산 지급 승인 — 단건 승인과 자동 승인이 같은 문을 지난다 (2026-11-25)
 *
 * 대표 2026-11-25 *"알고보니 지급대행 필수가 아니었어 … 최대한 자동화하자 지급대행 안쓰는 선에서"*.
 * 결재 `docs/decisions/2026-11-03-settlement-structure.md` (2026-11-25 갱신).
 *
 * ## 가드 (순서를 바꾸지 말 것 — 단건 승인 라우트가 쓰던 순서 그대로)
 *   ① pending 만 · ② 계좌 없으면 지금 계좌로 채우고 그래도 없으면 막는다 · ③ 계좌 변경 후 미재확인/생성 뒤 바뀐 계좌면 막는다
 *   ④ 받을 돈(원장)을 넘으면 막는다 · ⑤ CAS(pending → approved) — 동시 실행에도 한 번.
 *
 * ## 자동 승인 (`autoApproveSmallPayouts`) — 기본 꺼짐
 *   `platform_settings.payout_auto_approve_max_krw` 가 0(기본)이면 아무것도 안 한다. 값을 넣으면 그 금액 **이하**의
 *   pending 건만 위 가드를 그대로 지나 승인된다. 손바뀜 마감(`handover_closeout`)은 사람만 — 옛 주인 계좌로 가는 특수 건이다.
 *   ⚠️ 승인 ≠ 송금. 돈은 여전히 어드민이 은행 이체 파일로 보낸다(지급대행을 쓰지 않으므로). 자동 승인이 없애는 것은
 *      매주 "승인" 클릭뿐이고, 막힌 건(계좌·과다지급)은 사람 칸에 그대로 남는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { checkPayeeAccountCurrent, checkPayoutWithinReceivable, fillMissingPayoutAccount } from './payout-sent'

export const PAYOUT_AUTO_APPROVE_KEY = 'payout_auto_approve_max_krw'

export type ApproveResult =
  | { ok: true }
  | { ok: false; code: string; error: string; status: number; data?: unknown }

interface Row { id: number; status: string; payee_type: string; payee_id: string; amount: number; account_number: string | null; kind: string | null }

/** 정산 지급 1건 승인 — 가드 → CAS. 단건 승인 라우트와 자동 승인이 같이 쓴다. */
export async function approvePayoutGuarded(DB: D1Database, id: number): Promise<ApproveResult> {
  const row = await DB.prepare('SELECT id, status, payee_type, payee_id, amount, account_number, kind FROM payouts WHERE id = ?')
    .bind(id).first<Row>()
  if (!row) return { ok: false, code: 'NOT_FOUND', error: 'Not found', status: 404 }
  if (row.status !== 'pending') return { ok: false, code: 'NOT_PENDING', error: 'Not pending', status: 409 }

  // 계좌 없이 만들어진 건은 지금 계좌로 채우고, 그래도 없으면 승인하지 않는다(승인해도 송금 기록이 막힌다).
  await fillMissingPayoutAccount(DB, row)
  const acctNow = await DB.prepare('SELECT account_number FROM payouts WHERE id = ?').bind(id).first<{ account_number: string | null }>()
  if (!acctNow?.account_number) {
    return { ok: false, code: 'PAYOUT_NO_ACCOUNT', error: '수령자 정산 계좌가 아직 없습니다. 매장이 계좌를 등록하면 승인할 수 있습니다', status: 409 }
  }
  row.account_number = acctNow.account_number
  // 계좌 변경 후 미재확인 · 생성 이후 계좌가 바뀐 건은 승인하지 않는다(송금과 같은 SSOT).
  const acctCheck = await checkPayeeAccountCurrent(DB, row)
  if (!acctCheck.ok) return { ok: false, code: acctCheck.code, error: acctCheck.error, status: 409 }
  // 과다지급 방지 — 받을 돈을 넘으면 막는다.
  const within = await checkPayoutWithinReceivable(DB, row)
  if (!within.ok) {
    return { ok: false, code: within.code, error: within.error, data: within.data, status: within.code === 'RECEIVABLE_CHECK_FAILED' ? 503 : 409 }
  }
  // CAS 선점(머니 룰 #1).
  const res = await DB.prepare(
    `UPDATE payouts SET status = 'approved', approved_at = datetime('now') WHERE id = ? AND status = 'pending'`,
  ).bind(id).run()
  if ((res.meta?.changes ?? 0) === 0) return { ok: false, code: 'NOT_PENDING', error: 'Not pending', status: 409 }
  return { ok: true }
}

/** 설정값 → 자동 승인 상한(원). 비었거나 0·음수·이상값이면 0(꺼짐). 순수. */
export function resolveAutoApproveMax(raw: unknown): number {
  const n = Math.floor(Number(String(raw ?? '').trim() || '0'))
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return 0
  return n
}

/**
 * 소액 자동 승인 — 상한 이하 pending 건을 가드 그대로 승인한다. 꺼져 있으면 즉시 반환.
 * 반환: 승인 건수·합계, 막힌 건수(사람이 볼 것).
 */
export async function autoApproveSmallPayouts(DB: D1Database): Promise<{ max: number; approved: number; total: number; blocked: number }> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
    .bind(PAYOUT_AUTO_APPROVE_KEY).first<{ value: string }>().catch(() => null)
  const max = resolveAutoApproveMax(row?.value)
  if (max <= 0) return { max: 0, approved: 0, total: 0, blocked: 0 }
  const { results } = await DB.prepare(
    `SELECT id, amount FROM payouts
      WHERE status = 'pending' AND amount > 0 AND amount <= ? AND COALESCE(kind, '') != 'handover_closeout'
      ORDER BY id LIMIT 200`,
  ).bind(max).all<{ id: number; amount: number }>()
  let approved = 0
  let total = 0
  let blocked = 0
  for (const r of results || []) {
    const res = await approvePayoutGuarded(DB, Number(r.id)).catch(() => ({ ok: false } as ApproveResult))
    if (res.ok) { approved++; total += Number(r.amount) || 0 } else blocked++
  }
  return { max, approved, total, blocked }
}
