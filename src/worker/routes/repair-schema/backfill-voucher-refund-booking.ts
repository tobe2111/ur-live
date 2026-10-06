/**
 * 🧾 **소급 기록** — 이미 환불한 이용권이 주문 장부에 안 적혀 있던 행을 메운다 (2026-10-06).
 *
 * 결재 `docs/decisions/2026-10-02-expired-refund-not-booked.md` (대표 "모두 다 해줘" → "남은 것도 다 해줘").
 *
 * ## 왜 앞선 수리(#1625)만으로는 부족한가
 *
 * #1625 는 `expiredVoucherBookRefundSql()` 을 cron 에 배선해 **앞으로의** 만료 환불을 장부에 적게
 * 했다. 그런데 그 수리는 **이미 나간 돈을 소급해 적지 않는다** — 라이브에 그 행이 남아 있었다:
 *
 * ```
 * voucher 1  refund_status='refunded'  applied_price=1,800  order_id=85
 * order  85  total_amount=1,800        refunded_amount=0          ← 구멍
 * ```
 *
 * `orders.refunded_amount` 는 전액환불 경로의 **상한**이다(`order-refund.ts` →
 * `amount = total_amount − refunded_amount`). 0 으로 남아 있으면 어드민·셀러·주문 **세 자리**
 * 중 하나에서 그 주문에 환불을 누르면 `1800 − 0 = 1800` 이 **또** 나간다. 1,800 받고 3,600 환불.
 *
 * ⇒ 앞을 막은 것과 **뒤를 메우는 것은 다른 일**이고, 뒤는 이 파일이 한다.
 *
 * ## 일회성 SQL 이 아니라 코드 경로다
 *
 * CLAUDE.md: *"데이터 수리는 일회성 SQL 이 아니라 **코드 경로**(정비 레인 · `repair-schema`)로
 * 간다 — 그래야 재현되고 리뷰되고 다음에도 돈다."* `repair-schema` 는 `d1-migrate.yml` 이
 * main 푸시마다 자동 호출하므로, 머지되면 스스로 돈다(사람이 누를 것이 없다).
 *
 * ## SQL 을 왜 모듈로 뺐나 — 가드가 **실행으로** 판정하게
 *
 * `expired-voucher-refund-sql.ts` 와 같은 이유다. 문자열 비교는 **SQL 의미를 못 본다**(2026-09-30
 * 에 깨진 것이 정확히 의미였다). 여기 있으면 가드가 실제 `node:sqlite` 에 돌려 판정한다.
 *
 * ## 불변식 (가드가 실행으로 확인한다)
 *
 * 1. `refunded_amount` 가 **0(또는 NULL)** 이고 환불된 이용권이 있으면 그 합으로 채운다.
 * 2. **멱등** — 두 번째 실행은 `changes = 0`(채운 뒤엔 0 이 아니므로 조건에서 빠진다).
 * 3. `total_amount` 를 **절대 넘지 않는다**(`MIN` 으로 clamp — 상한이 음수가 되는 일은 없다).
 * 4. `refunded_amount > 0` 인 주문은 **건드리지 않는다** — 그 숫자가 이 이용권 몫인지 다른
 *    부분환불 몫인지 SQL 로는 구분할 수 없다. 덮어쓰면 남의 기록을 지운다 ⇒ **보고만** 한다(§5).
 * 5. 그중 `0 < refunded_amount < 이용권합` 인 행은 상한이 그 차액만큼 **아직 높다** → 사람이 볼
 *    목록으로 올린다(`voucherRefundAmbiguousSql`). 조용히 넘기면 구멍이 남은 채 초록불이 된다.
 *
 * ## ⚠️ 이 수리가 **못 하는 것**
 *
 * - `applied_price` 가 비어 있으면(NULL/0) 환불액을 **지어내지 않는다** — 합에서 빠지고, 그 주문은
 *   대상이 아니다. 금액을 추정해 장부에 적는 것은 이 파일이 막으려는 사고와 같은 종류다.
 * - 이용권 **밖**의 미기록 환불(예: cron 이 아닌 경로가 안 적은 경우)은 범위 밖이다. 이 파일은
 *   `vouchers.refund_status` 가 말해 주는 것만 적는다.
 * - `refund_status` 컬럼이 없는 환경에서는 통째로 skip(호출부가 catch) — 그 환경엔 만료 환불
 *   자체가 종전 폴백으로 도므로 메울 것이 없다.
 */

