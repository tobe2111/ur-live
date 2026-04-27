/**
 * Seller Transfer (Network Marketplace) — 순수 로직
 *
 * Phase 3-5 의 seller-transfer.routes.ts 가 이 함수들을 사용.
 */

export type TransferStatus =
  | 'pending'
  | 'accepted_by_to'
  | 'approved_by_seller'
  | 'completed'
  | 'rejected'
  | 'cancelled';

const COOLDOWN_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/**
 * 30일 cooldown 체크 — 이전 완료 시각 기준.
 *
 * @param lastCompletedAt 마지막 완료 ISO 문자열 (없으면 null)
 * @param now 기준 시각
 * @returns true: cooldown 중 (이전 차단), false: 가능
 */
export function isInTransferCooldown(
  lastCompletedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastCompletedAt) return false;
  const completedAt = new Date(lastCompletedAt);
  const elapsedMs = now.getTime() - completedAt.getTime();
  return elapsedMs < COOLDOWN_DAYS * MS_PER_DAY;
}

/**
 * 유효한 응답 → 다음 status 결정.
 */
export function nextStatusForToResponse(
  response: 'accept' | 'reject',
): 'accepted_by_to' | 'rejected' {
  return response === 'accept' ? 'accepted_by_to' : 'rejected';
}

/**
 * 셀러 동의 → 다음 status.
 */
export function nextStatusForSellerApproval(approved: boolean): 'completed' | 'rejected' {
  return approved ? 'completed' : 'rejected';
}

/**
 * 신청 가능 여부 검증.
 */
export function validateTransferRequest(opts: {
  fromAgencyId: number;
  toAgencyId: number;
  sellerId: number;
}): { valid: true } | { valid: false; reason: string } {
  if (!opts.sellerId || !opts.fromAgencyId || !opts.toAgencyId) {
    return { valid: false, reason: 'missing_params' };
  }
  if (opts.fromAgencyId === opts.toAgencyId) {
    return { valid: false, reason: 'same_agency' };
  }
  return { valid: true };
}
