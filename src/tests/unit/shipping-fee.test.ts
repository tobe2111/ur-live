import { describe, it, expect } from 'vitest';
import { calculateShippingFee } from '@/shared/utils';

/**
 * Shipping fee calculation tests.
 *
 * Tests calculateShippingFee(subtotal, baseShippingFee, freeShippingThreshold?)
 * from src/shared/utils/index.ts.
 */

describe('calculateShippingFee', () => {
  // ── Base fee behavior ──────────────────────────────────────────
  describe('base fee (no free shipping threshold)', () => {
    it('returns the base shipping fee when no threshold is set', () => {
      expect(calculateShippingFee(10000, 3000)).toBe(3000);
    });

    it('returns the base fee even when subtotal is very large', () => {
      expect(calculateShippingFee(999999, 2500)).toBe(2500);
    });

    it('returns the base fee when subtotal is 0', () => {
      expect(calculateShippingFee(0, 3000)).toBe(3000);
    });

    it('returns 0 when baseShippingFee is 0', () => {
      expect(calculateShippingFee(5000, 0)).toBe(0);
    });
  });

  // ── Free shipping threshold ────────────────────────────────────
  describe('free shipping threshold', () => {
    it('returns 0 when subtotal meets the threshold exactly', () => {
      expect(calculateShippingFee(50000, 3000, 50000)).toBe(0);
    });

    it('returns 0 when subtotal exceeds the threshold', () => {
      expect(calculateShippingFee(60000, 3000, 50000)).toBe(0);
    });

    it('returns the base fee when subtotal is below the threshold', () => {
      expect(calculateShippingFee(49999, 3000, 50000)).toBe(3000);
    });

    it('returns the base fee when subtotal is 0 and threshold is set', () => {
      expect(calculateShippingFee(0, 3000, 50000)).toBe(3000);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────
  describe('edge cases', () => {
    it('threshold of 0 means everything qualifies for free shipping', () => {
      expect(calculateShippingFee(0, 3000, 0)).toBe(0);
      expect(calculateShippingFee(1, 3000, 0)).toBe(0);
    });

    it('handles undefined threshold (same as no threshold)', () => {
      expect(calculateShippingFee(100000, 2500, undefined)).toBe(2500);
    });

    it('handles very small subtotals', () => {
      expect(calculateShippingFee(1, 3000, 50000)).toBe(3000);
    });

    it('handles large base shipping fees', () => {
      expect(calculateShippingFee(10000, 50000, 100000)).toBe(50000);
    });

    it('1 won below threshold still charges shipping', () => {
      expect(calculateShippingFee(29999, 3000, 30000)).toBe(3000);
    });

    it('exactly at threshold gets free shipping', () => {
      expect(calculateShippingFee(30000, 3000, 30000)).toBe(0);
    });

    it('1 won above threshold gets free shipping', () => {
      expect(calculateShippingFee(30001, 3000, 30000)).toBe(0);
    });
  });

  // ── Realistic scenarios ────────────────────────────────────────
  describe('realistic scenarios', () => {
    it('typical Korean e-commerce: 3000 won shipping, free above 50000', () => {
      expect(calculateShippingFee(25000, 3000, 50000)).toBe(3000);
      expect(calculateShippingFee(50000, 3000, 50000)).toBe(0);
      expect(calculateShippingFee(75000, 3000, 50000)).toBe(0);
    });

    it('seller with no free shipping policy', () => {
      expect(calculateShippingFee(100000, 5000)).toBe(5000);
      expect(calculateShippingFee(500000, 5000)).toBe(5000);
    });

    it('seller offering free shipping on everything (threshold = 0)', () => {
      expect(calculateShippingFee(1000, 3000, 0)).toBe(0);
      expect(calculateShippingFee(0, 3000, 0)).toBe(0);
    });
  });
});
