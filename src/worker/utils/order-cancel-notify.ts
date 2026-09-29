/**
 * 🔔 주문 취소 알림 3종(어드민 벨 · 셀러 벨 · 손님 인앱) — 한 곳.
 *
 * 취소 경로마다 같은 세 줄이 복붙돼 있었다(전액 / 부분 / 미결제 / 이용권 장 단위…).
 * 한쪽만 고치면 어떤 경로로 취소했는지에 따라 **알림이 오다 말다** 한다 — 사용자는
 * "취소가 된 건가?" 를 묻게 되고, 그 문의는 취소 자체보다 비싸다.
 *
 * 🔒 전부 fail-soft. **알림 실패가 환불을 되돌리면 안 된다** — 돈은 이미 움직였다.
 */
import { swallow } from './swallow'

export interface CancelNotifyTarget {
  order_number: string
  user_id: number | string
  seller_id?: number | string | null
}

export async function notifyOrderCancelled(
  DB: D1Database,
  order: CancelNotifyTarget,
  /** 벨 제목 — '주문 취소' · '부분 취소' · '이용권 일부 환불' 처럼 무엇이 일어났는지. */
  title: string,
  /** 손님에게 보일 한 줄. 없으면 주문번호만. */
  detail?: string,
): Promise<void> {
  const body = detail ? `주문번호: ${order.order_number} · ${detail}` : `주문번호: ${order.order_number}`
  try {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(DB, 'admin', null, 'order_cancelled', title, body, '/admin/orders').catch(swallow('cancel-notify:admin'))
    if (order.seller_id) {
      await createDashboardNotification(DB, 'seller', String(order.seller_id), 'order_cancelled', title, body, '/seller/orders').catch(swallow('cancel-notify:seller'))
    }
    const { notifyUser } = await import('../../lib/notifications')
    await notifyUser(DB, String(order.user_id), 'order_status', title, body, '/my-orders')
  } catch { /* 알림은 있으면 좋은 것이고, 환불은 이미 끝났다 */ }
}
