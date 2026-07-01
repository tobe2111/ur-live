/**
 * Authentication Middleware
 * 
 * Provides authentication and authorization middleware for API routes
 * Supports JWT (seller/admin) and Firebase (users) authentication
 * 
 * Created: 2026-03-09
 * Purpose: Backend refactoring - Centralized auth middleware
 */

import { Context, Next } from 'hono';
import * as jwt from '@tsndr/cloudflare-worker-jwt';
import { unauthorizedResponse, forbiddenResponse } from '../utils/response';
import { parseSessionCookie } from '../utils/session';
import { isDashboardSessionCurrent, deriveDashboardSeat } from '../utils/dashboard-session';

// 🔐 2026-06-17 단일 세션 강제 — 다른 기기/브라우저 로그인으로 무효화된 대시보드 세션 응답.
function sessionSupersededResponse() {
  return {
    success: false,
    error: '다른 기기 또는 브라우저에서 로그인되어 자동 로그아웃되었습니다. 다시 로그인해주세요.',
    code: 'SESSION_SUPERSEDED',
  };
}

/**
 * JWT payload type (both seller/admin JWT and Firebase token)
 */
interface JwtPayload {
  uid?: string;
  userId?: string;
  sub?: string;
  user_id?: string;
  email?: string;
  name?: string;
  type?: string;
  role?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/**
 * User types
 */
// 🛡️ 2026-04-28: 'agency' 추가 — dashboard-notifications fetch 분기에 필요.
export type UserType = 'user' | 'seller' | 'admin' | 'agency' | 'supplier';

/**
 * Authenticated user context
 */
export interface AuthUser {
  id: string | number;
  email: string;
  name?: string;
  type: UserType;
  role?: string;
  isDbId?: boolean;  // true면 id가 DB users.id (세션 쿠키)
}

/**
 * Extended context with auth user
 */
export interface AuthContext extends Context {
  get user(): AuthUser;
  set(key: 'user', value: AuthUser): void;
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1] ?? null;
}

/**
 * Verify JWT token
 */
async function verifyJWT(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    // Pin HS256 to defeat alg-confusion attacks (e.g. "none" or RS→HS swap).
    const isValid = await jwt.verify(token, secret, { algorithm: 'HS256' });

    if (!isValid) {
      return null;
    }

    const decoded = jwt.decode(token);
    return decoded.payload as unknown as JwtPayload;
  } catch {
    // Don't log token content — attacker reconnaissance risk
    return null;
  }
}

/**
 * Firebase JWK 공개키 캐시 (Cloudflare Worker 인스턴스 수명 동안 유지)
 * JWK 엔드포인트 사용: X.509 PEM 대신 Web Crypto API와 직접 호환되는 JWK 형식
 */
const firebaseJwkCache: { keys: JsonWebKey[]; expiresAt: number } = {
  keys: [],
  expiresAt: 0,
};

/**
 * Firebase JWK 공개키 조회 (캐시 포함)
 * JWK 엔드포인트는 Web Crypto importKey('jwk') 와 직접 호환됨
 */
async function getFirebaseJwkKeys(): Promise<JsonWebKey[]> {
  const now = Date.now();
  if (now < firebaseJwkCache.expiresAt && firebaseJwkCache.keys.length > 0) {
    return firebaseJwkCache.keys;
  }

  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    {
      cf: { cacheTtl: 3600, cacheEverything: true },
      // 🛡️ 2026-04-22: Firebase JWK 느리면 5초 후 중단 (auth middleware CPU 보호)
      signal: AbortSignal.timeout(5000),
    } as RequestInit
  );

  if (!res.ok) {
    throw new Error(`Firebase JWK fetch failed: ${res.status}`);
  }

  const json = await res.json() as { keys: JsonWebKey[] };

  // Cache-Control 헤더에서 max-age 파싱
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1] ?? '3600', 10) * 1000 : 3600 * 1000;

  firebaseJwkCache.keys = json.keys;
  firebaseJwkCache.expiresAt = now + maxAge;

  return json.keys;
}

