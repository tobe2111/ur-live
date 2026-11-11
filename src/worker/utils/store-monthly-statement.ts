/**
 * 🧾 매장 월간 명세서 — 소개비 · 중개사 몫 · 에이전시 몫 (2026-11-03 대표 *"4번도 해"*)
 *
 * 결재 `docs/decisions/2026-11-03-settlement-structure.md`. 매월 정산일(기본 10일, KST)에
 * **지난달(KST 1일~말일)** 동안 이 매장 몫에서 나간 돈을 매장에 한 장으로 알린다.
 *
 * ## 두 종류를 구분해서 적는다 (돈이 누구 손으로 나가는지가 다르다)
 *   - **유어딜이 정산금에서 떼어 대신 보낸 것** — 인플루언서 소개비(매장이 정한 딜 %)·중개사 몫,
 *     게이트가 켜진 경우의 에이전시 몫. 매장은 이미 그만큼 덜 받았다 → "확인만 하세요".
 *   - **매장이 직접 보내야 하는 것** — 유어딜 지급(`agency_share_payout_enabled`)이 꺼져 있을 때의
 *     에이전시 몫. 유어딜은 돈을 만지지 않고 금액만 계산해 준다 → "직접 보내 주세요".
 *   유어딜 자기 돈인 **영입 커미션(`store_intro`)은 매장 몫이 아니므로 싣지 않는다.**
 *
 * ## 멱등
 * `store_monthly_statements(seller_id, period)` UNIQUE + `INSERT OR IGNORE` — 같은 달에 두 번 보내지 않는다.
 * 이 표가 곧 "보낸 명세서" 기록이라 나중에 화면에서 다시 볼 수 있다(payload JSON).
 *
 * ⚠️ 이 파일은 **돈을 옮기지 않는다** — 읽어서 알리기만 한다(머니 경로 아님).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { isAgencySharePayoutEnabled } from './agency-share-payout'

const KST_MS = 9 * 60 * 60 * 1000
const sqlTs = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

export interface MonthRange { period: string; label: string; start: string; end: string }

/** 지난달(KST) — start 이상 end 미만(UTC, D1 `datetime('now')` 와 같은 모양). 순수. */
export function previousKstMonth(nowMs: number): MonthRange {
  const k = new Date(nowMs + KST_MS)
  const y = k.getUTCFullYear()
  const m = k.getUTCMonth() // 이번 달(0-base)
  const startMs = Date.UTC(y, m - 1, 1) - KST_MS
  const endMs = Date.UTC(y, m, 1) - KST_MS
  const p = new Date(Date.UTC(y, m - 1, 1))
  return {
    period: `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, '0')}`,
    label: `${p.getUTCFullYear()}년 ${p.getUTCMonth() + 1}월`,
    start: sqlTs(startMs),
    end: sqlTs(endMs),
  }
}

export interface StatementLine { kind: 'referral' | 'broker' | 'agency'; name: string; amount: number; pct?: number | null }
export interface StoreStatement {
  sellerId: number
  period: string
  label: string
  /** 유어딜이 정산금에서 떼어 이미 보낸(보낼) 것 */
  paidByUrdeal: StatementLine[]
  /** 매장이 직접 보내야 하는 것 */
  payByStore: StatementLine[]
}

/** 순수 — 알림 한 장의 문장. 빈 명세서면 null(보내지 않는다). */
export function statementMessage(s: StoreStatement): { title: string; message: string } | null {
  const sum = (ls: StatementLine[]) => ls.reduce((a, l) => a + l.amount, 0)
  const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
  const line = (l: StatementLine) => `${l.name} ${won(l.amount)}${l.pct != null ? `(${l.pct}%)` : ''}`
  const parts: string[] = []
  if (s.payByStore.length) parts.push(`직접 보내 주세요: ${s.payByStore.map(line).join(', ')} · 합계 ${won(sum(s.payByStore))}`)
  if (s.paidByUrdeal.length) parts.push(`정산금에서 빠진 금액(유어딜이 대신 지급): ${s.paidByUrdeal.map(line).join(', ')} · 합계 ${won(sum(s.paidByUrdeal))}`)
  if (!parts.length) return null
  return { title: `🧾 ${s.label} 소개비·에이전시 수수료 명세서`, message: parts.join(' / ') }
}

const _ensured = new WeakSet<object>()
async function ensureStatementTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS store_monthly_statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_store_monthly_statements_seller_period ON store_monthly_statements(seller_id, period)').run()
  _ensured.add(DB)
}

