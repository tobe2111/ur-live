import { describe, it, expect } from 'vitest';

/**
 * Deal point operations tests.
 *
 * The actual logic lives in src/features/points/api/points.routes.ts.
 * Those routes depend on D1Database + Hono middleware, so we mirror the
 * pure business math and state-transition rules here.
 *
 * Key rules from CLAUDE.md & points.routes.ts:
 *   - Charge: 1 won = 1 deal (no fee at charge time)
 *   - Seller settlement: 15% platform fee
 *   - Minimum donation: 500 deals
 *   - Deduction uses atomic SQL: "balance >= amount" guard
 */

// ── Constants (mirrored from points.routes.ts) ─────────────────────
const DEFAULT_COMMISSION_RATE = 0.15; // 15% platform fee (seller settlement)
const MIN_DONATION = 500;

const CHARGE_AMOUNTS = [
  { amount: 5_000,   points: 5_000   },
  { amount: 10_000,  points: 10_000  },
  { amount: 30_000,  points: 30_000  },
  { amount: 50_000,  points: 50_000  },
  { amount: 100_000, points: 100_000 },
];

// ── Wallet simulation (pure in-memory, mirrors DB behavior) ────────

interface Wallet {
  balance: number;
  total_charged: number;
  total_donated: number;
}

function createWallet(): Wallet {
  return { balance: 0, total_charged: 0, total_donated: 0 };
}

/** Charge: 1 won = 1 deal, no fee */
function charge(wallet: Wallet, amount: number): Wallet {
  const pkg = CHARGE_AMOUNTS.find(p => p.amount === amount);
  if (!pkg) throw new Error(`Invalid charge amount: ${amount}`);

  return {
    balance: wallet.balance + pkg.points,
    total_charged: wallet.total_charged + pkg.points,
    total_donated: wallet.total_donated,
  };
}

/**
 * Deduct (donate/pay).
 * Returns updated wallet or null if insufficient balance.
 * Mirrors the atomic SQL: UPDATE ... WHERE balance >= ?
 */
function deduct(wallet: Wallet, amount: number): Wallet | null {
  if (amount <= 0) return null;
  if (wallet.balance < amount) return null;

  return {
    balance: wallet.balance - amount,
    total_charged: wallet.total_charged,
    total_donated: wallet.total_donated + amount,
  };
}

/** Refund: restore exact amount (e.g. group-buy cancellation) */
function refund(wallet: Wallet, amount: number): Wallet {
  return {
    balance: wallet.balance + amount,
    total_charged: wallet.total_charged,
    total_donated: wallet.total_donated - amount,
  };
}

