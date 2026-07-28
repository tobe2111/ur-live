/**
 * Authentication Middleware
 * 
 * Provides authentication and authorization middleware for API routes
 * Supports JWT (seller/admin) and httpOnly session cookie (users — Kakao) authentication
 * 🔒 2026-07-28: Firebase 수용 경로 제거 — 아래 requireAuth 주석 참조
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
 * 🔒 2026-07-28: Firebase ID token 검증기 제거 (verifyFirebaseToken / JWK 캐시 / base64 헬퍼).
 *   수용 경로를 requireAuth·optionalAuth·auth-token.routes 에서 모두 닫아 호출자가 없다.
 *   함수만 남기면 다음 세션이 '있으니 쓰자' 로 되살릴 수 있어 파일에서 제거한다.
 *   배경: Firebase 서비스계정 개인키가 archive/ 문서에 3개월간 public 노출(#798) → 그 키로
 *   임의 uid 로그인이 가능했다. 복원이 필요하면 이 커밋을 revert 할 것.
 */

/**
 * Authentication middleware - requires any valid authentication
 *
 * Priority:
 * 1. httpOnly session cookie (ur_session) — user login via Kakao
 * 2. Bearer JWT (seller/admin)
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

      // 🔒 2026-07-28: Firebase ID token 수용 경로 제거 (대표 확인 "구글 로그인 쓰는 사람 없음").
      //   왜: Firebase 서비스계정 개인키가 archive/ 문서에 3개월간 public 노출됐고(#798),
      //   그 키로 [커스텀 토큰 발급 → Firebase 공개 API 로 ID 토큰 교환 → 여기로 제출] 하면
      //   **임의의 uid 로 로그인**이 됐다. 키 폐기와 별개로 이 문 자체를 닫는다
      //   (키를 다시 발급해도, 그 프로젝트 토큰이면 누구든 통과하던 구조였다).
      //   KR 은 카카오 세션 전용이고 GLOBAL 은 미런칭·폐기(#804)라 실사용 경로 없음.
      //   롤백: 이 블록을 verifyFirebaseToken 호출로 환원(함수는 아래에서 함께 제거됨).
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
      // 🛡️ 2026-07-04 (실사고 — /admin 무한 403): Bearer 가 '요구 타입'(예: admin)을 자칭하는데
      //   검증 실패(만료/무효)해서 하위 우선순위 신원(예: 소비자 세션쿠키)으로 인증된 경우 —
      //   의미상 '권한 부족(403)'이 아니라 '토큰 만료(401)'다. 403 을 주면 클라 401-refresh
      //   인터셉터가 영영 안 돌아 refresh_token 이 있어도 대시보드가 죽은 채 유지된다
      //   (만료 admin Bearer + 상시 카카오 소비자 쿠키 조합 — 대표 /recover 진단 실측 FORBIDDEN).
      //   401 이면 인터셉터가 자동 갱신·재시도 → 무개입 자가치유. 서명 검증 없는 디코드지만
      //   *거부 status 선택*에만 쓰므로 권한 부여와 무관(위조해도 401 vs 403 차이뿐).
      try {
        const authHeader = c.req.header('Authorization') || '';
        const rawBearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const seg = rawBearer.split('.')[1];
        if (seg) {
          const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
          const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
          const claimType = (JSON.parse(atob(pad)) as { type?: string }).type;
          if (claimType && types.includes(claimType as UserType) && currentUser.type !== claimType) {
            return c.json(unauthorizedResponse('토큰이 만료되었습니다. 다시 로그인해주세요'), 401);
          }
        }
      } catch { /* 디코드 실패 — 기존 403 유지 */ }
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

    // 🔒 2026-07-28: Firebase 수용 경로 제거 — requireAuth 와 동일 사유(위 주석 참조).
    //   optionalAuth 는 인증 실패해도 통과시키므로, 여기서는 그냥 익명으로 진행한다.

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
