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

/** 처리 결과(관측 + 재선점 차단). 'claimed' 로 남기지 않는다 — 무엇이 일어났는지 모르는 행이 생긴다. */
export type ExpiredVoucherOutcome = 'refunded' | 'forfeited' | 'failed' | 'none'
