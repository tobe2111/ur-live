/**
 * Agency Creator Auto-Evaluation Cron (Q3)
 *
 * 매일 18:00 UTC 실행 (다른 daily cron 과 함께).
 *
 * 동작:
 * - status='pending' + 신청일로부터 30일 경과 + evaluated_at IS NULL 인 row 찾기
 * - 해당 셀러의 30일 활동 집계 (라이브 시간, 매출, 후원, 라이브 횟수)
 * - score 계산 (0~100):
 *   · live_hours_score: 5h 이상이면 25점, 1h마다 5점 (max 30)
 *   · revenue_score: 10만원 이상이면 30점, 1만원마다 1점 (max 40)
 *   · stream_count_score: 3회 이상이면 20점, 1회마다 5점 (max 20)
 *   · activity_score: 0이 아니면 10점 (활동 자체 가산)
 * - 추천:
 *   · score >= 70 → recommend_approve
 *   · score < 20  → recommend_reject
 *   · 그 외       → inconclusive
 *
 * ⚠️ 자동 처리 X — 어드민에게 추천만. 최종 승인은 수동.
 *
 * 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q3), migrations/0213_agency_creator_evaluation.sql
 */

import type { Env } from '../types/env'

import { swallow } from '../utils/swallow';
interface PendingApproval {
  id: number
  seller_id: number
  agency_id: number
  created_at: string
}

interface ActivitySnapshot {
  live_hours: number
  stream_count: number
  revenue: number
  donations: number
  has_any_activity: boolean
}

export async function handleAgencyCreatorEval(env: Env): Promise<{
  evaluated: number
  recommend_approve: number
  recommend_reject: number
  inconclusive: number
}> {
  const DB = env.DB
  let evaluated = 0
  let approveCount = 0
  let rejectCount = 0
  let inconclusiveCount = 0

  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString()

  let pendings: PendingApproval[] = []
  try {
    const r = await DB.prepare(`
      SELECT id, seller_id, agency_id, created_at
      FROM agency_creator_approvals
      WHERE status = 'pending'
        AND evaluated_at IS NULL
        AND created_at <= ?
      LIMIT 100
    `).bind(cutoff).all<PendingApproval>()
    pendings = r.results || []
  } catch (e) {
    console.warn('[cron:agency-creator-eval] migrations 0207/0213 not applied:', e)
    return { evaluated: 0, recommend_approve: 0, recommend_reject: 0, inconclusive: 0 }
  }

  for (const approval of pendings) {
    try {
      const since = approval.created_at  // 신청일 = 평가 시작점

      // 활동 집계
      const stats = await DB.prepare(`
        SELECT
          COALESCE((SELECT SUM(
            CASE
              WHEN ls.ended_at IS NOT NULL THEN (julianday(ls.ended_at) - julianday(ls.started_at)) * 24
              ELSE 0
            END
          ) FROM live_streams ls WHERE ls.seller_id = ? AND ls.created_at >= ?), 0) AS live_hours,
          COALESCE((SELECT COUNT(*) FROM live_streams ls
            WHERE ls.seller_id = ? AND ls.created_at >= ? AND ls.status IN ('ended','live')), 0) AS stream_count,
          COALESCE((SELECT SUM(o.total_amount) FROM orders o
            WHERE o.seller_id = ? AND o.status IN ('PAID','DONE') AND o.created_at >= ?), 0) AS revenue,
          COALESCE((SELECT SUM(d.amount) FROM donations d
            WHERE d.seller_id = ? AND d.payment_status = 'approved' AND d.created_at >= ?), 0) AS donations
      `).bind(
        approval.seller_id, since,
        approval.seller_id, since,
        approval.seller_id, since,
        approval.seller_id, since,
      ).first<ActivitySnapshot>()

      const snapshot: ActivitySnapshot = {
        live_hours: Math.round((stats?.live_hours ?? 0) * 100) / 100,
        stream_count: stats?.stream_count ?? 0,
        revenue: stats?.revenue ?? 0,
        donations: stats?.donations ?? 0,
        has_any_activity: false,
      }
      snapshot.has_any_activity =
        snapshot.live_hours > 0 || snapshot.stream_count > 0 || snapshot.revenue > 0 || snapshot.donations > 0

      // Score 계산
      const liveHoursScore = Math.min(30, Math.floor(snapshot.live_hours) * 5 + (snapshot.live_hours >= 5 ? 5 : 0))
      const totalRevenue = snapshot.revenue + snapshot.donations
      const revenueScore = Math.min(40, Math.floor(totalRevenue / 10_000))
      const streamCountScore = Math.min(20, snapshot.stream_count * 5 + (snapshot.stream_count >= 3 ? 5 : 0))
      const activityScore = snapshot.has_any_activity ? 10 : 0

      // 🛡️ 2026-04-26 T3: TikTok 인증 셀러 가산 (+20)
      // TikTok Display API 로 검증된 셀러는 외부 신뢰도 보유 → 어드민 승인 추천에 가산.
      // seller_platform_links 미적용 (마이그레이션 0220) 시 0 — graceful.
      let tiktokBonus = 0
      try {
        const tiktok = await DB.prepare(
          "SELECT id FROM seller_platform_links WHERE seller_id = ? AND platform = 'tiktok' AND status = 'active' LIMIT 1"
        ).bind(approval.seller_id).first()
        if (tiktok) tiktokBonus = 20
      } catch { /* migration 미적용 → 0 */ }

      const totalScore = liveHoursScore + revenueScore + streamCountScore + activityScore + tiktokBonus

      let decision: 'recommend_approve' | 'recommend_reject' | 'inconclusive'
      if (totalScore >= 70) {
        decision = 'recommend_approve'
        approveCount++
      } else if (totalScore < 20) {
        decision = 'recommend_reject'
        rejectCount++
      } else {
        decision = 'inconclusive'
        inconclusiveCount++
      }

      const evalData = JSON.stringify({
        snapshot,
        scores: { liveHoursScore, revenueScore, streamCountScore, activityScore, tiktokBonus, totalScore },
        evaluated_at: new Date().toISOString(),
      })

      await DB.prepare(`
        UPDATE agency_creator_approvals
        SET evaluated_at = datetime('now'),
            evaluation_score = ?,
            auto_decision = ?,
            evaluation_data = ?
        WHERE id = ?
      `).bind(totalScore, decision, evalData, approval.id).run()

      // 어드민 알림 (활동 0 이면 강한 알림 — recommend_reject)
      if (decision === 'recommend_reject') {
        await DB.prepare(`
          INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
          VALUES (?, 'creator_eval_reject', '셀러 활동 미달 ⚠️', ?, '/admin/agency-creator-approval', datetime('now'))
        `).bind(
          approval.agency_id,
          `신청 셀러가 30일간 활동 거의 없음 (score: ${totalScore}/100). 어드민 검토 권장.`
        ).run().catch(swallow('worker:cron:agency-creator-eval'))
      }

      evaluated++
      console.log(
        `[cron:agency-creator-eval] approval=${approval.id} seller=${approval.seller_id} ` +
        `score=${totalScore} decision=${decision} ` +
        `(live=${snapshot.live_hours}h, streams=${snapshot.stream_count}, revenue=${totalRevenue})`
      )
    } catch (e) {
      console.error(`[cron:agency-creator-eval] approval=${approval.id} failed:`, e)
    }
  }

  return {
    evaluated,
    recommend_approve: approveCount,
    recommend_reject: rejectCount,
    inconclusive: inconclusiveCount,
  }
}
