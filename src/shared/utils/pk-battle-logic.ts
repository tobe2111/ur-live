/**
 * PK Battle — 순수 결정 로직 (단위 테스트 가능)
 *
 * 라우터에서 분리해서 단위 테스트로 검증 가능한 핵심 로직만 모음.
 * Phase 2-7 의 pk-battles.routes.ts 가 이 함수들을 사용.
 */

export type PKBattleStatus = 'pending' | 'live' | 'ended' | 'cancelled';

/**
 * 우승자 결정 — 더 높은 매출 셀러 승.
 * 동률이면 무승부 (null).
 */
export function determinePKWinner(opts: {
  sellerAId: number;
  sellerBId: number;
  revenueA: number;
  revenueB: number;
}): number | null {
  if (opts.revenueA > opts.revenueB) return opts.sellerAId;
  if (opts.revenueB > opts.revenueA) return opts.sellerBId;
  return null;
}

/**
 * 종료 시점 도달 여부 — 현재 시각이 ends_at 이상이면 종료.
 *
 * 🛡️ Date 객체 비교 (ISO 문자열 자릿수 차이로 인한 비교 오류 회피).
 */
export function shouldEndPK(endsAtISO: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(endsAtISO).getTime();
}

/**
 * 매출 비율 (0~100). 시청자 화면 막대 그래프용.
 */
export function pkRevenueShares(revenueA: number, revenueB: number): {
  aPercent: number;
  bPercent: number;
} {
  const total = revenueA + revenueB;
  if (total <= 0) return { aPercent: 50, bPercent: 50 };
  const aPercent = Math.round((revenueA / total) * 1000) / 10;
  return { aPercent, bPercent: Math.round((100 - aPercent) * 10) / 10 };
}

/**
 * 지속 시간 검증 — 15/30/60분만 허용.
 */
const ALLOWED_DURATIONS = [15, 30, 60];
export function isValidPKDuration(minutes: number): boolean {
  return ALLOWED_DURATIONS.includes(minutes);
}

/**
 * 유효 PK 매칭 검증 — 두 셀러가 같으면 안 됨.
 */
export function validatePKMatch(opts: {
  sellerAId: number;
  sellerBId: number;
  durationMinutes: number;
}): { valid: true } | { valid: false; reason: string } {
  if (opts.sellerAId === opts.sellerBId) {
    return { valid: false, reason: 'same_seller' };
  }
  if (!opts.sellerAId || !opts.sellerBId) {
    return { valid: false, reason: 'missing_seller' };
  }
  if (!isValidPKDuration(opts.durationMinutes)) {
    return { valid: false, reason: 'invalid_duration' };
  }
  return { valid: true };
}
