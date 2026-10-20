import { describe, it, expect } from 'vitest';

/**
 * Tests for EAN-13 barcode generation logic
 * extracted from src/features/inventory/api/inventory.routes.ts
 *
 * The generateEAN13 function is not exported, so we replicate
 * the identical algorithm here for unit testing.
 */

function generateEAN13(sellerId: number, productId: number): string {
  const prefix = '880'; // Korea country code
  const sellerPart = String(sellerId).padStart(4, '0').slice(-4);
  const productPart = String(productId).padStart(5, '0').slice(-5);
  const partial = prefix + sellerPart + productPart; // 12 digits

  // EAN-13 check digit calculation
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return partial + checkDigit;
}

/** Independent check digit verifier for EAN-13 */
function isValidEAN13(code: string): boolean {
  if (code.length !== 13 || !/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(code[12]);
}

describe('EAN-13 barcode generator', () => {
  // ── Format ───────────────────────────────────────────────────────
  describe('format', () => {
    it('produces exactly 13 digits', () => {
      const code = generateEAN13(1, 1);
      expect(code).toHaveLength(13);
      expect(code).toMatch(/^\d{13}$/);
    });

    it('starts with 880 (Korea country prefix)', () => {
      const code = generateEAN13(42, 99);
      expect(code.slice(0, 3)).toBe('880');
    });

    it('contains seller ID in positions 3-6 (4 digits, zero-padded)', () => {
      const code = generateEAN13(7, 1);
      expect(code.slice(3, 7)).toBe('0007');
    });

    it('contains product ID in positions 7-11 (5 digits, zero-padded)', () => {
      const code = generateEAN13(1, 42);
      expect(code.slice(7, 12)).toBe('00042');
    });
  });

  // ── Check digit ──────────────────────────────────────────────────
  describe('check digit', () => {
    it('produces a valid EAN-13 check digit', () => {
      const testCases = [
        [1, 1],
        [1, 2],
        [99, 12345],
        [9999, 99999],
        [0, 0],
        [500, 7777],
      ];
      for (const [sellerId, productId] of testCases) {
        const code = generateEAN13(sellerId, productId);
        expect(isValidEAN13(code)).toBe(true);
      }
    });

    it('check digit is between 0 and 9', () => {
      const code = generateEAN13(123, 456);
      const checkDigit = parseInt(code[12]);
      expect(checkDigit).toBeGreaterThanOrEqual(0);
      expect(checkDigit).toBeLessThanOrEqual(9);
    });
  });

  // ── Uniqueness ───────────────────────────────────────────────────
  describe('uniqueness', () => {
    it('different seller IDs produce different barcodes', () => {
      const code1 = generateEAN13(1, 100);
      const code2 = generateEAN13(2, 100);
      expect(code1).not.toBe(code2);
    });

    it('different product IDs produce different barcodes', () => {
      const code1 = generateEAN13(1, 100);
      const code2 = generateEAN13(1, 101);
      expect(code1).not.toBe(code2);
    });

    it('same inputs always produce the same barcode (deterministic)', () => {
      const code1 = generateEAN13(42, 999);
      const code2 = generateEAN13(42, 999);
      expect(code1).toBe(code2);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles seller ID 0', () => {
      const code = generateEAN13(0, 1);
      expect(code.slice(3, 7)).toBe('0000');
      expect(isValidEAN13(code)).toBe(true);
    });

    it('handles product ID 0', () => {
      const code = generateEAN13(1, 0);
      expect(code.slice(7, 12)).toBe('00000');
      expect(isValidEAN13(code)).toBe(true);
    });

    it('truncates seller ID to last 4 digits when > 9999', () => {
      const code = generateEAN13(12345, 1);
      expect(code.slice(3, 7)).toBe('2345');
      expect(isValidEAN13(code)).toBe(true);
    });

    it('truncates product ID to last 5 digits when > 99999', () => {
      const code = generateEAN13(1, 123456);
      expect(code.slice(7, 12)).toBe('23456');
      expect(isValidEAN13(code)).toBe(true);
    });

    it('max values within range still produce valid EAN-13', () => {
      const code = generateEAN13(9999, 99999);
      expect(code).toHaveLength(13);
      expect(isValidEAN13(code)).toBe(true);
    });
  });
});
