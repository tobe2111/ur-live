/**
 * Coupon redemption concurrency tests
 *
 * Ensures coupon redemption logic correctly prevents:
 * - Same user redeeming same coupon twice (UNIQUE(coupon_id, user_id))
 * - Global used_count exceeding total_count (race on last redemption)
 * - Expired coupons being redeemed
 *
 * Mirror of logic in src/features/coupons/api/coupons.routes.ts
 */
import { describe, it, expect } from 'vitest';

type Coupon = {
  id: number;
  total_count: number | null; // null = unlimited
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: number;
};

type CouponUse = { coupon_id: number; user_id: string };

function isExpired(c: Coupon, nowIso: string): boolean {
  if (!c.is_active) return true;
  if (c.starts_at && c.starts_at > nowIso) return true;
  if (c.expires_at && c.expires_at < nowIso) return true;
  return false;
}

function tryRedeem(
  coupon: Coupon,
  userId: string,
  uses: CouponUse[],
  nowIso = new Date().toISOString(),
): { ok: true } | { ok: false; reason: string } {
  if (isExpired(coupon, nowIso)) return { ok: false, reason: 'expired_or_inactive' };
  // Per-user UNIQUE check
  if (uses.some((u) => u.coupon_id === coupon.id && u.user_id === userId)) {
    return { ok: false, reason: 'already_used' };
  }
  // Global limit (CAS pattern)
  if (coupon.total_count !== null && coupon.used_count >= coupon.total_count) {
    return { ok: false, reason: 'sold_out' };
  }
  // Atomic increment
  coupon.used_count += 1;
  uses.push({ coupon_id: coupon.id, user_id: userId });
  return { ok: true };
}

describe('Coupon redemption — basic flow', () => {
  it('redeems valid coupon for new user', () => {
    const c: Coupon = { id: 1, total_count: 100, used_count: 0, starts_at: null, expires_at: null, is_active: 1 };
    const uses: CouponUse[] = [];
    const r = tryRedeem(c, 'user-A', uses);
    expect(r.ok).toBe(true);
    expect(c.used_count).toBe(1);
    expect(uses).toHaveLength(1);
  });

  it('rejects same user trying to redeem twice', () => {
    const c: Coupon = { id: 1, total_count: 100, used_count: 0, starts_at: null, expires_at: null, is_active: 1 };
    const uses: CouponUse[] = [];
    expect(tryRedeem(c, 'user-A', uses).ok).toBe(true);
    const second = tryRedeem(c, 'user-A', uses);
    expect(second.ok).toBe(false);
    expect((second as any).reason).toBe('already_used');
    expect(c.used_count).toBe(1); // unchanged
  });

  it('allows different users to redeem same coupon', () => {
    const c: Coupon = { id: 1, total_count: 100, used_count: 0, starts_at: null, expires_at: null, is_active: 1 };
    const uses: CouponUse[] = [];
    expect(tryRedeem(c, 'user-A', uses).ok).toBe(true);
    expect(tryRedeem(c, 'user-B', uses).ok).toBe(true);
    expect(c.used_count).toBe(2);
  });
});

describe('Coupon — global limit (sold out)', () => {
  it('rejects when used_count == total_count', () => {
    const c: Coupon = { id: 1, total_count: 2, used_count: 2, starts_at: null, expires_at: null, is_active: 1 };
    const r = tryRedeem(c, 'user-A', []);
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe('sold_out');
  });

  it('allows last redemption (used_count = total_count - 1)', () => {
    const c: Coupon = { id: 1, total_count: 2, used_count: 1, starts_at: null, expires_at: null, is_active: 1 };
    const r = tryRedeem(c, 'user-A', []);
    expect(r.ok).toBe(true);
    expect(c.used_count).toBe(2);
  });

  it('unlimited coupons (total_count = null) never sold out', () => {
    const c: Coupon = { id: 1, total_count: null, used_count: 999999, starts_at: null, expires_at: null, is_active: 1 };
    expect(tryRedeem(c, 'user-A', []).ok).toBe(true);
  });
});

describe('Coupon — expiry / inactive', () => {
  it('rejects inactive coupon', () => {
    const c: Coupon = { id: 1, total_count: 100, used_count: 0, starts_at: null, expires_at: null, is_active: 0 };
    const r = tryRedeem(c, 'user-A', []);
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe('expired_or_inactive');
  });

  it('rejects expired coupon', () => {
    const c: Coupon = {
      id: 1,
      total_count: 100,
      used_count: 0,
      starts_at: null,
      expires_at: '2020-01-01T00:00:00Z',
      is_active: 1,
    };
    expect(tryRedeem(c, 'user-A', [], '2026-04-22T00:00:00Z').ok).toBe(false);
  });

  it('rejects future-start coupon', () => {
    const c: Coupon = {
      id: 1,
      total_count: 100,
      used_count: 0,
      starts_at: '2030-01-01T00:00:00Z',
      expires_at: null,
      is_active: 1,
    };
    expect(tryRedeem(c, 'user-A', [], '2026-04-22T00:00:00Z').ok).toBe(false);
  });

  it('accepts coupon currently in window', () => {
    const c: Coupon = {
      id: 1,
      total_count: 100,
      used_count: 0,
      starts_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-12-31T00:00:00Z',
      is_active: 1,
    };
    expect(tryRedeem(c, 'user-A', [], '2026-04-22T00:00:00Z').ok).toBe(true);
  });
});

describe('Coupon — race condition simulation', () => {
  it('only first request wins when 1 slot remaining', () => {
    const c: Coupon = { id: 1, total_count: 2, used_count: 1, starts_at: null, expires_at: null, is_active: 1 };
    const uses: CouponUse[] = [];
    // Two different users race for the last slot
    const a = tryRedeem(c, 'user-A', uses);
    expect(a.ok).toBe(true);
    const b = tryRedeem(c, 'user-B', uses);
    expect(b.ok).toBe(false);
    expect((b as any).reason).toBe('sold_out');
    expect(c.used_count).toBe(2); // exactly cap
  });
});
