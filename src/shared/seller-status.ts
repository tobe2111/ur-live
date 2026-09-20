/**
 * 🪑 **매장(셀러 행) 상태 판정 SSOT** (2026-09-20 — 대표 *"승인 대기가 두 번이라 느리다. 더 이상적인 방법?"*)
 *
 * 답은 "승인을 빼는 것"이 아니라 **승인이 막는 범위를 좁히는 것**이다 (당근비즈니스·Stripe 모델):
 *   준비(이용권 등록·협업 코드·매장 정보)는 **지금**, 노출(메인 피드)과 **돈(정산)** 은 사람이 등록증을
 *   본 **뒤**. 2026-09-16 이 셀러 *계정* 에 적용한 규칙을 매장 *좌석* 과 *정산* 에도 같게 편다.
 *
 * 두 판정이 서로 다른 집합인 것이 핵심이다:
 *   - `isSeatableStoreStatus`      — 좌석 토큰·앉을 수 있는 매장 수 · 스위처 목록. **정지만 제외.**
 *   - `isPayoutEligibleSellerStatus` — 주간 정산 생성(`payouts-generate`). **승인된 매장만.**
 *   좌석을 열어도 돈이 안 나가니 09-16 사기 방어(등록증 + 어드민 승인)는 그대로다. 노출은
 *   `approvedSellerProductSql`(consumer-visible-product.ts) 이 이미 승인 매장만 내보낸다.
 *
 * ⚠️ `null`/미지 상태는 둘 다 **거짓** — 모르는 행에 좌석을 주거나 돈을 보내지 않는다(종전 동작).
 * ⚠️ 이 파일은 순수 함수만 — 테스트가 표로 잰다. 컬럼 값 SSOT 는 `docs/SCHEMA.md`.
 */

export const SEATABLE_STORE_STATUSES = ['active', 'approved', 'pending', 'rejected'] as const
export const PAYOUT_ELIGIBLE_SELLER_STATUSES = ['active', 'approved'] as const

/** 좌석에 앉을 수 있는가 — 대기·반려도 들어가서 고칠 수 있다. 정지·미지는 아니다. */
export function isSeatableStoreStatus(status: unknown): boolean {
  return typeof status === 'string' && (SEATABLE_STORE_STATUSES as readonly string[]).includes(status)
}

/** 정산(현금 payout)을 받을 수 있는가 — 사람이 등록증을 보고 승인한 매장만. */
export function isPayoutEligibleSellerStatus(status: unknown): boolean {
  return typeof status === 'string' && (PAYOUT_ELIGIBLE_SELLER_STATUSES as readonly string[]).includes(status)
}
