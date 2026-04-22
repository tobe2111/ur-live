/**
 * Session Cookie Utilities
 *
 * Provides httpOnly session cookie management for USER, SELLER, ADMIN, AGENCY login.
 * Signs/verifies JWTs with env.JWT_SECRET (HS256 via @tsndr/cloudflare-worker-jwt).
 *
 * 🛡️ 2026-04-22 Phase 1: Seller/Admin/Agency httpOnly cookies 추가.
 *   Bearer 토큰은 그대로 유지 (backward-compat). 쿠키는 추가 보호 레이어.
 *   Phase 2 에서 클라이언트가 localStorage → 쿠키 의존으로 전환 예정.
 *
 * Created: 2026-03-09 / Extended: 2026-04-22
 */

import * as jwt from '@tsndr/cloudflare-worker-jwt';

type SessionType = 'user' | 'seller' | 'admin' | 'agency';

const COOKIE_NAMES: Record<SessionType, string> = {
  user: 'ur_session',
  seller: 'ur_seller_session',
  admin: 'ur_admin_session',
  agency: 'ur_agency_session',
};

const MAX_AGE: Record<SessionType, number> = {
  user: 30 * 24 * 60 * 60,    // 30 days
  seller: 24 * 60 * 60,       // 24h — 셀러 세션 짧게 (보안)
  admin: 8 * 60 * 60,         // 8h — 어드민 최단 (배치 81에서 단축)
  agency: 24 * 60 * 60,       // 24h
};

export interface SessionUser {
  userId: string | number;
  name: string;
  email: string;
  profileImage?: string;
  role?: string;
  type?: SessionType;
  isDbId?: boolean;  // true면 userId가 DB users.id (숫자 변환 불필요)
}

/**
 * Create a signed session JWT and return the Set-Cookie header string.
 * @param type — 'user' | 'seller' | 'admin' | 'agency'
 */
export async function createSessionCookie(
  userId: string | number,
  name: string,
  email: string,
  profileImage: string | undefined | null,
  secret: string,
  type: SessionType = 'user',
): Promise<string> {
  const cookieName = COOKIE_NAMES[type];
  const maxAge = MAX_AGE[type];
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: String(userId),
    name,
    email,
    type,
    isDbId: true,
    iat: now,
    exp: now + maxAge,
  };
  if (profileImage) {
    payload.profileImage = profileImage;
  }

  const token = await jwt.sign(payload, secret);

  // 어드민 쿠키만 SameSite=Strict (CSRF 강화). 나머지는 Lax (OAuth redirect 호환).
  const sameSite = type === 'admin' ? 'Strict' : 'Lax';
  return `${cookieName}=${token}; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}`;
}

/**
 * Parse and verify a session cookie of the given type(s).
 * Returns the decoded user info or null if invalid/missing.
 */
export async function parseSessionCookie(
  cookieHeader: string | undefined | null,
  secret: string,
  types?: SessionType[],
): Promise<SessionUser | null> {
  if (!cookieHeader) return null;

  const typesToCheck = types ?? (['user', 'seller', 'admin', 'agency'] as SessionType[]);

  for (const t of typesToCheck) {
    const cookieName = COOKIE_NAMES[t];
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (!match || !match[1]) continue;

    const token = match[1];
    try {
      const isValid = await jwt.verify(token, secret);
      if (!isValid) continue;

      const decoded = jwt.decode(token);
      const payload = decoded.payload as Record<string, unknown>;

      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp === 'number' && payload.exp < now) continue;
      if (!payload.sub) continue;

      return {
        userId: payload.sub as string,
        name: (payload.name as string) || '',
        email: (payload.email as string) || '',
        profileImage: (payload.profileImage as string) || undefined,
        type: (payload.type as SessionType) || t,
        role: t,
        isDbId: !!payload.isDbId,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Return Set-Cookie header(s) that clear session cookie(s).
 */
export function clearSessionCookie(type: SessionType = 'user'): string {
  const cookieName = COOKIE_NAMES[type];
  const sameSite = type === 'admin' ? 'Strict' : 'Lax';
  return `${cookieName}=; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=0`;
}
