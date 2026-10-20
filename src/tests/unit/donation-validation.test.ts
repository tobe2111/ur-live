import { describe, it, expect } from 'vitest';

/**
 * Donation and points donation validation tests.
 *
 * Business rules from:
 * - src/features/points/api/points.routes.ts (points donation, COMMISSION_RATE, CHARGE_AMOUNTS)
 * - src/features/donations/api/donations.routes.ts (real-money donation)
 */

// ── Constants (mirrored from points.routes.ts) ───────────────────
const COMMISSION_RATE = 0.15; // 15% charging commission
const MIN_POINTS_DONATION = 100; // minimum points donation (100 team)

const CHARGE_AMOUNTS = [
  { amount: 5000,   points: 4250,   label: '5,000원 → 4,250딜' },
  { amount: 10000,  points: 8500,   label: '10,000원 → 8,500딜' },
  { amount: 30000,  points: 25500,  label: '30,000원 → 25,500딜' },
  { amount: 50000,  points: 42500,  label: '50,000원 → 42,500딜' },
  { amount: 100000, points: 85000,  label: '100,000원 → 85,000딜' },
];

// ── Constants (mirrored from donations.routes.ts) ────────────────
const MIN_MONEY_DONATION = 1000; // minimum real-money donation (1,000 won)
const MONEY_DONATION_UNIT = 100; // must be multiple of 100 won

// ── Helper: points donation validation ───────────────────────────
function isPointsDonationValid(
  streamId: number | undefined,
  amount: number | undefined,
  balance: number,
): { valid: boolean; error?: string } {
  if (!streamId || !amount || amount < MIN_POINTS_DONATION) {
    return { valid: false, error: '후원 금액은 최소 100딜입니다' };
  }
  if (balance < amount) {
    return {
      valid: false,
      error: `딜이 부족합니다. (보유: ${balance}딜, 필요: ${amount}딜)`,
    };
  }
  return { valid: true };
}

