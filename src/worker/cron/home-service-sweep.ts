/**
 * 🏠 생활 견적 정리 — 매시 :25 (2026-10-24, 결재 `docs/decisions/2026-10-24-home-service-quotes.md`)
 *
 * ① 손님이 견적을 **한 번도 안 열어 본 채** 첫 견적 뒤 48시간 → 요청 만료 + 보낸 참여권 전부 반환.
 *    사장님은 손님을 못 만났으니 돈을 돌려받는다(대표 확정).
 * ② 희망 날짜가 지난 열린 요청 → 만료. 손님이 열어 봤다면 반환하지 않는다(견적은 전달됐다).
 *
 * ③ 업체를 고르고 희망 날짜가 지났는데 후기가 없으면 → 손님에게 후기 부탁 **앱 알림 한 번**(2026-10-26 대표 "후기 기능").
 *    알림톡이 아니라 앱 알림이다(새 알림톡 문구는 심사가 필요하다). `review_asked_at` CAS 로 한 번만.
 *
 * 반환은 `refundQuote` 가 견적 상태 CAS + 원장 UNIQUE 로 하므로 이 cron 이 두 번 돌아도 한 번만 돌려준다.
 */
import type { Env } from '../types/env'
import { UNVIEWED_REFUND_HOURS } from '../../shared/home-service'
import { kstYmd } from '../../shared/stays-early'
import { ensureHomeServiceTables, refundAllQuotes } from '../../features/home-service/api/home-service-db'
import { categoryDef, type HomeServiceCategory } from '../../shared/home-service'
import { notifyUser } from '../../lib/notifications'

export async function runHomeServiceSweep(env: Env): Promise<{ unviewed: number; dated: number; refunded: number; reviewAsked: number }> {
  const DB = env.DB
  await ensureHomeServiceTables(DB)
  let refunded = 0

  const { results: stale } = await DB.prepare(
    `SELECT id FROM home_service_requests
      WHERE status = 'open' AND quote_count > 0 AND customer_viewed_at IS NULL
        AND first_quote_at < datetime('now', ?)
      LIMIT 100`,
  ).bind(`-${UNVIEWED_REFUND_HOURS} hours`).all<{ id: number }>()
  for (const r of stale ?? []) {
    const upd = await DB.prepare(
      `UPDATE home_service_requests SET status = 'expired', updated_at = datetime('now')
        WHERE id = ? AND status = 'open' AND customer_viewed_at IS NULL`,
    ).bind(r.id).run()
    if (upd.meta?.changes) refunded += await refundAllQuotes(DB, r.id, `손님이 ${UNVIEWED_REFUND_HOURS}시간 동안 견적을 안 열어 봄`)
  }

  const { results: past } = await DB.prepare(
    `SELECT id, customer_viewed_at FROM home_service_requests
      WHERE status = 'open' AND desired_date < ? LIMIT 200`,
  ).bind(kstYmd(0)).all<{ id: number; customer_viewed_at: string | null }>()
  for (const r of past ?? []) {
    const upd = await DB.prepare(
      `UPDATE home_service_requests SET status = 'expired', updated_at = datetime('now') WHERE id = ? AND status = 'open'`,
    ).bind(r.id).run()
    if (upd.meta?.changes && !r.customer_viewed_at) refunded += await refundAllQuotes(DB, r.id, '희망 날짜가 지나도록 손님이 견적을 안 열어 봄')
  }
  let reviewAsked = 0
  const { results: done } = await DB.prepare(
    `SELECT r.id, r.user_id, r.category FROM home_service_requests r
      WHERE r.status = 'chosen' AND r.review_asked_at IS NULL AND r.desired_date < ?
        AND NOT EXISTS (SELECT 1 FROM home_service_reviews v WHERE v.request_id = r.id)
      LIMIT 100`,
  ).bind(kstYmd(0)).all<{ id: number; user_id: number; category: HomeServiceCategory }>()
  for (const r of done ?? []) {
    const upd = await DB.prepare(
      `UPDATE home_service_requests SET review_asked_at = datetime('now') WHERE id = ? AND review_asked_at IS NULL`,
    ).bind(r.id).run()
    if (!upd.meta?.changes) continue
    const label = categoryDef(r.category)?.label || '생활'
    await notifyUser(DB, String(r.user_id), 'home_service_review', `${label} 어떠셨어요?`, '고른 업체의 후기를 남겨 주세요. 다음 손님이 업체를 고를 때 큰 도움이 돼요.', `/life/requests/${r.id}`)
    reviewAsked++
  }
  return { unviewed: stale?.length ?? 0, dated: past?.length ?? 0, refunded, reviewAsked }
}
