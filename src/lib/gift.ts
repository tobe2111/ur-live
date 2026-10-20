/**
 * 🛡️ 2026-04-28: 선물하기 핵심 로직 (순수 함수).
 *
 * - 전화번호 정규화 (한국 휴대폰)
 * - 메시지 검증 (길이 + XSS 방어)
 * - 만료 시각 계산 (결제 시각 + 30일)
 * - 상태 전환 가능 여부 검증
 * - claim_token 생성 (URL-safe random)
 */

const GIFT_EXPIRE_DAYS = 30;
const MAX_MESSAGE_LENGTH = 200;

export type GiftStatus =
  | 'pending'
  | 'paid'
  | 'claimed'
  | 'shipped'
  | 'delivered'
  | 'expired'
  | 'refunded';

export function normalizePhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  const clean = input.replace(/[^0-9]/g, '');
  if (!/^01\d{8,9}$/.test(clean)) return null;
  return clean;
}

export function validateMessage(message: string | undefined | null): { ok: true; clean: string } | { ok: false; error: string } {
  if (!message) return { ok: true, clean: '' };
  if (typeof message !== 'string') return { ok: false, error: 'message must be string' };
  const trimmed = message.trim();
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `메시지는 ${MAX_MESSAGE_LENGTH}자 이내로 작성해주세요` };
  }
  // 기본 XSS 방어: HTML 태그 제거
  const clean = trimmed.replace(/<[^>]*>/g, '');
  return { ok: true, clean };
}

export function calcExpireAt(paidAtMs: number = Date.now()): Date {
  return new Date(paidAtMs + GIFT_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
}

export function isExpired(expiresAtIso: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!expiresAtIso) return false;
  const expiresMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresMs)) return false;
  return nowMs > expiresMs;
}

/**
 * 상태 전환 정의 (DAG).
 * pending → paid → claimed → shipped → delivered
 *                  ↘ expired/refunded (terminal)
 */
const TRANSITIONS: Record<GiftStatus, GiftStatus[]> = {
  pending: ['paid', 'refunded'],
  paid: ['claimed', 'expired', 'refunded'],
  claimed: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: [],
  expired: ['refunded'],
  refunded: [],
};

export function canTransition(from: GiftStatus, to: GiftStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * URL-safe claim token (32 char) — Web Crypto API 사용.
 * 추측 불가 + 충돌 확률 ~ 2^-128.
 */
export function generateClaimToken(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    // base64url 인코딩
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  // fallback (테스트 환경 등)
  let s = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let i = 0; i < 32; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export const GIFT_CONSTANTS = {
  EXPIRE_DAYS: GIFT_EXPIRE_DAYS,
  MAX_MESSAGE_LENGTH,
} as const;
