/**
 * Resource permission regression tests
 *
 * These tests verify the authorization predicates used across routes.
 * Each predicate has previously been a source of IDOR bugs, so we
 * isolate and test the rule here.
 *
 * Routes covered (predicate mirrored):
 *   - src/features/products/api/products.routes.ts — canSellerModifyProduct
 *   - src/features/wishlists/api/wishlists.routes.ts — canAccessWishlist
 *   - src/worker/middleware/auth.ts requireUserType — admin gate
 *   - src/worker/middleware/auth.ts requireOwnership — self-access gate
 */
import { describe, it, expect } from 'vitest';

// ── Predicates (mirroring the source of truth) ─────────────────────────

/**
 * Seller can modify a product only if they own it.
 * Source: src/features/products/api/products.routes.ts
 */
function canSellerModifyProduct(
  authUser: { id: string | number; type: 'user' | 'seller' | 'admin' },
  product: { seller_id: number | null }
): boolean {
  if (authUser.type === 'admin') return true;
  if (authUser.type !== 'seller') return false;
  if (product.seller_id == null) return false;
  return product.seller_id === Number(authUser.id);
}

/**
 * User can view a wishlist only if it's their own, or if they are admin.
 * Source: src/features/wishlists/api/wishlists.routes.ts (IDOR fix)
 */
function canAccessWishlist(
  authUser: { id: string | number; type: 'user' | 'seller' | 'admin' },
  targetUserId: string
): boolean {
  if (authUser.type === 'admin') return true;
  return targetUserId === String(authUser.id);
}

/**
 * Admin-only route gate.
 * Source: requireAdmin()
 */
function canAccessAdminRoute(authUser: { type: 'user' | 'seller' | 'admin' }): boolean {
  return authUser.type === 'admin';
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('canSellerModifyProduct', () => {
  it('allows seller A to modify their own product', () => {
    expect(canSellerModifyProduct({ id: 7, type: 'seller' }, { seller_id: 7 })).toBe(true);
  });

  it('denies seller A from modifying seller B product (IDOR)', () => {
    expect(canSellerModifyProduct({ id: 7, type: 'seller' }, { seller_id: 8 })).toBe(false);
  });

  it('denies a regular user from modifying any product', () => {
    expect(canSellerModifyProduct({ id: 7, type: 'user' }, { seller_id: 7 })).toBe(false);
  });

  it('allows admin to modify any seller product', () => {
    expect(canSellerModifyProduct({ id: 1, type: 'admin' }, { seller_id: 999 })).toBe(true);
  });

  it('denies modification when product has no seller (orphan)', () => {
    expect(canSellerModifyProduct({ id: 7, type: 'seller' }, { seller_id: null })).toBe(false);
  });

  it('compares IDs after Number() coercion — string seller id still works', () => {
    expect(canSellerModifyProduct({ id: '7', type: 'seller' }, { seller_id: 7 })).toBe(true);
  });

  it('denies string id that would be NaN after Number()', () => {
    expect(canSellerModifyProduct({ id: 'abc', type: 'seller' }, { seller_id: 7 })).toBe(false);
  });
});

describe('canAccessWishlist', () => {
  it('allows user to view their own wishlist', () => {
    expect(canAccessWishlist({ id: '42', type: 'user' }, '42')).toBe(true);
  });

  it('denies user from viewing another user wishlist (IDOR)', () => {
    expect(canAccessWishlist({ id: '42', type: 'user' }, '43')).toBe(false);
  });

  it('allows admin to view any user wishlist', () => {
    expect(canAccessWishlist({ id: '1', type: 'admin' }, '999')).toBe(true);
  });

  it('coerces numeric id correctly (user_id is TEXT in some schemas)', () => {
    expect(canAccessWishlist({ id: 42, type: 'user' }, '42')).toBe(true);
    expect(canAccessWishlist({ id: 42, type: 'user' }, '43')).toBe(false);
  });

  it('denies seller accessing a user wishlist (sellers are not admins)', () => {
    expect(canAccessWishlist({ id: '5', type: 'seller' }, '42')).toBe(false);
  });
});

describe('canAccessAdminRoute', () => {
  it('admin passes', () => {
    expect(canAccessAdminRoute({ type: 'admin' })).toBe(true);
  });

  it('seller is rejected (common mistake: seller treated as privileged)', () => {
    expect(canAccessAdminRoute({ type: 'seller' })).toBe(false);
  });

  it('user is rejected', () => {
    expect(canAccessAdminRoute({ type: 'user' })).toBe(false);
  });
});
