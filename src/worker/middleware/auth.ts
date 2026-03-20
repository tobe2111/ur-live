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
  
  return parts[1] ?? null;
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
 * Firebase 공개키 캐시 (Cloudflare Worker 인스턴스 수명 동안 유지)
 * Google의 공개키는 최대 1시간마다 갱신되므로 캐시 사용
 */
const firebasePublicKeyCache: { keys: Record<string, string>; expiresAt: number } = {
  keys: {},
  expiresAt: 0,
};

/**
 * Firebase 공개키 조회 (캐시 포함)
 */
async function getFirebasePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < firebasePublicKeyCache.expiresAt && Object.keys(firebasePublicKeyCache.keys).length > 0) {
    return firebasePublicKeyCache.keys;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit
  );

  if (!res.ok) {
    throw new Error(`Firebase public key fetch failed: ${res.status}`);
  }

  const keys = await res.json() as Record<string, string>;

  // Cache-Control 헤더에서 max-age 파싱
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1] ?? '3600', 10) * 1000 : 3600 * 1000;

  firebasePublicKeyCache.keys = keys;
  firebasePublicKeyCache.expiresAt = now + maxAge;

  return keys;
}

/**
 * Base64URL → Uint8Array 변환 (Web Crypto API용)
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

/**
 * PEM 인증서에서 공개키 추출 및 Web Crypto 키 임포트
 */