/**
 * 한 주문에서 **이미 환불 처리된 이용권**의 금액 합. `orders.id` 에 상관(correlated)된 스칼라 서브쿼리라
 * UPDATE/SELECT 양쪽에 그대로 끼워 쓴다.
 *
 * ⚠️ `COALESCE(v.applied_price, 0)` — 금액을 모르는 장은 **0 으로 합산**된다(지어내지 않는다).
 */
const REFUNDED_VOUCHER_SUM = `SELECT COALESCE(SUM(COALESCE(v.applied_price, 0)), 0)
       FROM vouchers v
      WHERE v.order_id = orders.id AND COALESCE(v.refund_status, '') = 'refunded'`;

/**
 * 소급 기록. **`refunded_amount` 가 0/NULL 인 주문만** 대상 — 불변식 4 의 이유.
 *
 * `MIN(total_amount, 합)` 으로 clamp 한다. 합이 총액을 넘는 비정상 데이터에서도 상한은
 * `total − refunded = 0` 이 되어 **더 나가지 않는다**(안전한 방향으로 실패).
 */
export function voucherRefundBackfillSql(): string {
  return `UPDATE orders
             SET refunded_amount = MIN(total_amount, (${REFUNDED_VOUCHER_SUM}))
           WHERE COALESCE(refunded_amount, 0) = 0
             AND COALESCE(total_amount, 0) > 0
             AND (${REFUNDED_VOUCHER_SUM}) > 0`;
}

/**
 * 사람이 봐야 하는 행 — 이미 뭔가 적혀 있는데 **이용권 합보다 적다**(상한이 그 차액만큼 높다).
 * 자동으로 고치지 않는다(불변식 4). 비어 있는 것이 정상이다.
 */
export function voucherRefundAmbiguousSql(): string {
  return `SELECT orders.id AS order_id,
                 orders.total_amount AS total_amount,
                 COALESCE(orders.refunded_amount, 0) AS refunded_amount,
                 (${REFUNDED_VOUCHER_SUM}) AS voucher_refunded
            FROM orders
           WHERE COALESCE(orders.refunded_amount, 0) > 0
             AND COALESCE(orders.refunded_amount, 0) < (${REFUNDED_VOUCHER_SUM})
           LIMIT 50`;
}

export type VoucherRefundBackfillResult = {
  /** 소급 기록된 주문 수. 두 번째 실행부터는 0(멱등). */
  booked: number;
  /** 사람이 봐야 하는 행(불변식 5). 비어 있어야 정상. */
  ambiguous: { order_id: number; total_amount: number; refunded_amount: number; voucher_refunded: number }[];
};

/**
 * `repair-schema` 가 매 실행 부른다. 멱등이라 몇 번 돌아도 안전하다.
 *
 * 🔴 예외를 삼키지 않는다 — 호출부가 `tableResults` 에 error 로 남긴다. 조용히 넘기면
 *    "구멍이 남았는데 초록불" 이 되고, 그게 이 결함이 2026-10-02 부터 살아 있던 이유다.
 */
export async function backfillVoucherRefundBooking(DB: D1Database): Promise<VoucherRefundBackfillResult> {
  const upd = await DB.prepare(voucherRefundBackfillSql()).run();
  const amb = await DB.prepare(voucherRefundAmbiguousSql()).all<{
    order_id: number; total_amount: number; refunded_amount: number; voucher_refunded: number;
  }>();
  return { booked: Number(upd.meta?.changes || 0), ambiguous: amb.results || [] };
}