// ── Helper: real-money donation validation ───────────────────────
function isMoneyDonationValid(
  streamId: number | undefined,
  amount: number | undefined,
): { valid: boolean; error?: string } {
  if (!streamId || !amount) {
    return { valid: false, error: '필수 항목 누락 (stream_id, amount)' };
  }
  if (amount < MIN_MONEY_DONATION || amount % MONEY_DONATION_UNIT !== 0) {
    return { valid: false, error: '후원 금액은 최소 1,000원이며 100원 단위여야 합니다' };
  }
  return { valid: true };
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Donation validation', () => {

  // ── Minimum points donation (100 team) ─────────────────────────
  describe('Points donation minimum (100 team)', () => {
    it('rejects amount below 100', () => {
      expect(isPointsDonationValid(1, 99, 1000).valid).toBe(false);
      expect(isPointsDonationValid(1, 50, 1000).valid).toBe(false);
      expect(isPointsDonationValid(1, 1, 1000).valid).toBe(false);
    });

    it('accepts amount of exactly 100', () => {
      expect(isPointsDonationValid(1, 100, 1000).valid).toBe(true);
    });

    it('accepts amounts above 100', () => {
      expect(isPointsDonationValid(1, 101, 1000).valid).toBe(true);
      expect(isPointsDonationValid(1, 500, 1000).valid).toBe(true);
    });

    it('rejects zero amount', () => {
      expect(isPointsDonationValid(1, 0, 1000).valid).toBe(false);
    });

    it('rejects undefined amount', () => {
      expect(isPointsDonationValid(1, undefined, 1000).valid).toBe(false);
    });

    it('rejects missing stream_id', () => {
      expect(isPointsDonationValid(undefined, 500, 1000).valid).toBe(false);
      expect(isPointsDonationValid(0, 500, 1000).valid).toBe(false);
    });
  });

  // ── Balance check (insufficient points) ────────────────────────
  describe('Balance check', () => {
    it('rejects when balance < amount', () => {
      const result = isPointsDonationValid(1, 500, 400);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('딜이 부족합니다');
    });

    it('accepts when balance == amount', () => {
      expect(isPointsDonationValid(1, 500, 500).valid).toBe(true);
    });

    it('accepts when balance > amount', () => {
      expect(isPointsDonationValid(1, 500, 1000).valid).toBe(true);
    });

    it('rejects when balance is 0', () => {
      const result = isPointsDonationValid(1, 100, 0);
      expect(result.valid).toBe(false);
    });

    it('error message includes balance and required amount', () => {
      const result = isPointsDonationValid(1, 300, 100);
      expect(result.error).toContain('100');
      expect(result.error).toContain('300');
    });
  });

  // ── Commission rate 0.15 for charging ──────────────────────────
  describe('Charging commission rate (0.15)', () => {
    it('COMMISSION_RATE is 0.15 (15%)', () => {
      expect(COMMISSION_RATE).toBe(0.15);
    });

    it('commission for 10,000 charge is 1,500', () => {
      expect(Math.round(10_000 * COMMISSION_RATE)).toBe(1_500);
    });

    it('commission for 100,000 charge is 15,000', () => {
      expect(Math.round(100_000 * COMMISSION_RATE)).toBe(15_000);
    });

    it('points received = amount - commission for all packages', () => {
      for (const pkg of CHARGE_AMOUNTS) {
        const commission = Math.round(pkg.amount * COMMISSION_RATE);
        expect(pkg.points).toBe(pkg.amount - commission);
      }
    });
  });

  // ── Charge amounts validation ──────────────────────────────────
  describe('CHARGE_AMOUNTS packages', () => {
    it('contains exactly 5 options', () => {
      expect(CHARGE_AMOUNTS).toHaveLength(5);
    });

    it('only allows predefined amounts', () => {
      const validAmounts = CHARGE_AMOUNTS.map(p => p.amount);
      expect(validAmounts).toEqual([5000, 10000, 30000, 50000, 100000]);
    });

    it('rejects non-predefined charge amounts', () => {
      const invalidAmounts = [1000, 2000, 7777, 15000, 200000];
      for (const amount of invalidAmounts) {
        const pkg = CHARGE_AMOUNTS.find(p => p.amount === amount);
        expect(pkg).toBeUndefined();
      }
    });

    it.each(CHARGE_AMOUNTS)(
      'package $amount: yields $points points',
      ({ amount, points }) => {
        const expected = Math.round(amount * (1 - COMMISSION_RATE));
        expect(points).toBe(expected);
      },
    );

    it('labels contain formatted amounts', () => {
      for (const { amount, points, label } of CHARGE_AMOUNTS) {
        expect(label).toContain(amount.toLocaleString());
        expect(label).toContain(points.toLocaleString());
        expect(label).toContain('딜');
      }
    });
  });

  // ── Real-money donation validation ─────────────────────────────
  describe('Real-money donation validation', () => {
    it('minimum is 1,000 won', () => {
      expect(isMoneyDonationValid(1, 1000).valid).toBe(true);
      expect(isMoneyDonationValid(1, 999).valid).toBe(false);
      expect(isMoneyDonationValid(1, 500).valid).toBe(false);
    });

    it('must be a multiple of 100 won', () => {
      expect(isMoneyDonationValid(1, 1000).valid).toBe(true);
      expect(isMoneyDonationValid(1, 1100).valid).toBe(true);
      expect(isMoneyDonationValid(1, 1050).valid).toBe(false);
      expect(isMoneyDonationValid(1, 1001).valid).toBe(false);
    });

    it('rejects missing stream_id', () => {
      expect(isMoneyDonationValid(undefined, 1000).valid).toBe(false);
    });

    it('rejects missing amount', () => {
      expect(isMoneyDonationValid(1, undefined).valid).toBe(false);
    });
  });

  // ── Donation commission math (real-money) ──────────────────────
  describe('Donation commission split', () => {
    it('commission_amount + credit_amount = total amount', () => {
      const donationAmount = 10_000;
      const commissionRate = 15.0; // percent
      const commissionAmount = Math.round(donationAmount * commissionRate / 100);
      const creditAmount = donationAmount - commissionAmount;
      expect(commissionAmount + creditAmount).toBe(donationAmount);
      expect(commissionAmount).toBe(1_500);
      expect(creditAmount).toBe(8_500);
    });
  });
});
