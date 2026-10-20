/**
 * ⏰ 2026-07-02 (대표 "가장 이상적으로" — #5 승인 SLA): 셀러 승인 대기 리마인드 크론.
 *
 * 배경: 유저→사업자 전환 신청이 pending 인 채 24시간을 넘겨도 운영자에게 재알림이 없어,
 * 최초 벨 알림 한 번을 놓치면 사장님이 무한 대기하던 갭. 매시간 검사하되 어드민 알림은
 * 20시간 dedup(하루 1회꼴) — 알림 피로 없이 잊힘만 방지. fail-soft.
 */
import type { Env } from '../types/env'

export async function handleSellerApprovalReminder(env: Env): Promise<{ pending: number; notified: boolean }> {
  const DB = env.DB
  // 24시간 이상 대기 중인 전환 신청 (linked_user_id 유무 무관 — 모든 pending 셀러).
  const row = await DB.prepare(
    `SELECT COUNT(*) AS cnt, MIN(created_at) AS oldest
       FROM sellers WHERE status = 'pending' AND created_at < datetime('now', '-24 hours')`
  ).first<{ cnt: number; oldest: string | null }>().catch(() => null)
  const pending = Number(row?.cnt || 0)
  if (!pending) return { pending: 0, notified: false }

  // dedup: 최근 20시간 내 같은 리마인드가 이미 있으면 skip (하루 1회꼴).
  const dup = await DB.prepare(
    `SELECT 1 FROM dashboard_notifications
      WHERE recipient_type = 'admin' AND type = 'seller_pending_reminder'
        AND created_at > datetime('now', '-20 hours') LIMIT 1`
  ).first().catch(() => null)
  if (dup) return { pending, notified: false }

  const oldestDays = row?.oldest
    ? Math.max(1, Math.floor((Date.now() - Date.parse(row.oldest.replace(' ', 'T') + 'Z')) / 86_400_000))
    : 1
  const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
  await createDashboardNotification(
    DB, 'admin', null, 'seller_pending_reminder',
    `⏰ 셀러 승인 대기 ${pending}건`,
    `24시간 이상 대기 중입니다 (최장 ${oldestDays}일). 사장님이 기다리고 있어요 — 승인 페이지에서 처리해주세요.`,
    '/admin/seller-approval',
  ).catch(() => { /* fail-soft */ })
  return { pending, notified: true }
}