/**
 * Base64URL → Uint8Array 변환 (JWT 서명 검증용)
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

/**
 * Verify Firebase ID token using Google's public keys (RS256 signature validation)
 *
 * 검증 항목:
 * 1. RS256 서명 검증 (Google 공개키)
 * 2. exp(만료시간) 확인
 * 3. iat(발급시간) 확인 (미래 발급 방지)
 * 4. iss(발급자) 확인
 * 5. aud(수신자) = Firebase Project ID 확인
 * 6. sub(사용자 UID) 존재 확인
 */
async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<JwtPayload | null> {
  try {
    if (!projectId) {
      return null;
    }

    // JWT 구조 파싱
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    // 헤더 파싱
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));

    if (header.alg !== 'RS256') {
      return null;
    }

    const kid: string = header.kid;
    if (!kid) {
      return null;
    }

    // JWK 공개키 조회
    const jwkKeys = await getFirebaseJwkKeys();
    const jwk = jwkKeys.find((k) => (k as { kid?: string }).kid === kid);
    if (!jwk) {
      return null;
    }

    // 서명 검증 (Web Crypto API - JWK 직접 임포트)
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature.buffer as ArrayBuffer,
      signedData
    );

    if (!isValid) {
      return null;
    }

    // 페이로드 파싱
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);

    // exp 검증
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    // iat 검증 (미래 발급 방지, 10분 허용)
    if (!payload.iat || payload.iat > now + 600) {
      return null;
    }

    // iss 검증 (일반 Firebase 토큰 OR Admin SDK Custom Token)
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    const isAdminSDK = payload.iss && payload.iss.includes('firebase-adminsdk');

    if (!isAdminSDK && payload.iss !== expectedIss) {
      return null;
    }

    // aud 검증 (일반 Firebase 토큰 OR Admin SDK Custom Token)
    const expectedAud = projectId;
    const isAdminSDKAud = payload.aud && payload.aud.includes('identitytoolkit.googleapis.com');

    if (!isAdminSDKAud && payload.aud !== expectedAud) {
      return null;
    }

    // sub 검증 (UID)
    if (!payload.sub) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware - requires any valid authentication
 *
 * Priority:
 * 1. httpOnly session cookie (ur_session) — user login via Kakao
 * 2. Bearer JWT (seller/admin)
 * 3. Bearer Firebase ID token (user — legacy fallback)
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json(unauthorizedResponse('Authentication service misconfigured'), 503);
    }

    // ── 1. Try Bearer token FIRST (seller/admin JWT or Firebase) ───────
    // Bearer 토큰이 있으면 우선 사용 (어드민/셀러는 Bearer 토큰 필수)
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader || null);

    if (token) {
      // Try JWT first (seller/admin)
      const jwtPayload = await verifyJWT(token, jwtSecret);

      if (jwtPayload) {
        const jwtId = jwtPayload.userId ?? jwtPayload.sub;
        if (!jwtId) {
          return c.json(unauthorizedResponse('Invalid token: missing user identifier'), 401);
        }
        const user: AuthUser = {
          id: jwtId as string,
          email: jwtPayload.email as string,
          name: jwtPayload.name,
          type: (jwtPayload.type || 'user') as UserType,
          role: jwtPayload.role,
        };

        // 🔐 단일 세션 강제 (대시보드) — 시트별 키로 더 늦은 로그인이 무효화한 토큰 거부.
        const seatB = deriveDashboardSeat(jwtPayload);
        if (seatB && !(await isDashboardSessionCurrent(
          (c.env as { DB: D1Database }).DB, seatB.role, seatB.id,
          typeof jwtPayload.iat === 'number' ? jwtPayload.iat : undefined,
        ))) {
          return c.json(sessionSupersededResponse(), 401);
        }

        c.set('user', user);
        return next();
      }

      // Try Firebase token (users)
      const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;
      if (firebaseProjectId) {
        const firebasePayload = await verifyFirebaseToken(token, firebaseProjectId);
        if (firebasePayload) {
          const firebaseId = firebasePayload.sub ?? firebasePayload.user_id;
          if (!firebaseId) {
            return c.json(unauthorizedResponse('Invalid token: missing user identifier'), 401);
          }
          const user: AuthUser = {
            id: firebaseId as string,
            email: firebasePayload.email as string,
            name: firebasePayload.name,
            type: 'user',
          };
          c.set('user', user);
          return next();
        }
      }
    }

    // ── 2. Try httpOnly session cookies (user, seller, admin, agency) ──
    // 🛡️ 2026-04-22: Phase 1 — 셀러/어드민도 쿠키 인증 추가 (Bearer 와 병행).
    // Bearer 없는 경우 쿠키로 fallback → 클라이언트 migration 전에도 보안 강화.
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret);
      if (sessionUser) {
        const sessionType = sessionUser.type || 'user';
        // 🔐 단일 세션 강제 (대시보드 세션 쿠키 — member_id 없음 → agency 는 org 시트).
        const seatC = deriveDashboardSeat({ type: sessionType, sub: sessionUser.userId });
        if (seatC && !(await isDashboardSessionCurrent(
          (c.env as { DB: D1Database }).DB, seatC.role, seatC.id, sessionUser.iat,
        ))) {
          return c.json(sessionSupersededResponse(), 401);
        }
        const user: AuthUser = {
          id: sessionUser.userId,
          email: sessionUser.email,
          name: sessionUser.name,
          type: sessionType as UserType,
          role: sessionUser.role,
          isDbId: sessionUser.isDbId,
        };
        c.set('user', user);
        return next();
      }
    }

    // ── 2.5 SSR 경유 httpOnly 토큰 쿠키 (Phase 2 — docs/SSR_PHASE2_AUTH.md §3.3) ──
    //   beta(SSR) loader 가 forward 한 ud_seller_token/ud_agency_token. 값 = 기존 JWT 그대로.
    //   ⚠️ CSRF 가드: 읽기(GET/HEAD)에만 적용 — 상태 변경은 계속 Bearer 전용.
    const method = c.req.method.toUpperCase();
    if (cookieHeader && (method === 'GET' || method === 'HEAD')) {
      const { readAuthTokenCookie } = await import('../utils/auth-cookies');
      const cookieJwt = readAuthTokenCookie(cookieHeader);
      if (cookieJwt) {
        const p = await verifyJWT(cookieJwt, jwtSecret);
        if (p) {
          const pid = p.userId ?? p.sub;
          if (pid) {
            const ptype = (p.type || 'user') as UserType;
            // 🔐 단일 세션 강제 (SSR forward 토큰 — 시트별 키).
            const seatS = deriveDashboardSeat(p);
            if (seatS && !(await isDashboardSessionCurrent(
              (c.env as { DB: D1Database }).DB, seatS.role, seatS.id,
              typeof p.iat === 'number' ? p.iat : undefined,
            ))) {
              return c.json(sessionSupersededResponse(), 401);
            }
            const user: AuthUser = {
              id: pid as string,
              email: p.email as string,
              name: p.name,
              type: ptype,
              role: p.role,
            };
            c.set('user', user);
            return next();
          }
        }
      }
    }

    // ── 3. No valid auth found ─────────────────────────────────────────
    return c.json(unauthorizedResponse('Authentication required'), 401);
  };
}

