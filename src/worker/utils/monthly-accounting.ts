/**
 * 🧾 월별 회계 집계 SSOT — 세무사용 CSV(`GET /api/admin/tax/monthly-accounting`)와 매월 1일 자동 요약 알림이 같은 숫자를 쓴다.
 *
 * 2026-07-08 무인운영 감사로 라우트 안에 있던 집계를 2026-11-25 이 파일로 옮겼다(대표 *"최대한 자동화하자
 * 지급대행 안쓰는 선에서"* — 월 마감 요약을 자동으로 보내려는데 같은 식을 두 번 쓰면 숫자가 갈린다).
 * 식은 한 글자도 안 바꿨다. 전부 read-only · 지표별 fail-soft(쿼리 실패 시 0).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { COMMISSION_DEFAULTS } from '../../shared/constants/policy'

export interface MonthlyAccounting {
  month: string
  defaultRate: number
  sales: { n: number; gmv: number; commission: number }
  refunds: { n: number; refunded: number }
  payouts: Array<{ payee_type: string; n: number; total: number }>
  wht: { n: number; gross: number; withholding: number; net: number }
}

/** 지난달(KST) 'YYYY-MM'. 순수. */
export function previousKstMonthKey(nowMs: number = Date.now()): string {
  const k = new Date(nowMs + 9 * 3600_000)
  k.setUTCDate(1)
  k.setUTCMonth(k.getUTCMonth() - 1)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function computeMonthlyAccounting(DB: D1Database, month: string): Promise<MonthlyAccounting> {
  const [yStr, mStr] = month.split('-')
  const year = Number(yStr)
  const monthNum = Number(mStr)
  const defaultRate = COMMISSION_DEFAULTS.PLATFORM_FEE_PCT

  // ① 매출(GMV) + 플랫폼 수수료 수익 — settlement/export-csv 와 동일 공식.
  // ⚠️ .first() 는 T|null — 집계라 실제론 항상 행이 오지만, null 이면 0 기본값(타입·안전 동시 보장).
  const sales = (await DB.prepare(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(o.total_amount), 0) AS gmv,
           COALESCE(SUM(ROUND(o.total_amount * COALESCE(o.commission_rate, s.commission_rate, ?) / 100)), 0) AS commission
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
     WHERE o.status IN ('DONE', 'PAID', 'DELIVERED')
       AND strftime('%Y-%m', datetime(o.created_at, '+9 hours')) = ?
  `).bind(defaultRate, month).first<{ n: number; gmv: number; commission: number }>()
    .catch(() => null)) ?? { n: 0, gmv: 0, commission: 0 }

  // ② 환불/취소 — 환불 발생 월(refunded_at) 기준.
  const refunds = (await DB.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(refunded_amount), 0) AS refunded
      FROM orders
     WHERE COALESCE(refunded_amount, 0) > 0
       AND strftime('%Y-%m', datetime(COALESCE(refunded_at, updated_at, created_at), '+9 hours')) = ?
  `).bind(month).first<{ n: number; refunded: number }>()
    .catch(() => null)) ?? { n: 0, refunded: 0 }

  // ③ 정산 지급(실송금 sent) — payee 유형별. = 매입세금계산서(역발행) 발행 대상.
  const payouts = await DB.prepare(`
    SELECT payee_type, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total
      FROM payouts
     WHERE status = 'sent'
       AND strftime('%Y-%m', datetime(sent_at, '+9 hours')) = ?
     GROUP BY payee_type
  `).bind(month).all<{ payee_type: string; n: number; total: number }>()
    .catch(() => ({ results: [] as Array<{ payee_type: string; n: number; total: number }> }))

  // ④ 원천징수 — tax_withholding_log (지급월 기준).
  const wht = (await DB.prepare(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(gross_amount), 0) AS gross,
           COALESCE(SUM(withholding_amount), 0) AS withholding,
           COALESCE(SUM(net_amount), 0) AS net
      FROM tax_withholding_log
     WHERE payout_year = ? AND payout_month = ?
  `).bind(year, monthNum).first<{ n: number; gross: number; withholding: number; net: number }>()
    .catch(() => null)) ?? { n: 0, gross: 0, withholding: 0, net: 0 }
  // 🧾 2026-11-18 인플루언서 현금 지급의 원천징수(별도 표 — `utils/influencer-withholding-log.ts`)를 같은 달 합계에 더한다.
  const whtInf = (await DB.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(gross_amount), 0) AS gross,
           COALESCE(SUM(withholding_amount), 0) AS withholding, COALESCE(SUM(net_amount), 0) AS net
      FROM influencer_withholding_log WHERE payout_year = ? AND payout_month = ?
  `).bind(year, monthNum).first<{ n: number; gross: number; withholding: number; net: number }>().catch(() => null))
  if (whtInf) { wht.n += Number(whtInf.n) || 0; wht.gross += Number(whtInf.gross) || 0; wht.withholding += Number(whtInf.withholding) || 0; wht.net += Number(whtInf.net) || 0 }
  // 🧾 2026-11-25 개인 에이전시에게 지급하며 뗀 3.3% 도 같은 달 합계에 — 종전엔 `agency_share_payouts` 에만 남아 이 요약에서 빠졌다(표가 없으면 0).
  const whtAg = (await DB.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(gross_amount), 0) AS gross,
           COALESCE(SUM(withholding_amount), 0) AS withholding, COALESCE(SUM(net_amount), 0) AS net
      FROM agency_share_payouts
     WHERE status = 'paid' AND withholding_amount > 0 AND strftime('%Y-%m', datetime(paid_at, '+9 hours')) = ?
  `).bind(month).first<{ n: number; gross: number; withholding: number; net: number }>().catch(() => null))
  if (whtAg) { wht.n += Number(whtAg.n) || 0; wht.gross += Number(whtAg.gross) || 0; wht.withholding += Number(whtAg.withholding) || 0; wht.net += Number(whtAg.net) || 0 }
  return { month, defaultRate, sales, refunds, payouts: payouts.results || [], wht }
}

const won = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`

