import { describe, it, expect } from 'vitest';
import { isFullScreenPath, BOTTOM_NAV_MAX_WIDTH } from '@/layouts/AppLayout';

/**
 * Tests for the layout system's path classification logic
 * and layout constants from src/layouts/AppLayout.tsx.
 */

const APP_MAX_WIDTH = '640px';

describe('Layout system', () => {
  // ── isFullScreenPath: true cases ─────────────────────────────────
  describe('isFullScreenPath returns true for full-screen routes', () => {
    const truePathCases = [
      '/live/abc',
      '/live/123',
      '/seller/',
      '/seller/products',
      '/seller/orders',
      '/admin/',
      '/admin/sellers',
      '/admin/orders',
      '/checkout',
      '/checkout?step=2',
      '/payment/confirm',
      '/points/purchase',
      '/login',
      '/login?redirect=/cart',
      '/register',
      '/auth/callback',
      '/embed/live',
      '/introduce',
    ];

    it.each(truePathCases)('"%s" → true', (path) => {
      expect(isFullScreenPath(path)).toBe(true);
    });
  });

  // ── isFullScreenPath: false cases ────────────────────────────────
  describe('isFullScreenPath returns false for mobile layout routes', () => {
    const falsePathCases = [
      '/',
      '/search',
      '/search?q=test',
      '/cart',
      '/products/',
      '/products/123',
      '/profile',
      '/profile/edit',
      '/orders',
      '/orders/12345',
      '/wishlist',
      '/categories',
      '/reviews',
    ];

    it.each(falsePathCases)('"%s" → false', (path) => {
      expect(isFullScreenPath(path)).toBe(false);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────
  describe('isFullScreenPath edge cases', () => {
    it('empty string returns false', () => {
      expect(isFullScreenPath('')).toBe(false);
    });

    it('/live without trailing slash returns false (prefix is /live/)', () => {
      expect(isFullScreenPath('/live')).toBe(false);
    });

    it('/admins (different route) returns false', () => {
      expect(isFullScreenPath('/admins')).toBe(false);
    });

    it('/sellers returns false (prefix is /seller/)', () => {
      expect(isFullScreenPath('/sellers')).toBe(false);
    });
  });

  // ── BOTTOM_NAV_MAX_WIDTH ─────────────────────────────────────────
  describe('BOTTOM_NAV_MAX_WIDTH', () => {
    it('equals APP_MAX_WIDTH (640px)', () => {
      expect(BOTTOM_NAV_MAX_WIDTH).toBe(APP_MAX_WIDTH);
    });

    it('is a string ending with px', () => {
      expect(BOTTOM_NAV_MAX_WIDTH).toMatch(/^\d+px$/);
    });
  });
});