/**
 * Require specific user type
 */
export function requireUserType(...types: UserType[]) {
  return async (c: Context, next: Next) => {
    // First check if user is authenticated
    const user = c.get('user') as AuthUser | undefined;

    if (!user) {
      // Run requireAuth middleware first and capture any error response (401/503)
      const authMiddleware = requireAuth();
      const authErrorResponse = await authMiddleware(c, async () => {
        // no-op; we only care about whether user was set
      });

      // If requireAuth returned a Response (401/503), propagate it
      if (authErrorResponse) {
        return authErrorResponse;
      }

      // Check again after authentication
      const authenticatedUser = c.get('user') as AuthUser | undefined;
      if (!authenticatedUser) {
        return c.json(unauthorizedResponse('Authentication required'), 401);
      }
    }

    const currentUser = c.get('user') as AuthUser;

    if (!types.includes(currentUser.type)) {
      return c.json(
        forbiddenResponse(`Access denied. Required user type: ${types.join(' or ')}`),
        403
      );
    }

    return next();
  };
}

/**
 * Require seller authentication
 */
export function requireSeller() {
  return requireUserType('seller');
}

/**
 * Require admin authentication
 */
export function requireAdmin() {
  return requireUserType('admin');
}

/**
 * Require supplier (외부 도매상) authentication — 도매몰 INC-3.
 */
