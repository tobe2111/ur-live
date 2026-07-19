/**
 * 📈 2026-07-19 주간 코호트 리포트 (운영 자동화 백로그 ④ — 매주 월요일 자동 발송).
 *
 * 매주 월요일 00:00 UTC(KST 09:00, weekly-metrics-summary 와 같은 '0 0 * * 1' 슬롯) 실행:
 *   최근 8주 **가입 주차 코호트**별로
 *     가입 n · 구매전환(이용권 1건+) · 14일 내 구매(활성 전환) · 재구매(주문 2건+) · QR 사용자
 *   를 read-only 집계해 표 1장으로 발송.
 *
 * 배달: 어드민 벨 + Discord + 이메일(platform_settings `ops_digest_email` 설정 시) —
 *   ops-daily-digest 와 동일 공용 경로(deliverAdminOpsReport). 전 쿼리 fail-soft.
 * 라이브 무접촉 — 소비자 발송 0, 머니 경로 무관. weekly-metrics-summary(스냅샷 5개)와 상보:
 *   그쪽은 "이번 주 숫자", 이쪽은 "주차별 유저 질(전환·리텐션) 추세".
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'
import { toSqlUtc, deliverAdminOpsReport } from '../utils/ops-report'

const WEEKS = 8
const KST = 9 * 3600_000

type CohortRow = {
  signups: number
  buyers: number
  fast_buyers: number
  repeat_buyers: number
  qr_users: number
}

export async function runWeeklyCohortReport(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    // 이번 주 월요일(KST) 00:00 → UTC ms. getUTCDay(): 0=일…1=월.
    const nowKst = new Date(Date.now() + KST)
    const dow = nowKst.getUTCDay()
    const daysSinceMonday = (dow + 6) % 7
    const thisMondayUtcMs =
      Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()) - KST - daysSinceMonday * 86400_000

    const lines: string[] = [
      '주차(가입) | 가입 | 구매전환 | 14일내구매 | 재구매 | QR사용',
    ]

    for (let w = WEEKS; w >= 1; w--) {
      const startMs = thisMondayUtcMs - w * 7 * 86400_000
      const endMs = startMs + 7 * 86400_000
      const start = toSqlUtc(new Date(startMs))
      const end = toSqlUtc(new Date(endMs))
      const label = new Date(startMs + KST).toISOString().slice(2, 10) // YY-MM-DD (KST 월요일)

      // 코호트 1주 = 쿼리 1개 (users 상관 서브쿼리 — 주당 가입자 규모라 부담 낮음, 실패 시 skip).
      const row = await DB.prepare(`
        SELECT COUNT(*) AS signups,
               SUM(CASE WHEN EXISTS (SELECT 1 FROM vouchers v WHERE v.user_id = CAST(u.id AS TEXT)) THEN 1 ELSE 0 END) AS buyers,
               SUM(CASE WHEN EXISTS (SELECT 1 FROM vouchers v WHERE v.user_id = CAST(u.id AS TEXT)
                                       AND julianday(v.created_at) - julianday(u.created_at) <= 14) THEN 1 ELSE 0 END) AS fast_buyers,
               SUM(CASE WHEN (SELECT COUNT(DISTINCT v.order_id) FROM vouchers v WHERE v.user_id = CAST(u.id AS TEXT)) >= 2 THEN 1 ELSE 0 END) AS repeat_buyers,
               SUM(CASE WHEN EXISTS (SELECT 1 FROM vouchers v WHERE v.user_id = CAST(u.id AS TEXT) AND v.used_at IS NOT NULL) THEN 1 ELSE 0 END) AS qr_users
          FROM users u
         WHERE u.created_at >= ? AND u.created_at < ?
      `).bind(start, end).first<CohortRow>().catch(() => null)

      if (!row) { lines.push(`${label} | (집계 실패)`); continue }
      const s = Number(row.signups) || 0
      const pct = (n: number) => (s > 0 ? `${n}(${Math.round((n / s) * 100)}%)` : '0')
      lines.push(
        `${label} | ${s} | ${pct(Number(row.buyers) || 0)} | ${pct(Number(row.fast_buyers) || 0)} | ${pct(Number(row.repeat_buyers) || 0)} | ${pct(Number(row.qr_users) || 0)}`
      )
    }

    lines.push('')
    lines.push('※ 가입 주차(KST 월~일) 기준. 구매=이용권 발급 1건+, 재구매=주문 2건+, QR사용=사용 1건+.')

    const title = '📈 주간 코호트 리포트 (최근 8주 가입자)'
    const body = lines.join('\n')
    const delivered = await deliverAdminOpsReport(env, { type: 'weekly_cohort_report', title, body, link: '/admin' })
    logInfo(`[cron:weekly-cohort-report] bell=${delivered.bell} discord=${delivered.discord} email=${delivered.email}`)
  } catch (err) {
    logError('[cron:weekly-cohort-report] failed', { error: String(err) })
    throw err
  }
}
