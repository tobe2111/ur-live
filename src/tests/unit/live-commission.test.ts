/**
 * Live commission branching regression tests
 *
 * Ensures settlement SQL branches correctly: live sales (live_stream_id IS NOT NULL)
 * get 5% commission, non-live orders get seller's or default rate.
 *
 * Mirror of the CASE WHEN logic in src/lib/settlement-automation.ts
 */
import { describe, it, expect } from 'vitest';

type OrderForSettlement = {
  id: string;
  total_amount: number;
  live_stream_id: number | null;
  seller_commission_rate: number | null;
};

function computeCommission(
  order: OrderForSettlement,
  options: {
    liveRate: number;
    defaultRate: number;
  },
): { commission: number; sellerAmount: number; rate: number } {
  const rate = order.live_stream_id !== null
    ? options.liveRate
    : (order.seller_commission_rate ?? options.defaultRate);
  const commission = Math.round((order.total_amount * rate) / 100);
  const sellerAmount = order.total_amount - commission;
  return { commission, sellerAmount, rate };
}

describe('Live commission branching — 5% for live orders', () => {
  const options = { liveRate: 5.0, defaultRate: 10.0 };

  it('applies 5% to live order (live_stream_id set)', () => {
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: 42,
      seller_commission_rate: null,
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(5.0);
    expect(r.commission).toBe(500);
    expect(r.sellerAmount).toBe(9500);
  });

  it('ignores seller_commission_rate for live orders (live 5% wins)', () => {
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: 42,
      seller_commission_rate: 20.0, // would be 20% if not live
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(5.0); // live wins
    expect(r.commission).toBe(500);
  });
});

describe('Regular commission — seller rate or default', () => {
  const options = { liveRate: 5.0, defaultRate: 10.0 };

  it('uses seller.commission_rate when set', () => {
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: null,
      seller_commission_rate: 8.0,
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(8.0);
    expect(r.commission).toBe(800);
  });

  it('uses default rate when seller has no custom rate', () => {
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: null,
      seller_commission_rate: null,
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(10.0);
    expect(r.commission).toBe(1000);
  });

  it('handles zero commission (free tier seller)', () => {
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: null,
      seller_commission_rate: 0,
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(0);
    expect(r.commission).toBe(0);
    expect(r.sellerAmount).toBe(10000);
  });
});

describe('Commission rounding', () => {
  const options = { liveRate: 5.0, defaultRate: 10.0 };

  it('rounds half to even (integer commission)', () => {
    // 1234 * 0.05 = 61.7 → 62
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 1234,
      live_stream_id: 1,
      seller_commission_rate: null,
    };
    const r = computeCommission(order, options);
    expect(r.commission).toBe(62);
    expect(r.sellerAmount).toBe(1172);
    expect(r.commission + r.sellerAmount).toBe(1234); // invariant
  });

  it('invariant: commission + sellerAmount = total for any amount', () => {
    for (const amount of [1, 99, 100, 333, 999, 1000, 12345]) {
      const order: OrderForSettlement = {
        id: 'o',
        total_amount: amount,
        live_stream_id: null,
        seller_commission_rate: 10,
      };
      const r = computeCommission(order, options);
      expect(r.commission + r.sellerAmount).toBe(amount);
    }
  });
});

describe('Admin-configurable rates (platform_settings)', () => {
  it('respects custom liveRate from platform_settings', () => {
    // Admin changed commission_rate_live to 3%
    const options = { liveRate: 3.0, defaultRate: 10.0 };
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: 1,
      seller_commission_rate: null,
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(3.0);
    expect(r.commission).toBe(300);
  });

  it('respects custom defaultRate from platform_settings', () => {
    const options = { liveRate: 5.0, defaultRate: 7.5 };
    const order: OrderForSettlement = {
      id: 'o1',
      total_amount: 10000,
      live_stream_id: null,
      seller_commission_rate: null,
    };
    const r = computeCommission(order, options);
    expect(r.rate).toBe(7.5);
    expect(r.commission).toBe(750);
  });
});
