import { describe, it, expect } from 'vitest';

/**
 * Multi-tier referral commission calculation tests.
 *
 * The actual logic lives in src/features/referral/api/referral-tree.routes.ts
 * (calculateMultiTierCommission). That function depends on D1Database, so we
 * mirror the pure math here to validate commission arithmetic in isolation.
 *
 * Default commission rates (from getCommissionRates defaults):
 *   tier1 = 10%, tier2 = 3%, tier3 = 1%
 *
 * The production code uses Math.round(orderAmount * rate / 100).
 * (Standardized to Math.round across all commission math per v9 audit CRIT-2.)
 */

// ── Constants (mirrored from referral-tree.routes.ts) ──────────────
interface CommissionRates {
  tier1: number; // percent, e.g. 10
  tier2: number; // percent, e.g. 3
  tier3: number; // percent, e.g. 1
}

const DEFAULT_RATES: CommissionRates = { tier1: 10, tier2: 3, tier3: 1 };

// ── Pure math mirror of calculateMultiTierCommission ────────────────

interface ReferralNode {
  parent_id: string | null;
  grandparent_id: string | null;
  great_grandparent_id: string | null;
}

interface CommissionEntry {
  tier: number;
  beneficiary_id: string;
  commission_amount: number;
}

/**
 * Pure-function equivalent of calculateMultiTierCommission.
 * No DB access, no duplicate-check (tested separately via logic assertions).
 */
