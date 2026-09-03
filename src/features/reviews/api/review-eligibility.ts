/**
 * 🎫 리뷰 자격 판정 — "이 사람이 이 상품에 리뷰를 쓸 수 있는가"
 *
 * 2026-09-02 대표 *"리뷰는 이용권 사용한 사람만 쓸 수 있게끔 되어있지?"* → **아니었다.**
 * 게이트가 '구매'(orders.status)만 봤는데 이용권은 결제 즉시 DONE 이라 **매장에 가기 전에도**
 * 리뷰와 리워드가 났다. 사용 기록(`vouchers.status='used'`)은 이미 있었는데 리뷰가 안 봤을 뿐이다.
 *
 * ■ 판정 두 갈래
 *   1) **매장에서 쓰는 이용권** → `vouchers.status='used'` 가 1장 이상. 리워드 근거 = 그 장의 `order_id`.
 *   2) 그 외(교환권·쇼핑·배송 상품) → 종전 구매 게이트(완료/배송 주문 1건 이상).
 *
 * ■ ⚠️ 1) 의 판정은 **두 조건을 AND** 로 본다 — 결제수단(`getProductFlow`) **그리고** 수령 방식
 *   (`isVoucherCategory`). `group_buy_status` 는 migration 0146 이 **모든 상품에 DEFAULT 'active'**
 *   를 박아서, 결제수단만 보면 배송되는 물건까지 이용권으로 분류된다(2026-09-02 라이브 실측 8건 —
 *   한우 등심·참기름·명란젓·밀키트·쌀조청·갈치·Canvas Tote Bag). 매장에서 쓸 일이 없으니 `used` 가
 *   될 수 없고 ⇒ 그 구매자들이 리뷰를 **영영 못 쓴다.** 첫 판이 실제로 그 상태로 배포됐다.
 *
 *   CLAUDE.md 🚦 절의 *"카테고리 이름으로 딜 결제를 가르지 말 것"* 은 **결제수단** 판정 이야기이고,
 *   여기서 필요한 것은 결제수단 **and** 수령 방식이다 — 둘 다 봐야 맞다.
 *
 * ■ 실패는 자격 없음이 아니다. 조회 자체가 실패하면(테이블 부재·일시 오류) 403 이 아니라 503 이다 —
 *   403 으로 말하면 매장에 다녀온 사용자가 "다녀오세요" 를 보고 원인을 알 길이 없다.
 */
import { getProductFlow, type ProductFlowInput } from '@/shared/product-flow'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'

export type ReviewEligibility =
  /** 통과 — `rewardOrderId` 가 있으면 그 주문이 리워드 근거(이용권은 사용한 그 장) */
  | { ok: true; rewardOrderId: number | null }
  /** 차단 — 라우트가 이 코드/문구/상태를 그대로 응답한다 */
  | { ok: false; status: 403 | 503; error: string; error_code: string }

/**
 * @param userId 인증된 유저의 **raw** id. 정규화는 이 함수가 발급 경로와 같은 방식으로 한다.
 * @param isDbId 세션 쿠키 유저 여부(이미 DB id).
 */
export async function checkReviewEligibility(
  DB: D1Database,
  productId: number,
  userId: string | number,
  isDbId?: boolean,
): Promise<ReviewEligibility> {
  const prod = await DB.prepare('SELECT deal_only, group_buy_status, category FROM products WHERE id = ?')
    .bind(productId).first<ProductFlowInput>().catch(() => null)

  // 상품 조회 실패 시 이용권 게이트를 걸지 않는다 — 모르는 것을 이유로 막지 않는다(구매 게이트가 받는다).
  const storeUsedVoucher = !!prod && getProductFlow(prod) === 'group_buy_toss' && isVoucherCategory(prod.category)

  if (storeUsedVoucher) {
    // 🔑 발급(`group-buy.routes`)이 `resolveUserIdString` 로 쓴 값과 **같은 정규화**로 읽는다.
    //    raw 로 읽으면 정규화가 갈리는 계정에서 자기 이용권을 못 찾아, 매장에 다녀온 사람이
    //    "안 다녀왔다" 는 답을 받는다.
    const voucherUserId = await resolveUserIdString(DB, userId, isDbId)
    let used: { order_id: number } | null = null
    try {
      used = await DB.prepare(
        "SELECT order_id FROM vouchers WHERE product_id = ? AND user_id = ? AND status = 'used' ORDER BY used_at DESC LIMIT 1"
      ).bind(productId, voucherUserId).first<{ order_id: number }>()
    } catch {
      return {
        ok: false,
        status: 503,
        error: '지금은 리뷰를 등록할 수 없어요. 잠시 후 다시 시도해 주세요',
        error_code: 'REVIEW_ELIGIBILITY_UNAVAILABLE',
      }
    }
    if (!used) {
      return {
        ok: false,
        status: 403,
        error: '이용권을 사용한 뒤에 리뷰를 쓸 수 있어요',
        error_code: 'VOUCHER_NOT_USED',
      }
    }
    return { ok: true, rewardOrderId: used.order_id }
  }

  // 🛡️ 2026-05-21: 구매자만 리뷰 작성 가능 — 완료/배송 주문이 1건이라도 있으면 OK.
  const purchasedOrder = await DB.prepare(`
    SELECT o.id FROM orders o
    INNER JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.product_id = ?
      AND o.user_id = ?
      AND o.status IN ('PAID', 'DONE', 'DELIVERED', 'SHIPPING', 'COMPLETED')
    LIMIT 1
  `).bind(productId, userId).first().catch(() => null)

  if (!purchasedOrder) {
    return {
      ok: false,
      status: 403,
      error: '리뷰는 해당 상품을 구매한 분만 작성할 수 있습니다.',
      error_code: 'NOT_PURCHASED',
    }
  }
  return { ok: true, rewardOrderId: null }
}
