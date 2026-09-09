/**
 * 🪑 **매장 소유권 이전** — 설계 SSOT: `docs/design/store-operator-model.md` §5(3단계)
 *
 * 대표 확정 2026-09-09: *"지금은 유저가 없어서 지금 하면 좋은 게 아닐까"* → 3단계 착수.
 *
 * ## 무엇을 하나
 * 중개자가 대신 올린 매장의 **주인 자리**를 진짜 사장님에게 넘긴다. 상품·주문·리뷰·정산 이력은
 * 전부 매장에 남는다(관계만 바뀐다 — 이 모델이 존재하는 이유).
 *
 *   이전 주인(있으면) → `operator` 로 **강등**(회수가 아니다)
 *   새 주인          → `owner`
 *
 * ## 🔑 절대 건드리지 않는 것 — 영입 보상
 * 설계 §5(c) 가 **"이게 설계의 핵심"** 이라고 못 박은 조항이다:
 *
 *   > 관계가 끊기면 수입도 끊긴다고 하면, **중개자는 사장님이 직접 계정 만드는 걸 막는다.**
 *   > 사장님을 플랫폼에서 숨기고 자기가 유일한 창구로 남으려 한다.
 *
 * ⇒ `introduced_by_influencer_id` · `introduced_by_agency_id` · `introduced_at` ·
 *   `referral_bonus_until` 은 **이 함수가 절대 쓰지 않는다.** 운영권을 잃어도 영입 커미션은
 *   계약기간까지 그대로 간다. (가드가 이 불변식을 고정한다.)
 *
 * ## 🔒 돈이 먼저다 — 자물쇠를 반드시 통과한다
 * 이전 주인 몫이 남아 있으면 이전을 **막는다**(`checkStoreHandover`). 대표 확정:
 * *"중개사가 한 매장으로 번 돈이 있으면 그 돈은 승계가 되더라도 일단 중개사에게 정산되어야지."*
 * 마감은 `POST /api/admin/payouts/handover-closeout` 이 한다 — 이 함수는 **송금하지 않는다.**
 *
 * ## ⚠️ 끝나면 주인 자리는 **정확히 하나**여야 한다
 * 옛 칸(`linked_user_id`)은 비우고, 남아 있던 **다른 `owner` 행도 전부 강등**한다.
 *
 * 🩸 처음엔 이전 주인 한 사람만 강등했다. 그런데 `resolveStoreOwnerUserId` 는 linked 를 먼저 보고,
 *   없으면 `owner` 행 중 **가장 먼저 부여된 것**을 고른다 — 두 신호가 어긋난 매장에서 옛 owner 행이
 *   남으면 이전이 끝난 뒤에도 **새 주인이 주인이 아니게 된다**(에러 없이). 시험이 그걸 잡았다.
 *
 * (같은 이유로 "linked 가 제3자를 가리키면 막는다"는 분기는 **없앴다** — linked 가 있으면 그 사람이
 *  정의상 주인이라 그 조건은 영원히 거짓인 죽은 가지였다. 실제 위험은 제3자가 아니라 위의 중복 owner 다.)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { grantOperator, resolveStoreOwnerUserId } from './seller-operators'
import { checkStoreHandover, STORE_HANDOVER_BLOCKED } from './store-handover-guard'

export interface TransferResult {
  ok: boolean
  code?: 'BAD_INPUT' | 'STORE_NOT_FOUND' | 'SAME_OWNER' | 'OWNER_UNKNOWN'
    | typeof STORE_HANDOVER_BLOCKED | 'GRANT_FAILED'
  error?: string
  /** 이전 주인(없었으면 null) — 감사로그·화면이 "누구에게서 누구로" 를 적을 수 있게. */
  previousOwnerId?: number | null
  receivable?: number
}

/**
 * `actorUserId` 는 **소비자 user id** 다 — 어드민이 대신 지정하면 `null` 을 넘긴다.
 * (어드민 id 를 사용자 id 칸에 적으면 두 id 공간이 섞인다. 어드민 흔적은 감사로그가 남긴다.)
 */
export async function transferStoreOwnership(
  DB: D1Database,
  params: { sellerId: number; nextUserId: number; actorUserId: number | null },
): Promise<TransferResult> {
  const { sellerId, nextUserId, actorUserId } = params
  if (!Number.isInteger(sellerId) || sellerId <= 0) return { ok: false, code: 'BAD_INPUT', error: '매장이 올바르지 않습니다' }
  if (!Number.isInteger(nextUserId) || nextUserId <= 0) return { ok: false, code: 'BAD_INPUT', error: '대상 사용자가 올바르지 않습니다' }

  const seller = await DB.prepare('SELECT id, linked_user_id FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId).first<{ id: number; linked_user_id: number | null }>().catch(() => undefined)
  if (seller === undefined) return { ok: false, code: 'OWNER_UNKNOWN', error: '매장 정보를 확인할 수 없습니다' }
  if (!seller) return { ok: false, code: 'STORE_NOT_FOUND', error: '매장을 찾을 수 없습니다' }

  const prev = await resolveStoreOwnerUserId(DB, sellerId)
  // 모름은 통과가 아니다 — 근거 없이 주인을 바꾸면 이전 주인 몫을 놓친다.
  if (prev === undefined) return { ok: false, code: 'OWNER_UNKNOWN', error: '현재 소유자를 확인할 수 없어 보류했습니다' }
  if (prev !== null && Number(prev) === Number(nextUserId)) {
    return { ok: false, code: 'SAME_OWNER', error: '이미 이 사용자가 소유자입니다', previousOwnerId: prev }
  }

  const linked = seller.linked_user_id == null ? null : Number(seller.linked_user_id)

  // 💰 자물쇠 — 이전 주인 몫이 남아 있으면 여기서 멈춘다.
  const gate = await checkStoreHandover(DB, sellerId, nextUserId)
  if (gate.blocked) {
    return { ok: false, code: STORE_HANDOVER_BLOCKED, error: gate.reason, previousOwnerId: prev, receivable: gate.receivable }
  }

  // 새 주인 먼저 — 실패하면 아무도 강등하지 않는다(주인 없는 매장을 만들지 않는다).
  const granted = await grantOperator(DB, sellerId, nextUserId, actorUserId, 'owner')
  if (!granted.ok) return { ok: false, code: 'GRANT_FAILED', error: '소유자 지정에 실패했습니다', previousOwnerId: prev }

  // 이전 주인은 회수가 아니라 강등 — 그가 올려 둔 것을 계속 운영할 수 있어야 한다(설계 §5(a)).
  // 🔴 "이전 주인 한 명"이 아니라 **새 주인 외의 모든 owner 행**을 강등한다. 남은 owner 행 하나가
  //    `resolveStoreOwnerUserId`(granted_at 순 첫 행)에서 새 주인을 이길 수 있다.
  await DB.prepare(
    `UPDATE seller_operators SET role = 'operator'
      WHERE seller_id = ? AND user_id != ? AND role = 'owner' AND revoked_at IS NULL`,
  ).bind(sellerId, nextUserId).run().catch(() => { /* 강등 실패가 이전을 되돌리지는 않는다 */ })

  // 두 신호가 다른 사람을 가리키지 않게 — 옛 칸은 정의상 이전 주인이므로 비운다.
  if (linked !== null) {
    await DB.prepare(`UPDATE sellers SET linked_user_id = NULL, updated_at = datetime('now') WHERE id = ? AND linked_user_id = ?`)
      .bind(sellerId, linked).run().catch(() => { /* best-effort */ })
  }

  return { ok: true, previousOwnerId: prev }
}