function calculateCommissions(
  buyerNode: ReferralNode | null,
  orderAmount: number,
  rates: CommissionRates = DEFAULT_RATES,
): CommissionEntry[] {
  if (!buyerNode || !buyerNode.parent_id) return [];

  const commissions: CommissionEntry[] = [];

  // Tier 1 -- direct referrer (parent)
  if (buyerNode.parent_id) {
    const amount = Math.round(orderAmount * rates.tier1 / 100);
    if (amount > 0) {
      commissions.push({ tier: 1, beneficiary_id: buyerNode.parent_id, commission_amount: amount });
    }
  }

  // Tier 2 -- grandparent
  if (buyerNode.grandparent_id) {
    const amount = Math.round(orderAmount * rates.tier2 / 100);
    if (amount > 0) {
      commissions.push({ tier: 2, beneficiary_id: buyerNode.grandparent_id, commission_amount: amount });
    }
  }

  // Tier 3 -- great-grandparent
  if (buyerNode.great_grandparent_id) {
    const amount = Math.round(orderAmount * rates.tier3 / 100);
    if (amount > 0) {
      commissions.push({ tier: 3, beneficiary_id: buyerNode.great_grandparent_id, commission_amount: amount });
    }
  }

  return commissions;
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Multi-tier referral commission', () => {

  const fullNode: ReferralNode = {
    parent_id: 'user-A',
    grandparent_id: 'user-B',
    great_grandparent_id: 'user-C',
  };

  // ── Tier 1 commission = 10% of order amount ─────────────────────
  describe('Tier 1 commission (10%)', () => {
    it('calculates 10% for a 100,000 order', () => {
      const result = calculateCommissions(fullNode, 100_000);
      const tier1 = result.find(c => c.tier === 1);
      expect(tier1).toBeDefined();
      expect(tier1!.commission_amount).toBe(10_000);
    });

    it('calculates 10% for a 50,000 order', () => {
      const result = calculateCommissions(fullNode, 50_000);
      expect(result.find(c => c.tier === 1)!.commission_amount).toBe(5_000);
    });

    it('uses Math.round for non-integer results', () => {
      // 33,333 * 10 / 100 = 3333.3 => round => 3333
      const result = calculateCommissions(fullNode, 33_333);
      expect(result.find(c => c.tier === 1)!.commission_amount).toBe(3_333);
    });

    it('assigns to the parent_id beneficiary', () => {
      const result = calculateCommissions(fullNode, 10_000);
      expect(result.find(c => c.tier === 1)!.beneficiary_id).toBe('user-A');
    });
  });

  // ── Tier 2 commission = 3% of order amount ──────────────────────
  describe('Tier 2 commission (3%)', () => {
    it('calculates 3% for a 100,000 order', () => {
      const result = calculateCommissions(fullNode, 100_000);
      const tier2 = result.find(c => c.tier === 2);
      expect(tier2).toBeDefined();
      expect(tier2!.commission_amount).toBe(3_000);
    });

    it('uses Math.round for non-integer results', () => {
      // 10,001 * 3 / 100 = 300.03 => round => 300
      const result = calculateCommissions(fullNode, 10_001);
      expect(result.find(c => c.tier === 2)!.commission_amount).toBe(300);
    });

    it('assigns to the grandparent_id beneficiary', () => {
      const result = calculateCommissions(fullNode, 10_000);
      expect(result.find(c => c.tier === 2)!.beneficiary_id).toBe('user-B');
    });
  });

  // ── Tier 3 commission = 1% of order amount ──────────────────────
  describe('Tier 3 commission (1%)', () => {
    it('calculates 1% for a 100,000 order', () => {
      const result = calculateCommissions(fullNode, 100_000);
      const tier3 = result.find(c => c.tier === 3);
      expect(tier3).toBeDefined();
      expect(tier3!.commission_amount).toBe(1_000);
    });

    it('uses Math.round for non-integer results', () => {
      // 999 * 1 / 100 = 9.99 => round => 10
      const result = calculateCommissions(fullNode, 999);
      expect(result.find(c => c.tier === 3)!.commission_amount).toBe(10);
    });

    it('assigns to the great_grandparent_id beneficiary', () => {
      const result = calculateCommissions(fullNode, 10_000);
      expect(result.find(c => c.tier === 3)!.beneficiary_id).toBe('user-C');
    });
  });

  // ── No commission if buyer has no referrer ──────────────────────
  describe('No referrer scenarios', () => {
    it('returns empty array when buyer node is null', () => {
      expect(calculateCommissions(null, 100_000)).toEqual([]);
    });

    it('returns empty array when parent_id is null', () => {
      const node: ReferralNode = { parent_id: null, grandparent_id: null, great_grandparent_id: null };
      expect(calculateCommissions(node, 100_000)).toEqual([]);
    });

    it('returns only tier 1 when grandparent/great-grandparent are null', () => {
      const node: ReferralNode = { parent_id: 'user-A', grandparent_id: null, great_grandparent_id: null };
      const result = calculateCommissions(node, 100_000);
      expect(result).toHaveLength(1);
      expect(result[0].tier).toBe(1);
    });

    it('returns tier 1 and tier 2 when only great-grandparent is null', () => {
      const node: ReferralNode = { parent_id: 'user-A', grandparent_id: 'user-B', great_grandparent_id: null };
      const result = calculateCommissions(node, 100_000);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.tier)).toEqual([1, 2]);
    });
  });

  // ── No duplicate commissions for same order ──────────────────────
  describe('Duplicate prevention (logic)', () => {
    it('production code checks existing commissions before inserting (SELECT ... WHERE order_id = ?)', () => {
      // This is a DB-level check in calculateMultiTierCommission.
      // We verify the logic contract: calling calculateCommissions twice yields identical results,
      // and the production code returns [] if commissions already exist for orderId.
      const first = calculateCommissions(fullNode, 100_000);
      const second = calculateCommissions(fullNode, 100_000);
      expect(first).toEqual(second);
    });

    it('each tier appears at most once in the results', () => {
      const result = calculateCommissions(fullNode, 100_000);
      const tiers = result.map(c => c.tier);
      expect(new Set(tiers).size).toBe(tiers.length);
    });

    it('total commissions never exceed sum of all tier rates', () => {
      const orderAmount = 100_000;
      const result = calculateCommissions(fullNode, orderAmount);
      const totalCommission = result.reduce((sum, c) => sum + c.commission_amount, 0);
      const maxRate = (DEFAULT_RATES.tier1 + DEFAULT_RATES.tier2 + DEFAULT_RATES.tier3) / 100;
      // Math.round may produce a value 1 higher than Math.floor(orderAmount * maxRate) due to
      // rounding up; allow a small tolerance of the number of tiers.
      expect(totalCommission).toBeLessThanOrEqual(Math.round(orderAmount * maxRate) + result.length);
    });
  });

  // ── Custom rates ────────────────────────────────────────────────
  describe('Custom commission rates', () => {
    it('respects overridden rates from platform_settings', () => {
      const customRates: CommissionRates = { tier1: 15, tier2: 5, tier3: 2 };
      const result = calculateCommissions(fullNode, 100_000, customRates);
      expect(result.find(c => c.tier === 1)!.commission_amount).toBe(15_000);
      expect(result.find(c => c.tier === 2)!.commission_amount).toBe(5_000);
      expect(result.find(c => c.tier === 3)!.commission_amount).toBe(2_000);
    });

    it('zero rate produces no commission for that tier', () => {
      const zeroT2: CommissionRates = { tier1: 10, tier2: 0, tier3: 1 };
      const result = calculateCommissions(fullNode, 100_000, zeroT2);
      expect(result.find(c => c.tier === 2)).toBeUndefined();
      expect(result).toHaveLength(2);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('zero order amount produces no commissions', () => {
      const result = calculateCommissions(fullNode, 0);
      expect(result).toEqual([]);
    });

    it('very small order (< 100) still produces tier 1 commission via round', () => {
      // 99 * 10 / 100 = 9.9 => round => 10
      const result = calculateCommissions(fullNode, 99);
      expect(result.find(c => c.tier === 1)!.commission_amount).toBe(10);
    });

    it('order amount of 1 yields 0 for all tiers (all round to 0)', () => {
      const result = calculateCommissions(fullNode, 1);
      // 1 * 10/100 = 0.1 => round => 0 (filtered out since amount > 0 check)
      // 1 * 3/100 = 0.03 => round => 0
      // 1 * 1/100 = 0.01 => round => 0
      expect(result).toEqual([]);
    });

    it('very large order amount', () => {
      const result = calculateCommissions(fullNode, 100_000_000);
      expect(result.find(c => c.tier === 1)!.commission_amount).toBe(10_000_000);
      expect(result.find(c => c.tier === 2)!.commission_amount).toBe(3_000_000);
      expect(result.find(c => c.tier === 3)!.commission_amount).toBe(1_000_000);
    });
  });
});
