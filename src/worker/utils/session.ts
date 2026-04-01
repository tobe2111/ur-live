/**
 * Session Cookie Utilities
 *
 * Provides httpOnly session cookie management for USER login.
 * Signs/verifies JWTs with env.JWT_SECRET (HS256 via @tsndr/cloudflare-worker-jwt).
 * Seller/Admin auth is NOT affected — they continue using Bearer tokens.
 *
 * Created: 2026-04-01
 */

import * as jwt from '@tsndr/cloudflare-worker-jwt';

const COOKIE_NAME = 'ur_session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionUser {
  userId: string | number;
  name: string;
  email: string;
  profileImage?: string;
  role?: string;
}

/**
 * Create a signed session JWT and return the Set-Cookie header string.
 */
export async function createSessionCookie(
  userId: string | number,
  name: string,
  email: string,
  profileImage: string | undefined | null,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: String(userId),
    name,
    email,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  };
  if (profileImage) {
    payload.profileImage = profileImage;
  }

  const token = await jwt.sign(payload, secret);

  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

/**
 * Parse and verify the session cookie from a Cookie header string.
 * Returns the decoded user info or null if invalid/missing.
 */
export async function parseSessionCookie(
  cookieHeader: string | undefined | null,
  secret: string,
): Promise<SessionUser | null> {
  if (!cookieHeader) return null;

  // Extract the ur_session value from the cookie header
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match || !match[1]) return null;

  const token = match[1];

  try {
    const isValid = await jwt.verify(token, secret);
    if (!isValid) return null;

    const decoded = jwt.decode(token);
    const payload = decoded.payload as Record<string, unknown>;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) return null;

    if (!payload.sub) return null;

    return {
      userId: payload.sub as string,
      name: (payload.name as string) || '',
      email: (payload.email as string) || '',
      profileImage: (payload.profileImage as string) || undefined,
      role: 'user',
    };
  } catch {
    return null;
  }
}

/**
 * Return a Set-Cookie header string that clears the session cookie.
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
