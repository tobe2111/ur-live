/**
 * ✅ **매장 승인 직후에 할 일** — 한 자리에 모은다 (2026-09-21).
 *
 * ## 왜 모으나
 * 승인 경로가 **둘**이다(`/admin/sellers/:id/approve` · `/admin/tools 의 PUT`). 부수효과를 각
 * 경로에 손으로 붙이면 **한쪽만 붙는 날**이 온다 — 그러면 그 문으로 들어온 매장만 규칙이 안 돌고
 * **에러는 안 난다**(이 레포가 반복해 당한 "조용한 부재"). 호출을 하나로 만들면 빠뜨릴 자리가 준다.
 *
 * ## 전부 fail-soft 다
 * 승인 자체는 이미 끝났다. 여기서 뭐가 실패해도 승인을 되돌리지 않고, 한 훅의 실패가
 * 다른 훅을 막지도 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { markExposureGrace } from './store-verify'
import { queueOwnerNotice } from './store-owner-notice'

export interface ApprovedHookResult {
  graceHours: number
  notice: string
}

export async function runSellerApprovedHooks(
  DB: D1Database,
  sellerId: number,
  prevStatus: string | null | undefined,
): Promise<ApprovedHookResult> {
  // ⏳ 노출 유예 마커 — 기본 OFF, 재승인 제외(store-verify.ts 참조).
  const graceHours = await markExposureGrace(DB, sellerId, prevStatus).catch(() => 0)
  // 📩 사장님 통보 줄 세우기 — 010 만. 발송은 게이트 뒤(store-owner-notice.ts 참조).
  const phone = await DB.prepare('SELECT phone FROM sellers WHERE id = ?')
    .bind(sellerId).first<{ phone: string | null }>().catch(() => null)
  const notice = await queueOwnerNotice(DB, sellerId, phone?.phone).catch(() => 'skip_error')
  return { graceHours, notice }
}
