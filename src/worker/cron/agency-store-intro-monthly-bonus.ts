/**
 * 🛡️ 2026-05-20: 에이전시 입점 가게 월 성장 보너스 cron.
 *
 * 매월 1일 18 UTC 실행.
 *   - 전월 1일~말일 매출 집계 (각 introduced store 마다)
 *   - 월 매출 ≥ ₩1,000,000 (1M) 이면 → 해당 가게의 introducer 에이전시에게 ₩50,000 보너스
 *   - UNIQUE(order_id=NULL, type='growth_bonus') 으로 월별 중복 방지 → note 에 'YYYY-MM' 포함
 *
 * Fail-soft: 개별 가게 실패해도 다른 가게 진행.
 */

import type { Env } from '../types/env'

const GROWTH_BONUS_THRESHOLD = 1_000_000  // ₩1,000,000 월 매출
const GROWTH_BONUS_AMOUNT = 50_000        // ₩50,000 보너스

export async function runAgencyStoreIntroMonthlyBonus(env: Env): Promise<{
  processed: number
  awarded: number
  totalAmount: number
}> {
  const DB = env.DB

  // 전월 범위 (UTC 기준 — 한국 시간 보정은 결제 시점 기준이라 큰 영향 없음)
  const now = new Date()
  // 🔐 2026-06-11 (정합성 감사): 전월 yearMonth — getUTCMonth()(0-indexed)가 곧 전월의 1-indexed.
  //   단 1월(month=0)이면 "YYYY-00" 가 되던 버그 → 전년 12월로 정정.
  const _pm = now.getUTCMonth() === 0 ? { y: now.getUTCFullYear() - 1, m: 12 } : { y: now.getUTCFullYear(), m: now.getUTCMonth() }
  const yearMonth = `${_pm.y}-${String(_pm.m).padStart(2, '0')}`
  const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString()
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  let processed = 0
  let awarded = 0
  let totalAmount = 0

  try {
    // 1. 전월 매출 집계 — introduced 가게만 (introduced_by_agency_id IS NOT NULL).
    const monthlySales = await DB.prepare(
      `SELECT s.id as seller_id, s.introduced_by_agency_id as agency_id,
              COALESCE(SUM(o.total_amount), 0) as monthly_total
         FROM sellers s
         JOIN orders o ON o.seller_id = s.id
        WHERE s.introduced_by_agency_id IS NOT NULL
          AND o.status IN ('PAID', 'DONE', 'SHIPPING', 'COMPLETED')
          AND o.created_at >= ? AND o.created_at < ?
        GROUP BY s.id, s.introduced_by_agency_id
        HAVING monthly_total >= ?`
    ).bind(startOfPrevMonth, startOfThisMonth, GROWTH_BONUS_THRESHOLD)
      .all<{ seller_id: number; agency_id: number; monthly_total: number }>()
      .catch(() => ({ results: [] as Array<{ seller_id: number; agency_id: number; monthly_total: number }> }))

    for (const row of (monthlySales.results || [])) {
      processed++
      const note = `[월 성장 보너스 ${yearMonth}] 가게 #${row.seller_id} 월매출 ₩${row.monthly_total.toLocaleString()}`

      // 🛡️ 2026-06-26 [머니] 동월 중복 방지를 원자적 INSERT...WHERE NOT EXISTS 한 문장으로 통합.
      //   기존엔 별도 SELECT 체크 후 INSERT(레이스 — 같은 UTC일 재진입 시 이중 INSERT 여지) +
      //   INSERT 실패가 `.catch(()=>null)` 로 삼켜지는데 awarded++ 는 무조건 실행(미적립을 적립으로 오보고)이었음.
      //   이제 한 문장 원자 처리 + meta.changes 게이트로 실제 적립된 건만 카운트(claim-before-credit).
      const ins = await DB.prepare(
        `INSERT INTO agency_store_intro_commissions
           (agency_id, store_seller_id, order_id, type, order_amount, commission_amount, status, note)
         SELECT ?, ?, NULL, 'growth_bonus', ?, ?, 'pending', ?
          WHERE NOT EXISTS (
            SELECT 1 FROM agency_store_intro_commissions
             WHERE store_seller_id = ? AND type = 'growth_bonus' AND note LIKE ?
          )`
      ).bind(row.agency_id, row.seller_id, row.monthly_total, GROWTH_BONUS_AMOUNT, note, row.seller_id, `%${yearMonth}%`)
        .run().catch(() => null)

      if ((ins?.meta?.changes ?? 0) > 0) {
        awarded++
        totalAmount += GROWTH_BONUS_AMOUNT
      }
    }
  } catch { /* fail-soft */ }

  return { processed, awarded, totalAmount }
}
