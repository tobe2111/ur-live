import { describe, it, expect } from 'vitest';

/**
 * Seller tier system tests.
 *
 * Tier data is defined in src/features/seller-tiers/api/seller-tiers.routes.ts
 * (ensureTable INSERT). We mirror the pure business constants here to test
 * commission calculation and tier-assignment logic without a DB.
 */

// ── Constants (mirrored from seller-tiers.routes.ts) ─────────────
interface SellerTier {
  name: string;
  min_monthly_sales: number;
  commission_rate: number;
  benefits: string[];
  sort_order: number;
}

const SELLER_TIERS: SellerTier[] = [
  { name: '브론즈', min_monthly_sales: 0,        commission_rate: 12.0, benefits: ['기본 정산'], sort_order: 1 },
  { name: '실버',   min_monthly_sales: 1_000_000, commission_rate: 10.0, benefits: ['기본 정산', '우선 노출'], sort_order: 2 },
  { name: '골드',   min_monthly_sales: 5_000_000, commission_rate: 8.0,  benefits: ['기본 정산', '우선 노출', '배너 노출'], sort_order: 3 },
  { name: '플래티넘', min_monthly_sales: 10_000_000, commission_rate: 6.0, benefits: ['기본 정산', '우선 노출', '배너 노출', '전담 매니저'], sort_order: 4 },
  { name: '다이아', min_monthly_sales: 30_000_000, commission_rate: 4.0,  benefits: ['기본 정산', '우선 노출', '배너 노출', '전담 매니저', '수수료 최저'], sort_order: 5 },
];

/**
 * Mirrors the DB query:
 *   SELECT ... FROM seller_tiers WHERE min_monthly_sales <= ? ORDER BY min_monthly_sales DESC LIMIT 1
 */
function getTierForSales(monthlySales: number): SellerTier {
  const sorted = [...SELLER_TIERS].sort((a, b) => b.min_monthly_sales - a.min_monthly_sales);
  return sorted.find(t => monthlySales >= t.min_monthly_sales) ?? SELLER_TIERS[0];
}

function getNextTier(monthlySales: number): SellerTier | null {
  const sorted = [...SELLER_TIERS].sort((a, b) => a.min_monthly_sales - b.min_monthly_sales);
  return sorted.find(t => t.min_monthly_sales > monthlySales) ?? null;
}

