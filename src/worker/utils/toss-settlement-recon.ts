/**
 * 🔎 토스 입금 대사 — "토스가 실제로 정산해 준 돈" ↔ "우리 장부의 카드 결제" 를 매일 맞춘다 (2026-11-25 대표 *"응 모두 해줘"*)
 *
 * 매장에 보내는 돈의 원천은 토스가 우리 통장에 넣어 주는 돈이다. 종전엔 그 둘을 맞추는 곳이 없어,
 * 토스 정산에서 빠진 결제(취소·실패·누락)가 있어도 우리는 그 결제의 매장 몫을 그대로 지급했다.
 *
 * ## 무엇을 하나 (읽기 전용 — 돈을 옮기지 않는다)
 * 대상일 T(KST, 오늘 − 3일)에 승인된 결제를 두 쪽에서 모은다:
 *   - 토스: `GET /v1/settlements?startDate=T-1&endDate=오늘-1&dateType=soldDate` 에서 approvedAt 이 T 인 항목(취소분 포함 합산)
 *   - 우리: `orders` 중 `payment_key` 가 있고 결제일(paid_at, 없으면 created_at)이 T 인 주문 — 카드 몫 = total − deal_used
 * 그리고 세 가지를 찾는다:
 *   ① 우리엔 있는데 토스엔 없는 결제 — **가장 위험**(받지 못한 돈의 매장 몫을 줄 수 있다)
 *   ② 금액이 다른 결제(환불이 없는 건만 — 환불이 섞이면 시점 차이일 수 있어 '확인 필요' 로만)
 *   ③ 토스엔 있는데 주문표에 없는 결제(선물·광고 등 다른 표의 결제일 수 있다 — 정보용)
 * 결과는 `toss_settlement_recon`(대상일 UNIQUE)에 남고, ①·② 가 있으면 어드민 알림.
 *
 * ⚠️ 결제 승인·취소 SSOT(`toss-gateway.ts`, 잠금)는 건드리지 않는다 — 이건 조회 API 하나다.
 * ⚠️ 키(`TOSS_SECRET_KEY`)가 없으면 아무것도 안 한다.
 */
import type { D1Database } from '@cloudflare/workers-types'

const KST_MS = 9 * 3600_000
const DAY_MS = 86_400_000
const ymd = (ms: number) => new Date(ms + KST_MS).toISOString().slice(0, 10)

export interface TossSettlementItem { paymentKey?: string; orderId?: string; amount?: number; payOutAmount?: number; approvedAt?: string; fees?: Array<{ fee?: number }> }
export interface OurPayment { paymentKey: string; orderNumber: string; expected: number; refunded: number }
export interface ReconResult {
  day: string
  tossCount: number; ourCount: number
  tossAmount: number; payOut: number; fee: number
  missingInToss: Array<{ orderNumber: string; expected: number }>
  mismatched: Array<{ orderNumber: string; expected: number; toss: number }>
  needsCheck: Array<{ orderNumber: string; expected: number; toss: number; refunded: number }>
  unmatchedToss: Array<{ orderId: string; amount: number }>
}

/** 순수 — 대상일(오늘 − 3일, KST)과 토스 조회 범위. */
export function reconWindow(nowMs: number): { day: string; start: string; end: string } {
  return { day: ymd(nowMs - 3 * DAY_MS), start: ymd(nowMs - 4 * DAY_MS), end: ymd(nowMs - DAY_MS) }
}

/** 순수 — 두 쪽을 맞춘다. 토스 항목은 approvedAt 이 대상일인 것만(같은 결제의 취소분은 합산). */
export function reconcile(day: string, toss: TossSettlementItem[], ours: OurPayment[]): ReconResult {
  const byKey = new Map<string, { amount: number; orderId: string }>()
  let tossAmount = 0, payOut = 0, fee = 0
  for (const t of toss) {
    const approved = String(t.approvedAt || '').slice(0, 10)
    if (approved !== day || !t.paymentKey) continue
    const cur = byKey.get(t.paymentKey) ?? { amount: 0, orderId: String(t.orderId || '') }
    cur.amount += Number(t.amount) || 0
    byKey.set(t.paymentKey, cur)
    tossAmount += Number(t.amount) || 0
    payOut += Number(t.payOutAmount) || 0
    fee += (t.fees || []).reduce((s, f) => s + (Number(f.fee) || 0), 0)
  }
  const r: ReconResult = { day, tossCount: byKey.size, ourCount: ours.length, tossAmount, payOut, fee, missingInToss: [], mismatched: [], needsCheck: [], unmatchedToss: [] }
  const seen = new Set<string>()
  for (const o of ours) {
    const t = byKey.get(o.paymentKey)
    if (!t) { if (o.expected - o.refunded > 0) r.missingInToss.push({ orderNumber: o.orderNumber, expected: o.expected }); continue }
    seen.add(o.paymentKey)
    if (t.amount === o.expected) continue
    if (o.refunded > 0) r.needsCheck.push({ orderNumber: o.orderNumber, expected: o.expected, toss: t.amount, refunded: o.refunded })
    else r.mismatched.push({ orderNumber: o.orderNumber, expected: o.expected, toss: t.amount })
  }
  for (const [k, t] of byKey) if (!seen.has(k)) r.unmatchedToss.push({ orderId: t.orderId, amount: t.amount })
  return r
}

