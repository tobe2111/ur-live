/**
 * Agency Tier Evaluation Cron (Q1)
 *
 * 매월 1일 00:30 UTC (= KST 09:30) 실행.
 *
 * 등급 산정:
 * - 가입 90일 이내 + 전월 매출 < 500만원  → 'new'
 * - 가입 90일 이상 + 전월 매출 < 500만원  → 'junior'
 * - 전월 매출 ≥ 500만원                  → 'senior'
 *
 * tier_locked = 1 인 에이전시는 어드민 수동 override 상태 → 자동 평가 skip.
 *
 * 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q1), migrations/0212_agency_tier.sql
 */

import type { Env } from '../types/env'

const SENIOR_THRESHOLD = 5_000_000 // 500만원 (TikTok 의 500만 다이아 기준 채택)
const JUNIOR_AGE_DAYS = 90         // 가입 90일 (TikTok 6개월의 한국 적응)

interface AgencyRow {
  id: number
  status: string
  created_at: string
  tier: string
}

export async function handleAgencyTierEval(env: Env): Promise<{
  evaluated: number
  changed: number
  by_tier: Record<string, number>
}> {
  const DB = env.DB
  let evaluated = 0
  let changed = 0
  const byTier: Record<string, number> = { new: 0, junior: 0, senior: 0 }

  // 전월 시작/종료 (UTC 기준)
  const now = new Date()
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString()
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  // 자동 평가 대상 (tier_locked = 0)
  let agencies: AgencyRow[] = []
  try {
    const r = await DB.prepare(`
      SELECT id, status, created_at, tier
      FROM agencies
      WHERE COALESCE(tier_locked, 0) = 0
        AND status IN ('active','approved')
    `).all<AgencyRow>()
    agencies = r.results || []
  } catch (e) {
    console.warn('[cron:agency-tier-eval] migration 0212 not applied:', e)
    return { evaluated: 0, changed: 0, by_tier: byTier }
  }

  for (const agency of agencies) {
    evaluated++

    // 1) 가입 경과 일수
    const joinedAt = new Date(agency.created_at)
    const ageDays = Math.floor((now.getTime() - joinedAt.getTime()) / 86400_000)

    // 2) 전월 매출 (orders.PAID/DONE + donations.approved)
    let lastMonthRevenue = 0
    try {
      const row = await DB.prepare(`
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
        agency.id, lastMonthStart, thisMonthStart,
        agency.id, lastMonthStart, thisMonthStart,
      ).first<{ revenue: number; donations: number }>()
      lastMonthRevenue = (row?.revenue ?? 0) + (row?.donations ?? 0)
    } catch (e) {
      console.error(`[cron:agency-tier-eval] revenue query failed for agency=${agency.id}:`, e)
      continue
    }

    // 3) 등급 산정
    let newTier: 'new' | 'junior' | 'senior'
    if (lastMonthRevenue >= SENIOR_THRESHOLD) {
      newTier = 'senior'
    } else if (ageDays >= JUNIOR_AGE_DAYS) {
      newTier = 'junior'
    } else {
      newTier = 'new'
    }

    byTier[newTier]++

    // 4) 변경 시 갱신 + 알림
    if (newTier !== agency.tier) {
      await DB.prepare(`
        UPDATE agencies
        SET tier = ?, tier_evaluated_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(newTier, agency.id).run()

      // 알림 발송 (best-effort)
      const direction = isUpgrade(agency.tier, newTier) ? '⬆️ 승급' : '⬇️ 강등'
      await DB.prepare(`
        INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
        VALUES (?, 'tier_change', ?, ?, '/agency', datetime('now'))
      `).bind(
        agency.id,
        `${direction} ${newTier.toUpperCase()} 등급으로 변경`,
        `전월 매출 ${lastMonthRevenue.toLocaleString()}원 / 가입 ${ageDays}일 기준`,
      ).run().catch(() => {})

      changed++
      console.log(`[cron:agency-tier-eval] agency=${agency.id} ${agency.tier} → ${newTier} (revenue=${lastMonthRevenue}, age=${ageDays}d)`)
    } else {
      // 등급 동일해도 평가 시각만 업데이트
      await DB.prepare(
        "UPDATE agencies SET tier_evaluated_at = datetime('now') WHERE id = ?"
      ).bind(agency.id).run()
    }
  }

  return { evaluated, changed, by_tier: byTier }
}

function isUpgrade(prev: string, next: string): boolean {
  const order = { new: 0, junior: 1, senior: 2 } as const
  const p = order[prev as keyof typeof order] ?? 0
  const n = order[next as keyof typeof order] ?? 0
  return n > p
}

// 🛡️ R2: 테스트 가능하도록 export.
export { isUpgrade }

/**
 * 등급 산정 — 가입 경과일 + 전월 매출 기준.
 * 순수 함수 (DB 의존 X) — 단위 테스트 용도로 추출.
 */
export function determineTier(args: { ageDays: number; lastMonthRevenue: number }): 'new' | 'junior' | 'senior' {
  if (args.lastMonthRevenue >= SENIOR_THRESHOLD) return 'senior'
  if (args.ageDays >= JUNIOR_AGE_DAYS) return 'junior'
  return 'new'
}

/**
 * tier 별 기본 commission rate (% of revenue).
 * 호환성: agencies.commission_rate 가 별도 설정되어 있으면 그것을 우선.
 */
export function tierBaseCommissionRate(tier: string): number {
  switch (tier) {
    case 'senior': return 2.5
    case 'junior': return 2.0
    case 'new':
    default:       return 1.5
  }
}
