import { describe, it, expect, vi } from 'vitest';
import { resolveUserId } from '@/worker/utils/resolve-user-id';

/**
 * Tests for resolveUserId — the pure-logic paths that don't hit DB.
 *
 * The function has three code paths:
 *   1. isDbId=true  → parseInt and return (no DB)
 *   2. isDbId=false, numeric string → return as number (no DB)
 *   3. isDbId=false, non-numeric → DB lookup by firebase_uid
 *
 * Paths 1 & 2 are fully testable without a real database.
 * Path 3 is tested with a lightweight mock.
 */

function mockDb(rows: Record<string, unknown> | null = null): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as unknown as D1Database;
}

describe('resolveUserId', () => {
  // ── isDbId = true ────────────────────────────────────────────────
  describe('when isDbId is true', () => {
    it('returns the numeric value for a numeric string', async () => {
      const db = mockDb();
      expect(await resolveUserId(db, '42', true)).toBe(42);
      // DB should NOT be called
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('returns the number directly when given a number', async () => {
      const db = mockDb();
      expect(await resolveUserId(db, 7, true)).toBe(7);
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('returns null for non-numeric string with isDbId=true', async () => {
      const db = mockDb();
      expect(await resolveUserId(db, 'abc', true)).toBeNull();
    });

    it('returns null for empty string with isDbId=true', async () => {
      const db = mockDb();
      expect(await resolveUserId(db, '', true)).toBeNull();
    });
  });

  // ── isDbId = false / undefined, numeric string ───────────────────
  describe('when isDbId is false and id is numeric', () => {
    it('returns number for "123"', async () => {
      const db = mockDb();
      expect(await resolveUserId(db, '123', false)).toBe(123);
    });

    it('returns number for "0"', async () => {
      const db = mockDb();
      expect(await resolveUserId(db, '0', false)).toBe(0);
    });

    it('handles negative numeric strings via DB lookup (parseInt matches but String() check fails)', async () => {
      // "-5" → parseInt gives -5, but String(-5) === "-5" is true
      const db = mockDb();
      expect(await resolveUserId(db, '-5', false)).toBe(-5);
    });
  });

  // ── Firebase UID path (mocked DB) ───────────────────────────────
  describe('when isDbId is false and id is a firebase UID', () => {
    it('returns DB id when user is found', async () => {
      const db = mockDb({ id: 999 });
      const result = await resolveUserId(db, 'firebase-uid-abc123', false);
      expect(result).toBe(999);
      expect(db.prepare).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE firebase_uid = ? LIMIT 1'
      );
    });

    it('returns null when user is not found', async () => {
      const db = mockDb(null);
      const result = await resolveUserId(db, 'nonexistent-uid', false);
      expect(result).toBeNull();
    });

    it('returns null when DB throws', async () => {
      const db = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
      } as unknown as D1Database;
      const result = await resolveUserId(db, 'firebase-uid-err');
      expect(result).toBeNull();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────
  describe('edge cases', () => {
    it('empty string without isDbId triggers DB lookup', async () => {
      const db = mockDb(null);
      const result = await resolveUserId(db, '', false);
      // "" → parseInt is NaN, String(NaN) !== "", so goes to DB path
      expect(result).toBeNull();
      expect(db.prepare).toHaveBeenCalled();
    });

    it('handles leading-zero strings like "007" via DB', async () => {
      // parseInt("007") = 7, String(7) = "7" !== "007" → DB path
      const db = mockDb({ id: 50 });
      const result = await resolveUserId(db, '007', false);
      expect(result).toBe(50);
    });
  });
});
