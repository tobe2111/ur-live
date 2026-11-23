import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateOrderId,
  generateRandomId,
  validateOrderId,
  sanitizeUserId,
} from '../../utils/orderIdGenerator';

describe('orderIdGenerator', () => {
  // ── generateOrderId ──────────────────────────────────────────────
  describe('generateOrderId', () => {
    it('returns an 18-digit numeric string', () => {
      const id = generateOrderId();
      expect(id).toHaveLength(18);
      expect(id).toMatch(/^\d{18}$/);
    });

    // 🎲 2026-11-23 — 이 자리에 있던 시험은 "50번 연속 호출하면 50개가 전부 다르다" 를 **진짜 난수로** 단언했다.
    //   뒤 6자리는 900,000 가지뿐이고 50번은 같은 1초 안에 돌기 때문에(앞 12자리 동일) 생일 문제가 된다:
    //   겹칠 확률 ≈ 50·49 / (2·900,000) ≈ 0.14% — 약 730번에 한 번 **코드가 멀쩡한데** 빨개진다
    //   (실제로 2026-11-23 배포 run 45191275420 이 `expected 49 to be 50` 로 멈췄다. 옛 주석의 "negligible" 은 틀렸다).
    //   ⇒ 확률적 결과가 아니라 **이 시험이 지키려던 성질 자체**를 난수를 고정해서 단언한다. 우연으로는 실패할 수 없다.
    //   (같은 1초에 번호가 실제로 겹치는 경우는 생성기가 아니라 DB 가 막는다 — orders.order_number UNIQUE.)
    describe('uniqueness comes from the random suffix (deterministic)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
      });

      /** crypto.getRandomValues 가 `values` 를 차례로 돌려주게 고정한다. */
      function stubRandom(values: number[]) {
        let i = 0;
        return vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((arr: Uint32Array) => {
          arr[0] = values[i++ % values.length];
          return arr;
        }) as typeof crypto.getRandomValues);
      }

      it('distinct random values → distinct ids, even within the same second', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 10, 23, 9, 53, 12)); // 시계를 멈춘다 — 앞 12자리는 전부 같다
        stubRandom(Array.from({ length: 50 }, (_, n) => n * 17_999)); // 전부 다르고 전부 900,000 미만

        const ids = Array.from({ length: 50 }, () => generateOrderId());

        expect(new Set(ids.map((id) => id.slice(0, 12))).size).toBe(1); // 날짜 부분은 구분에 기여하지 않았다
        expect(new Set(ids).size).toBe(50); // 그런데도 50개가 전부 다르다 — 뒤 6자리가 구분한다
      });

      it('draws the suffix from crypto.getRandomValues once per call (not a counter or a constant)', () => {
        const spy = stubRandom([123_456, 123_456, 7]);

        const a = generateOrderId();
        const b = generateOrderId();
        const c = generateOrderId();

        expect(spy).toHaveBeenCalledTimes(3);
        expect(a.slice(12)).toBe('223456'); // 100000 + 123456
        expect(b.slice(12)).toBe('223456'); // 같은 난수 → 같은 뒷자리: 고유성은 오직 난수에서 온다
        expect(c.slice(12)).toBe('100007');
      });

      it('uses the whole 900,000-value space (both ends reachable, modulo wraps)', () => {
        stubRandom([0, 899_999, 900_000, 0xffffffff]);

        expect(generateOrderId().slice(12)).toBe('100000');
        expect(generateOrderId().slice(12)).toBe('999999');
        expect(generateOrderId().slice(12)).toBe('100000'); // 900000 % 900000 = 0
        expect(generateOrderId().slice(12)).toBe(String(100000 + (0xffffffff % 900000)));
      });
    });

    it('starts with the current date prefix (YYMMDDHHmmss)', () => {
      const before = new Date();
      const id = generateOrderId();
      const after = new Date();

      // Extract the 2-digit year and month from the ID
      const idYear = parseInt(id.slice(0, 2), 10);
      const idMonth = parseInt(id.slice(2, 4), 10);
      const idDay = parseInt(id.slice(4, 6), 10);

      expect(idYear).toBe(before.getFullYear() % 100);
      expect(idMonth).toBeGreaterThanOrEqual(1);
      expect(idMonth).toBeLessThanOrEqual(12);
      expect(idDay).toBeGreaterThanOrEqual(1);
      expect(idDay).toBeLessThanOrEqual(31);
    });

    it('ignores the optional userId parameter (always returns same format)', () => {
      const withoutUser = generateOrderId();
      const withNumericUser = generateOrderId(12345);
      const withStringUser = generateOrderId('firebase_uid_abc');

      for (const id of [withoutUser, withNumericUser, withStringUser]) {
        expect(id).toHaveLength(18);
        expect(id).toMatch(/^\d{18}$/);
      }
    });

    it('random suffix is between 100000 and 999999', () => {
      for (let i = 0; i < 20; i++) {
        const id = generateOrderId();
        const randomPart = parseInt(id.slice(12), 10);
        expect(randomPart).toBeGreaterThanOrEqual(100000);
        expect(randomPart).toBeLessThanOrEqual(999999);
      }
    });
  });

  // ── validateOrderId ──────────────────────────────────────────────
  describe('validateOrderId', () => {
    it('returns true for a valid generated order ID', () => {
      const id = generateOrderId();
      expect(validateOrderId(id)).toBe(true);
    });

    it('returns true for IDs with allowed characters (a-z, A-Z, 0-9, -, _)', () => {
      expect(validateOrderId('abc-DEF_123')).toBe(true);
      expect(validateOrderId('abcdef')).toBe(true); // min length 6
      expect(validateOrderId('a'.repeat(64))).toBe(true); // max length 64
    });

    it('returns false for IDs shorter than 6 characters', () => {
      expect(validateOrderId('abc')).toBe(false);
      expect(validateOrderId('12345')).toBe(false);
      expect(validateOrderId('')).toBe(false);
    });

    it('returns false for IDs longer than 64 characters', () => {
      expect(validateOrderId('a'.repeat(65))).toBe(false);
    });

    it('returns false for IDs containing invalid characters', () => {
      expect(validateOrderId('order@123456')).toBe(false);
      expect(validateOrderId('order 123456')).toBe(false);
      expect(validateOrderId('order.123456')).toBe(false);
      expect(validateOrderId('주문번호123456')).toBe(false);
    });
  });

  // ── generateRandomId ─────────────────────────────────────────────
  describe('generateRandomId', () => {
    it('returns a string of the default length (12)', () => {
      const id = generateRandomId();
      expect(id).toHaveLength(12);
    });

    it('returns a string of a custom length', () => {
      expect(generateRandomId(6)).toHaveLength(6);
      expect(generateRandomId(20)).toHaveLength(20);
      expect(generateRandomId(1)).toHaveLength(1);
    });

    it('contains only alphanumeric characters', () => {
      const id = generateRandomId(100);
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('produces different values on repeated calls', () => {
      const ids = new Set(Array.from({ length: 20 }, () => generateRandomId()));
      expect(ids.size).toBeGreaterThan(1);
    });
  });

  // ── sanitizeUserId ───────────────────────────────────────────────
  describe('sanitizeUserId', () => {
    it('passes through alphanumeric strings unchanged', () => {
      expect(sanitizeUserId('abc123')).toBe('abc123');
    });

    it('converts numeric input to string', () => {
      expect(sanitizeUserId(12345)).toBe('12345');
    });

    it('removes invalid characters', () => {
      expect(sanitizeUserId('user@email.com')).toBe('useremailcom');
      expect(sanitizeUserId('hello world!')).toBe('helloworld');
    });

    it('keeps hyphens and underscores', () => {
      expect(sanitizeUserId('user-name_123')).toBe('user-name_123');
    });

    it('truncates to 16 characters', () => {
      const long = 'abcdefghijklmnopqrstuvwxyz';
      expect(sanitizeUserId(long)).toHaveLength(16);
      expect(sanitizeUserId(long)).toBe('abcdefghijklmnop');
    });

    it('strips Korean characters', () => {
      expect(sanitizeUserId('사용자123')).toBe('123');
    });
  });
});