export function requireSupplier() {
  return requireUserType('supplier');
}

/**
 * Admin sub-roles (2026-05-05 P0):
 *   - 'super':   전권 (default for legacy admins)
 *   - 'ops':     운영 (settlement/refund 제외)
 *   - 'cs':      CS — 조회 + 환불 승인
 *   - 'finance': 정산/환불/수수료 변경 전권
 *
 * Migration 0242: admin_users.role 컬럼 추가됨. 'super' 가 fallback.
 * 사용:
 *   adminSettlementRoutes.post('/approve', requireAdminRole('finance'), handler)
 *   adminRefundRoutes.post('/refund', requireAdminRole('cs', 'finance'), handler)
 */
export type AdminRole = 'super' | 'ops' | 'cs' | 'finance';
export function requireAdminRole(...allowed: AdminRole[]) {
  return async (c: Context, next: Next) => {
    // 1) admin 인증 확인
    const inner = requireUserType('admin');
    let blocked = false;
    await inner(c, async () => {});
    if (c.res.status === 401 || c.res.status === 403) blocked = true;
    if (blocked) return c.res;

    const user = (c as Context & { get: (k: string) => unknown }).get('user') as { id?: string | number } | undefined;
    // 🛡️ 2026-06-25: 미인증(토큰 없음/무효) 403 에 전용 code — 클라가 '권한부족(role)' 과 구분해
    //   세션만료 재로그인 유도. (role 부족은 아래 별도 메시지·code 'FORBIDDEN' 유지.)
    if (!user?.id) return c.json(forbiddenResponse('관리자 인증이 필요합니다 (세션 만료)', 'ADMIN_AUTH_REQUIRED'), 403);

    try {
      const row = await (c.env as { DB: D1Database }).DB
        .prepare('SELECT role FROM admins WHERE id = ?')
        .bind(String(user.id))
        .first<{ role?: string }>();
      // 기존 'super_admin' 값과 신규 'super' 둘 다 전권으로 인정
      const rawRole = row?.role || 'super';
      const role = (rawRole === 'super_admin' ? 'super' : rawRole) as AdminRole;
      // super 는 모든 권한
      if (role === 'super') { await next(); return; }
      if (allowed.includes(role)) { await next(); return; }
      return c.json(forbiddenResponse(`이 작업은 ${allowed.join('/')} 권한이 필요합니다 (현재: ${role})`), 403);
    } catch (err) {
      // 🔐 2026-07-01 (보안 감사 ③): 이전엔 DB 오류 시 super 로 fail-OPEN → 일시적 D1 오류로
      //   역할 게이트가 무력화(제한역할이 전권 획득)될 수 있었음. 이제 1회 재시도 후 fail-CLOSED.
      //   (프로덕션은 admins.role 컬럼을 repair-schema/로그인이 보장하므로 정상 경로는 영향 없음.)
      try {
        const retry = await (c.env as { DB: D1Database }).DB
          .prepare('SELECT role FROM admins WHERE id = ?')
          .bind(String(user.id))
          .first<{ role?: string }>();
        const rawRole = retry?.role || 'super';
        const role = (rawRole === 'super_admin' ? 'super' : rawRole) as AdminRole;
        if (role === 'super' || allowed.includes(role)) { await next(); return; }
        return c.json(forbiddenResponse(`이 작업은 ${allowed.join('/')} 권한이 필요합니다 (현재: ${role})`), 403);
      } catch (err2) {
        try { if (typeof console !== 'undefined') console.error('[requireAdminRole] role 조회 실패(재시도 포함) — 안전차단(403):', String(err), String(err2)); } catch { /* */ }
        return c.json(forbiddenResponse('권한 확인 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'ADMIN_ROLE_CHECK_FAILED'), 403);
      }
    }
  };
}

/**
 * Require user (buyer) authentication
 */
export function requireUser() {
  return requireUserType('user');
}

/**
 * Require seller or admin
 */
export function requireSellerOrAdmin() {
  return requireUserType('seller', 'admin');
}

/**
 * Optional authentication - sets user if authenticated, continues if not
 */
export function optionalAuth() {
  return async (c: Context, next: Next) => {
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    // ── 1. Try httpOnly session cookies (user/seller/admin/agency) ──────
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret);
      if (sessionUser) {
        const sessionType = sessionUser.type || 'user';
        const user: AuthUser = {
          id: sessionUser.userId,
          email: sessionUser.email,
          name: sessionUser.name,
          type: sessionType as UserType,
          role: sessionUser.role,
          isDbId: sessionUser.isDbId,
        };
        c.set('user', user);
        return next();
      }
    }

    // ── 2. Try Bearer token ─────────────────────────────────────────────
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader || null);

    if (!token) {
      return next();
    }

    // Try JWT
    const jwtPayload = await verifyJWT(token, jwtSecret);

    if (jwtPayload) {
      const user: AuthUser = {
        id: (jwtPayload.userId || jwtPayload.sub) as string,
        email: jwtPayload.email as string,
        name: jwtPayload.name,
        type: (jwtPayload.type || 'user') as UserType,
        role: jwtPayload.role,
      };

      c.set('user', user);
      return next();
    }

    // Try Firebase
    const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;
    const firebasePayload = await verifyFirebaseToken(token, firebaseProjectId);

    if (firebasePayload) {
      const user: AuthUser = {
        id: (firebasePayload.sub || firebasePayload.user_id) as string,
        email: firebasePayload.email as string,
        name: firebasePayload.name,
        type: 'user',
      };

      c.set('user', user);
    }

    return next();
  };
}