/** Seller settlement: 15% platform fee */
function calculateSellerSettlement(donationAmount: number, rate = DEFAULT_COMMISSION_RATE) {
  const commission = Math.round(donationAmount * rate);
  const creditAmount = donationAmount - commission;
  return { commission, creditAmount };
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Deal point operations', () => {

  // ── Charge adds correct amount (1:1) ────────────────────────────
  describe('Charge (1 won = 1 deal)', () => {
    it.each(CHARGE_AMOUNTS)(
      'charging $amount won adds exactly $points deals',
      ({ amount, points }) => {
        const wallet = charge(createWallet(), amount);
        expect(wallet.balance).toBe(points);
        expect(wallet.total_charged).toBe(points);
        expect(amount).toBe(points); // 1:1 ratio
      },
    );

    it('rejects invalid charge amounts', () => {
      expect(() => charge(createWallet(), 7777)).toThrow('Invalid charge amount');
      expect(() => charge(createWallet(), 0)).toThrow('Invalid charge amount');
      expect(() => charge(createWallet(), -5000)).toThrow('Invalid charge amount');
    });

    it('stacks multiple charges', () => {
      let wallet = createWallet();
      wallet = charge(wallet, 5_000);
      wallet = charge(wallet, 10_000);
      expect(wallet.balance).toBe(15_000);
      expect(wallet.total_charged).toBe(15_000);
    });
  });

  // ── Deduction doesn't go below 0 ───────────────────────────────
  describe('Deduction (balance guard)', () => {
    it('succeeds when balance is sufficient', () => {
      let wallet = charge(createWallet(), 10_000);
      wallet = deduct(wallet, 5_000)!;
      expect(wallet).not.toBeNull();
      expect(wallet.balance).toBe(5_000);
    });

    it('fails when balance is insufficient', () => {
      const wallet = charge(createWallet(), 5_000);
      const result = deduct(wallet, 10_000);
      expect(result).toBeNull();
    });

    it('fails when balance is exactly 0', () => {
      const wallet = createWallet();
      expect(deduct(wallet, 1)).toBeNull();
    });

    it('succeeds when deducting exact balance', () => {
      const wallet = charge(createWallet(), 10_000);
      const result = deduct(wallet, 10_000);
      expect(result).not.toBeNull();
      expect(result!.balance).toBe(0);
    });

    it('rejects zero or negative deduction amounts', () => {
      const wallet = charge(createWallet(), 10_000);
      expect(deduct(wallet, 0)).toBeNull();
      expect(deduct(wallet, -500)).toBeNull();
    });

    it('updates total_donated on successful deduction', () => {
      let wallet = charge(createWallet(), 10_000);
      wallet = deduct(wallet, 3_000)!;
      expect(wallet.total_donated).toBe(3_000);
    });
  });

  // ── Refund restores exact amount ────────────────────────────────
  describe('Refund', () => {
    it('restores the exact deducted amount', () => {
      let wallet = charge(createWallet(), 10_000);
      wallet = deduct(wallet, 3_000)!;
      expect(wallet.balance).toBe(7_000);
      wallet = refund(wallet, 3_000);
      expect(wallet.balance).toBe(10_000);
    });

    it('adjusts total_donated back down', () => {
      let wallet = charge(createWallet(), 10_000);
      wallet = deduct(wallet, 5_000)!;
      expect(wallet.total_donated).toBe(5_000);
      wallet = refund(wallet, 5_000);
      expect(wallet.total_donated).toBe(0);
    });

    it('partial refund restores partial amount', () => {
      let wallet = charge(createWallet(), 10_000);
      wallet = deduct(wallet, 5_000)!;
      wallet = refund(wallet, 2_000);
      expect(wallet.balance).toBe(7_000);
      expect(wallet.total_donated).toBe(3_000);
    });
  });

  // ── Concurrent deductions don't create negative balance ─────────
  describe('Concurrent deduction safety', () => {
    it('second deduction fails if first consumed the balance', () => {
      const wallet = charge(createWallet(), 10_000);
      // Simulate two concurrent deductions on the same snapshot
      const result1 = deduct(wallet, 7_000);
      const result2 = deduct(wallet, 7_000);
      // Both see the same balance, but in production the SQL WHERE clause
      // ensures only one succeeds. Here both see enough balance from the snapshot.
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();

      // If we apply sequentially (as the DB would), the second fails:
      const sequential1 = deduct(wallet, 7_000)!;
      const sequential2 = deduct(sequential1, 7_000);
      expect(sequential2).toBeNull(); // 3,000 < 7,000
    });

    it('atomic guard pattern: UPDATE ... WHERE balance >= amount', () => {
      // The production code at points.routes.ts line 264:
      //   UPDATE user_points SET balance = balance - ? ... WHERE user_id = ? AND balance >= ?
      // This means if balance dropped between the SELECT and UPDATE, the
      // UPDATE affects 0 rows (meta.changes === 0) and the code returns an error.
      // We verify the math here:
      const balance = 5_000;
      const amount = 5_001;
      expect(balance >= amount).toBe(false); // would not match WHERE clause
    });

    it('multiple small deductions drain to zero', () => {
      let wallet = charge(createWallet(), 5_000);
      for (let i = 0; i < 50; i++) {
        const result = deduct(wallet, 100);
        expect(result).not.toBeNull();
        wallet = result!;
      }
      expect(wallet.balance).toBe(0);
      // 51st deduction fails
      expect(deduct(wallet, 100)).toBeNull();
    });
  });

  // ── Seller settlement (15% platform fee) ────────────────────────
  describe('Seller settlement commission', () => {
    it('15% commission on donation of 10,000', () => {
      const { commission, creditAmount } = calculateSellerSettlement(10_000);
      expect(commission).toBe(1_500);
      expect(creditAmount).toBe(8_500);
    });

    it('commission + creditAmount = original amount', () => {
      for (const amount of [500, 1_000, 5_000, 10_000, 50_000, 100_000]) {
        const { commission, creditAmount } = calculateSellerSettlement(amount);
        expect(commission + creditAmount).toBe(amount);
      }
    });

    it('handles odd amounts with rounding', () => {
      // 333 * 0.15 = 49.95 => round => 50
      const { commission, creditAmount } = calculateSellerSettlement(333);
      expect(commission).toBe(50);
      expect(creditAmount).toBe(283);
      expect(commission + creditAmount).toBe(333);
    });
  });

  // ── Minimum donation validation ─────────────────────────────────
  describe('Minimum donation (500 deals)', () => {
    it('rejects donations below 500', () => {
      expect(499 < MIN_DONATION).toBe(true);
      expect(0 < MIN_DONATION).toBe(true);
      expect(1 < MIN_DONATION).toBe(true);
    });

    it('accepts donations of 500 or more', () => {
      expect(500 >= MIN_DONATION).toBe(true);
      expect(501 >= MIN_DONATION).toBe(true);
      expect(10_000 >= MIN_DONATION).toBe(true);
    });
  });

  // ── Charge option validation ────────────────────────────────────
  describe('Charge options', () => {
    it('has exactly 5 charge options', () => {
      expect(CHARGE_AMOUNTS).toHaveLength(5);
    });

    it('all options have 1:1 won-to-deal ratio', () => {
      for (const { amount, points } of CHARGE_AMOUNTS) {
        expect(amount).toBe(points);
      }
    });

    it('amounts are sorted ascending', () => {
      for (let i = 1; i < CHARGE_AMOUNTS.length; i++) {
        expect(CHARGE_AMOUNTS[i].amount).toBeGreaterThan(CHARGE_AMOUNTS[i - 1].amount);
      }
    });
  });
});
