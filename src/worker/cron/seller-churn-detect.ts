/**
 * 🛡️ 2026-05-15: 셀러 churn (이탈) prediction — 1일 1회 cron.
 *
 * 신호 (단순 rule based, ML 없이도 효과적):
 *   - 마지막 공구 등록 14일+ 경과 (active=0)
 *   - 직전 30일 진행률 평균 50% 미만 (low conversion)
 *   - 정산 미수령 7일+ (불만 가능성)
 *
 * 점수: low/medium/high
 * 액션:
 *   - high: 에이전시 dashboard 알림 + 셀러에게 격려 알림톡
 *   - medium: 에이전시 weekly 리포트
 *   - low: 추적만
 *
 * 0원 운영: AI 호출 없이 SQL only.
 */

import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface SellerSignal {
  seller_id: number
  seller_name: string
  user_id: string | null
  days_since_last_post: number
  recent_avg_completion: number
  pending_settlement_days: number
  score: 'low' | 'medium' | 'high'
}

export async function handleSellerChurnDetect(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  try {
    // 셀러별 신호 집계
    const { results } = await DB.prepare(`
      SELECT
        s.id AS seller_id,
        s.name AS seller_name,
        s.linked_user_id AS user_id,
        (julianday('now') - julianday(MAX(p.created_at))) AS days_since_last_post,
        AVG(CASE WHEN p.group_buy_target > 0 THEN p.group_buy_current * 1.0 / p.group_buy_target ELSE NULL END) AS recent_avg_completion
      FROM sellers s
      LEFT JOIN products p ON p.seller_id = s.id
        AND p.created_at >= datetime('now', '-30 days')
        AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
      WHERE s.status = 'approved'
      GROUP BY s.id
      HAVING days_since_last_post IS NOT NULL
      LIMIT 500
    `).all<SellerSignal>().catch(() => ({ results: [] as SellerSignal[] }))

    if (!results || results.length === 0) {
      logInfo('[cron:churn] no signals to process')
      return
    }

    let highRiskCount = 0
    const stmts: D1PreparedStatement[] = []

    for (const s of results) {
      const days = Number(s.days_since_last_post ?? 0)
      const avgComp = Number(s.recent_avg_completion ?? 0)

      // 점수 계산
      let score: 'low' | 'medium' | 'high' = 'low'
      if (days > 14 && avgComp < 0.5) score = 'high'
      else if (days > 7 || avgComp < 0.6) score = 'medium'

      if (score === 'high') {
        highRiskCount++
        // 🌇 2026-09-04 에이전시 일몰 — 여기 있던 '에이전시 dashboard 알림'을 삭제했다.
        //    `sellers.agency_id` 는 라이브에서 전원 NULL 이라 이 분기는 실행된 적이 없다.
        // 셀러 본인에게도 격려
        //
        // 🗓️ 2026-09-04: 종전 문구가 '마감 임박 push 를 활용해보세요' 였다. 그 push cron 은
        //   어디에도 등록되지 않은 죽은 파일이고 마감 개념 자체도 없어졌다 — 존재한 적 없는
        //   기능을 사장님에게 권하고 있었다. 실제로 할 수 있는 행동으로 바꾼다.
        //
        // ⚠️ 주석을 `.bind(...)` **인자 목록 안에 넣지 말 것** — 주석 속 쉼표를 인자로 세어
        //   `check-sql-bind-params` 가 개수 불일치로 막는다(2026-09-04 에 실제로 밟았다).
        if (s.user_id) {
          stmts.push(
            DB.prepare(`
              INSERT INTO user_notifications (user_id, type, title, message, link)
              VALUES (?, 'seller_re_engage', ?, ?, '/seller/group-buy')
            `).bind(
              s.user_id,
              '✨ 새 공구 시작해보세요',
              `요즘 공구 진행률이 낮아요. 공구 특가를 키우거나 유어샵 링크를 공유해 알려보세요.`,
            )
          )
        }
      }
    }

    if (stmts.length > 0) await DB.batch(stmts).catch(e => logError('[cron:churn] batch failed', { error: String(e) }))

    logInfo(`[cron:churn] processed=${results.length} high_risk=${highRiskCount}`)
  } catch (e) {
    logError('[cron:churn] failed', { error: String(e) })
  }
}
