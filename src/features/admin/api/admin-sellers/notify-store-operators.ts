/**
 * 🤝 매장 승인 → **위임 운영자(중개사)** 통보 (2026-09-20)
 *
 * 중개사가 등록한 매장은 사장님 승계 전까지 `sellers.linked_user_id` 가 비어 있다. 그래서
 * `PATCH /sellers/:id/approve` 의 기존 알림(연결된 유저에게)은 **아무에게도 안 갔고**, 승인을
 * 기다리던 중개사는 매장 목록을 새로고침해 보는 수밖에 없었다. 2026-09-20 부터 좌석이 승인 전에도
 * 열리므로(`shared/seller-status.ts`) "승인됐다 = 이제 메인에 노출되고 정산이 시작된다" 를 알려야 한다.
 *
 * best-effort — 알림 실패가 승인을 되돌리지 않는다. 연결된 유저(사장님)에게는 호출부가 따로 보내므로 제외.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { executeQuery } from '@/worker/utils/database'
import { notifyUser } from '@/lib/notifications'
import { swallow } from '@/worker/utils/swallow'

export async function notifyStoreOperatorsApproved(
  DB: D1Database,
  sellerId: string | number,
  skipUserId: string | number | null | undefined,
  isReactivation: boolean,
): Promise<void> {
  const ops = await executeQuery<{ user_id: number }>(DB,
    'SELECT user_id FROM seller_operators WHERE seller_id = ? AND revoked_at IS NULL', [sellerId]).catch(() => [] as { user_id: number }[])
  for (const o of ops) {
    if (!o.user_id || String(o.user_id) === String(skipUserId ?? '')) continue
    notifyUser(DB, String(o.user_id), 'store_approved',
      isReactivation ? '🏪 운영 매장 재활성화' : '🏪 운영 매장 승인 완료',
      isReactivation ? '위임받은 매장이 다시 활성화됐어요' : '위임받은 매장이 승인됐어요. 이용권이 메인에 노출되고 정산이 시작돼요',
      '/seller/stores').catch(swallow('admin-sellers:approve-operator-notify'))
  }
}
