import { describe, it, expect } from 'vitest';
import { ReviewSchema, validateOrError } from '@/lib/validation-schemas';

/**
 * Review validation logic tests.
 *
 * Tests the ReviewSchema from src/lib/validation-schemas.ts and
 * mirrors the validation rules in src/features/reviews/api/reviews.routes.ts:
 * - rating: integer, 1-5 (CHECK constraint in DB + route validation)
 * - content: min 10 chars, max 1000 chars (Zod schema)
 * - Duplicate review prevention logic (one review per user per product)
 */

// ── Rating validation ────────────────────────────────────────────
describe('Review rating validation', () => {
  it('accepts ratings 1 through 5', () => {
    for (let rating = 1; rating <= 5; rating++) {
      const result = ReviewSchema.safeParse({ rating, content: 'This is a valid review content.' });
      expect(result.success).toBe(true);
    }
  });

  it('rejects rating of 0', () => {
    const result = ReviewSchema.safeParse({ rating: 0, content: 'Valid content here.' });
    expect(result.success).toBe(false);
  });

  it('rejects rating of 6', () => {
    const result = ReviewSchema.safeParse({ rating: 6, content: 'Valid content here.' });
    expect(result.success).toBe(false);
  });

  it('rejects negative ratings', () => {
    const result = ReviewSchema.safeParse({ rating: -1, content: 'Valid content here.' });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer ratings', () => {
    const result = ReviewSchema.safeParse({ rating: 3.5, content: 'Valid content here.' });
    expect(result.success).toBe(false);
  });

  it('rejects missing rating', () => {
    const result = ReviewSchema.safeParse({ content: 'Valid content here.' });
    expect(result.success).toBe(false);
  });
});

// ── Content length validation ────────────────────────────────────
describe('Review content validation', () => {
  it('accepts content with exactly 10 characters', () => {
    const result = ReviewSchema.safeParse({ rating: 5, content: 'a'.repeat(10) });
    expect(result.success).toBe(true);
  });

  it('accepts content with exactly 1000 characters', () => {
    const result = ReviewSchema.safeParse({ rating: 5, content: 'a'.repeat(1000) });
    expect(result.success).toBe(true);
  });

  it('rejects content shorter than 10 characters', () => {
    const result = ReviewSchema.safeParse({ rating: 5, content: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects content with 9 characters', () => {
    const result = ReviewSchema.safeParse({ rating: 5, content: 'a'.repeat(9) });
    expect(result.success).toBe(false);
  });

  it('rejects content longer than 1000 characters', () => {
    const result = ReviewSchema.safeParse({ rating: 5, content: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });

  it('rejects missing content', () => {
    const result = ReviewSchema.safeParse({ rating: 5 });
    expect(result.success).toBe(false);
  });

  it('rejects empty string content', () => {
    const result = ReviewSchema.safeParse({ rating: 5, content: '' });
    expect(result.success).toBe(false);
  });
});

// ── validateOrError helper ───────────────────────────────────────
describe('validateOrError with ReviewSchema', () => {
  it('returns success for valid review', () => {
    const result = validateOrError(ReviewSchema, { rating: 4, content: 'Great product, highly recommend!' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rating).toBe(4);
      expect(result.data.content).toBe('Great product, highly recommend!');
    }
  });

  it('returns error string for invalid review', () => {
    const result = validateOrError(ReviewSchema, { rating: 0, content: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTypeOf('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns error for completely empty object', () => {
    const result = validateOrError(ReviewSchema, {});
    expect(result.success).toBe(false);
  });
});

// ── Duplicate review prevention (business logic mirror) ──────────
describe('Duplicate review prevention logic', () => {
  /**
   * Mirrors the duplicate check in reviews.routes.ts:
   * SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?
   * If existing review found -> 409 Conflict
   */
  interface ExistingReview {
    product_id: number;
    user_id: string;
  }

  function hasDuplicateReview(
    existingReviews: ExistingReview[],
    productId: number,
    userId: string
  ): boolean {
    return existingReviews.some(
      (r) => r.product_id === productId && r.user_id === userId
    );
  }

  const existingReviews: ExistingReview[] = [
    { product_id: 1, user_id: 'user-a' },
    { product_id: 2, user_id: 'user-a' },
    { product_id: 1, user_id: 'user-b' },
  ];

  it('detects duplicate: same user and same product', () => {
    expect(hasDuplicateReview(existingReviews, 1, 'user-a')).toBe(true);
  });

  it('allows: same user, different product', () => {
    expect(hasDuplicateReview(existingReviews, 3, 'user-a')).toBe(false);
  });

  it('allows: different user, same product', () => {
    expect(hasDuplicateReview(existingReviews, 1, 'user-c')).toBe(false);
  });

  it('allows: no existing reviews at all', () => {
    expect(hasDuplicateReview([], 1, 'user-a')).toBe(false);
  });

  it('detects duplicate for second product by same user', () => {
    expect(hasDuplicateReview(existingReviews, 2, 'user-a')).toBe(true);
  });
});

// ── Route-level validation logic (mirrored) ──────────────────────
describe('Route-level review validation (mirrored from reviews.routes.ts)', () => {
  /**
   * Mirrors: if (!body.product_id || !body.rating || body.rating < 1 || body.rating > 5)
   */
  function isReviewRequestValid(body: { product_id?: number; rating?: number }): boolean {
    if (!body.product_id || !body.rating || body.rating < 1 || body.rating > 5) {
      return false;
    }
    return true;
  }

  it('accepts valid request', () => {
    expect(isReviewRequestValid({ product_id: 1, rating: 5 })).toBe(true);
  });

  it('rejects missing product_id', () => {
    expect(isReviewRequestValid({ rating: 3 })).toBe(false);
  });

  it('rejects product_id of 0', () => {
    expect(isReviewRequestValid({ product_id: 0, rating: 3 })).toBe(false);
  });

  it('rejects missing rating', () => {
    expect(isReviewRequestValid({ product_id: 1 })).toBe(false);
  });

  it('rejects rating of 0', () => {
    expect(isReviewRequestValid({ product_id: 1, rating: 0 })).toBe(false);
  });

  it('rejects rating above 5', () => {
    expect(isReviewRequestValid({ product_id: 1, rating: 6 })).toBe(false);
  });

  it('rejects rating below 1', () => {
    expect(isReviewRequestValid({ product_id: 1, rating: 0 })).toBe(false);
  });
});
