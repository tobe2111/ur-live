/**
 * 📰 2026-07-19 어드민 일일 다이제스트 (운영 자동화 백로그 ① — "판단은 내가, 수집은 기계가").
 *
 * 매일 KST 07:00 (hourly cron '0 * * * *' 슬롯에서 UTC 22시 게이트) 실행:
 *   [어제(KST) 하루]
 *   ① 판매 — 결제 승인 주문 건수/금액 + 이용권 발급 건수
 *   ② QR 사용 — 이용권 사용 건수
 *   ③ 신규 가입 — 유저 가입 수
 *   [이상 신호]
 *   ④ 환불 급증 — 어제 환불/취소가 직전 7일 일평균의 2배 이상 && 3건 이상이면 ⚠️
 *   ⑤ 미사용 임박 — 7일 내 만료 예정 미사용 이용권 수
 *   ⑥ cron 실패 24h / 어뷰징 high 24h
 *
 * 배달: 어드민 벨 + Discord + 이메일(platform_settings `ops_digest_email` 설정 시)
 *   + 알림톡(env `OPS_DIGEST_ALIMTALK_ENABLED==='true'` && `ops_digest_phone` 설정 시 — 기본 OFF).
 *
 * 전부 read-only 집계 + fail-soft. 멱등: 같은 KST 날짜 다이제스트가 이미 벨에 있으면 skip.
 * 라이브 무접촉 — 소비자/셀러 대상 발송 0, 정산·머니 경로 무관.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'
import { kstDayWindow, scalar, getOpsSetting, deliverAdminOpsReport } from '../utils/ops-report'

/** hourly 슬롯 게이트 — UTC 22시(KST 07:00)에만 실제 실행. */
export function isOpsDigestHour(now = new Date()): boolean {
  return now.getUTCHours() === 22
}

export async function runOpsDailyDigest(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    const y = kstDayWindow(1) // KST 어제
    const w7Start = kstDayWindow(8).start // 직전 7일(어제 제외) 시작

    // 멱등 — 같은 KST 날짜 다이제스트가 이미 있으면 재실행 skip (cron 재시도/중복 방어).
    const dup = await DB.prepare(
      `SELECT id FROM dashboard_notifications
        WHERE recipient_type = 'admin' AND type = 'ops_daily_digest'
          AND title LIKE ? AND created_at > datetime('now', '-20 hours') LIMIT 1`
    ).bind(`%${y.kstDate}%`).first().catch(() => null)
    if (dup) return

    const [
      paidOrders, paidAmount, vouchersIssued, vouchersUsed, newUsers,
      refundsY, refunds7d,
      expiringSoon, cronFails24h, abuseHigh24h,
    ] = await Promise.all([
      scalar(DB, `SELECT COUNT(*) n FROM orders WHERE payment_status = 'approved' AND created_at >= ? AND created_at < ?`, y.start, y.end),
      scalar(DB, `SELECT COALESCE(SUM(total_amount),0) n FROM orders WHERE payment_status = 'approved' AND created_at >= ? AND created_at < ?`, y.start, y.end),
      scalar(DB, `SELECT COUNT(*) n FROM vouchers WHERE created_at >= ? AND created_at < ?`, y.start, y.end),
      scalar(DB, `SELECT COUNT(*) n FROM vouchers WHERE used_at >= ? AND used_at < ?`, y.start, y.end),
      scalar(DB, `SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?`, y.start, y.end),
      // 환불/취소 전이 시각 proxy = updated_at (orders 는 상태 flip 시 updated_at 갱신).
      scalar(DB, `SELECT COUNT(*) n FROM orders WHERE payment_status IN ('refunded','cancelled') AND updated_at >= ? AND updated_at < ?`, y.start, y.end),
      scalar(DB, `SELECT COUNT(*) n FROM orders WHERE payment_status IN ('refunded','cancelled') AND updated_at >= ? AND updated_at < ?`, w7Start, y.start),
      scalar(DB, `SELECT COUNT(*) n FROM vouchers WHERE status = 'unused' AND expires_at IS NOT NULL
                   AND julianday(expires_at) - julianday('now') BETWEEN 0 AND 7`),
      scalar(DB, `SELECT COUNT(*) n FROM cron_failures WHERE created_at > datetime('now','-1 day')`),
      scalar(DB, `SELECT COUNT(*) n FROM abuse_detections WHERE severity = 'high' AND created_at > datetime('now','-1 day')`),
    ])

    const lines = [
      `① 판매: 주문 ${paidOrders}건 · ₩${paidAmount.toLocaleString()} · 이용권 발급 ${vouchersIssued}건`,
      `② QR 사용: ${vouchersUsed}건`,
      `③ 신규 가입: ${newUsers}명`,
    ]

    // ④ 환불 급증 신호 — 직전 7일 일평균 대비.
    const refundAvg = refunds7d / 7
    if (refundsY >= 3 && refundsY >= refundAvg * 2) {
      lines.push(`⚠️ 환불 급증: 어제 ${refundsY}건 (직전 7일 일평균 ${refundAvg.toFixed(1)}건) — /admin/orders 확인`)
    } else {
      lines.push(`④ 환불/취소: ${refundsY}건 (7일 일평균 ${refundAvg.toFixed(1)}건)`)
    }

    if (expiringSoon > 0) lines.push(`⑤ 미사용 임박: 7일 내 만료 예정 이용권 ${expiringSoon}건 (D-7/3/1 알림 cron 발송 중)`)
    if (cronFails24h > 0) lines.push(`🔴 cron 실패 24h: ${cronFails24h}건 — /admin/system-monitoring`)
    if (abuseHigh24h > 0) lines.push(`🚨 어뷰징 high 24h: ${abuseHigh24h}건 — /admin/abuse`)

    const title = `📰 일일 다이제스트 ${y.kstDate} (KST)`
    const body = lines.join('\n')

    const delivered = await deliverAdminOpsReport(env, { type: 'ops_daily_digest', title, body, link: '/admin' })

    // 알림톡 (기본 OFF — env 게이트 + platform_settings 수신번호 + Aligo 3종 설정 모두 필요).
    if ((env as Env & { OPS_DIGEST_ALIMTALK_ENABLED?: string }).OPS_DIGEST_ALIMTALK_ENABLED === 'true') {
      try {
        const phone = await getOpsSetting(DB, 'ops_digest_phone')
        if (phone && /^01\d{8,9}$/.test(phone.replace(/\D/g, ''))) {
          const { sendSystemAlimtalk } = await import('../../lib/system-alimtalk')
          const tpl = (env as Env & { ALIGO_OPS_DAILY_DIGEST?: string }).ALIGO_OPS_DAILY_DIGEST || 'ops_daily_digest'
          await sendSystemAlimtalk(env, phone.replace(/\D/g, ''), tpl, `[유어딜] ${title}\n\n${body}`)
        }
      } catch { /* fail-soft */ }
    }

    logInfo(`[cron:ops-daily-digest] ${y.kstDate} bell=${delivered.bell} discord=${delivered.discord} email=${delivered.email}`)
  } catch (err) {
    // weekly-metrics 패턴 — 재throw 로 safeCron → notifyCronFailure(Discord + cron_failures + 벨) 도달.
    logError('[cron:ops-daily-digest] failed', { error: String(err) })
    throw err
  }
}