/**
 * Get current authenticated user from context
 */
export function getCurrentUser(c: Context): AuthUser | null {
  return c.get('user') || null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(c: Context): boolean {
  return !!c.get('user');
}

/**
 * Check if user has specific type
 */
export function hasUserType(c: Context, type: UserType): boolean {
  const user = getCurrentUser(c);
  return user?.type === type;
}

/**
 * Require resource ownership (user can only access their own resources)
 */
export function requireOwnership(userIdParam: string = 'id') {
  return async (c: Context, next: Next) => {
    const user = getCurrentUser(c);
    
    if (!user) {
      return c.json(unauthorizedResponse('Authentication required'), 401);
    }
    
    const resourceUserId = c.req.param(userIdParam);
    
    // Admin can access any resource
    if (user.type === 'admin') {
      return next();
    }
    
    // Check ownership
    if (resourceUserId !== String(user.id)) {
      return c.json(
        forbiddenResponse('You can only access your own resources'),
        403
      );
    }
    
    return next();
  };
}

/**
 * Generate JWT token
 */
export async function generateJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: number = 86400 // 24 hours
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const token = await jwt.sign(
    {
      ...payload,
      iat: now,
      exp: now + expiresIn,
    },
    secret
  );
  
  return token;
}

// ─── 호환성 래퍼 ─────────────────────────────────────────────────────────────
/**
 * verifyAdminToken - requireAdmin()의 미들웨어 형태 래퍼
 * 기존 feature 파일 호환용
 */
export function verifyAdminToken() {
  return requireAdmin();
}

/**
 * verifySellerToken - requireSeller()의 미들웨어 형태 래퍼
 */
export function verifySellerToken() {
  return requireSeller();
}

/**
 * verifyAuthToken - requireAuth()의 별칭
 */
export function verifyAuthToken() {
  return requireAuth();
}
