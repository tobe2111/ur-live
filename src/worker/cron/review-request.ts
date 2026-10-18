/**
 * ⭐ 2026-10-18 — 이용권을 쓴 다음 날 후기를 부탁한다 (대표 "5번 하자").
 *
 * 왜: 손님이 매장에서 이용권을 써도 후기를 부탁하는 장치가 없었다. 상품 페이지의 후기는
 * 다음 손님의 결정 근거이고, AI 검색이 인용하는 문장이기도 하다.
 *
 * 무엇을: 하루 1회(growth 배치) — 24~48시간 전에 사용된 이용권 중
 *   · 그 손님이 그 상품에 아직 후기를 안 썼고
 *   · 0원 체험권·데모 상품이 아니고
 *   · 같은 이용권으로 부탁한 적이 없는 것
 * 에 **앱 안 알림 한 건**만 남긴다(카톡·문자 없음 — 템플릿 검수와 비용이 필요한 경로라 범위 밖).
 *
 * 🔒 게이트 `review_request_enabled` — 기본 OFF(손님에게 나가는 메시지라 대표가 켠다).
 * 머니 경로 무접촉. 한 번에 최대 300건.
 */
import type { Env } from '../types/env'
import { settingOn, REVIEW_REQUEST_GATE } from '../utils/owner-nudges'

type Row = { voucher_id: number; user_id: string; product_id: number; product_name: string | null; store_name: string | null; category: string | null }

export const REVIEW_REQUEST_LIMIT = 300

/** 알림이 열 상품 페이지 — 숙소는 정본이 /stays, 나머지 이용권은 /pass. */
export function reviewLink(productId: number, category: string | null): string {
  return category === 'stay_voucher' ? `/stays/${productId}` : `/pass/${productId}`
}

export const REVIEW_REQUEST_SQL = `
  SELECT v.id AS voucher_id, v.user_id AS user_id, p.id AS product_id, p.name AS product_name,
         p.restaurant_name AS store_name, p.category AS category
  FROM vouchers v JOIN products p ON p.id = v.product_id
  WHERE v.status = 'used'
    AND v.used_at >= datetime('now', '-48 hours') AND v.used_at < datetime('now', '-24 hours')
    AND COALESCE(v.is_experience, 0) = 0
    AND COALESCE(p.slug, '') NOT LIKE 'demo-%'
    AND NOT EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.product_id = p.id AND CAST(pr.user_id AS TEXT) = CAST(v.user_id AS TEXT))
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = v.user_id AND n.type = 'review_request_' || v.id)
  ORDER BY v.used_at ASC
  LIMIT ?`

export async function handleReviewRequest(env: Env): Promise<{ sent: number; skipped?: string }> {
  const DB = env.DB
  if (!DB) return { sent: 0, skipped: 'no_db' }
  if (!(await settingOn(DB, REVIEW_REQUEST_GATE))) return { sent: 0, skipped: 'gate_off' }

  const rows = (await DB.prepare(REVIEW_REQUEST_SQL).bind(REVIEW_REQUEST_LIMIT).all<Row>()
    .catch(() => ({ results: [] as Row[] }))).results || []
  let sent = 0
  for (const r of rows) {
    const name = r.product_name || '이용권'
    const where = r.store_name ? `${r.store_name}에서 ` : ''
    const res = await DB.prepare(
      `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
       VALUES (?, 'user', ?, ?, ?, ?, datetime('now'))`,
    ).bind(
      r.user_id, `review_request_${r.voucher_id}`,
      `${name}, 어떠셨나요?`,
      `${where}이용하신 경험을 짧게 남겨 주세요. 다음 손님에게 큰 도움이 돼요.`,
      reviewLink(r.product_id, r.category),
    ).run().catch(() => null)
    if (res) sent++
  }
  return { sent }
}
