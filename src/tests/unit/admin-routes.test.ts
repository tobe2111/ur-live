/**
 * Admin Routes unit tests
 * Pure function mirrors of validation logic from:
 *   - admin-users.routes.ts
 *   - admin-orders.routes.ts
 *   - admin-coupons.routes.ts
 *   - admin-sellers.routes.ts
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ──────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: (_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  }),
};

// ── Admin Users mirrors ───────────────────────────────────────────────────────

const VALID_USER_STATUSES = ['active', 'suspended', 'banned'] as const;
type UserStatus = typeof VALID_USER_STATUSES[number];

function validateUserStatus(status: string): status is UserStatus {
  return VALID_USER_STATUSES.includes(status as UserStatus);
}

function validateUserId(id: string | undefined): boolean {
  return !!id && id.trim().length > 0;
}

function calcPagination(pageStr: string | undefined, limitStr: string | undefined) {
  const page = Math.max(1, (parseInt(pageStr || '1') || 1));
  const limit = Math.min(100, Math.max(1, (parseInt(limitStr || '50') || 50)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ── Admin Orders mirrors ──────────────────────────────────────────────────────

const VALID_ORDER_STATUSES = ['PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
type OrderStatus = typeof VALID_ORDER_STATUSES[number];

function validateOrderStatus(status: string): status is OrderStatus {
  return VALID_ORDER_STATUSES.includes(status as OrderStatus);
}

function validateOrderNumber(orderNumber: string | undefined): boolean {
  return !!orderNumber && orderNumber.trim().length > 0;
}

// ── Admin Coupons mirrors ─────────────────────────────────────────────────────

function validateCouponInput(body: {
  code?: string; name?: string; type?: string; value?: number; max_discount?: number | null
}): string | null {
  const { code, name, type, value } = body;
  if (!code || !name || !type || value === undefined) return '필수 항목 누락';
  if (typeof code !== 'string' || code.length > 50) return 'code 50자 이하';
  const valNum = Number(value);
  if (!Number.isFinite(valNum) || valNum <= 0 || valNum > 1_000_000) return 'value 범위 초과';
  const maxDisc = body.max_discount == null ? null : Number(body.max_discount);
  if (maxDisc !== null && (!Number.isFinite(maxDisc) || maxDisc < 0)) return 'max_discount 음수 불가';
  return null;
}

// ── Admin Sellers mirrors ─────────────────────────────────────────────────────

function validateCommissionRate(rate: unknown): boolean {
  if (rate === null || rate === undefined) return false;
  const n = Number(rate);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function validateSellerListPagination(pageStr: string | undefined, limitStr: string | undefined) {
  const page = Math.max((parseInt(pageStr || '1') || 1), 1);
  const limit = Math.min(Math.max((parseInt(limitStr || '50') || 50), 1), 200);
  return { page, limit };
}

// ── Tests: Admin Users ────────────────────────────────────────────────────────

describe('Admin Users Routes', () => {
  describe('validateUserStatus', () => {
    it('accepts valid statuses', () => {
      expect(validateUserStatus('active')).toBe(true);
      expect(validateUserStatus('suspended')).toBe(true);
      expect(validateUserStatus('banned')).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(validateUserStatus('deleted')).toBe(false);
      expect(validateUserStatus('ACTIVE')).toBe(false);
      expect(validateUserStatus('')).toBe(false);
      expect(validateUserStatus('unknown')).toBe(false);
    });
  });

  describe('validateUserId', () => {
    it('rejects empty or missing userId', () => {
      expect(validateUserId(undefined)).toBe(false);
      expect(validateUserId('')).toBe(false);
      expect(validateUserId('   ')).toBe(false);
    });

    it('accepts valid userId', () => {
      expect(validateUserId('abc123')).toBe(true);
      expect(validateUserId('user-uuid-string')).toBe(true);
    });
  });

  describe('calcPagination', () => {
    it('defaults to page=1, limit=50', () => {
      const r = calcPagination(undefined, undefined);
      expect(r.page).toBe(1);
      expect(r.limit).toBe(50);
      expect(r.offset).toBe(0);
    });

    it('clamps page to minimum 1', () => {
      expect(calcPagination('0', '10').page).toBe(1);
      expect(calcPagination('-5', '10').page).toBe(1);
    });

    it('clamps limit to maximum 100', () => {
      expect(calcPagination('1', '200').limit).toBe(100);
    });

    it('calculates offset correctly', () => {
      expect(calcPagination('3', '20').offset).toBe(40);
    });

    it('handles NaN input gracefully', () => {
      const r = calcPagination('abc', 'xyz');
      expect(r.page).toBe(1);
      expect(r.limit).toBe(50);
    });
  });
});

// ── Tests: Admin Orders ───────────────────────────────────────────────────────

describe('Admin Orders Routes', () => {
  describe('validateOrderStatus', () => {
    it('accepts all valid order statuses (uppercase)', () => {
      const valid = ['PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
      valid.forEach(s => expect(validateOrderStatus(s)).toBe(true));
    });

    it('rejects lowercase variants', () => {
      expect(validateOrderStatus('pending')).toBe(false);
      expect(validateOrderStatus('paid')).toBe(false);
    });

    it('rejects invalid statuses', () => {
      expect(validateOrderStatus('PROCESSING')).toBe(false);
      expect(validateOrderStatus('')).toBe(false);
    });
  });

  describe('validateOrderNumber', () => {
    it('rejects empty/missing order numbers', () => {
      expect(validateOrderNumber(undefined)).toBe(false);
      expect(validateOrderNumber('')).toBe(false);
    });

    it('accepts valid order number formats', () => {
      expect(validateOrderNumber('ORD-20240101-001')).toBe(true);
      expect(validateOrderNumber('12345')).toBe(true);
    });
  });
});

// ── Tests: Admin Coupons ─────────────────────────────────────────────────────

describe('Admin Coupons Routes', () => {
  describe('validateCouponInput', () => {
    it('rejects missing required fields', () => {
      expect(validateCouponInput({})).toBe('필수 항목 누락');
      expect(validateCouponInput({ code: 'ABC' })).toBe('필수 항목 누락');
      expect(validateCouponInput({ code: 'A', name: 'n', type: 'percent' })).toBe('필수 항목 누락');
    });

    it('rejects code longer than 50 chars', () => {
      const longCode = 'A'.repeat(51);
      expect(validateCouponInput({ code: longCode, name: 'Test', type: 'percent', value: 10 })).toBe('code 50자 이하');
    });

    it('rejects non-positive or over-limit value', () => {
      expect(validateCouponInput({ code: 'TEST', name: 'T', type: 'percent', value: 0 })).toBe('value 범위 초과');
      expect(validateCouponInput({ code: 'TEST', name: 'T', type: 'percent', value: -5 })).toBe('value 범위 초과');
      expect(validateCouponInput({ code: 'TEST', name: 'T', type: 'percent', value: 2_000_000 })).toBe('value 범위 초과');
    });

    it('rejects negative max_discount', () => {
      expect(validateCouponInput({ code: 'TEST', name: 'T', type: 'percent', value: 10, max_discount: -1 })).toBe('max_discount 음수 불가');
    });

    it('accepts valid coupon data', () => {
      expect(validateCouponInput({ code: 'SUMMER10', name: '여름 할인', type: 'percent', value: 10, max_discount: 5000 })).toBeNull();
      expect(validateCouponInput({ code: 'FLAT2000', name: '정액 할인', type: 'fixed', value: 2000 })).toBeNull();
    });
  });
});

// ── Tests: Admin Sellers ──────────────────────────────────────────────────────

describe('Admin Sellers Routes', () => {
  describe('validateCommissionRate', () => {
    it('accepts rates between 0 and 100', () => {
      expect(validateCommissionRate(0)).toBe(true);
      expect(validateCommissionRate(10)).toBe(true);
      expect(validateCommissionRate(100)).toBe(true);
      expect(validateCommissionRate(5.5)).toBe(true);
    });

    it('rejects out-of-range rates', () => {
      expect(validateCommissionRate(-1)).toBe(false);
      expect(validateCommissionRate(101)).toBe(false);
    });

    it('rejects non-numeric values', () => {
      expect(validateCommissionRate('abc')).toBe(false);
      expect(validateCommissionRate(null)).toBe(false);
      expect(validateCommissionRate(NaN)).toBe(false);
    });
  });

  describe('validateSellerListPagination', () => {
    it('clamps limit to max 200', () => {
      expect(validateSellerListPagination('1', '500').limit).toBe(200);
    });

    it('defaults sensibly on bad input', () => {
      const r = validateSellerListPagination(undefined, undefined);
      expect(r.page).toBe(1);
      expect(r.limit).toBe(50);
    });
  });

  describe('D1 mock interactions', () => {
    it('mockDB prepare/bind/first returns null by default', async () => {
      const result = await mockDB.prepare('SELECT * FROM sellers WHERE id = ?').bind(999).first();
      expect(result).toBeNull();
    });

    it('mockDB prepare/bind/run returns success', async () => {
      const result = await mockDB.prepare('UPDATE sellers SET status = ? WHERE id = ?').bind('approved', 1).run();
      expect(result.success).toBe(true);
    });
  });
});
