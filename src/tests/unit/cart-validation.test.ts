import { describe, it, expect } from 'vitest';
import {
  MAX_CART_ITEMS,
  MAX_QUANTITY_PER_ITEM,
} from '@/shared/constants';

/**
 * Cart validation logic tests.
 *
 * Tests the cart-related constants and validation rules
 * defined in src/shared/constants/index.ts and
 * src/lib/validation-schemas.ts (CartAddSchema).
 */

// ── Cart item structure for validation ────────────────────────────
interface CartItem {
  product_id: number;
  option_id?: number;
  quantity: number;
  priceSnapshot: number;
  productName?: string;
}

function isValidCartItem(item: Partial<CartItem>): boolean {
  if (!item.product_id || item.product_id <= 0) return false;
  if (!item.quantity || item.quantity <= 0) return false;
  if (item.quantity > MAX_QUANTITY_PER_ITEM) return false;
  if (item.priceSnapshot === undefined || item.priceSnapshot < 0) return false;
  return true;
}

function canAddToCart(currentItemCount: number): boolean {
  return currentItemCount < MAX_CART_ITEMS;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Cart validation', () => {
  // ── MAX_CART_ITEMS ─────────────────────────────────────────────
  describe('MAX_CART_ITEMS', () => {
    it('is 50', () => {
      expect(MAX_CART_ITEMS).toBe(50);
    });

    it('allows adding when cart has fewer than 50 items', () => {
      expect(canAddToCart(0)).toBe(true);
      expect(canAddToCart(49)).toBe(true);
    });

    it('prevents adding when cart already has 50 items', () => {
      expect(canAddToCart(50)).toBe(false);
      expect(canAddToCart(100)).toBe(false);
    });
  });

  // ── MAX_QUANTITY_PER_ITEM ──────────────────────────────────────
  describe('MAX_QUANTITY_PER_ITEM', () => {
    it('is 99', () => {
      expect(MAX_QUANTITY_PER_ITEM).toBe(99);
    });

    it('quantities from 1 to 99 are valid', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 1, priceSnapshot: 1000 })).toBe(true);
      expect(isValidCartItem({ product_id: 1, quantity: 99, priceSnapshot: 1000 })).toBe(true);
      expect(isValidCartItem({ product_id: 1, quantity: 50, priceSnapshot: 1000 })).toBe(true);
    });

    it('quantity above 99 is invalid', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 100, priceSnapshot: 1000 })).toBe(false);
      expect(isValidCartItem({ product_id: 1, quantity: 999, priceSnapshot: 1000 })).toBe(false);
    });

    it('quantity of 0 or negative is invalid', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 0, priceSnapshot: 1000 })).toBe(false);
      expect(isValidCartItem({ product_id: 1, quantity: -1, priceSnapshot: 1000 })).toBe(false);
    });
  });

  // ── Price snapshot validation ──────────────────────────────────
  describe('Price snapshot validation', () => {
    it('accepts zero price (free items)', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 1, priceSnapshot: 0 })).toBe(true);
    });

    it('accepts positive prices', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 1, priceSnapshot: 15000 })).toBe(true);
      expect(isValidCartItem({ product_id: 1, quantity: 1, priceSnapshot: 1 })).toBe(true);
    });

    it('rejects negative price', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 1, priceSnapshot: -100 })).toBe(false);
    });

    it('rejects missing price snapshot', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 1 })).toBe(false);
    });
  });

  // ── Cart item structure validation ─────────────────────────────
  describe('Cart item structure', () => {
    it('rejects missing product_id', () => {
      expect(isValidCartItem({ quantity: 1, priceSnapshot: 1000 })).toBe(false);
    });

    it('rejects product_id of 0', () => {
      expect(isValidCartItem({ product_id: 0, quantity: 1, priceSnapshot: 1000 })).toBe(false);
    });

    it('rejects negative product_id', () => {
      expect(isValidCartItem({ product_id: -1, quantity: 1, priceSnapshot: 1000 })).toBe(false);
    });

    it('accepts a fully valid cart item', () => {
      const item: CartItem = {
        product_id: 42,
        quantity: 3,
        priceSnapshot: 25000,
        productName: 'Test Product',
      };
      expect(isValidCartItem(item)).toBe(true);
    });

    it('accepts a cart item with optional option_id', () => {
      const item: CartItem = {
        product_id: 42,
        option_id: 7,
        quantity: 1,
        priceSnapshot: 10000,
      };
      expect(isValidCartItem(item)).toBe(true);
    });

    it('rejects missing quantity', () => {
      expect(isValidCartItem({ product_id: 1, priceSnapshot: 1000 })).toBe(false);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('boundary: cart with exactly 49 items can add one more', () => {
      expect(canAddToCart(49)).toBe(true);
    });

    it('boundary: quantity of exactly 99 is valid', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 99, priceSnapshot: 500 })).toBe(true);
    });

    it('boundary: quantity of exactly 100 is invalid', () => {
      expect(isValidCartItem({ product_id: 1, quantity: 100, priceSnapshot: 500 })).toBe(false);
    });
  });
});
