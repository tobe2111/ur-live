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
authTokenRoutes.post('/id-token', async (c) => {
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
    const userQuery = await db
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

    const token = await sign(tokenPayload, c.env.JWT_SECRET || 'dev-secret-change-in-prod');

    // Token expires in 55 minutes (5-minute buffer like client cache)
    const expiresAt = Date.now() + (55 * 60 * 1000);

    console.log(`[AuthToken] Generated token for user ${userQuery.id} (${uid})`);

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
    const message = err instanceof Error ? err.message : 'Failed to generate token';
    
    return c.json({
      success: false,
      error: message,
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
    const decoded = await verify(token, c.env.JWT_SECRET || 'dev-secret-change-in-prod').catch(() => null);

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