function calculateCommission(saleAmount: number, commissionRate: number): number {
  return Math.round(saleAmount * commissionRate / 100);
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Seller tier system', () => {

  // ── Tier structure ─────────────────────────────────────────────
  describe('Tier definitions', () => {
    it('has exactly 5 tiers', () => {
      expect(SELLER_TIERS).toHaveLength(5);
    });

    it('tiers are sorted by sort_order ascending', () => {
      for (let i = 1; i < SELLER_TIERS.length; i++) {
        expect(SELLER_TIERS[i].sort_order).toBeGreaterThan(SELLER_TIERS[i - 1].sort_order);
      }
    });

    it('commission rates decrease as tier improves', () => {
      for (let i = 1; i < SELLER_TIERS.length; i++) {
        expect(SELLER_TIERS[i].commission_rate).toBeLessThan(SELLER_TIERS[i - 1].commission_rate);
      }
    });

    it('min_monthly_sales increase as tier improves', () => {
      for (let i = 1; i < SELLER_TIERS.length; i++) {
        expect(SELLER_TIERS[i].min_monthly_sales).toBeGreaterThan(SELLER_TIERS[i - 1].min_monthly_sales);
      }
    });

    it('benefits accumulate with higher tiers', () => {
      for (let i = 1; i < SELLER_TIERS.length; i++) {
        expect(SELLER_TIERS[i].benefits.length).toBeGreaterThanOrEqual(SELLER_TIERS[i - 1].benefits.length);
      }
    });

    it('bronze is the base tier with 0 min sales', () => {
      expect(SELLER_TIERS[0].min_monthly_sales).toBe(0);
      expect(SELLER_TIERS[0].name).toBe('브론즈');
    });
  });

  // ── Commission rates per tier ──────────────────────────────────
  describe('Commission rates', () => {
    it.each([
      { tier: '브론즈', rate: 12.0 },
      { tier: '실버',   rate: 10.0 },
      { tier: '골드',   rate: 8.0 },
      { tier: '플래티넘', rate: 6.0 },
      { tier: '다이아', rate: 4.0 },
    ])('$tier has commission rate $rate%', ({ tier, rate }) => {
      const found = SELLER_TIERS.find(t => t.name === tier);
      expect(found).toBeDefined();
      expect(found!.commission_rate).toBe(rate);
    });
  });

  // ── Commission calculation ─────────────────────────────────────
  describe('Commission calculation', () => {
    it('브론즈 (12%): 100,000 sale => 12,000 commission', () => {
      expect(calculateCommission(100_000, 12.0)).toBe(12_000);
    });

    it('실버 (10%): 100,000 sale => 10,000 commission', () => {
      expect(calculateCommission(100_000, 10.0)).toBe(10_000);
    });

    it('골드 (8%): 100,000 sale => 8,000 commission', () => {
      expect(calculateCommission(100_000, 8.0)).toBe(8_000);
    });

    it('플래티넘 (6%): 100,000 sale => 6,000 commission', () => {
      expect(calculateCommission(100_000, 6.0)).toBe(6_000);
    });

    it('다이아 (4%): 100,000 sale => 4,000 commission', () => {
      expect(calculateCommission(100_000, 4.0)).toBe(4_000);
    });

    it('seller receives sale minus commission', () => {
      const sale = 500_000;
      for (const tier of SELLER_TIERS) {
        const commission = calculateCommission(sale, tier.commission_rate);
        const sellerRevenue = sale - commission;
        expect(sellerRevenue + commission).toBe(sale);
        expect(sellerRevenue).toBeGreaterThan(0);
      }
    });

    it('handles zero sale amount', () => {
      expect(calculateCommission(0, 12.0)).toBe(0);
    });

    it('rounds correctly for odd amounts', () => {
      // 33,333 * 12 / 100 = 3999.96 => rounds to 4000
      expect(calculateCommission(33_333, 12.0)).toBe(4_000);
      // 33,333 * 10 / 100 = 3333.3 => rounds to 3333
      expect(calculateCommission(33_333, 10.0)).toBe(3_333);
    });
  });

  // ── Tier assignment based on monthly sales ─────────────────────
  describe('Tier assignment by monthly sales', () => {
    it('0 sales => 브론즈', () => {
      expect(getTierForSales(0).name).toBe('브론즈');
    });

    it('999,999 sales => 브론즈', () => {
      expect(getTierForSales(999_999).name).toBe('브론즈');
    });

    it('1,000,000 sales => 실버 (boundary)', () => {
      expect(getTierForSales(1_000_000).name).toBe('실버');
    });

    it('4,999,999 sales => 실버', () => {
      expect(getTierForSales(4_999_999).name).toBe('실버');
    });

    it('5,000,000 sales => 골드 (boundary)', () => {
      expect(getTierForSales(5_000_000).name).toBe('골드');
    });

    it('9,999,999 sales => 골드', () => {
      expect(getTierForSales(9_999_999).name).toBe('골드');
    });

    it('10,000,000 sales => 플래티넘 (boundary)', () => {
      expect(getTierForSales(10_000_000).name).toBe('플래티넘');
    });

    it('29,999,999 sales => 플래티넘', () => {
      expect(getTierForSales(29_999_999).name).toBe('플래티넘');
    });

    it('30,000,000 sales => 다이아 (boundary)', () => {
      expect(getTierForSales(30_000_000).name).toBe('다이아');
    });

    it('100,000,000 sales => 다이아 (well above max)', () => {
      expect(getTierForSales(100_000_000).name).toBe('다이아');
    });
  });

  // ── Next tier / remaining sales ────────────────────────────────
  describe('Next tier calculation', () => {
    it('브론즈 seller needs 1,000,000 to reach 실버', () => {
      const sales = 0;
      const next = getNextTier(sales);
      expect(next).not.toBeNull();
      expect(next!.name).toBe('실버');
      expect(next!.min_monthly_sales - sales).toBe(1_000_000);
    });

    it('실버 seller at 2,000,000 needs 3,000,000 more for 골드', () => {
      const sales = 2_000_000;
      const next = getNextTier(sales);
      expect(next).not.toBeNull();
      expect(next!.name).toBe('골드');
      expect(next!.min_monthly_sales - sales).toBe(3_000_000);
    });

    it('다이아 seller has no next tier', () => {
      const next = getNextTier(30_000_000);
      expect(next).toBeNull();
    });

    it('다이아 seller with 50,000,000 still has no next tier', () => {
      const next = getNextTier(50_000_000);
      expect(next).toBeNull();
    });
  });

  // ── min_monthly_sales boundaries ───────────────────────────────
  describe('min_monthly_sales boundaries', () => {
    it.each([
      { sales: 0,           expected: '브론즈' },
      { sales: 1,           expected: '브론즈' },
      { sales: 999_999,     expected: '브론즈' },
      { sales: 1_000_000,   expected: '실버' },
      { sales: 1_000_001,   expected: '실버' },
      { sales: 5_000_000,   expected: '골드' },
      { sales: 10_000_000,  expected: '플래티넘' },
      { sales: 30_000_000,  expected: '다이아' },
    ])('$sales monthly sales => $expected', ({ sales, expected }) => {
      expect(getTierForSales(sales).name).toBe(expected);
    });
  });
});
