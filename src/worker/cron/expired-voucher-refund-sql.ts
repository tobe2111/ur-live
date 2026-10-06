/**
 * 🎟️ 미사용 만료 이용권 환불 — **조회·선점 SQL 의 SSOT** (2026-09-30).
 *
 * ## 왜 따로 뺐나
 *
 * 이 두 문장은 *"환불이 실제로 일어나는가"* 를 혼자 결정한다. `auto-settlement.ts` 안에 인라인으로
 * 두면 가드가 문자열 비교밖에 못 하고, 문자열 비교는 **SQL 의미를 못 본다** — 2026-09-30 에 깨진
 * 것이 정확히 의미였다(`status = 'unused'` 하나로 조회해서, 다른 cron 이 먼저 `expired` 로
 * 바꿔 놓으면 환불 대상이 **영구히 0건**이 됐다. 에러 0·하트비트 초록).
 *
 * ⇒ 여기로 빼면 가드가 **실제 sqlite 에 돌려** 판정할 수 있다(`expired-voucher-refund-2026-09-30`).
 *
 * ## 불변식 (가드가 실행으로 확인한다)
 *
 * 1. 만료됐고 **아직 환불 처리 안 된** 건은 `status` 가 `unused` 든 `expired` 든 **잡힌다.**
 * 2. 이미 처리된 건(`refund_status` 가 채워진 건)은 **다시 안 잡힌다** — 이중 환불 0.
 * 3. 선점은 **한 번만** 성공한다(두 번째 UPDATE 는 `changes = 0`).
 * 4. 조회와 선점 사이에 손님이 **실제로 사용**했으면(`used`) 선점하지 않는다 — 쓰고도 환불받는 것 차단.
 * 5. 만료 기한이 안 지난 건은 안 잡힌다.
 *
 * ## 폴백 (`withRefundStatus: false`)
 *
 * `vouchers.refund_status` 는 repair-schema 가 보장하지만 아직 없는 환경에서 cron 이 통째로 죽으면
 * **환불이 다시 0건**이 된다. 그 경우엔 종전(2026-04-22) 조건으로 물러난다 — 고쳐지기 전과 같은
 * 동작이지 더 나쁘지는 않다.
 */

/** 환불 대상 조회. `withRefundStatus=false` 는 컬럼 부재 환경용 폴백(종전 동작). */
export function expiredVoucherSelectSql(withRefundStatus: boolean): string {
  return `
      SELECT v.id, v.code, v.order_id, v.product_id, v.applied_price,
             o.user_id, o.payment_method, o.payment_key, p.price, p.name as product_name,
             p.seller_id
      FROM vouchers v
      JOIN orders o ON v.order_id = o.id
      JOIN products p ON v.product_id = p.id
      WHERE v.expires_at < datetime('now')
        AND (v.status = 'unused'${withRefundStatus ? " OR v.status = 'expired'" : ''})
        ${withRefundStatus ? "AND COALESCE(v.refund_status, '') = ''" : ''}
      ORDER BY v.expires_at ASC
      LIMIT 5000
    `
}

/**
 * 돈 side-effect 앞의 원자적 선점(CLAUDE.md 머니 룰 #1). `changes = 1` 인 실행만 환불한다.
 *
 * 🔴 선점 근거가 `status` 가 아니라 `refund_status` 다 — `status` 는 만료 **표시**이고 그것을 쓰는
 *   자리가 셋이라(이 cron · `scheduled-cleanup` 매시 · 사용 시도 경로) 선점 근거가 될 수 없었다.
 * ⚠️ `status IN ('unused','expired')` 를 함께 잠근다: 조회 후 손님이 실제로 사용했으면 건드리지 않는다.
 */
export function expiredVoucherClaimSql(withRefundStatus: boolean): string {
  return withRefundStatus
    ? `UPDATE vouchers SET status = 'expired', refund_status = 'claimed'
              WHERE id = ? AND COALESCE(refund_status, '') = '' AND status IN ('unused', 'expired')`
    : "UPDATE vouchers SET status = 'expired' WHERE id = ? AND status = 'unused'"
}

/**
 * 🧾 **환불을 주문 장부에 적는다** (2026-10-06 · 결재 `2026-10-02-expired-refund-not-booked.md`).
 *
 * ## 왜 필요한가 — 안 적으면 **같은 돈을 또 환불할 수 있다**
 *
 * 2026-10-02 실측: 만료 환불이 라이브에서 처음 돌아 user 3 에게 1,800딜이 들어갔는데
 * `orders.refunded_amount` 는 **0 그대로**였다. 그 칸은 전액환불 경로의 **상한**이다
 * (`order-refund.ts` → `amount = total_amount − refunded_amount`) ⇒ 그 주문에 어드민·셀러·주문
 * 세 자리 중 하나에서 환불을 누르면 `1800 − 0 = 1800` 이 **또** 나간다(1,800 받고 3,600 환불).
 *
 * 다른 환불 네 경로는 **전부** 이 칸을 올린다(`refund.ts` · `order-refund.ts` ·
 * `voucher-partial-refund.ts` · `order.routes.ts`). 규칙이 없는 게 아니라 **한 자리가 규칙 밖**이었다.
 *
 * ## 문법은 그 네 경로와 **같다** — CAS 로 총액을 넘지 못한다
 *
 * 이용권 **여러 장이 한 주문**일 수 있어 장당 누적이고, 합이 `total_amount` 를 넘으면
 * `changes = 0` 으로 **기록이 실패**한다. 그때 돈은 이미 나갔으므로 **조용히 넘기지 않는다** —
 * 호출부가 크게 로그한다(기록 누락 쪽으로 안전하게 실패한다. 과다 기록은 상한을 거짓으로 올려
 * 다음 환불을 막으므로 더 나쁘다).
 *
 * ⚠️ 이 문장은 **금액을 정하지 않는다** — 호출부가 이미 환불한 액수를 그대로 적는다.
 */
export function expiredVoucherBookRefundSql(): string {
  return `UPDATE orders SET refunded_amount = COALESCE(refunded_amount, 0) + ?
            WHERE id = ? AND COALESCE(refunded_amount, 0) + ? <= total_amount`
}

/** 처리 결과(관측 + 재선점 차단). 'claimed' 로 남기지 않는다 — 무엇이 일어났는지 모르는 행이 생긴다. */
export type ExpiredVoucherOutcome = 'refunded' | 'forfeited' | 'failed' | 'none'
