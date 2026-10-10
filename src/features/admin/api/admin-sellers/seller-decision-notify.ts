/**
 * 📣 매장 승인·반려 통보 — **받을 사람에게 닿게** (2026-10-10 사장님·중개사 플로우 전수조사)
 *
 * 승인 알림톡은 `sellers.phone`(매장 대표번호 — 대부분 유선)으로만 가서 라이브 13곳 중 12곳에
 * **한 번도 안 갔다**. 반려는 더 나빴다 — 알림이 `linked_user_id`(사장님 승계 전엔 비어 있다)에게만
 * 가서, **중개사가 등록한 매장이 반려돼도 그 중개사는 아무 연락을 못 받았다**(승인은 2026-09-20 에
 * 운영자 통보가 붙었는데 반려에는 그 짝이 없었다). 반려 사유도 함께 보낸다 — "반려됐다" 만으로는
 * 고칠 수가 없다.
 *
 * best-effort — 통보 실패가 승인·반려를 되돌리지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { executeQuery } from '@/worker/utils/database'
import { notifyUser } from '@/lib/notifications'
import { swallow } from '@/worker/utils/swallow'
import { resolveSellerNotifyTarget } from '@/worker/utils/seller-notify-phone'

/** 승인·재활성 알림톡. 문안·tpl_code 는 종전과 byte-동일(카카오 템플릿 글자 일치) — 받는 번호만 고친다. */
export async function sendSellerApprovalAlimtalk(env: unknown, DB: D1Database, sellerId: string | number, isReactivation: boolean): Promise<void> {
  const target = await resolveSellerNotifyTarget(DB as unknown as globalThis.D1Database, sellerId)
  if (!target?.phone) return
  const sellerName = target.name || ''
  const { sendSystemAlimtalk } = await import('../../../../lib/system-alimtalk')
  await sendSystemAlimtalk(env, target.phone,
    isReactivation ? 'seller_reactivated' : 'seller_approved',
    isReactivation
      ? `[유어딜] ${sellerName}님,\n계정이 다시 활성화되었어요.\n판매를 이어가실 수 있습니다.`
      : `[유어딜] ${sellerName}님,\n셀러 가입이 승인되었어요!\n지금 바로 판매를 시작해보세요.`,
  ).catch(swallow('admin-sellers:approve-alimtalk'))
}

/** 반려 → 위임 운영자(중개사)·승계한 사장님에게 앱 알림. 연결된 유저는 호출부가 따로 보내므로 제외. */
export async function notifyStoreOperatorsRejected(
  DB: D1Database,
  sellerId: string | number,
  skipUserId: string | number | null | undefined,
  reason: string | null,
): Promise<void> {
  const ops = await executeQuery<{ user_id: number; role: string | null }>(DB,
    'SELECT user_id, role FROM seller_operators WHERE seller_id = ? AND revoked_at IS NULL', [sellerId])
    .catch(() => [] as { user_id: number; role: string | null }[])
  for (const o of ops) {
    if (!o.user_id || String(o.user_id) === String(skipUserId ?? '')) continue
    const owner = o.role === 'owner'
    notifyUser(DB, String(o.user_id), 'store_rejected',
      owner ? '🏪 내 매장 심사 결과' : '🏪 운영 매장 심사 결과',
      `${owner ? '매장이' : '위임받은 매장이'} 반려됐어요.${reason ? ` 사유: ${reason}` : ''} 고쳐서 다시 제출할 수 있어요`,
      '/seller/business-info').catch(swallow('admin-sellers:reject-operator-notify'))
  }
}

/**
 * ✅ 승인 = 등록증 확인 (2026-10-10). 어드민은 승인 화면에서 **등록증을 보고** 승인한다 — 그런데 등록증
 * 상태가 따로 'pending' 에 남아, 승인된 매장이 셀러 화면에서 계속 "등록증 확인 중" 으로 보였고
 * 어드민은 같은 서류를 검증 큐에서 한 번 더 처리해야 했다. 사본이 있고 아직 대기일 때만 바꾼다
 * (반려된 서류를 승인이 덮어쓰지 않는다 — 그건 어드민이 검증 큐에서 다시 판단할 일이다).
 */
export async function markCertVerifiedOnApproval(DB: D1Database, sellerId: string | number): Promise<boolean> {
  const r = await DB.prepare(
    `UPDATE sellers SET business_registration_status = 'verified', business_registration_verified_at = datetime('now')
      WHERE id = ? AND COALESCE(business_registration_image_url, '') <> '' AND business_registration_status = 'pending'`,
  ).bind(sellerId).run().catch(() => null)
  return Number(r?.meta?.changes ?? 0) === 1
}
