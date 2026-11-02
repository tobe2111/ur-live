/**
 * 🔔 어드민 "업무" 알림 — 가입·입점·구매 같은 사람·돈 사건을 어드민 종에 올리는 **한 함수** (2026-11-02)
 *
 * 대표: *"유저 가입, 에이전시 가입 이런 중요한 것들은 알람이 하나도 안 오고 있어. 교환권 교환, 이용권 구입 등."*
 * 실측(2026-11-02): 어드민 알림 427건 중 가입·구매 알림 **0건** — 크론 실패·일일 요약만 쌓였다.
 *
 * 규칙
 *   • 종류(type)는 `shared/notification-catalog.ts` 의 `ADMIN_NOTIF_GROUP` 에 등록된 것만 쓴다(시험이 강제).
 *   • **절대 본 동작을 막지 않는다** — 알림 실패는 삼킨다. 가입·결제는 이미 끝난 일이다.
 *   • 요청 경로에서는 `scheduleAdminEvent` 로 응답 **뒤에** 보낸다(로그인·결제 체감 속도 0ms).
 *   • 문구는 한 줄 — 무엇이 · 누가 · 얼마. 내부 id 나열 금지.
 */
import type { Context } from 'hono'

export type AdminEventType =
  | 'user_signup' | 'agency_signup' | 'store_registered'
  | 'voucher_purchased' | 'gifticon_purchased'

export interface AdminEvent {
  type: AdminEventType
  title: string
  message?: string
  link?: string
}

export async function notifyAdminEvent(DB: D1Database, ev: AdminEvent): Promise<void> {
  try {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(DB, 'admin', null, ev.type, ev.title.slice(0, 80), ev.message?.slice(0, 160), ev.link)
  } catch { /* fail-soft — 알림이 본 동작을 막지 않는다 */ }
}

/** 응답 뒤에 보낸다(waitUntil). 컨텍스트가 없으면 그 자리에서. */
export async function scheduleAdminEvent(c: Pick<Context, 'executionCtx'>, DB: D1Database, ev: AdminEvent): Promise<void> {
  const run = notifyAdminEvent(DB, ev)
  try {
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(run); return }
  } catch { /* no ctx */ }
  await run
}

/** "홍대 돈가스 세트 ×1" / "A 외 2건" — 상품 줄 한 줄 요약. */
export function summarizeItems(names: string[], qty?: number): string {
  const list = names.map((n) => String(n || '').trim()).filter(Boolean)
  if (list.length === 0) return ''
  const head = list[0]!.slice(0, 30)
  if (list.length > 1) return `${head} 외 ${list.length - 1}건`
  return qty && qty > 1 ? `${head} ×${qty}` : head
}

export function won(n: unknown): string {
  const v = Number(n)
  return Number.isFinite(v) ? `${Math.round(v).toLocaleString('ko-KR')}원` : ''
}
