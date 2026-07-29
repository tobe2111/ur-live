/**
 * Auth Token Routes
 * 
 * Purpose: Backend endpoints for ID token management
 * Feature: Phase 2.3 - Backend ID Token
 * 
 * Endpoints:
 *   POST /api/auth/id-token - Get Firebase ID token via backend
 */

import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import type { Env } from '@/worker/types/env';
import { rateLimit } from '@/worker/middleware/rate-limit';

const authTokenRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/id-token
 * 
 * Purpose: Get Firebase ID token via backend (more secure than client-side)
 * 
 * Flow:
 *   1. Client sends Firebase UID + optional refresh token
 *   2. Backend verifies user exists in DB
 *   3. Backend returns fresh ID token
 * 
 * Benefits:
 *   - Centralized token management
 *   - Better security (no client-side Firebase calls)
 *   - Easier monitoring/logging
 *   - Works in SSR environments
 * 
 * Request Body:
 *   {
 *     "uid": "kakao_4735311250",
 *     "forceRefresh": false
 *   }
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "token": "eyJhbGci...",
 *       "expiresAt": 1742501234567
 *     }
 *   }
 */
authTokenRoutes.post('/id-token', rateLimit({ action: 'auth_id_token', max: 20, windowSec: 60 }), async (c) => {
  try {
    // Parse request body
    const body = await c.req.json().catch(() => ({}));
    const { uid, forceRefresh = false } = body;

    if (!uid || typeof uid !== 'string') {
      return c.json({
        success: false,
        error: 'Missing or invalid uid',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    // 🛡️ 2026-04-27 (CRITICAL SECURITY FIX): 호출자 본인 확인 필수.
    // 이전에는 검증 없이 uid 만 받아 임의 사용자의 backend JWT 발급 가능 (full account takeover).
    // 두 가지 인증 방식 중 하나라도 통과해야 함:
    //   A) ur_session 쿠키 (카카오 세션 로그인) — userId 가 요청 uid 와 일치
    //   B) Firebase ID token (Authorization: Bearer ...) — verify 후 sub 가 요청 uid 와 일치
    let authVerifiedUid: string | null = null;

    // Method A: session cookie
    try {
      const { parseSessionCookie } = await import('../utils/session');
      const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']);
      if (sessionUser?.userId) {
        if (String(sessionUser.userId) === String(uid)) {
          authVerifiedUid = String(sessionUser.userId);
        }
      }
    } catch { /* fall through to method B */ }

    // 🔒 2026-07-28: Method B(Firebase ID token) 제거.
    //   Firebase 서비스계정 개인키가 archive/ 문서에 3개월간 public 노출됐고(#798), 그 키로
    //   [커스텀 토큰 발급 → Firebase 공개 API 로 ID 토큰 교환] 하면 **임의 uid 의 소유권을 증명**해
    //   이 엔드포인트에서 그 uid 의 토큰을 받아낼 수 있었다. 키 폐기와 별개로 경로를 닫는다.
    //   KR 은 카카오 세션(Method A) 전용이고 GLOBAL 은 미런칭·폐기(#804)라 실사용 경로 없음.
    //   롤백: 이 커밋 revert.

    if (!authVerifiedUid) {
      return c.json({
        success: false,
        error: '인증되지 않았습니다 — 세션 쿠키가 필요합니다',
        code: 'AUTH_REQUIRED'
      }, 401);
    }

    // Get database
    const db = c.env.DB;
    if (!db) {
      return c.json({
        success: false,
        error: 'Database not available',
        code: 'INTERNAL_ERROR'
      }, 500);
    }

    // Verify user exists in database
    // Session cookie users pass a numeric DB ID; Firebase users pass a string UID
    const numericUid = parseInt(uid, 10);
    const userQuery = Number.isFinite(numericUid)
      ? await db
          .prepare('SELECT id, email, name, user_type FROM users WHERE id = ? OR firebase_uid = ? LIMIT 1')
          .bind(numericUid, uid)
          .first<{
            id: number;
            email: string;
            name: string | null;
            user_type: string;
          }>()
      : await db
          .prepare('SELECT id, email, name, user_type FROM users WHERE firebase_uid = ? LIMIT 1')
          .bind(uid)
          .first<{
            id: number;
            email: string;
            name: string | null;
            user_type: string;
          }>();

    if (!userQuery) {
      return c.json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, 404);
    }

    // Generate custom JWT token with user info
    // Note: This is a backend-signed JWT, not a Firebase ID token
    // It contains user claims and is verified by our middleware
    const tokenPayload = {
      uid: uid,
      userId: userQuery.id,
      email: userQuery.email,
      name: userQuery.name || userQuery.email.split('@')[0],
      userType: userQuery.user_type,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    };

    const token = await sign(tokenPayload, c.env.JWT_SECRET);

    // Token expires in 55 minutes (5-minute buffer like client cache)
    const expiresAt = Date.now() + (55 * 60 * 1000);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AuthToken] Generated token for user ${userQuery.id}`);
    }

    return c.json({
      success: true,
      data: {
        token,
        expiresAt,
        user: {
          id: userQuery.id,
          email: userQuery.email,
          name: userQuery.name,
          userType: userQuery.user_type,
        }
      }
    }, 200);

  } catch (err) {
    console.error('[AuthToken] Error generating token:', err);
    // 🛡️ 2026-05-31: raw error 반환 금지(내부구조 누출). generic 메시지만.
    return c.json({
      success: false,
      error: '토큰 생성 중 오류가 발생했습니다',
      code: 'INTERNAL_ERROR'
    }, 500);
  }
});

/**
 * GET /api/auth/token-info
 * 
 * Purpose: Get information about current token (for debugging)
 * 
 * Requires: Authorization header with Bearer token
 * 
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "valid": true,
 *       "userId": 3,
 *       "email": "user@example.com",
 *       "expiresIn": 2847  // seconds
 *     }
 *   }
 */
authTokenRoutes.get('/token-info', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Missing or invalid Authorization header',
        code: 'UNAUTHORIZED'
      }, 401);
    }

    const token = authorization.substring(7);

    // Verify token
    const { verify } = await import('hono/jwt');
    const decoded = await verify(token, c.env.JWT_SECRET, 'HS256').catch(() => null);

    if (!decoded) {
      return c.json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      }, 401);
    }

    const exp = decoded.exp as number;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = exp - now;

    return c.json({
      success: true,
      data: {
        valid: expiresIn > 0,
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
        userType: decoded.userType,
        expiresIn,
        expiresAt: exp * 1000,
      }
    }, 200);

  } catch (err) {
    console.error('[AuthToken] Error verifying token:', err);
    return c.json({
      success: false,
      error: 'Failed to verify token',
      code: 'INTERNAL_ERROR'
    }, 500);
  }
});

export { authTokenRoutes };
