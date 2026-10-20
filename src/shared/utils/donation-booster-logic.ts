/**
 * Donation Booster — 순수 결정 로직 (단위 테스트 가능)
 *
 * Phase 2-5 의 donation-booster.routes.ts 가 이 함수들을 사용.
 */

const ALLOWED_MULTIPLIERS = [1.5, 2.0, 3.0];
const ALLOWED_DURATIONS_SEC = [300, 600, 900];

/**
 * 부스터 매개변수 검증.
 */
export function validateBoosterParams(opts: {
  multiplier: number;
  durationSeconds: number;
}): { valid: true } | { valid: false; reason: string } {
  if (!ALLOWED_MULTIPLIERS.includes(opts.multiplier)) {
    return { valid: false, reason: 'invalid_multiplier' };
  }
  if (!ALLOWED_DURATIONS_SEC.includes(opts.durationSeconds)) {
    return { valid: false, reason: 'invalid_duration' };
  }
  return { valid: true };
}

/**
 * 매칭 금액 계산 — multiplier - 1 만큼 추가.
 * 예: 후원 1000원 × 2x → 매칭 1000원 추가 (총 2000원 효과).
 */
export function calculateMatchedAmount(
  donationAmount: number,
  multiplier: number,
): number {
  if (donationAmount <= 0) return 0;
  if (multiplier <= 1) return 0;
  return Math.floor(donationAmount * (multiplier - 1));
}

/**
 * 부스터 종료 여부 — 현재 시각이 ends_at 이상이면 종료.
 */
export function isBoosterExpired(endsAtISO: string, now: Date = new Date()): boolean {
  return now >= new Date(endsAtISO);
}

/**
 * 부스터 ends_at 계산 — duration 초 추가.
 */
export function computeBoosterEndsAt(durationSeconds: number, startedAt: Date = new Date()): string {
  return new Date(startedAt.getTime() + durationSeconds * 1000).toISOString();
}
