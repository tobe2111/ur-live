/**
 * 💸 **인플루언서·중개사 몫의 원장 역전** — 머니 룰 #2(적립-역전 대칭) (2026-10-10 감사)
 *
 * ## 무엇이 깨져 있었나
 * 이용권 주문에서 매장 몫을 떼어 남에게 주는 적립이 두 가지 있다. 둘 다 같은 모양이다:
 *
 * | 적립 | attribution | 원장 |
 * |---|---|---|
 * | 중개사 몫(`creditBrokerShare`) | `source='broker_share'` | `broker_share` : `seller:N` → `influencer:{uid}` |
 * | 인플루언서 추천(`group-buy.routes` · `helpers.ts`) | `source` 없음 | `influencer_commission` : `seller:N` → `influencer:{id}` |
 *
 * 환불·만료 때 `clawbackVoucherCommission` 이 **attribution 과 잔액은 회수**했지만 원장은 그대로 뒀다
 * (`reverseVoucherCommissionShares` 는 `voucher:N:agency`·`voucher:N:intro-inf` 만 본다). 그래서
 * `seller:N` 의 debit 이 남아 — 정산 집계가 `seller:N` 과 `merchant:N` 을 한 가게로 접으므로 —
 * **환불된 주문의 몫을 매장이 영구 부담**했다(다음 정산에서 그만큼 덜 받는다). 에러는 없다.
 *
 * ## 이 함수
 * attribution 회수와 **같은 금액(바우처 비례 몫)** 을 원장에서 되돌린다. 원본 엔트리의 debit/credit 을
 * 읽어 그대로 뒤집으므로 계정 이름이 바뀌어도 대칭이 유지된다(`reverseVoucherCommissionShares` 와 같은 설계).
 *
 * ## 멱등
 *   - 역전 참조 = `attr:{attributionId}:v{voucherId}:reversal` — 같은 바우처는 한 번만.
 *     `ledger_entries(reference_id) WHERE event_type='attribution_reversal'` 부분 UNIQUE 로 잠근다(머니 룰 #3).
 *   - 상한: 그 attribution 의 원본 금액 − 이미 되돌린 합. 몇 장을 무르든 원본보다 많이 되돌리지 않는다.
 *
 * ⚠️ 이미 **지급된**(paid) attribution 은 호출부가 회수하지 않으므로 여기도 오지 않는다 — 그 돈은 이미
 *   나갔고, 원장을 되돌리면 플랫폼이 대신 떠안는다. 회수 정책은 별건.
 * ⚠️ fail-soft — 역전 실패가 환불을 막지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ensureLedgerTable, recordLedger } from './ledger'

export const ATTRIBUTION_REVERSAL_EVENT = 'attribution_reversal'

export interface AttributionShareToReverse {
  attributionId: number
  influencerId: string
  /** `influencer_attributions.source` — 'broker_share' 면 중개사 몫, 비었으면 인플루언서 추천. */
  source: string | null
  /** 이번에 회수한 금액(바우처 비례 몫). */
  share: number
}

/** attribution source → 그 적립이 원장에 남긴 event_type. 모르는 source 는 역전하지 않는다. */
export function ledgerEventForAttributionSource(source: string | null | undefined): string | null {
  if (source === 'broker_share') return 'broker_share'
  if (source == null || source === '') return 'influencer_commission'
  return null
}

const _ensured = new WeakSet<object>()
async function ensureReversalIndex(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_attribution_reversal
       ON ledger_entries(reference_id) WHERE event_type = '${ATTRIBUTION_REVERSAL_EVENT}'`,
  ).run().catch(() => { /* 권한/레거시 — dup SELECT 가 두 번째 방어선 */ })
}

export async function reverseAttributionLedgerShares(
  DB: D1Database,
  p: { orderId: number | null; voucherId: number; reason: string; shares: AttributionShareToReverse[] },
): Promise<{ reversed: number }> {
  let reversed = 0
  try {
    const orderId = Number(p.orderId)
    if (!Number.isFinite(orderId) || orderId <= 0 || p.shares.length === 0) return { reversed }
    await ensureLedgerTable(DB)
    await ensureReversalIndex(DB)
    const ord = await DB.prepare('SELECT order_number FROM orders WHERE id = ?').bind(orderId)
      .first<{ order_number: string | null }>().catch(() => null)
    const orderNumber = ord?.order_number
    if (!orderNumber) return { reversed }

    for (const s of p.shares) {
      const event = ledgerEventForAttributionSource(s.source)
      const share = Math.floor(Number(s.share))
      if (!event || !(share > 0)) continue
      try {
        const src = await DB.prepare(
          `SELECT amount, debit_account, credit_account FROM ledger_entries
            WHERE reference_id = ? AND event_type = ? AND credit_account = ?
            ORDER BY id LIMIT 1`,
        ).bind(orderNumber, event, `influencer:${s.influencerId}`)
          .first<{ amount: number; debit_account: string; credit_account: string }>()
        if (!src || !(Number(src.amount) > 0)) continue
        const revRef = `attr:${s.attributionId}:v${p.voucherId}:reversal`
        const dup = await DB.prepare(
          `SELECT id FROM ledger_entries WHERE reference_id = ? AND event_type = '${ATTRIBUTION_REVERSAL_EVENT}' LIMIT 1`,
        ).bind(revRef).first().catch(() => null)
        if (dup) continue
        const done = await DB.prepare(
          `SELECT COALESCE(SUM(amount), 0) AS t FROM ledger_entries
            WHERE event_type = '${ATTRIBUTION_REVERSAL_EVENT}' AND reference_id LIKE ?`,
        ).bind(`attr:${s.attributionId}:v%`).first<{ t: number }>().catch(() => ({ t: 0 }))
        const amount = Math.min(share, Number(src.amount) - Number(done?.t ?? 0))
        if (!(amount > 0)) continue
        await recordLedger(DB, {
          event_type: ATTRIBUTION_REVERSAL_EVENT,
          reference_id: revRef,
          amount,
          debit_account: src.credit_account,  // 받았던 쪽에서 회수
          credit_account: src.debit_account,  // 냈던 매장으로 복원
          metadata: { kind: `${event}_reversal`, attribution_id: s.attributionId, voucher_id: p.voucherId, order_id: orderId, reason: p.reason },
        })
        reversed++
      } catch { /* fail-soft — 한 건 실패가 나머지를 막지 않는다 */ }
    }
  } catch { /* fail-soft */ }
  return { reversed }
}
