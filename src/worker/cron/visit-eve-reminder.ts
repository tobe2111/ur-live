/**
 * 📅 전화 예약형 이용권 — **방문 전날 알림** (2026-11-23) · 규칙: `worker/utils/visit-plan.ts`
 *
 * 매일 KST 18:40 슬롯. 내일(KST)이 방문 날짜인 미사용 이용권의 손님에게 앱 알림 1건.
 * 🔒 한 번만: `eve_notified_at` 을 CAS 로 먼저 찍고(변경 1행일 때만) 알림을 넣는다 — 날짜를 바꾸면 표시가 지워져 새 날짜에 다시 간다.
 * 앱 알림만 보낸다(알림톡 템플릿은 카카오 심사 대상 — 발송은 결재 C).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { addDays, ensureVisitPlanTable, kstToday, visitWhenLabel } from '../utils/visit-plan'

interface Row { voucher_id: number; user_id: string; visit_date: string; visit_time: string | null; product_name: string | null; restaurant_name: string | null }

export async function runVisitEveReminder(env: { DB: D1Database }, now: number = Date.now()): Promise<{ sent: number }> {
  const DB = env.DB
  await ensureVisitPlanTable(DB)
  const tomorrow = addDays(kstToday(now), 1)
  const { results } = await DB.prepare(
    `SELECT vp.voucher_id, v.user_id, vp.visit_date, vp.visit_time, p.name AS product_name, p.restaurant_name
       FROM voucher_visit_plans vp
       JOIN vouchers v ON v.id = vp.voucher_id AND v.status = 'unused'
       JOIN products p ON p.id = v.product_id
      WHERE vp.visit_date = ? AND vp.eve_notified_at IS NULL
      LIMIT 500`,
  ).bind(tomorrow).all<Row>().catch(() => ({ results: [] as Row[] }))
  let sent = 0
  for (const r of results || []) {
    const claim = await DB.prepare(
      "UPDATE voucher_visit_plans SET eve_notified_at = datetime('now') WHERE voucher_id = ? AND eve_notified_at IS NULL",
    ).bind(r.voucher_id).run().catch(() => null)
    if (Number(claim?.meta?.changes ?? 0) !== 1) continue
    await DB.prepare(
      `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
       VALUES (?, 'user', ?, ?, ?, '/my-vouchers', datetime('now'))`,
    ).bind(r.user_id, `visit_eve_${r.voucher_id}`, '📅 내일 방문 예약이 있어요',
      `${r.restaurant_name || '매장'} · ${visitWhenLabel(r.visit_date, r.visit_time)} — ${r.product_name || '이용권'}. 매장에서 QR 을 보여주세요.`).run().catch(() => null)
    sent++
  }
  return { sent }
}
