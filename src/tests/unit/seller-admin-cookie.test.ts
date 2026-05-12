/**
 * Seller/Admin/Agency httpOnly cookie regression tests
 *
 * Verifies the Phase 1 cookie implementation in src/worker/utils/session.ts:
 * - createSessionCookie produces correct Set-Cookie header per type
 * - parseSessionCookie correctly parses and rejects expired/forged tokens
 * - Cookie name and SameSite policy is correct per type
 * - clearSessionCookie produces correct Max-Age=0 header
 */
import { describe, it, expect } from 'vitest';
import { createSessionCookie, parseSessionCookie, clearSessionCookie } from '@/worker/utils/session';

const SECRET = 'test-jwt-secret-for-session-cookie-tests';

describe('createSessionCookie — header format per type', () => {
  it('user cookie uses ur_session, SameSite=Lax, 30d Max-Age', async () => {
    const c = await createSessionCookie(123, 'Alice', 'a@x.com', null, SECRET, 'user');
    expect(c).toMatch(/^ur_session=/);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Max-Age=2592000'); // 30d
  });

  it('seller cookie uses ur_seller_session, 24h Max-Age, SameSite=Strict', async () => {
    const c = await createSessionCookie(1, 'Seller', 's@x.com', null, SECRET, 'seller');
    expect(c).toMatch(/^ur_seller_session=/);
    expect(c).toContain('Max-Age=86400'); // 24h
    expect(c).toContain('SameSite=Strict'); // 10차 배치: CSRF 강화
  });

  it('admin cookie uses ur_admin_session, 8h Max-Age, SameSite=Strict (CSRF 강화)', async () => {
    const c = await createSessionCookie(1, 'Admin', 'admin@x.com', null, SECRET, 'admin');
    expect(c).toMatch(/^ur_admin_session=/);
    expect(c).toContain('Max-Age=28800'); // 8h
    expect(c).toContain('SameSite=Strict');
  });

  it('agency cookie uses ur_agency_session, 24h, SameSite=Strict', async () => {
    const c = await createSessionCookie(1, 'Agency', 'agency@x.com', null, SECRET, 'agency');
    expect(c).toMatch(/^ur_agency_session=/);
    expect(c).toContain('Max-Age=86400');
    expect(c).toContain('SameSite=Strict'); // 10차 배치: CSRF 강화
  });
});

describe('parseSessionCookie — round-trip', () => {
  it('parses freshly-created seller cookie correctly', async () => {
    const setHeader = await createSessionCookie(99, 'Seller', 's@x.com', null, SECRET, 'seller');
    // Extract value from Set-Cookie format
    const tokenMatch = setHeader.match(/ur_seller_session=([^;]+)/);
    expect(tokenMatch).toBeTruthy();
    const cookieHeader = `ur_seller_session=${tokenMatch![1]}`;
    const parsed = await parseSessionCookie(cookieHeader, SECRET);
    expect(parsed).toBeTruthy();
    expect(parsed!.userId).toBe('99');
    expect(parsed!.email).toBe('s@x.com');
    expect(parsed!.type).toBe('seller');
  });

  it('parses admin cookie and exposes type=admin', async () => {
    const setHeader = await createSessionCookie(7, 'Admin', 'admin@x.com', null, SECRET, 'admin');
    const tokenMatch = setHeader.match(/ur_admin_session=([^;]+)/);
    const cookieHeader = `ur_admin_session=${tokenMatch![1]}`;
    const parsed = await parseSessionCookie(cookieHeader, SECRET);
    expect(parsed?.type).toBe('admin');
  });

  it('returns null for missing cookie header', async () => {
    expect(await parseSessionCookie(null, SECRET)).toBeNull();
    expect(await parseSessionCookie('', SECRET)).toBeNull();
  });

  it('returns null for cookie signed with wrong secret', async () => {
    const setHeader = await createSessionCookie(1, 'X', 'x@x.com', null, SECRET, 'seller');
    const tokenMatch = setHeader.match(/ur_seller_session=([^;]+)/);
    const cookieHeader = `ur_seller_session=${tokenMatch![1]}`;
    const parsed = await parseSessionCookie(cookieHeader, 'wrong-secret');
    expect(parsed).toBeNull();
  });

  it('returns null for malformed cookie value', async () => {
    expect(await parseSessionCookie('ur_seller_session=garbage.token.here', SECRET)).toBeNull();
  });

  it('selects correct session type when multiple cookies present', async () => {
    const sellerSet = await createSessionCookie(10, 'S', 's@x.com', null, SECRET, 'seller');
    const adminSet = await createSessionCookie(20, 'A', 'a@x.com', null, SECRET, 'admin');
    const sellerTok = sellerSet.match(/ur_seller_session=([^;]+)/)![1];
    const adminTok = adminSet.match(/ur_admin_session=([^;]+)/)![1];
    const combined = `ur_seller_session=${sellerTok}; ur_admin_session=${adminTok}`;
    const parsed = await parseSessionCookie(combined, SECRET);
    // Order: user → seller → admin → agency. Seller wins (user not present).
    expect(parsed?.type).toBe('seller');
    expect(parsed?.userId).toBe('10');
  });
});

describe('clearSessionCookie — logout', () => {
  it('produces Max-Age=0 for user', () => {
    const c = clearSessionCookie('user');
    expect(c).toMatch(/^ur_session=;/);
    expect(c).toContain('Max-Age=0');
  });

  it('produces Max-Age=0 for seller/admin/agency', () => {
    expect(clearSessionCookie('seller')).toContain('Max-Age=0');
    expect(clearSessionCookie('admin')).toContain('SameSite=Strict');
    expect(clearSessionCookie('admin')).toContain('Max-Age=0');
    expect(clearSessionCookie('agency')).toContain('Max-Age=0');
  });
});