/** 한 매장의 지난달 명세서(읽기만). */
export async function buildStoreStatement(DB: D1Database, sellerId: number, range: MonthRange, agencyGateOn: boolean): Promise<StoreStatement> {
  const out: StoreStatement = { sellerId, period: range.period, label: range.label, paidByUrdeal: [], payByStore: [] }

  // ① 소개비·중개사 몫 — 매장 몫에서 떼어 유어딜이 지급하는 레일. 영입 커미션(유어딜 돈)은 제외.
  const att = await DB.prepare(
    `SELECT a.influencer_id AS uid, COALESCE(a.source, '') AS source, SUM(a.commission_amount) AS amt,
            (SELECT COALESCE(u.name, u.handle) FROM users u WHERE CAST(u.id AS TEXT) = a.influencer_id) AS name
       FROM influencer_attributions a
      WHERE a.seller_id = ? AND a.status != 'clawed_back' AND COALESCE(a.source, '') != 'store_intro'
        AND a.created_at >= ? AND a.created_at < ?
      GROUP BY a.influencer_id, COALESCE(a.source, '')`,
  ).bind(sellerId, range.start, range.end).all<{ uid: string; source: string; amt: number; name: string | null }>()
    .catch(() => ({ results: [] as { uid: string; source: string; amt: number; name: string | null }[] }))
  for (const r of att.results || []) {
    const amount = Math.round(Number(r.amt) || 0)
    if (amount <= 0) continue
    const broker = r.source === 'broker_share'
    out.paidByUrdeal.push({ kind: broker ? 'broker' : 'referral', name: `${broker ? '중개사' : '소개'} ${r.name || `#${r.uid}`}`, amount })
  }

  // ② 에이전시 몫 — 맡은 기간 안의 판매 × 그 판매 시각의 %(성과표와 같은 문장). 환불분은 0.
  const ag = await DB.prepare(
    `SELECT pr.agency_id AS agency_id, a.name AS name,
            SUM(CASE WHEN v.status = 'refunded' THEN 0 ELSE COALESCE(v.applied_price, p.price, 0) *
                COALESCE((SELECT t.pct FROM agency_share_terms t WHERE t.seller_id = p.seller_id AND t.agency_id = pr.agency_id
                            AND t.effective_from <= o.created_at ORDER BY t.effective_from DESC, t.id DESC LIMIT 1), 0) END) / 100.0 AS amt,
            (SELECT t.pct FROM agency_share_terms t WHERE t.seller_id = p.seller_id AND t.agency_id = pr.agency_id
              ORDER BY t.effective_from DESC, t.id DESC LIMIT 1) AS pct
       FROM vouchers v JOIN orders o ON o.id = v.order_id JOIN products p ON p.id = v.product_id
       JOIN agency_product_periods pr ON pr.product_id = v.product_id AND pr.seller_id = p.seller_id
            AND o.created_at >= pr.started_at AND (pr.ended_at IS NULL OR o.created_at < pr.ended_at)
       LEFT JOIN agency_accounts a ON a.id = pr.agency_id
      WHERE p.seller_id = ? AND COALESCE(v.is_experience, 0) = 0 AND o.created_at >= ? AND o.created_at < ?
      GROUP BY pr.agency_id`,
  ).bind(sellerId, range.start, range.end).all<{ agency_id: number; name: string | null; amt: number; pct: number | null }>()
    .catch(() => ({ results: [] as { agency_id: number; name: string | null; amt: number; pct: number | null }[] }))
  for (const r of ag.results || []) {
    const amount = Math.round(Number(r.amt) || 0)
    if (amount <= 0) continue
    const lineItem: StatementLine = { kind: 'agency', name: `에이전시 ${r.name || `#${r.agency_id}`}`, amount, pct: r.pct == null ? null : Number(r.pct) }
    ;(agencyGateOn ? out.paidByUrdeal : out.payByStore).push(lineItem)
  }
  return out
}

/** 매월 정산일 — 지난달에 해당 금액이 있는 매장마다 한 장씩. 같은 달 두 번은 안 보낸다. */
export async function sendStoreMonthlyStatements(DB: D1Database, nowMs: number): Promise<{ sent: number; stores: number }> {
  await ensureStatementTable(DB)
  const range = previousKstMonth(nowMs)
  const agencyGateOn = await isAgencySharePayoutEnabled(DB)
  // 후보 매장 = 지난달 소개 적립이 있었거나 에이전시가 맡은 이용권이 팔린 곳
  const cand = await DB.prepare(
    `SELECT DISTINCT seller_id FROM influencer_attributions
      WHERE seller_id IS NOT NULL AND COALESCE(source, '') != 'store_intro' AND created_at >= ? AND created_at < ?
     UNION
     SELECT DISTINCT pr.seller_id FROM agency_product_periods pr
       JOIN vouchers v ON v.product_id = pr.product_id JOIN orders o ON o.id = v.order_id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.created_at >= pr.started_at
        AND (pr.ended_at IS NULL OR o.created_at < pr.ended_at)
     LIMIT 500`,
  ).bind(range.start, range.end, range.start, range.end).all<{ seller_id: number }>()
    .catch(() => ({ results: [] as { seller_id: number }[] }))
  const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
  let sent = 0
  const stores = (cand.results || []).length
  for (const r of cand.results || []) {
    const sellerId = Number(r.seller_id)
    if (!Number.isInteger(sellerId) || sellerId <= 0) continue
    const st = await buildStoreStatement(DB, sellerId, range, agencyGateOn)
    const msg = statementMessage(st)
    if (!msg) continue
    // 선점이 먼저 — 알림은 선점에 성공한 쪽만(재실행해도 한 장).
    const ins = await DB.prepare(
      'INSERT OR IGNORE INTO store_monthly_statements (seller_id, period, payload) VALUES (?, ?, ?)',
    ).bind(sellerId, range.period, JSON.stringify(st)).run()
    if (!ins.meta?.changes) continue
    await createDashboardNotification(DB, 'seller', String(sellerId), 'store_monthly_statement', msg.title, msg.message, '/seller/settlements')
      .catch((e) => console.error('[store-statement] notify failed', e))
    sent++
  }
  return { sent, stores }
}
