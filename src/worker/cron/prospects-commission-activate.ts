/**
 * 🛡️ 2026-05-27 (영업 검증 Layer 4): 첫 매출 발생 시 prospect commission 활성.
 *
 * 단순 가입만으론 commission 0. 매장이 실제 매출 발생 시만 영업 commission lock-in.
 * 부정 방지: 영업자가 가짜 가입 시켜도 매출 없으면 commission 0.
 *
 * 동작:
 *   1. seller_prospects WHERE status='converted' AND first_sale_at IS NULL
 *   2. 각 prospect 의 converted_seller_id 의 orders 첫 paid 매출 검색
 *   3. 발견 시: first_sale_at + commission_locked_at 기록 → 영업 보너스 활성
 *
 * 매시간 cron. idempotent (이미 first_sale_at 있으면 skip).
 */

import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

export async function handleProspectsCommissionActivate(env: Env): Promise<void> {
  try {
    // 활성 prospects — 매출 발생 대기 중
    const { results: pendingProspects } = await env.DB.prepare(
      `SELECT id, converted_seller_id, introducer_type, introducer_id
         FROM seller_prospects
        WHERE status = 'converted'
          AND converted_seller_id IS NOT NULL
          AND first_sale_at IS NULL
        LIMIT 200`,
    ).all<{ id: number; converted_seller_id: number; introducer_type: string; introducer_id: string }>().catch(() => ({ results: [] as any[] }))

    if (pendingProspects.length === 0) return
    let activated = 0

    for (const p of pendingProspects) {
      try {
        // 매장의 첫 paid 매출 찾기
        const firstSale = await env.DB.prepare(
          `SELECT MIN(created_at) AS first_at FROM orders
            WHERE seller_id = ?
              AND payment_status IN ('approved', 'paid')`
        ).bind(p.converted_seller_id).first<{ first_at: string | null }>().catch(() => null)

        if (firstSale?.first_at) {
          await env.DB.prepare(
            `UPDATE seller_prospects SET
                first_sale_at = ?,
                commission_locked_at = datetime('now'),
                updated_at = datetime('now')
              WHERE id = ?`
          ).bind(firstSale.first_at, p.id).run()
          activated++

          // 어드민 알림 (영업 commission 활성)
          // 🛡️ 2026-07-01: 실제 테이블은 dashboard_notifications (없는 admin_notifications·body 컬럼 참조로
          //   조용히 실패 → 어드민 벨에 안 뜸). recipient_type='admin'/recipient_id=NULL(전체 어드민)·message 로 교정.
          await env.DB.prepare(
            `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
             VALUES ('admin', NULL, 'prospect_first_sale', '영업 commission 활성', ?, '/admin/prospects', datetime('now'))`
          ).bind(
            `prospect #${p.id} (${p.introducer_type} ${p.introducer_id}) 의 매장 #${p.converted_seller_id} 첫 매출 발생 → commission lock-in`
          ).run().catch(() => null)
        }
      } catch (e) {
        logError('[cron] prospects-commission-activate per-row', { error: String(e), prospect_id: p.id })
      }
    }

    if (activated > 0) {
      logInfo(`[cron] prospects-commission-activate: ${activated} activated`)
    }

    // 🛡️ 2026-05-27 (Step G): D-3 만료 임박 prospects → 영업자에게 admin 알림 (push 대체).
    //   영업자가 사장님에게 다시 연락 / 회수 결정 가능.
    //   admin_notifications 테이블 INSERT (영업자가 본인 dashboard 에서 확인).
    const { results: expiringSoon } = await env.DB.prepare(
      `SELECT id, introducer_type, introducer_id, store_name, contact_phone, expires_at
         FROM seller_prospects
        WHERE status = 'visiting'
          AND expires_at IS NOT NULL
          AND expires_at > datetime('now')
          AND expires_at <= datetime('now', '+3 days')
          AND (last_expiry_notified_at IS NULL OR last_expiry_notified_at <= datetime('now', '-1 day'))
        LIMIT 100`
    ).all<{ id: number; introducer_type: string; introducer_id: string; store_name: string | null; contact_phone: string | null; expires_at: string }>().catch(() => ({ results: [] as any[] }))

    for (const p of expiringSoon ?? []) {
      try {
        const daysLeft = Math.max(0, Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / (24 * 60 * 60_000)))
        await env.DB.prepare(
          `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
           VALUES ('admin', NULL, 'prospect_expiring', '영업 prospect 만료 임박', ?, '/admin/prospects', datetime('now'))`
        ).bind(
          `${p.introducer_type} #${p.introducer_id} 의 prospect (${p.store_name || p.contact_phone}) D-${daysLeft}`
        ).run().catch(() => null)
        // 알림 발송 시각 기록 (1일 1회 dedup)
        await env.DB.prepare(
          `UPDATE seller_prospects SET last_expiry_notified_at = datetime('now') WHERE id = ?`
        ).bind(p.id).run().catch(() => null)
      } catch { /* graceful */ }
    }

    // 만료 처리 — expires_at 지난 visiting prospect status='expired'
    await env.DB.prepare(
      `UPDATE seller_prospects SET status = 'expired', updated_at = datetime('now')
        WHERE status = 'visiting' AND expires_at IS NOT NULL AND expires_at <= datetime('now')`
    ).run().catch(() => null)
  } catch (e) {
    logError('[cron] prospects-commission-activate FAILED', { error: String(e) })
  }
}
