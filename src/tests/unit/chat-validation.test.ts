/**
 * Chat Message Validation Tests — batch 167
 *
 * 배치 164 에서 DurableObject 에 추가한 채팅 검증 로직을 순수 함수로 재현하여
 * 단위 테스트. 실제 DO 인스턴스는 Cloudflare runtime 필요 → 로직만 검증.
 *
 * 검증 규칙:
 *  - stripTags: HTML 태그 제거
 *  - 길이: 최대 300자
 *  - rate limit: 3초 sliding window 에서 최대 5건
 *  - 빈 메시지 차단
 */
import { describe, it, expect } from 'vitest';

const CHAT_MAX_LEN = 300;
const CHAT_RATE_LIMIT = 5;
const CHAT_RATE_WINDOW_MS = 3000;

function sanitizeMessage(raw: string): string {
  return raw.replace(/<[^>]*>/g, '').trim();
}

function validateLength(text: string): { ok: boolean; reason?: string } {
  if (text.length === 0) return { ok: false, reason: 'EMPTY' };
  if (text.length > CHAT_MAX_LEN) return { ok: false, reason: 'TOO_LONG' };
  return { ok: true };
}

/**
 * Sliding-window rate limiter identical to the DO implementation.
 */
class ChatRateLimiter {
  private times: number[] = [];
  check(now: number): boolean {
    this.times = this.times.filter((t) => now - t < CHAT_RATE_WINDOW_MS);
    if (this.times.length >= CHAT_RATE_LIMIT) return false;
    this.times.push(now);
    return true;
  }
}

describe('Chat sanitizeMessage', () => {
  it('strips simple HTML tags', () => {
    expect(sanitizeMessage('<b>hello</b>')).toBe('hello');
    expect(sanitizeMessage('<script>alert(1)</script>hi')).toBe('alert(1)hi');
  });

  it('strips tags with attributes', () => {
    expect(sanitizeMessage('<a href="x">link</a>')).toBe('link');
    expect(sanitizeMessage('<img src=x onerror=alert(1)/>x')).toBe('x');
  });

  it('trims whitespace after stripping', () => {
    expect(sanitizeMessage('  <br>  hi  <br>  ')).toBe('hi');
  });

  it('preserves text without tags', () => {
    expect(sanitizeMessage('안녕하세요 👋')).toBe('안녕하세요 👋');
  });
});

describe('Chat validateLength', () => {
  it('rejects empty after sanitize', () => {
    const cleaned = sanitizeMessage('<br><br>');
    expect(validateLength(cleaned)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('accepts at exactly 300 chars', () => {
    const text = 'a'.repeat(300);
    expect(validateLength(text).ok).toBe(true);
  });

  it('rejects 301 chars', () => {
    const text = 'a'.repeat(301);
    expect(validateLength(text)).toEqual({ ok: false, reason: 'TOO_LONG' });
  });
});

describe('Chat ChatRateLimiter', () => {
  it('allows first 5 messages within 3s window', () => {
    const limiter = new ChatRateLimiter();
    const base = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(limiter.check(base + i * 100)).toBe(true);
    }
  });

  it('rejects 6th message within 3s window', () => {
    const limiter = new ChatRateLimiter();
    const base = 1_000_000;
    for (let i = 0; i < 5; i++) limiter.check(base + i * 100);
    expect(limiter.check(base + 500)).toBe(false);
  });

  it('allows burst again after window slides past', () => {
    const limiter = new ChatRateLimiter();
    const base = 1_000_000;
    for (let i = 0; i < 5; i++) limiter.check(base + i * 100);
    // 3초 이후
    expect(limiter.check(base + 3100)).toBe(true);
  });

  it('sliding: old entries expire independently', () => {
    const limiter = new ChatRateLimiter();
    const base = 1_000_000;
    // t=0, 1000, 2000 (3건), 이후 t=4000 시 t=0/1000 만료 → 여유 3건 남음
    limiter.check(base);
    limiter.check(base + 1000);
    limiter.check(base + 2000);
    // t=4000: base (0-4000=-4000 → 4s ago, expired) and base+1000 (3s ago, expired) removed
    // 남은 건 base+2000 (2s ago) → 1건
    expect(limiter.check(base + 4000)).toBe(true); // 2건
    expect(limiter.check(base + 4001)).toBe(true); // 3건
    expect(limiter.check(base + 4002)).toBe(true); // 4건
    expect(limiter.check(base + 4003)).toBe(true); // 5건
    expect(limiter.check(base + 4004)).toBe(false); // 한도 초과
  });
});
