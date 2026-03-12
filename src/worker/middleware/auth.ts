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

/**
 * User types
 */
export type UserType = 'user' | 'seller' | 'admin';

/**
 * Authenticated user context
 */
export interface AuthUser {
  id: string | number;
  email: string;
  name?: string;
  type: UserType;
  role?: string;
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
  
  return parts[1];
}

/**
 * Verify JWT token
 */
async function verifyJWT(
  token: string,
  secret: string
): Promise<any> {
  try {
    const isValid = await jwt.verify(token, secret);
    
    if (!isValid) {
      return null;
    }
    
    const decoded = jwt.decode(token);
    return decoded.payload;
  } catch (error) {
    console.error('[Auth] JWT verification failed:', error);
    return null;
  }
}

/**
 * Verify Firebase ID token
 * Note: This is a simplified version. In production, use Firebase Admin SDK
 */
async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<any> {
  try {
    // In production, verify with Firebase Admin SDK
    // For now, just decode (NOT SECURE - for development only)
    const decoded = jwt.decode(token);
    
    // Basic validation
    if (!decoded || !decoded.payload) {
      return null;
    }
    
    const payload = decoded.payload;
    
    // Check required claims
    if (!payload.sub || !(payload as any).email) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('[Auth] Firebase token verification failed:', error);
    return null;
  }
}

/**
 * Authentication middleware - requires any valid authentication
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader || null);
    
    if (!token) {
      return c.json(unauthorizedResponse('Authentication required'), 401);
    }
    
    // Try JWT first (seller/admin)
    const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-in-production';
    const jwtPayload = await verifyJWT(token, jwtSecret);
    
    if (jwtPayload) {
      const user: AuthUser = {
        id: jwtPayload.userId || jwtPayload.sub,
        email: jwtPayload.email,
        name: jwtPayload.name,
        type: jwtPayload.type || 'user',
        role: jwtPayload.role,
      };
      
      c.set('user', user);
      return next();
    }
    
    // Try Firebase token (users)
    const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;
    const firebasePayload = await verifyFirebaseToken(token, firebaseProjectId);
    
    if (firebasePayload) {
      const user: AuthUser = {
        id: firebasePayload.sub || firebasePayload.user_id,
        email: firebasePayload.email,
        name: firebasePayload.name,
        type: 'user',
      };
      
      c.set('user', user);
      return next();
    }
    
    return c.json(unauthorizedResponse('Invalid or expired token'), 401);
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
      // Run requireAuth middleware first
      const authMiddleware = requireAuth();
      await authMiddleware(c, async () => {});
      
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
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader || null);
    
    if (!token) {
      return next();
    }
    
    // Try JWT
    const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-in-production';
    const jwtPayload = await verifyJWT(token, jwtSecret);
    
    if (jwtPayload) {
      const user: AuthUser = {
        id: jwtPayload.userId || jwtPayload.sub,
        email: jwtPayload.email,
        name: jwtPayload.name,
        type: jwtPayload.type || 'user',
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
        id: firebasePayload.sub || firebasePayload.user_id,
        email: firebasePayload.email,
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
  payload: Record<string, any>,
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
