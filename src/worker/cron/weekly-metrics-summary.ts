/**
 * 📊 2026-07-05 주간 지표 요약 크론 (자문 ⑤ — "매주 월요일 아침에 보는 숫자 5개").
 *
 * 매주 월요일 00:00 UTC(KST 09:00, agency-weekly-batch 슬롯) 실행:
 *   ① 신규 가입  ② 이용권 판매/사용 건수  ③ 재방문율(북극성 — 최근 30일 구매자 중 2회+ 구매 비율)
 *   ④ 유입 신호(추천 경유 적립·체험단 응모)  ⑤ 커미션 캡 발동 건수
 * → Discord(설정 시) + 어드민 대시보드 알림 1건. 전부 read-only 집계, 쿼리별 fail-soft.
 *
 * 목적: 대시보드가 흩어져 있어도 주 1회 조종석 숫자가 알아서 도착 — 1인 운영 리듬.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

async function count(DB: D1Database, sql: string): Promise<number> {
  const r = await DB.prepare(sql).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

export async function runWeeklyMetricsSummary(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    const [
      newUsers, vouchersSold, vouchersUsed,
      buyers30, repeatBuyers30,
      affiliateOrders, fcfsApplies, capEvents,
    ] = await Promise.all([
      count(DB, "SELECT COUNT(*) n FROM users WHERE created_at > datetime('now','-7 days')"),
      count(DB, "SELECT COUNT(*) n FROM vouchers WHERE created_at > datetime('now','-7 days')"),
      count(DB, "SELECT COUNT(*) n FROM vouchers WHERE used_at > datetime('now','-7 days')"),
      count(DB, "SELECT COUNT(DISTINCT user_id) n FROM vouchers WHERE created_at > datetime('now','-30 days')"),
      count(DB, `SELECT COUNT(*) n FROM (
        SELECT user_id FROM vouchers WHERE created_at > datetime('now','-30 days')
        GROUP BY user_id HAVING COUNT(DISTINCT order_id) >= 2)`),
      count(DB, "SELECT COUNT(*) n FROM affiliate_earnings WHERE created_at > datetime('now','-7 days')"),
      count(DB, "SELECT COUNT(*) n FROM fcfs_applications WHERE created_at > datetime('now','-7 days')"),
      count(DB, "SELECT COUNT(*) n FROM commission_budget_logs WHERE created_at > datetime('now','-7 days')"),
    ])

    const repeatRate = buyers30 > 0 ? Math.round((repeatBuyers30 / buyers30) * 100) : 0
    const lines = [
      `① 신규 가입: ${newUsers}명`,
      `② 이용권 판매 ${vouchersSold}건 · 사용 ${vouchersUsed}건`,
      `③ 재방문율(30일 구매자 중 2회+): ${repeatRate}% (${repeatBuyers30}/${buyers30})`,
      `④ 유입 신호: 추천 경유 적립 ${affiliateOrders}건 · 체험단 응모 ${fcfsApplies}건`,
      `⑤ 커미션 캡 발동: ${capEvents}건`,
    ]

    // 💸 2026-07-08 (머니 감사 ③ — 지급후 환불 미회수 알림): 정산 지급 뒤 환불이 들어와
    //   자동 회수가 안 되고 의무만 기록된 clawback(로그·의무row만 남던 것)을 주간 조종석에 승격.
    //   테이블은 lazy-create(voucher-settlement-clawback.ts) — 미존재 시 count() 가 fail-soft 0.
    const clawbackPending = await count(DB, "SELECT COUNT(*) n FROM settlement_clawbacks WHERE status = 'pending'")
    if (clawbackPending > 0) {
      const clawbackAmt = await count(DB, "SELECT COALESCE(SUM(amount),0) n FROM settlement_clawbacks WHERE status = 'pending'")
      lines.push(`⚠️ 미회수 clawback(지급후 환불): ${clawbackPending}건 ₩${clawbackAmt.toLocaleString()} — 회수/상계 필요 (/admin/payouts)`)
    }

    const body = lines.join('\n')

    // 어드민 대시보드 벨 — 매주 1건.
    try {
      const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
      await createDashboardNotification(DB, 'admin', null, 'weekly_metrics',
        '📊 주간 지표 요약 (최근 7일)', body, '/admin')
    } catch { /* fail-soft */ }

    // Discord (설정 시).
    const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
    if (webhook) {
      try {
        const { sendDiscordAlert } = await import('../utils/discord-alert')
        await sendDiscordAlert(webhook, '📊 주간 지표 요약 (최근 7일)', body, 'info')
      } catch { /* fail-soft */ }
    }

    logInfo(`[cron:weekly-metrics] ${body.replace(/\n/g, ' | ')}`)
  } catch (err) {
    // 🔔 2026-07-08 (무인운영 감사): 이전엔 삼켜 safeCron 실패 알림에 안 닿았음(주간 리포트가
    //   조용히 안 와도 경보 0). 재throw → safeCron → notifyCronFailure(Discord + cron_failures + 벨).
    logError('[cron:weekly-metrics] failed', { error: String(err) })
    throw err
  }
}
