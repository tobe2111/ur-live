/**
 * 🔐 매장 손바뀜 잠금 — **미지급 잔액이 남은 매장의 주인을 바꾸지 않는다** (2026-09-07 대표 지시)
 *
 * ## 왜 필요한가 (대표 질문에서 출발)
 * 대표: *"매장 가져오는 것에선 돈까지 귀속이 되면 안되지, 귀속되는 시점부터 계산해서
 * 성과 수익이 계산되어야 하지 않을까?"*
 *
 * 맞다. 그런데 지금 구조는 정반대다:
 *   - 원장 계정은 `seller:N` **문자열뿐**이고 "누구 것인지" 를 적는 칸이 없다(`ledger.ts` 스키마).
 *   - payout 집계에 **`created_at` 필터가 없다** — 전기간 누적이다(`payouts-generate.ts:44-55`).
 *     이건 실수가 아니라 2026-06-26 의 의도적 변경이다(주 단위로 자르니 누락된 주의 정산금이
 *     영영 재포착되지 않았다). **평상시엔 맞고, 손바뀜 경계에서만 틀린다.**
 *   - 송금 목적지는 `sellers.bank_account` 하나다(`payouts-generate.ts:85`).
 *
 * ⇒ 주인을 바꾸고 계좌를 갈면 **그 매장이 창업 이래 쌓은 미지급 잔액 전액이 다음 주 cron 에서
 *   통째로 새 계좌로 나간다.** 되돌릴 수 없는 오지급이고, 에러도 안 난다.
 *
 * ## 이 파일이 하는 일 — 승계를 만드는 게 아니라 **사고를 막는 것**
 * 승계 기능(`owner_verified`)은 아직 코드가 없다(레포 전체 grep 0건). 그래서 지금 필요한 것은
 * 정교한 승계 절차가 아니라, **그런 절차 없이 주인이 바뀌는 것을 막는 자물쇠**다.
 * 잔액이 0 이면 아무 일도 안 하고(=오늘까지의 모든 정상 흐름 그대로), 잔액이 남아 있을 때만 막는다.
 *
 * 그러면 나중에 승계를 만드는 사람이 **이 자물쇠를 반드시 마주치게 되고**, 그 자리에서
 * "이전 주인에게 정산하고 0 으로 마감" 을 설계하게 된다. 결정 문서:
 * `docs/decisions/2026-09-07-store-handover-money-cut.md`
 *
 * ## ⚠️ 이 가드가 **막지 못하는 것** (과신 금지)
 *   - 잔액이 0 인 상태의 손바뀜은 그대로 통과한다 — 그게 의도다(줄 돈이 없으니 샐 돈도 없다).
 *   - 손바뀜 **이후** 발생한 매출은 여전히 매장 계정에 쌓인다. "귀속 시점부터 계산" 의
 *     나머지 절반(원장을 시점으로 자르기)은 승계 기능과 함께 지어야 한다.
 *   - **최초 연결**(`linked_user_id` 가 NULL → 값)은 손바뀜이 아니므로 검사하지 않는다.
 *   - `seller_operators` 로 운영자를 추가하는 것도 손바뀜이 아니다(정산 목적지가 안 바뀐다).
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface HandoverCheck {
  /** 막아야 하는가 */
  blocked: boolean
  /** 남은 미지급 잔액(원). 막지 않을 때는 0 이거나 계산 생략. */
  receivable: number
  /** 사용자에게 보일 이유 — blocked 일 때만 채워진다. */
  reason?: string
  /** 종전 소유자(있으면). 감사·통지용. */
  prevUserId?: number | null
}

/** 응답 코드 — 화면이 이 코드로 분기할 수 있게 고정한다. */
export const STORE_HANDOVER_BLOCKED = 'STORE_HANDOVER_BLOCKED'

/**
 * 이 매장의 주인을 `nextUserId` 로 바꿔도 되는가.
 *
 * @param sellerId 대상 매장
 * @param nextUserId 새 주인 (users.id)
 *
 * **막는 조건은 하나뿐**: 이미 다른 사람이 주인이고(`linked_user_id` 가 있고 값이 다름),
 * 그 매장의 미지급 잔액이 0 이 아니다.
 *
 * ⚠️ **fail-open 이 아니라 fail-closed** 다. 잔액 조회가 실패하면 **막는다** — 돈이 걸린
 *   판단에서 "모르겠으면 통과" 는 오지급으로 직행한다. (조회 실패는 D1 장애뿐이고, 그때는
 *   손바뀜을 미루는 편이 언제나 싸다.)
 */
export async function checkStoreHandover(
  DB: D1Database,
  sellerId: number,
  nextUserId: number,
): Promise<HandoverCheck> {
  const seller = await DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId)
    .first<{ linked_user_id: number | null }>()
    .catch(() => undefined)

  // 매장 조회 자체가 실패했으면 판단 근거가 없다 → 막는다(fail-closed).
  if (seller === undefined) {
    return { blocked: true, receivable: 0, reason: '매장 정보를 확인할 수 없어 소유자 변경을 보류했어요' }
  }
  if (!seller) return { blocked: false, receivable: 0 }

  const prevUserId = seller.linked_user_id
  // 최초 연결이거나 같은 사람이면 손바뀜이 아니다 — 오늘까지의 흐름 그대로.
  if (!prevUserId || Number(prevUserId) === Number(nextUserId)) {
    return { blocked: false, receivable: 0, prevUserId }
  }

  let receivable: number
  try {
    const { getLedgerReceivable } = await import('./ledger')
    receivable = await getLedgerReceivable(DB, `seller:${sellerId}`)
  } catch {
    return {
      blocked: true,
      receivable: 0,
      prevUserId,
      reason: '정산 잔액을 확인할 수 없어 소유자 변경을 보류했어요',
    }
  }

  if (receivable === 0) return { blocked: false, receivable: 0, prevUserId }

  return {
    blocked: true,
    receivable,
    prevUserId,
    reason:
      `이 매장에 아직 정산되지 않은 금액(${receivable.toLocaleString('ko-KR')}원)이 남아 있어요. ` +
      '지금 소유자를 바꾸면 그 돈이 새 소유자 계좌로 나갑니다 — 이전 소유자에게 정산을 마친 뒤에 진행해주세요.',
  }
}
