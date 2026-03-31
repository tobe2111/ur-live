import { describe, it, expect } from 'vitest';

/**
 * Wishlist logic tests.
 *
 * Business rules from src/features/wishlists/api/wishlists.routes.ts.
 * Tests pure toggle/validation logic without DB.
 */

// ── In-memory wishlist for testing toggle behavior ───────────────
interface WishlistEntry {
  id: number;
  user_id: string;
  product_id: number;
}

class InMemoryWishlist {
  private items: WishlistEntry[] = [];
  private nextId = 1;

  find(userId: string, productId: number): WishlistEntry | undefined {
    return this.items.find(
      (w) => w.user_id === userId && w.product_id === productId,
    );
  }

  add(userId: string, productId: number): { action: 'added'; id: number } {
    const existing = this.find(userId, productId);
    if (existing) {
      throw new Error('UNIQUE constraint failed: wishlists.user_id, wishlists.product_id');
    }
    const id = this.nextId++;
    this.items.push({ id, user_id: userId, product_id: productId });
    return { action: 'added', id };
  }

  remove(userId: string, productId: number): boolean {
    const idx = this.items.findIndex(
      (w) => w.user_id === userId && w.product_id === productId,
    );
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  /**
   * Mirrors POST /api/wishlists/toggle:
   * if exists -> remove; else -> add.
   */
  toggle(
    userId: string,
    productId: number,
  ): { action: 'added' | 'removed'; isWishlisted: boolean; id?: number } {
    const existing = this.find(userId, productId);
    if (existing) {
      this.remove(userId, productId);
      return { action: 'removed', isWishlisted: false };
    } else {
      const { id } = this.add(userId, productId);
      return { action: 'added', isWishlisted: true, id };
    }
  }

  count(userId: string): number {
    return this.items.filter((w) => w.user_id === userId).length;
  }

  all(userId: string): WishlistEntry[] {
    return this.items.filter((w) => w.user_id === userId);
  }

  clear(userId: string): void {
    this.items = this.items.filter((w) => w.user_id !== userId);
  }
}

// ── Validation helper (mirrors routes logic) ─────────────────────
function validateProductId(productId: unknown): { valid: boolean; error?: string } {
  if (!productId) {
    return { valid: false, error: 'product_id가 필요합니다.' };
  }
  const id = Number(productId);
  if (isNaN(id) || id <= 0) {
    return { valid: false, error: '유효하지 않은 상품 ID입니다.' };
  }
  return { valid: true };
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Wishlist logic', () => {

  // ── Toggle behavior ────────────────────────────────────────────
  describe('Toggle behavior', () => {
    it('adds product if not in wishlist', () => {
      const wl = new InMemoryWishlist();
      const result = wl.toggle('user1', 101);
      expect(result.action).toBe('added');
      expect(result.isWishlisted).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('removes product if already in wishlist', () => {
      const wl = new InMemoryWishlist();
      wl.toggle('user1', 101); // add
      const result = wl.toggle('user1', 101); // remove
      expect(result.action).toBe('removed');
      expect(result.isWishlisted).toBe(false);
    });

    it('toggle twice restores original state (empty)', () => {
      const wl = new InMemoryWishlist();
      wl.toggle('user1', 101); // add
      wl.toggle('user1', 101); // remove
      expect(wl.count('user1')).toBe(0);
    });

    it('toggle three times leaves item wishlisted', () => {
      const wl = new InMemoryWishlist();
      wl.toggle('user1', 101); // add
      wl.toggle('user1', 101); // remove
      wl.toggle('user1', 101); // add again
      expect(wl.count('user1')).toBe(1);
      expect(wl.find('user1', 101)).toBeDefined();
    });

    it('toggling one product does not affect another', () => {
      const wl = new InMemoryWishlist();
      wl.toggle('user1', 101);
      wl.toggle('user1', 102);
      wl.toggle('user1', 101); // remove 101
      expect(wl.count('user1')).toBe(1);
      expect(wl.find('user1', 102)).toBeDefined();
      expect(wl.find('user1', 101)).toBeUndefined();
    });

    it('different users can wishlist same product independently', () => {
      const wl = new InMemoryWishlist();
      wl.toggle('user1', 101);
      wl.toggle('user2', 101);
      expect(wl.count('user1')).toBe(1);
      expect(wl.count('user2')).toBe(1);
      wl.toggle('user1', 101); // remove for user1
      expect(wl.count('user1')).toBe(0);
      expect(wl.count('user2')).toBe(1);
    });
  });

  // ── Duplicate prevention (UNIQUE constraint) ───────────────────
  describe('Duplicate prevention', () => {
    it('direct add throws on duplicate (UNIQUE constraint)', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      expect(() => wl.add('user1', 101)).toThrow('UNIQUE constraint');
    });

    it('same user can add different products', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      wl.add('user1', 102);
      wl.add('user1', 103);
      expect(wl.count('user1')).toBe(3);
    });

    it('different users can add the same product', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      wl.add('user2', 101);
      expect(wl.find('user1', 101)).toBeDefined();
      expect(wl.find('user2', 101)).toBeDefined();
    });

    it('after removal, can add the same product again', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      wl.remove('user1', 101);
      expect(() => wl.add('user1', 101)).not.toThrow();
      expect(wl.count('user1')).toBe(1);
    });
  });

  // ── Product ID validation ──────────────────────────────────────
  describe('Product ID validation', () => {
    it('rejects undefined product_id', () => {
      expect(validateProductId(undefined).valid).toBe(false);
    });

    it('rejects null product_id', () => {
      expect(validateProductId(null).valid).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateProductId('').valid).toBe(false);
    });

    it('rejects zero', () => {
      expect(validateProductId(0).valid).toBe(false);
    });

    it('rejects negative numbers', () => {
      expect(validateProductId(-1).valid).toBe(false);
      expect(validateProductId(-100).valid).toBe(false);
    });

    it('rejects non-numeric strings', () => {
      expect(validateProductId('abc').valid).toBe(false);
    });

    it('accepts valid numeric product_id', () => {
      expect(validateProductId(1).valid).toBe(true);
      expect(validateProductId(101).valid).toBe(true);
      expect(validateProductId(99999).valid).toBe(true);
    });

    it('accepts numeric string product_id', () => {
      expect(validateProductId('42').valid).toBe(true);
    });

    it('error message mentions product_id when missing', () => {
      const result = validateProductId(undefined);
      expect(result.error).toContain('product_id');
    });
  });

  // ── Clear wishlist ─────────────────────────────────────────────
  describe('Clear wishlist', () => {
    it('removes all items for a user', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      wl.add('user1', 102);
      wl.add('user1', 103);
      wl.clear('user1');
      expect(wl.count('user1')).toBe(0);
    });

    it('does not affect other users', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      wl.add('user2', 101);
      wl.clear('user1');
      expect(wl.count('user1')).toBe(0);
      expect(wl.count('user2')).toBe(1);
    });

    it('clear on empty wishlist is a no-op', () => {
      const wl = new InMemoryWishlist();
      expect(() => wl.clear('user1')).not.toThrow();
      expect(wl.count('user1')).toBe(0);
    });
  });

  // ── Remove non-existent ────────────────────────────────────────
  describe('Remove behavior', () => {
    it('returns false when item does not exist', () => {
      const wl = new InMemoryWishlist();
      expect(wl.remove('user1', 999)).toBe(false);
    });

    it('returns true when item is successfully removed', () => {
      const wl = new InMemoryWishlist();
      wl.add('user1', 101);
      expect(wl.remove('user1', 101)).toBe(true);
    });
  });
});
