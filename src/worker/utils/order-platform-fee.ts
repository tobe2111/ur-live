/**
 * 🧾 **이 주문에서 유어딜이 실제로 떼어 간 수수료**(원) — 한 자리에서만 묻는다.
 *
 * ■ 왜 따로 떼어 놨나 — 실제로 틀려 있었던 일 (2026-10-01)
 *   S1(`commission_budget_enabled`) 의 합격선은 *"Σ성장커미션 ≤ 주문당 예산"* 이고,
 *   그 예산의 재료가 **이 주문의 원장 수수료**다. 그런데 판정 패널
 *   (`admin-promo-ledger.routes.ts`)이 그 수수료를 이렇게 묻고 있었다:
 *
 *     WHERE credit_account = 'platform:revenue' AND reference_id IN ('order:89')
 *
 *   라이브의 유일한 주문을 넣어 보니 **0원**이 나왔다. 원장에는 분명히 있었다:
 *
 *     id=3 · reference_id='GB-3-1789611467065' · credit_account='seller:14'
 *          · fee_amount=50 · fee_account='platform:commission'
 *
 *   **두 군데가 어긋나 있었고, 각각만으로도 늘 0 이 된다.**
 *   ① 수수료는 `credit_account` 가 아니라 **`fee_amount`** 에 붙고, 그 돈의 목적지는
 *      `fee_account` 가 말한다. 매장이 있는 주문의 `credit_account` 는 `seller:N` 이다
 *      (`platform:revenue` 는 **매장이 없는** 플랫폼 상품 — 교환권·KT — 일 때만 나온다).
 *   ② 참조 키가 **두 가지**다. 쇼핑 주문은 `order:N`(`order-ledger-credit.ts`),
 *      공구·이용권은 **주문번호 그대로**(`group-buy.routes.ts` · `cart-checkout.routes.ts`).
 *      `order:N` 만 물으면 **지금 라이브 트래픽 전부**(이용권)를 놓친다.
 *
 *   ⚠️ 0 이 나온 결과가 더 고약한 쪽은 "통과"가 아니라 **오판**이다. 예산이 0 이면
 *   적립이 1원만 있어도 `within_budget: false` 가 되어, 아비터가 멀쩡히 일하는데도
 *   *"게이트가 작동하지 않는다"* 고 읽게 된다. 양쪽으로 다 틀린다.
 *
 * ■ 이중 집계가 안 되는 이유
 *   `fee_account` 를 세는 쓰기 경로는 레포 전체에 **네 곳**이고 전부 전진(크레딧) 기록이다
 *   (`order-ledger-credit`·`group-buy.routes` ×2·`cart-checkout.routes`). 환불 역전 기록
 *   (`order_paid_refund` 등)은 `fee_amount`·`fee_account` 를 **안 쓴다** ⇒ 합계가 부풀지 않는다.
 *   `platform:pg_fee` 는 타입 주석에만 있고 실제 쓰는 곳이 0 이다(2026-10-01 실측).
 *
 * ■ 한계
 *   환불된 주문도 전진 기록이 남아 있으므로 여기 합계는 **"떼었던 금액"** 이다.
 *   "지금도 유어딜 것인가" 는 역전 기록을 함께 봐야 한다(판정 패널의 `s2`/`s3` 가 그 몫).
 */
export const PLATFORM_FEE_ACCOUNT = 'platform:commission'

/**
 * 주문의 원장 참조 키 전부. 쇼핑(`order:N`)과 공구·이용권(주문번호)이 **둘 다** 필요하다.
 * 한쪽만 넣으면 그 레일의 주문이 조용히 0원으로 읽힌다.
 */
export function orderLedgerRefs(orderIds: number[], orderNumber: string): string[] {
  const refs = orderIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .map((id) => `order:${id}`)
  const num = String(orderNumber || '').trim()
  // 주문번호가 `order:N` 과 겹칠 일은 없지만, 중복 바인딩은 막는다.
  if (num && !refs.includes(num)) refs.push(num)
  return refs
}

/** 플랫폼 수수료 합계 쿼리 — SQL 과 바인딩을 **같이** 돌려준다(둘이 갈리면 바인딩 개수 오류). */
export function platformFeeQuery(orderIds: number[], orderNumber: string): { sql: string; binds: (string | number)[] } {
  const refs = orderLedgerRefs(orderIds, orderNumber)
  const ph = refs.map(() => '?').join(', ')
  return {
    sql: `SELECT COALESCE(SUM(fee_amount), 0) AS fee FROM ledger_entries
            WHERE fee_account = ? AND reference_id IN (${ph})`,
    binds: [PLATFORM_FEE_ACCOUNT, ...refs],
  }
}
