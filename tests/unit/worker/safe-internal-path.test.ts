/**
 * Unit Tests — safe-internal-path.ts
 *
 * Coverage:
 *   - isSafeInternalPath(): type guard for safe internal paths
 *   - safeInternalPath(): safe extraction with fallback
 *   - All block conditions: external URLs, protocol-relative, backslash,
 *     control chars, forbidden auth/login prefixes
 */

import { describe, it, expect } from 'vitest';
import { isSafeInternalPath, safeInternalPath } from '@/utils/safe-internal-path';

// ── isSafeInternalPath ───────────────────────────────────────────────────────

describe('isSafeInternalPath()', () => {
  describe('valid (safe) paths → returns true', () => {
    it('allows root path', () => {
      expect(isSafeInternalPath('/')).toBe(true);
    });

    it('allows a simple product path', () => {
      expect(isSafeInternalPath('/products/123')).toBe(true);
    });

    it('allows a deep nested path', () => {
      expect(isSafeInternalPath('/seller/dashboard/orders/456')).toBe(true);
    });

    it('allows paths with hyphens and underscores', () => {
      expect(isSafeInternalPath('/my-orders_list')).toBe(true);
    });

    it('allows paths with a trailing slash', () => {
      expect(isSafeInternalPath('/browse/')).toBe(true);
    });
  });

  describe('null / empty input → returns false', () => {
    it('rejects null', () => {
      expect(isSafeInternalPath(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isSafeInternalPath(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isSafeInternalPath('')).toBe(false);
    });

    it('rejects a number', () => {
      expect(isSafeInternalPath(42)).toBe(false);
    });
  });

  describe('external URLs → returns false', () => {
    it('rejects https:// URL', () => {
      expect(isSafeInternalPath('https://evil.com')).toBe(false);
    });

    it('rejects http:// URL', () => {
      expect(isSafeInternalPath('http://evil.com/steal')).toBe(false);
    });

    it('rejects relative path without leading slash', () => {
      expect(isSafeInternalPath('products/123')).toBe(false);
    });
  });

  describe('protocol-relative URLs → returns false', () => {
    it('rejects //evil.com', () => {
      expect(isSafeInternalPath('//evil.com')).toBe(false);
    });

    it('rejects //evil.com/path', () => {
      expect(isSafeInternalPath('//evil.com/path')).toBe(false);
    });
  });

  describe('backslash paths → returns false', () => {
    it('rejects \\admin', () => {
      expect(isSafeInternalPath('\\admin')).toBe(false);
    });

    it('rejects /path\\with\\backslashes', () => {
      expect(isSafeInternalPath('/path\\with\\backslash')).toBe(false);
    });
  });

  describe('control characters → returns false', () => {
    it('rejects path with newline', () => {
      expect(isSafeInternalPath('/path\ninjection')).toBe(false);
    });

    it('rejects path with carriage return', () => {
      expect(isSafeInternalPath('/path\rinjection')).toBe(false);
    });

    it('rejects path with tab', () => {
      expect(isSafeInternalPath('/path\tinjection')).toBe(false);
    });

    it('rejects path with null byte', () => {
      expect(isSafeInternalPath('/path\0injection')).toBe(false);
    });
  });

  describe('forbidden login prefixes → returns false', () => {
    it('rejects /login exactly', () => {
      expect(isSafeInternalPath('/login')).toBe(false);
    });

    it('rejects /login?next=/home', () => {
      expect(isSafeInternalPath('/login?next=/home')).toBe(false);
    });

    it('rejects /login/extra', () => {
      expect(isSafeInternalPath('/login/extra')).toBe(false);
    });

    it('rejects /seller/login', () => {
      expect(isSafeInternalPath('/seller/login')).toBe(false);
    });

    it('rejects /admin/login', () => {
      expect(isSafeInternalPath('/admin/login')).toBe(false);
    });

    it('rejects /agency/login', () => {
      expect(isSafeInternalPath('/agency/login')).toBe(false);
    });
  });

  describe('forbidden auth/oauth prefixes → returns false', () => {
    it('rejects /auth/kakao', () => {
      expect(isSafeInternalPath('/auth/kakao')).toBe(false);
    });

    it('rejects /auth/ (trailing slash)', () => {
      expect(isSafeInternalPath('/auth/')).toBe(false);
    });

    it('rejects /auth/callback/token', () => {
      expect(isSafeInternalPath('/auth/callback/token')).toBe(false);
    });

    it('rejects /oauth/callback', () => {
      expect(isSafeInternalPath('/oauth/callback')).toBe(false);
    });

    it('rejects /oauth/', () => {
      expect(isSafeInternalPath('/oauth/')).toBe(false);
    });
  });

  describe('custom scheme URLs → returns false', () => {
    it('rejects kakaotalk:// scheme', () => {
      expect(isSafeInternalPath('kakaotalk://open')).toBe(false);
    });

    it('rejects intent:// scheme', () => {
      expect(isSafeInternalPath('intent://example')).toBe(false);
    });
  });
});

// ── safeInternalPath ─────────────────────────────────────────────────────────

describe('safeInternalPath()', () => {
  describe('returns safe path unchanged', () => {
    it('passes through /products/123', () => {
      expect(safeInternalPath('/products/123')).toBe('/products/123');
    });

    it('passes through root /', () => {
      expect(safeInternalPath('/')).toBe('/');
    });
  });

  describe('returns fallback for bad input', () => {
    it('returns "/" (default) for null', () => {
      expect(safeInternalPath(null)).toBe('/');
    });

    it('returns "/" (default) for empty string', () => {
      expect(safeInternalPath('')).toBe('/');
    });

    it('returns custom fallback for unsafe path', () => {
      expect(safeInternalPath('https://evil.com', '/home')).toBe('/home');
    });

    it('returns "/" for //evil.com', () => {
      expect(safeInternalPath('//evil.com')).toBe('/');
    });

    it('returns "/" for \\admin', () => {
      expect(safeInternalPath('\\admin')).toBe('/');
    });

    it('returns "/" for control character path', () => {
      expect(safeInternalPath('/path\ninjection')).toBe('/');
    });

    it('returns "/" for /login', () => {
      expect(safeInternalPath('/login')).toBe('/');
    });

    it('returns "/" for /oauth/callback', () => {
      expect(safeInternalPath('/oauth/callback')).toBe('/');
    });

    it('returns "/" for kakaotalk:// scheme', () => {
      expect(safeInternalPath('kakaotalk://open')).toBe('/');
    });
  });

  describe('URL decoding', () => {
    it('decodes %2F encoded slash correctly (path stays valid)', () => {
      const result = safeInternalPath('/user%2Fprofile');
      // /user/profile is safe
      expect(result).toBe('/user/profile');
    });

    it('handles invalid percent-encoding gracefully', () => {
      // decodeURIComponent('%ZZ') throws → falls back to raw then validates
      const result = safeInternalPath('/path/%ZZbad');
      // raw '/path/%ZZbad' starts with '/' and has no forbidden chars → safe
      expect(typeof result).toBe('string');
    });
  });

  describe('query / hash stripping', () => {
    it('strips query string before validation', () => {
      expect(safeInternalPath('/user/profile?error=database_error')).toBe('/user/profile');
    });

    it('strips hash before validation', () => {
      expect(safeInternalPath('/home#section')).toBe('/home');
    });

    it('blocks /login?next=/ (query stripped → /login blocked)', () => {
      expect(safeInternalPath('/login?next=/')).toBe('/');
    });
  });
});
