import { describe, it, expect } from 'vitest';
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

    it('returns unique values on successive calls', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateOrderId()));
      // With 6 random digits the collision chance across 50 calls is negligible
      expect(ids.size).toBe(50);
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
