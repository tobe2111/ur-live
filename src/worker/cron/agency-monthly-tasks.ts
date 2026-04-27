/**
 * Agency Monthly Tasks Aggregation Cron (Q6)
 *
 * 매일 18:00 UTC 실행 (다른 daily cron 과 함께).
 *
 * 동작:
 * - 모든 활성 에이전시에 대해 이번 달 3종 의무 작업의 actual_value 갱신
 * - row 가 없으면 자동 생성 (target_value 는 tier 기반 디폴트)
 * - 100% 도달 시 status='completed', 월말 미달 시 'failed' (월말 cron 별도)
 *
 * 1차에는 페널티 없음. 표시 + 데이터 누적만.
 *
 * 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q6), migrations/0215_agency_monthly_tasks.sql
 */

import type { Env } from '../types/env'

// 등급별 디폴트 목표 (tier_locked 인 경우 어드민이 별도 조정)
// 🛡️ W2: 테스트 가능하도록 export
export const TIER_DEFAULTS = {
  new:    { creator_growth: 2,  sales_quota: 1_000_000,  activation: 1 },
  junior: { creator_growth: 3,  sales_quota: 3_000_000,  activation: 3 },
  senior: { creator_growth: 5,  sales_quota: 10_000_000, activation: 5 },
} as const

/**
 * 의무 작업 진행률 계산 (순수 함수 — 테스트 가능)
 *
 * @returns { pct: 0~100, completed: boolean, label: 진행률 + 단위 }
 */
export function taskProgress(taskType: 'creator_growth' | 'sales_quota' | 'activation', actual: number, target: number): {
  pct: number
  completed: boolean
  label: string
} {
  const safeTarget = Math.max(1, target)
  const pct = Math.min(100, Math.round((actual / safeTarget) * 100))
  const completed = actual >= target
  let label: string
  if (taskType === 'sales_quota') {
    label = `${(actual / 10_000).toFixed(0)}만원 / ${(target / 10_000).toFixed(0)}만원`
  } else {
    label = `${actual}명 / ${target}명`
  }
  return { pct, completed, label }
}

type TaskType = 'creator_growth' | 'sales_quota' | 'activation'

interface AgencyRow {
  id: number
  tier: string
}

export async function handleAgencyMonthlyTasks(env: Env): Promise<{
  agencies_processed: number
  tasks_updated: number
  tasks_created: number
  tasks_completed: number
}> {
  const DB = env.DB
  let agencies_processed = 0
  let tasks_updated = 0
  let tasks_created = 0
  let tasks_completed = 0

  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  let agencies: AgencyRow[] = []
  try {
    const r = await DB.prepare(`
      SELECT id, COALESCE(tier, 'new') AS tier
      FROM agencies
      WHERE status IN ('active','approved')
    `).all<AgencyRow>()
    agencies = r.results || []
  } catch (e) {
    console.warn('[cron:agency-monthly-tasks] migration 0215 not applied:', e)
    return { agencies_processed: 0, tasks_updated: 0, tasks_created: 0, tasks_completed: 0 }
  }

  for (const agency of agencies) {
    agencies_processed++
    const tier = (agency.tier as keyof typeof TIER_DEFAULTS) || 'new'
    const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS.new

    // 3종 task 각각 actual 계산 + UPSERT
    const actuals: Record<TaskType, number> = {
      creator_growth: 0,
      sales_quota: 0,
      activation: 0,
    }

    try {
      // 1) creator_growth: 이번 달 시작된 매니지먼트 관계 수
      const cg = await DB.prepare(`
        SELECT COUNT(*) AS cnt FROM agency_sellers
        WHERE agency_id = ? AND created_at >= ? AND created_at < ?
      `).bind(agency.id, monthStart, monthEnd).first<{ cnt: number }>()
      actuals.creator_growth = cg?.cnt ?? 0
    } catch { /* fallback 0 */ }

    try {
      // 2) sales_quota: 이번 달 PAID/DONE 매출 + 후원
      const sq = await DB.prepare(`
        SELECT
          COALESCE((SELECT SUM(o.total_amount)
            FROM orders o
            INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
            WHERE ag.agency_id = ? AND o.status IN ('PAID','DONE')
              AND o.created_at >= ? AND o.created_at < ?), 0) AS revenue,
          COALESCE((SELECT SUM(d.amount)
            FROM donations d
            INNER JOIN agency_sellers ag ON ag.seller_id = d.seller_id
            WHERE ag.agency_id = ? AND d.payment_status = 'approved'
              AND d.created_at >= ? AND d.created_at < ?), 0) AS donations
      `).bind(
        agency.id, monthStart, monthEnd,
        agency.id, monthStart, monthEnd,
      ).first<{ revenue: number; donations: number }>()
      actuals.sales_quota = (sq?.revenue ?? 0) + (sq?.donations ?? 0)
    } catch { /* */ }

    try {
      // 3) activation: 1시간 이상 라이브 진행한 셀러 수 (이번 달)
      const ac = await DB.prepare(`
        SELECT COUNT(DISTINCT ls.seller_id) AS cnt
        FROM live_streams ls
        INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
        WHERE ag.agency_id = ?
          AND ls.created_at >= ? AND ls.created_at < ?
          AND ls.ended_at IS NOT NULL
          AND (julianday(ls.ended_at) - julianday(ls.started_at)) * 1440 >= 60
      `).bind(agency.id, monthStart, monthEnd).first<{ cnt: number }>()
      actuals.activation = ac?.cnt ?? 0
    } catch { /* */ }

    // 각 task UPSERT
    for (const taskType of ['creator_growth', 'sales_quota', 'activation'] as TaskType[]) {
      const target = defaults[taskType]
      const actual = actuals[taskType]
      const isCompleted = actual >= target
      const completedAt = isCompleted ? new Date().toISOString() : null

      try {
        const result = await DB.prepare(`
          INSERT INTO agency_monthly_tasks (agency_id, month, task_type, target_value, actual_value, status, completed_at, last_calculated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT (agency_id, month, task_type) DO UPDATE SET
            actual_value = excluded.actual_value,
            status = excluded.status,
            completed_at = CASE
              WHEN agency_monthly_tasks.status != 'completed' AND excluded.status = 'completed'
              THEN excluded.completed_at
              ELSE agency_monthly_tasks.completed_at
            END,
            last_calculated_at = datetime('now')
        `).bind(
          agency.id, month, taskType, target, actual,
          isCompleted ? 'completed' : 'in_progress',
          completedAt,
        ).run()

        if ((result.meta.changes ?? 0) > 0) {
          tasks_updated++
          // INSERT 인지 UPDATE 인지 정확히 모르지만 신규 row 검출 어려움 — 통합 카운트
          if (isCompleted) tasks_completed++
        }
      } catch (e) {
        console.error(`[cron:agency-monthly-tasks] agency=${agency.id} task=${taskType} failed:`, e)
      }
    }
  }

  return { agencies_processed, tasks_updated, tasks_created, tasks_completed }
}
