/**
 * Product, Order & Public API Routes unit tests
 * Pure function mirrors of validation logic from:
 *   - products.routes.ts
 *   - orders.routes.ts
 *   - seller-public-api.routes.ts
 *   - seller-orders.routes.ts
 */
import { describe, it, expect } from 'vitest';

// ── D1 mock ───────────────────────────────────────────────────────────────────
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

// ── Product list mirrors ──────────────────────────────────────────────────────

function calcProductPagination(pageStr: string | undefined, limitStr: string | undefined) {
  const rawPage = (parseInt(pageStr || '1') || 1);
  const page = Math.max(1, rawPage);
  const limit = Math.min(Math.max((parseInt(limitStr || '20') || 20), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildProductWhereClause(
  category: string | undefined,
  search: string | undefined,
  sellerId: number | undefined
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = ['p.is_active = 1'];
  const params: unknown[] = [];
  if (category) { conditions.push('p.category = ?'); params.push(category); }
  if (search) { conditions.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (sellerId) { conditions.push('p.seller_id = ?'); params.push(sellerId); }
  return { conditions, params };
}

function validatePriceRange(minPrice: string | undefined, maxPrice: string | undefined): string | null {
  if (minPrice !== undefined) {
    const n = Number(minPrice);
    if (!Number.isFinite(n) || n < 0) return 'minPrice 오류';
  }
  if (maxPrice !== undefined) {
    const n = Number(maxPrice);
    if (!Number.isFinite(n) || n < 0) return 'maxPrice 오류';
  }
  if (minPrice !== undefined && maxPrice !== undefined) {
    if (Number(minPrice) > Number(maxPrice)) return 'minPrice > maxPrice';
  }
  return null;
}

// ── Order mirrors ─────────────────────────────────────────────────────────────

const VALID_ORDER_STATUSES = new Set(['PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED']);

function validateOrderStatusFilter(status: string | undefined): boolean {
  if (!status) return true; // no filter = ok
  return VALID_ORDER_STATUSES.has(status);
}

function validateOrderOwnership(orderUserId: string, requestUserId: string): boolean {
  return orderUserId === requestUserId;
}

function calcOrderListPagination(pageStr: string | undefined, limitStr: string | undefined) {
  const page = Math.max(1, (parseInt(pageStr || '1') || 1));
  const limit = Math.min(50, Math.max(1, (parseInt(limitStr || '20') || 20)));
  return { page, limit, offset: (page - 1) * limit };
}

// ── Seller public API mirrors ─────────────────────────────────────────────────

function buildSellerCacheKey(identifier: string, type: 'username' | 'id'): string {
  return `cache:seller:public:${type}:${identifier}`;
}

function validateSellerId(id: string | undefined): boolean {
  if (!id) return false;
  const n = parseInt(id);
  return Number.isInteger(n) && n > 0;
}

// ── Seller Orders mirrors ─────────────────────────────────────────────────────

function validateSellerOrderFilters(body: {
  status?: string; startDate?: string; endDate?: string
}): string | null {
  if (body.status && !VALID_ORDER_STATUSES.has(body.status)) {
    return `유효하지 않은 상태: ${body.status}`;
  }
  if (body.startDate && isNaN(Date.parse(body.startDate))) return 'startDate 형식 오류';
  if (body.endDate && isNaN(Date.parse(body.endDate))) return 'endDate 형식 오류';
  return null;
}

// ── Tests: Products ───────────────────────────────────────────────────────────

describe('Products Routes', () => {
  describe('calcProductPagination', () => {
    it('defaults to page=1, limit=20', () => {
      const r = calcProductPagination(undefined, undefined);
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
      expect(r.offset).toBe(0);
    });

    it('clamps page to minimum 1', () => {
      expect(calcProductPagination('0', '10').page).toBe(1);
      expect(calcProductPagination('-1', '10').page).toBe(1);
    });

    it('clamps limit to maximum 100', () => {
      expect(calcProductPagination('1', '500').limit).toBe(100);
    });

    it('calculates correct offset', () => {
      expect(calcProductPagination('3', '20').offset).toBe(40);
      expect(calcProductPagination('2', '10').offset).toBe(10);
    });

    it('handles NaN input gracefully', () => {
      const r = calcProductPagination('abc', 'xyz');
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
    });
  });

  describe('buildProductWhereClause', () => {
    it('always includes is_active = 1', () => {
      const { conditions } = buildProductWhereClause(undefined, undefined, undefined);
      expect(conditions).toContain('p.is_active = 1');
    });

    it('adds category filter when provided', () => {
      const { conditions, params } = buildProductWhereClause('food', undefined, undefined);
      expect(conditions.some(c => c.includes('category'))).toBe(true);
      expect(params).toContain('food');
    });

    it('adds search filter with LIKE for name and description', () => {
      const { conditions, params } = buildProductWhereClause(undefined, '김치', undefined);
      expect(conditions.some(c => c.includes('LIKE'))).toBe(true);
      expect(params).toContain('%김치%');
    });

    it('adds seller_id filter when provided', () => {
      const { conditions, params } = buildProductWhereClause(undefined, undefined, 42);
      expect(conditions.some(c => c.includes('seller_id'))).toBe(true);
      expect(params).toContain(42);
    });

    it('combines multiple filters', () => {
      const { conditions } = buildProductWhereClause('food', '김치', 42);
      expect(conditions.length).toBe(4); // is_active + category + search + seller_id
    });
  });

  describe('validatePriceRange', () => {
    it('accepts undefined (no filter)', () => {
      expect(validatePriceRange(undefined, undefined)).toBeNull();
    });

    it('rejects negative prices', () => {
      expect(validatePriceRange('-100', undefined)).toBe('minPrice 오류');
      expect(validatePriceRange(undefined, '-50')).toBe('maxPrice 오류');
    });

    it('rejects when minPrice > maxPrice', () => {
      expect(validatePriceRange('1000', '500')).toBe('minPrice > maxPrice');
    });

    it('accepts valid range', () => {
      expect(validatePriceRange('1000', '50000')).toBeNull();
    });
  });
});

// ── Tests: Orders ─────────────────────────────────────────────────────────────

describe('Orders Routes', () => {
  describe('validateOrderStatusFilter', () => {
    it('accepts undefined (no filter)', () => {
      expect(validateOrderStatusFilter(undefined)).toBe(true);
    });

    it('accepts all valid order statuses', () => {
      ['PENDING', 'PAID', 'DONE', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'].forEach(s => {
        expect(validateOrderStatusFilter(s)).toBe(true);
      });
    });

    it('rejects invalid or lowercase statuses', () => {
      expect(validateOrderStatusFilter('pending')).toBe(false);
      expect(validateOrderStatusFilter('PROCESSING')).toBe(false);
      expect(validateOrderStatusFilter('unknown')).toBe(false);
    });
  });

  describe('validateOrderOwnership', () => {
    it('returns true when user IDs match', () => {
      expect(validateOrderOwnership('user-123', 'user-123')).toBe(true);
    });

    it('returns false when user IDs differ', () => {
      expect(validateOrderOwnership('user-123', 'user-456')).toBe(false);
    });
  });

  describe('calcOrderListPagination', () => {
    it('defaults to page=1, limit=20', () => {
      const r = calcOrderListPagination(undefined, undefined);
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
    });

    it('clamps limit to max 50', () => {
      expect(calcOrderListPagination('1', '200').limit).toBe(50);
    });
  });
});

// ── Tests: Seller Public API ──────────────────────────────────────────────────

describe('Seller Public API Routes', () => {
  describe('buildSellerCacheKey', () => {
    it('generates consistent cache keys', () => {
      expect(buildSellerCacheKey('seller-name', 'username')).toBe('cache:seller:public:username:seller-name');
      expect(buildSellerCacheKey('42', 'id')).toBe('cache:seller:public:id:42');
    });
  });

  describe('validateSellerId', () => {
    it('accepts positive integer IDs', () => {
      expect(validateSellerId('1')).toBe(true);
      expect(validateSellerId('42')).toBe(true);
    });

    it('rejects invalid IDs', () => {
      expect(validateSellerId(undefined)).toBe(false);
      expect(validateSellerId('0')).toBe(false);
      expect(validateSellerId('-1')).toBe(false);
      expect(validateSellerId('abc')).toBe(false);
    });
  });
});

// ── Tests: Seller Orders ──────────────────────────────────────────────────────

describe('Seller Orders Routes', () => {
  describe('validateSellerOrderFilters', () => {
    it('accepts empty filters', () => {
      expect(validateSellerOrderFilters({})).toBeNull();
    });

    it('accepts valid status filters', () => {
      expect(validateSellerOrderFilters({ status: 'PAID' })).toBeNull();
      expect(validateSellerOrderFilters({ status: 'SHIPPING' })).toBeNull();
    });

    it('rejects invalid status', () => {
      expect(validateSellerOrderFilters({ status: 'invalid' })).not.toBeNull();
    });

    it('accepts valid ISO date strings', () => {
      expect(validateSellerOrderFilters({ startDate: '2024-01-01', endDate: '2024-12-31' })).toBeNull();
    });

    it('rejects malformed date strings', () => {
      expect(validateSellerOrderFilters({ startDate: 'not-a-date' })).not.toBeNull();
    });
  });

  describe('D1 mock', () => {
    it('mockDB all returns empty results by default', async () => {
      const r = await mockDB.prepare('SELECT * FROM orders WHERE seller_id = ?').bind(1).all();
      expect(r.results).toEqual([]);
    });
  });
});
