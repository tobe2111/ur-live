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
 * ## 이 파일이 하는 일 — 마감을 강제한다
 * ⭐ **2026-09-08 대표 확정**: *"중개사가 한 매장으로 유어딜에서 번 돈이 있으면 그 돈은 승계가
 * 되더라도 일단 중개사에게 정산되어야지. 반대 상황도 마찬가지고."*
 *
 * ⇒ 답은 "손바뀜을 막는다" 가 아니라 **"마감하고 나서 넘긴다"** 다. 이 자물쇠는 그 순서를
 * 강제하는 장치이지 종착점이 아니다. 마감 창구는
 * `POST /api/admin/payouts/handover-closeout` — 이전 주인 계좌를 payout 행에 **스냅샷**해
 * 배정하고, 그러면 아래 잔액이 0 이 되어 손바뀜이 열린다.
 *
 * 🩸 **처음엔 `getLedgerReceivable`(순수 원장)을 봤는데 그게 결함이었다** — 마감을 해도 원장은
 *   안 줄어서 **영원히 막혔다**(막다른 길). 지금은 `getUnsettledBalance`(원장 − 배정분)를 본다.
 *
 * 결정 문서: `docs/decisions/2026-09-07-store-handover-money-cut.md`
 *
 * ## ⚠️ 이 가드가 **막지 못하는 것** (과신 금지)
 *   - 잔액이 0 인 상태의 손바뀜은 그대로 통과한다 — 그게 의도다(줄 돈이 없으니 샐 돈도 없다).
 *   - 손바뀜 **이후** 발생한 매출은 여전히 매장 계정에 쌓인다. 그건 새 주인 것이 맞다 —
 *     마감이 이전 주인 몫을 payout 으로 떼어 냈으므로, 그 뒤 쌓이는 것은 자연히 새 주인 몫이다.
 *   - 마감 payout 을 손바뀜 **뒤에** 취소하면 잔액이 되살아나 새 주인에게 간다
 *     (`getUnsettledBalance` 헤더 참조). 그 취소를 막는 장치는 아직 없다.
 *   - **최초 연결**(주인이 없던 매장에 주인이 생기는 것)은 손바뀜이 아니므로 검사하지 않는다.
 *   - `seller_operators` 로 **운영자**(`role='operator'`)를 추가하는 것도 손바뀜이 아니다 —
 *     운영자는 정산 계좌를 못 바꾼다(`seller-profile.routes.ts` 소유자 게이트).
 *
 * 🕳️ **2026-09-09 사각지대 수리 — 주인은 두 곳에 적힌다.**
 *   이 자물쇠는 처음에 `sellers.linked_user_id` 만 봤다. 그런데 `/store/new` 는 설계상 그 칸을
 *   **비워 두고**(UNIQUE 1인1행) `seller_operators.role='owner'` 로 주인을 적는다
 *   (`seller-stores.routes.ts:12-14`). ⇒ **지금 만들어지는 모든 매장에서 자물쇠가 무력**이었다.
 *   라이브 실측(2026-09-09): 매장 1곳 전부 `linked_user_id` NULL. 승계(3단계)가 지나갈 문도
 *   바로 이 `role` 승격이다. 그래서 **두 신호를 함께** 본다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { resolveStoreOwnerUserId } from './seller-operators'

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
/**
 * 지금 이 매장의 **주인**은 누구인가 — 두 신호를 함께 본다.
 *
 * ① `sellers.linked_user_id` (옛 방식 · 1인 1행 UNIQUE)
 * ② `seller_operators.role = 'owner'` (지금 `/store/new` 가 쓰는 방식)
 *
 * @returns 주인의 user id · 주인이 없으면 `null` · **판단 근거를 못 얻으면 `undefined`**
 *          (셋을 구분해야 "주인 없음"과 "모름"이 안 섞인다 — 섞이면 모름이 통과가 된다).
 */
export async function resolveCurrentOwner(
  DB: D1Database,
  sellerId: number,
): Promise<number | null | undefined> {
  // 규칙 본체는 `seller-operators.ts` 하나뿐이다 — 출금·인증 판정도 같은 함수를 쓴다.
  return await resolveStoreOwnerUserId(DB, sellerId)
}

export async function checkStoreHandover(
  DB: D1Database,
  sellerId: number,
  nextUserId: number,
): Promise<HandoverCheck> {
  const prev = await resolveCurrentOwner(DB, sellerId)

  // 판단 근거를 못 얻었으면 막는다(fail-closed).
  if (prev === undefined) {
    return { blocked: true, receivable: 0, reason: '매장 정보를 확인할 수 없어 소유자 변경을 보류했어요' }
  }

  const prevUserId = prev
  // 최초 연결이거나 같은 사람이면 손바뀜이 아니다 — 오늘까지의 흐름 그대로.
  if (!prevUserId || Number(prevUserId) === Number(nextUserId)) {
    return { blocked: false, receivable: 0, prevUserId }
  }

  let receivable: number
  try {
    const { getUnsettledBalance } = await import('./ledger')
    receivable = await getUnsettledBalance(DB, `seller:${sellerId}`)
  } catch {
    return {
      blocked: true,
      receivable: 0,
      prevUserId,
      reason: '정산 잔액을 확인할 수 없어 소유자 변경을 보류했어요',
    }
  }

  // 배정이 끝났으면(0) 통과. 음수는 매장이 플랫폼에 빚진 상태라 payout 으로 표현할 수 없다 —
  // 그대로 넘기면 그 빚을 새 주인이 떠안으므로 역시 막는다.
  if (receivable === 0) return { blocked: false, receivable: 0, prevUserId }

  const won = Math.abs(receivable).toLocaleString('ko-KR')
  return {
    blocked: true,
    receivable,
    prevUserId,
    reason: receivable > 0
      ? `이 매장에 아직 정산되지 않은 금액(${won}원)이 남아 있어요. 지금 소유자를 바꾸면 그 돈이 ` +
        '새 소유자 계좌로 나갑니다 — 정산 마감(어드민 → 정산 → 손바뀜 마감)을 먼저 해주세요.'
      : `이 매장은 플랫폼에 정산할 금액(${won}원)이 남아 있어요. 소유자를 바꾸면 그 부담이 ` +
        '새 소유자에게 넘어갑니다 — 먼저 정리해주세요.',
  }
}
