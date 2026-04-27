/**
 * Agency Invite Code — 순수 로직
 *
 * Phase 1-3 의 agency-invites.routes.ts 가 이 함수들을 사용.
 */

const VALID_DAYS = 7;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 (0,O,1,I,L) 제외
const CODE_LENGTH = 8;

/**
 * 코드 만료 여부.
 */
export function isInviteCodeExpired(expiresAtISO: string, now: Date = new Date()): boolean {
  return now >= new Date(expiresAtISO);
}

/**
 * 발급 시 ends_at 계산 (현재 시각 + 7일).
 */
export function computeInviteCodeExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + VALID_DAYS * 86_400_000).toISOString();
}

/**
 * 사용 가능 여부 — 활성 + 만료 X + 사용 가능 횟수 남음.
 */
export function canUseInviteCode(opts: {
  isActive: number;
  expiresAt: string;
  usedCount: number;
  maxUses: number;
  now?: Date;
}): { ok: true } | { ok: false; reason: 'inactive' | 'expired' | 'used_up' } {
  if (!opts.isActive) return { ok: false, reason: 'inactive' };
  if (isInviteCodeExpired(opts.expiresAt, opts.now)) return { ok: false, reason: 'expired' };
  if (opts.usedCount >= opts.maxUses) return { ok: false, reason: 'used_up' };
  return { ok: true };
}

/**
 * 코드 형식 검증 (8자, 대문자/숫자, 헷갈리는 문자 제외).
 */
export function isValidInviteCodeFormat(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return /^[A-Z0-9]+$/.test(code) && !/[0OIL1]/.test(code);
}

/**
 * 코드 생성 — Math.random 기반 (테스트는 mock 가능).
 */
export function generateInviteCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)];
  }
  return code;
}