async function importCertPublicKey(pem: string): Promise<CryptoKey> {
  // PEM → DER 바이너리
  const pemBody = pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');

  const derBuffer = base64UrlToUint8Array(pemBody).buffer as ArrayBuffer;

  return crypto.subtle.importKey(
    'spki',
    derBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
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
): Promise<any> {
  try {
    console.log('[Firebase] 🔍 Starting Firebase token verification...');
    console.log('[Firebase] 🎫 Token (first 50 chars):', token.substring(0, 50) + '...');
    
    if (!projectId) {
      console.error('[Firebase] ❌ FIREBASE_PROJECT_ID is not set');
      return null;
    }
    
    console.log('[Firebase] 📋 Project ID:', projectId);

    // JWT 구조 파싱
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[Firebase] ❌ Invalid JWT structure (parts !== 3)');
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) {
      console.error('[Firebase] ❌ Missing JWT parts');
      return null;
    }

    // 헤더 파싱
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    console.log('[Firebase] 📄 Token header alg:', header.alg, 'kid:', header.kid?.substring(0, 10) + '...');
    
    if (header.alg !== 'RS256') {
      console.error('[Firebase] ❌ Firebase token must use RS256, got:', header.alg);
      return null;
    }

    const kid: string = header.kid;
    if (!kid) {
      console.error('[Firebase] ❌ Missing kid in header');
      return null;
    }

    // 공개키 조회
    console.log('[Firebase] 🔑 Fetching public keys...');
    const publicKeys = await getFirebasePublicKeys();
    const certPem = publicKeys[kid];
    if (!certPem) {
      console.error('[Firebase] ❌ Firebase public key not found for kid:', kid);
      console.error('[Firebase] Available kids:', Object.keys(publicKeys).join(', '));
      return null;
    }
    
    console.log('[Firebase] ✅ Public key found for kid:', kid.substring(0, 10) + '...');

    // 서명 검증 (Web Crypto API)
    console.log('[Firebase] 🔐 Verifying signature...');
    const publicKey = await importCertPublicKey(certPem);
    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature.buffer as ArrayBuffer,
      signedData
    );

    if (!isValid) {
      console.error('[Firebase] ❌ Signature verification FAILED');
      return null;
    }
    
    console.log('[Firebase] ✅ Signature verification SUCCESS');

    // 페이로드 파싱
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    
    console.log('[Firebase] 📦 Token payload - sub:', payload.sub, 'exp:', payload.exp, 'now:', now);

    // exp 검증
    if (!payload.exp || payload.exp < now) {
      console.error('[Firebase] ❌ Token EXPIRED (exp:', payload.exp, 'now:', now, 'diff:', now - payload.exp, 'sec)');
      return null;
    }
    
    console.log('[Firebase] ✅ Token NOT expired (remaining:', payload.exp - now, 'sec)');

    // iat 검증 (미래 발급 방지, 10분 허용)
    if (!payload.iat || payload.iat > now + 600) {
      console.error('[Firebase] ❌ Token iat is in the future');
      return null;
    }

    // iss 검증 (일반 Firebase 토큰 OR Admin SDK Custom Token)
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    const isAdminSDK = payload.iss && payload.iss.includes('firebase-adminsdk');
    
    if (!isAdminSDK && payload.iss !== expectedIss) {
      console.error('[Firebase] ❌ Token iss mismatch. Expected:', expectedIss, 'Got:', payload.iss);
      return null;
    }
    
    if (isAdminSDK) {
      console.log('[Firebase] ℹ️ Admin SDK Custom Token detected');
    }

    // aud 검증 (일반 Firebase 토큰 OR Admin SDK Custom Token)
    const expectedAud = projectId;
    const isAdminSDKAud = payload.aud && payload.aud.includes('identitytoolkit.googleapis.com');
    
    if (!isAdminSDKAud && payload.aud !== expectedAud) {
      console.error('[Firebase] ❌ Token aud mismatch. Expected:', expectedAud, 'Got:', payload.aud);
      return null;
    }

    // sub 검증 (UID)
    if (!payload.sub) {
      console.error('[Firebase] ❌ Token missing sub (user ID)');
      return null;
    }
    
    console.log('[Firebase] ✅✅✅ ALL VERIFICATIONS PASSED - User:', payload.sub);
    return payload;
  } catch (error) {
    console.error('[Firebase] ❌ Exception during verification:', error);
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
    
    console.log('[Auth] 🔐 requireAuth called, path:', c.req.path);
    console.log('[Auth] 📝 Authorization header present:', !!authHeader);
    
    if (!token) {
      console.log('[Auth] ❌ No token extracted from Authorization header');
      return c.json(unauthorizedResponse('Authentication required'), 401);
    }
    
    console.log('[Auth] 🎫 Token received (first 30 chars):', token.substring(0, 30) + '...');
    
    // Try JWT first (seller/admin)
    const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-in-production';
    console.log('[Auth] 🔑 JWT_SECRET available:', !!c.env.JWT_SECRET);
    
    const jwtPayload = await verifyJWT(token, jwtSecret);
    
    if (jwtPayload) {
      console.log('[Auth] ✅ JWT verification SUCCESS (seller/admin)');
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
    
    console.log('[Auth] ⚠️ JWT verification failed, trying Firebase...');
    
    // Try Firebase token (users)
    const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;
    console.log('[Auth] 🔥 Firebase Project ID:', firebaseProjectId);
    console.log('[Auth] 🔑 FIREBASE_PRIVATE_KEY available:', !!c.env.FIREBASE_PRIVATE_KEY);
    console.log('[Auth] 📧 FIREBASE_CLIENT_EMAIL available:', !!c.env.FIREBASE_CLIENT_EMAIL);
    
    if (!firebaseProjectId) {
      console.error('[Auth] ❌ FIREBASE_PROJECT_ID not configured — treating as 401');
      return c.json(unauthorizedResponse('Authentication service not available'), 401);
    }
    
    const firebasePayload = await verifyFirebaseToken(token, firebaseProjectId);
    
    if (firebasePayload) {
      console.log('[Auth] ✅ Firebase verification SUCCESS, user:', firebasePayload.sub);
      const user: AuthUser = {
        id: firebasePayload.sub || firebasePayload.user_id,
        email: firebasePayload.email,
        name: firebasePayload.name,
        type: 'user',
      };
      
      c.set('user', user);
      return next();
    }
    
    console.error('[Auth] ❌ Both JWT and Firebase verification FAILED');
    console.error('[Auth] 🐛 DEBUG INFO:');
    console.error('[Auth]   - Token (first 50 chars):', token.substring(0, 50));
    console.error('[Auth]   - Firebase Project ID:', firebaseProjectId);
    console.error('[Auth]   - Token format valid:', token.split('.').length === 3);
    
    // Return 401 Unauthorized (토큰 검증 실패 = 인증 실패)
    return c.json(unauthorizedResponse('Token verification failed'), 401);
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
