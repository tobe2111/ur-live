import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSessionCookie,
  parseSessionCookie,
  clearSessionCookie,
} from '@/worker/utils/session';

const SECRET = 'test-secret-key-for-unit-tests';

describe('Session cookie utilities', () => {
  // ── createSessionCookie ──────────────────────────────────────────
  describe('createSessionCookie', () => {
    it('returns a valid Set-Cookie string with the token', async () => {
      const cookie = await createSessionCookie(42, 'Alice', 'alice@example.com', null, SECRET);
      expect(cookie).toMatch(/^ur_session=[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+;/);
    });

    it('includes HttpOnly, Secure, SameSite=Lax, Path=/', async () => {
      const cookie = await createSessionCookie(1, 'Bob', 'bob@test.com', null, SECRET);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
    });

    it('includes Max-Age=2592000 (30 days)', async () => {
      const cookie = await createSessionCookie(1, 'Bob', 'bob@test.com', null, SECRET);
      expect(cookie).toContain('Max-Age=2592000');
    });

    it('embeds profileImage when provided', async () => {
      const cookie = await createSessionCookie(1, 'Carol', 'c@c.com', 'https://img.jpg', SECRET);
      const parsed = await parseSessionCookie(`ur_session=${cookie.split('=')[1].split(';')[0]}`, SECRET);
      expect(parsed?.profileImage).toBe('https://img.jpg');
    });

    it('omits profileImage when null', async () => {
      const cookie = await createSessionCookie(1, 'Dave', 'd@d.com', null, SECRET);
      const token = cookie.split('=')[1].split(';')[0];
      const parsed = await parseSessionCookie(`ur_session=${token}`, SECRET);
      expect(parsed?.profileImage).toBeUndefined();
    });
  });

  // ── parseSessionCookie ───────────────────────────────────────────
  describe('parseSessionCookie', () => {
    it('extracts user data from a valid cookie header', async () => {
      const cookie = await createSessionCookie(99, 'Eve', 'eve@example.com', null, SECRET);
      const token = cookie.split('=')[1].split(';')[0];
      const user = await parseSessionCookie(`ur_session=${token}`, SECRET);

      expect(user).not.toBeNull();
      expect(user!.userId).toBe('99');
      expect(user!.name).toBe('Eve');
      expect(user!.email).toBe('eve@example.com');
      expect(user!.role).toBe('user');
    });

    it('returns null for undefined/null cookie header', async () => {
      expect(await parseSessionCookie(undefined, SECRET)).toBeNull();
      expect(await parseSessionCookie(null, SECRET)).toBeNull();
    });

    it('returns null for empty string', async () => {
      expect(await parseSessionCookie('', SECRET)).toBeNull();
    });

    it('returns null for a cookie signed with a different secret', async () => {
      const cookie = await createSessionCookie(1, 'X', 'x@x.com', null, SECRET);
      const token = cookie.split('=')[1].split(';')[0];
      const user = await parseSessionCookie(`ur_session=${token}`, 'wrong-secret');
      expect(user).toBeNull();
    });

    it('returns null for garbage token', async () => {
      const user = await parseSessionCookie('ur_session=not.a.valid.jwt', SECRET);
      expect(user).toBeNull();
    });

    it('handles cookie header with multiple cookies', async () => {
      const cookie = await createSessionCookie(7, 'Multi', 'm@m.com', null, SECRET);
      const token = cookie.split('=')[1].split(';')[0];
      const header = `other=abc; ur_session=${token}; another=xyz`;
      const user = await parseSessionCookie(header, SECRET);
      expect(user).not.toBeNull();
      expect(user!.userId).toBe('7');
    });
  });

  // ── isDbId flag ──────────────────────────────────────────────────
  describe('isDbId preservation', () => {
    it('sets isDbId=true for session cookies', async () => {
      const cookie = await createSessionCookie(123, 'Flag', 'f@f.com', null, SECRET);
      const token = cookie.split('=')[1].split(';')[0];
      const user = await parseSessionCookie(`ur_session=${token}`, SECRET);
      expect(user!.isDbId).toBe(true);
    });
  });

  // ── clearSessionCookie ───────────────────────────────────────────
  describe('clearSessionCookie', () => {
    it('returns a cookie string with Max-Age=0', () => {
      const clear = clearSessionCookie();
      expect(clear).toContain('Max-Age=0');
    });

    it('clears the ur_session value', () => {
      const clear = clearSessionCookie();
      expect(clear).toMatch(/^ur_session=;/);
    });

    it('keeps HttpOnly and Secure flags', () => {
      const clear = clearSessionCookie();
      expect(clear).toContain('HttpOnly');
      expect(clear).toContain('Secure');
    });
  });

  // ── Expired tokens ──────────────────────────────────────────────
  describe('expired tokens', () => {
    it('returns null when the token is expired', async () => {
      // Freeze time, create token, then advance past expiration
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const cookie = await createSessionCookie(1, 'Exp', 'e@e.com', null, SECRET);
      const token = cookie.split('=')[1].split(';')[0];

      // Advance 31 days (past the 30-day max-age)
      vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 24 * 60 * 60 * 1000);

      const user = await parseSessionCookie(`ur_session=${token}`, SECRET);
      expect(user).toBeNull();

      vi.restoreAllMocks();
    });
  });
});