/** 토스 정산 조회(읽기). 실패하면 던진다 — 대사 자체를 못 한 날은 '문제 없음' 으로 기록하지 않는다. */
export async function fetchTossSettlements(secretKey: string, start: string, end: string, fetchImpl: typeof fetch = fetch): Promise<TossSettlementItem[]> {
  const out: TossSettlementItem[] = []
  for (let page = 1; page <= 20; page++) {
    const url = `https://api.tosspayments.com/v1/settlements?startDate=${start}&endDate=${end}&dateType=soldDate&page=${page}&size=5000`
    const res = await fetchImpl(url, { headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` }, signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`toss settlements HTTP ${res.status}`)
    const rows = (await res.json()) as TossSettlementItem[]
    if (!Array.isArray(rows)) throw new Error('toss settlements: unexpected body')
    out.push(...rows)
    if (rows.length < 5000) break
  }
  return out
}

async function loadOurPayments(DB: D1Database, day: string): Promise<OurPayment[]> {
  const { results } = await DB.prepare(`
    SELECT COALESCE(NULLIF(payment_key, ''), toss_payment_key) AS pk, order_number,
           COALESCE(total_amount, 0) - COALESCE(deal_used, 0) AS expected, COALESCE(refunded_amount, 0) AS refunded
      FROM orders
     WHERE COALESCE(NULLIF(payment_key, ''), toss_payment_key) IS NOT NULL
       AND status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'FAILED')
       AND strftime('%Y-%m-%d', datetime(COALESCE(paid_at, created_at), '+9 hours')) = ?`,
  ).bind(day).all<{ pk: string; order_number: string; expected: number; refunded: number }>()
  return (results || []).map((r) => ({ paymentKey: r.pk, orderNumber: r.order_number, expected: Math.round(Number(r.expected) || 0), refunded: Math.round(Number(r.refunded) || 0) }))
}

/** 매일 — 대상일 대사를 한 번 하고 기록·알림. 같은 날 두 번은 안 한다(UNIQUE). */
export async function runTossSettlementRecon(DB: D1Database, secretKey: string | undefined, nowMs: number = Date.now(), fetchImpl?: typeof fetch): Promise<{ skipped?: string; result?: ReconResult }> {
  if (!secretKey) return { skipped: 'no_key' }
  await DB.prepare(`CREATE TABLE IF NOT EXISTS toss_settlement_recon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    issues INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_settlement_recon_day ON toss_settlement_recon(day)').run()
  const w = reconWindow(nowMs)
  const done = await DB.prepare('SELECT 1 FROM toss_settlement_recon WHERE day = ? LIMIT 1').bind(w.day).first().catch(() => null)
  if (done) return { skipped: 'already_done' }
  const [toss, ours] = await Promise.all([fetchTossSettlements(secretKey, w.start, w.end, fetchImpl), loadOurPayments(DB, w.day)])
  const result = reconcile(w.day, toss, ours)
  const issues = result.missingInToss.length + result.mismatched.length
  const ins = await DB.prepare('INSERT OR IGNORE INTO toss_settlement_recon (day, issues, payload) VALUES (?, ?, ?)')
    .bind(w.day, issues, JSON.stringify(result)).run()
  if (ins.meta?.changes && issues > 0) {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    const parts = [
      result.missingInToss.length ? `토스 정산에 없는 결제 ${result.missingInToss.length}건(${result.missingInToss.slice(0, 3).map((m) => m.orderNumber).join(', ')})` : '',
      result.mismatched.length ? `금액이 다른 결제 ${result.mismatched.length}건` : '',
    ].filter(Boolean)
    await createDashboardNotification(DB, 'admin', null, 'toss_settlement_mismatch', `⚠️ ${w.day} 토스 입금 대사 불일치`,
      `${parts.join(' · ')} — 해당 매장 정산 승인 전에 토스 상점관리자에서 확인하세요.`, '/admin/payouts?tab=annual').catch(() => undefined)
  }
  return { result }
}
