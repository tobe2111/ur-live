/**
 * 🛡️ 2026-04-28: 선물하기 핵심 로직 테스트
 */
import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  validateMessage,
  calcExpireAt,
  isExpired,
  canTransition,
  generateClaimToken,
  GIFT_CONSTANTS,
  type GiftStatus,
} from '@/lib/gift';

describe('normalizePhone', () => {
  it('010-1234-5678 → 01012345678', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
  });
  it('010 1234 5678 → 01012345678', () => {
    expect(normalizePhone('010 1234 5678')).toBe('01012345678');
  });
  it('011-987-6543 (구 PCS) → 통과', () => {
    expect(normalizePhone('011-987-6543')).toBe('0119876543');
  });
  it('빈 문자열 → null', () => {
    expect(normalizePhone('')).toBe(null);
  });
  it('숫자 외 + 부족 → null', () => {
    expect(normalizePhone('010-abc')).toBe(null);
  });
  it('너무 김 → null', () => {
    expect(normalizePhone('010-1234-5678-9')).toBe(null);
  });
  it('non-string input → null', () => {
    // @ts-expect-error 의도적 타입 위반
    expect(normalizePhone(null)).toBe(null);
    // @ts-expect-error
    expect(normalizePhone(undefined)).toBe(null);
  });
});

describe('validateMessage', () => {
  it('빈 메시지 OK', () => {
    expect(validateMessage('')).toEqual({ ok: true, clean: '' });
    expect(validateMessage(undefined)).toEqual({ ok: true, clean: '' });
    expect(validateMessage(null)).toEqual({ ok: true, clean: '' });
  });

  it('정상 메시지 trim + clean', () => {
    expect(validateMessage('  생일축하 ✨  ')).toEqual({ ok: true, clean: '생일축하 ✨' });
  });

  it('200자 초과 → 거부', () => {
    const long = 'a'.repeat(201);
    const r = validateMessage(long);
    expect(r.ok).toBe(false);
  });

  it('200자 정확히 → 통과', () => {
    const exact = 'a'.repeat(200);
    expect(validateMessage(exact).ok).toBe(true);
  });

  it('HTML 태그 제거', () => {
    expect(validateMessage('<script>alert(1)</script>안녕')).toEqual({ ok: true, clean: 'alert(1)안녕' });
  });

  it('GIFT_CONSTANTS 노출', () => {
    expect(GIFT_CONSTANTS.EXPIRE_DAYS).toBe(30);
    expect(GIFT_CONSTANTS.MAX_MESSAGE_LENGTH).toBe(200);
  });
});

describe('calcExpireAt — 30일 후', () => {
  it('paidAt + 30일', () => {
    const paid = new Date('2026-04-28T00:00:00Z').getTime();
    const expire = calcExpireAt(paid);
    const expected = new Date('2026-05-28T00:00:00Z').getTime();
    expect(expire.getTime()).toBe(expected);
  });
});

describe('isExpired', () => {
  it('만료 시각 미설정 → false', () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });
  it('미래 → false', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
  it('과거 → true', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isExpired(past)).toBe(true);
  });
  it('잘못된 ISO → false (안전)', () => {
    expect(isExpired('not-a-date')).toBe(false);
  });
});

describe('canTransition — 상태 머신', () => {
  const cases: Array<[GiftStatus, GiftStatus, boolean]> = [
    ['pending', 'paid', true],
    ['pending', 'refunded', true],
    ['pending', 'claimed', false],   // 결제 전 claim 불가
    ['paid', 'claimed', true],
    ['paid', 'expired', true],
    ['paid', 'refunded', true],
    ['paid', 'shipped', false],      // claim 거치지 않고 발송 불가
    ['claimed', 'shipped', true],
    ['claimed', 'refunded', true],
    ['shipped', 'delivered', true],
    ['shipped', 'refunded', false],  // 발송 후 환불은 별도 흐름
    ['delivered', 'refunded', false], // terminal
    ['expired', 'refunded', true],
    ['refunded', 'paid', false],     // terminal
  ];
  for (const [from, to, expected] of cases) {
    it(`${from} → ${to} = ${expected}`, () => {
      expect(canTransition(from, to)).toBe(expected);
    });
  }
});

describe('generateClaimToken', () => {
  it('32자 정도 길이 (base64url)', () => {
    const t = generateClaimToken();
    expect(t.length).toBeGreaterThanOrEqual(28);
    expect(t.length).toBeLessThanOrEqual(40);
  });
  it('URL-safe (영숫자 + - _ 만)', () => {
    const t = generateClaimToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('두 번 호출 시 다른 값 (충돌 방지)', () => {
    const a = generateClaimToken();
    const b = generateClaimToken();
    expect(a).not.toBe(b);
  });
});
