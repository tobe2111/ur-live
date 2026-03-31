import { describe, it, expect } from 'vitest';

/**
 * Points system validation logic tests.
 *
 * These values are defined in src/features/points/api/points.routes.ts
 * but that file imports Hono / Cloudflare Workers middleware, so we
 * duplicate the pure business constants here to test the math without
 * needing a Workers runtime.
 */

// ── Constants (mirrored from points.routes.ts) ─────────────────────
const COMMISSION_RATE = 0.15; // 15%

const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 4250,   label: '5,000원 → 4,250팀' },
  { amount: 10000,  points: 8500,   label: '10,000원 → 8,500팀' },
  { amount: 30000,  points: 25500,  label: '30,000원 → 25,500팀' },
  { amount: 50000,  points: 42500,  label: '50,000원 → 42,500팀' },
  { amount: 100000, points: 85000,  label: '100,000원 → 85,000팀' },
];

const MIN_DONATION_AMOUNT = 100;

// ── Tests ──────────────────────────────────────────────────────────
describe('Points system validation', () => {
  // ── COMMISSION_RATE ──────────────────────────────────────────────
  describe('COMMISSION_RATE', () => {
    it('is 0.15 (15%)', () => {
      expect(COMMISSION_RATE).toBe(0.15);
    });

    it('commission for 10000 is 1500', () => {
      expect(Math.round(10000 * COMMISSION_RATE)).toBe(1500);
    });

    it('commission for 5000 is 750', () => {
      expect(Math.round(5000 * COMMISSION_RATE)).toBe(750);
    });

    it('commission for 100000 is 15000', () => {
      expect(Math.round(100000 * COMMISSION_RATE)).toBe(15000);
    });
  });

  // ── CHARGE_AMOUNTS ──────────────────────────────────────────────
  describe('CHARGE_AMOUNTS', () => {
    it('contains exactly 5 charge options', () => {
      expect(CHARGE_AMOUNTS).toHaveLength(5);
    });

    it.each(CHARGE_AMOUNTS)(
      'amount $amount yields $points points (amount * 0.85)',
      ({ amount, points }) => {
        const expected = Math.round(amount * (1 - COMMISSION_RATE));
        expect(points).toBe(expected);
      },
    );

    it('points are always less than amount (commission is deducted)', () => {
      for (const { amount, points } of CHARGE_AMOUNTS) {
        expect(points).toBeLessThan(amount);
      }
    });

    it('commission_amount + points = amount for every option', () => {
      for (const { amount, points } of CHARGE_AMOUNTS) {
        const commission = Math.round(amount * COMMISSION_RATE);
        expect(commission + points).toBe(amount);
      }
    });

    it('amounts are sorted in ascending order', () => {
      for (let i = 1; i < CHARGE_AMOUNTS.length; i++) {
        expect(CHARGE_AMOUNTS[i].amount).toBeGreaterThan(CHARGE_AMOUNTS[i - 1].amount);
      }
    });

    it('labels contain correct formatted amounts', () => {
      for (const { amount, points, label } of CHARGE_AMOUNTS) {
        expect(label).toContain(amount.toLocaleString());
        expect(label).toContain(points.toLocaleString());
      }
    });
  });

  // ── Donation validation ──────────────────────────────────────────
  describe('Donation amount validation', () => {
    it('minimum donation is 100', () => {
      expect(MIN_DONATION_AMOUNT).toBe(100);
    });

    it('amounts >= 100 are valid', () => {
      for (const validAmount of [100, 101, 500, 1000, 99999]) {
        expect(validAmount >= MIN_DONATION_AMOUNT).toBe(true);
      }
    });

    it('amounts < 100 are invalid', () => {
      for (const invalidAmount of [0, 1, 50, 99]) {
        expect(invalidAmount < MIN_DONATION_AMOUNT).toBe(true);
      }
    });

    it('negative amounts are invalid', () => {
      expect(-1 < MIN_DONATION_AMOUNT).toBe(true);
      expect(-100 < MIN_DONATION_AMOUNT).toBe(true);
    });

    // Mirrors the validation logic: !stream_id || !amount || amount < 100
    function isDonationValid(streamId: number | undefined, amount: number | undefined): boolean {
      if (!streamId || !amount || amount < 100) return false;
      return true;
    }

    it('rejects missing stream_id', () => {
      expect(isDonationValid(undefined, 500)).toBe(false);
      expect(isDonationValid(0, 500)).toBe(false);
    });

    it('rejects missing or zero amount', () => {
      expect(isDonationValid(1, undefined)).toBe(false);
      expect(isDonationValid(1, 0)).toBe(false);
    });

    it('rejects amount below 100', () => {
      expect(isDonationValid(1, 99)).toBe(false);
      expect(isDonationValid(1, 1)).toBe(false);
    });

    it('accepts valid stream_id and amount >= 100', () => {
      expect(isDonationValid(1, 100)).toBe(true);
      expect(isDonationValid(42, 5000)).toBe(true);
    });
  });

  // ── Edge cases for commission math ───────────────────────────────
  describe('Commission rounding', () => {
    it('Math.round is used so intermediate values are correctly rounded', () => {
      // 5000 * 0.15 = 750 exactly (no rounding needed)
      expect(Math.round(5000 * COMMISSION_RATE)).toBe(750);

      // Verify there is no floating-point surprise for any CHARGE_AMOUNTS entry
      for (const { amount } of CHARGE_AMOUNTS) {
        const commission = Math.round(amount * COMMISSION_RATE);
        const points = Math.round(amount * (1 - COMMISSION_RATE));
        // The sum might be off by 1 due to rounding; verify the source data is consistent
        expect(commission + points).toBe(amount);
      }
    });
  });
});