/** 순수 — 월 마감 알림 한 장. 원천세 신고·납부 기한(다음 달 10일)을 같이 적는다. */
export function monthlyCloseMessage(a: MonthlyAccounting, unsent: { n: number; total: number }): { title: string; message: string } {
  const [y, m] = a.month.split('-').map(Number)
  const payTotal = a.payouts.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const due = new Date(Date.UTC(y, m, 10)) // 다음 달 10일
  const dueLabel = `${due.getUTCMonth() + 1}월 10일`
  const parts = [
    `매출 ${won(a.sales.gmv)}(${a.sales.n}건)`,
    `수수료 수익 ${won(a.sales.commission)}`,
    `환불 ${won(a.refunds.refunded)}`,
    `지급 완료 ${won(payTotal)}`,
    `원천징수 ${won(a.wht.withholding)}${a.wht.withholding > 0 ? ` — 원천세 신고·납부 ${dueLabel}까지` : ''}`,
  ]
  if (unsent.n > 0) parts.push(`⚠️ 승인됐는데 아직 안 보낸 정산 ${unsent.n}건 ${won(unsent.total)}`)
  return { title: `🧾 ${y}년 ${m}월 회계 마감 요약 — 세무사용 CSV 준비됨`, message: parts.join(' · ') }
}

/**
 * 매월 1일(KST) — 지난달 회계 요약을 어드민 알림으로 보낸다(대표 2026-11-25 *"최대한 자동화하자"*).
 * 숫자는 세무사용 CSV 와 같은 `computeMonthlyAccounting`. 같은 달 두 번 보내지 않는다(UNIQUE + INSERT OR IGNORE).
 * 돈을 옮기지 않는다 — 읽고 알리기만.
 */
export async function sendMonthlyCloseSummary(DB: D1Database, nowMs: number = Date.now()): Promise<{ sent: boolean; month: string }> {
  const month = previousKstMonthKey(nowMs)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS monthly_close_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_close_reports_month ON monthly_close_reports(month)').run()
  const acc = await computeMonthlyAccounting(DB, month)
  const unsent = (await DB.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM payouts WHERE status = 'approved'",
  ).first<{ n: number; total: number }>().catch(() => null)) ?? { n: 0, total: 0 }
  // 선점이 먼저 — 알림은 선점에 성공한 쪽만(재실행해도 한 장).
  const ins = await DB.prepare('INSERT OR IGNORE INTO monthly_close_reports (month, payload) VALUES (?, ?)')
    .bind(month, JSON.stringify({ ...acc, unsent })).run()
  if (!ins.meta?.changes) return { sent: false, month }
  const msg = monthlyCloseMessage(acc, { n: Number(unsent.n) || 0, total: Number(unsent.total) || 0 })
  const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
  await createDashboardNotification(DB, 'admin', null, 'monthly_close_report', msg.title, msg.message, '/admin/payouts?tab=annual')
  return { sent: true, month }
}
