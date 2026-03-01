/**
 * Firebase ID Token 검증 (100% Firebase 표준)
 * 
 * Cloudflare Workers 최적화:
 * - jose 라이브러리 + createRemoteJWKSet (JWKS 캐싱)
 * - exp/iat 강화 검증
 * - JWKS 캐시 무효화 로직 (kid not found 방지)
 * - 타입 가드 + 상세 에러 핸들링
 */

import { createRemoteJWKSet, jwtVerify, JWTPayload, errors } from 'jose';

// Google JWKS 엔드포인트
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// JWKS 캐시 (Worker 인스턴스 수명 동안 유지)
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * JWKS 가져오기 (캐싱)
 */
function getJWKS() {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    console.log('[Firebase Token] ✅ JWKS cache initialized');
  }
  return jwksCache;
}

/**
 * JWKS 캐시 무효화 (kid not found 등의 에러 발생 시)
 */
export function invalidateJWKSCache() {
  jwksCache = null;
  console.warn('[Firebase Token] 🔄 JWKS cache invalidated');
}

/**
 * Firebase ID Token Payload 타입
 */
export interface FirebaseTokenPayload extends JWTPayload {
  uid: string;
  role?: string;
  userId?: number;
  userName?: string;
  email?: string;
}

/**
 * Firebase ID Token 검증
 * 
 * @param token - Firebase ID Token (not Custom Token!)
 * @param projectId - Firebase Project ID
 * @returns Decoded payload with uid, role, etc.
 * @throws Error if token is invalid, expired, or signature fails
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string
): Promise<FirebaseTokenPayload> {
  try {
    console.log('[Firebase Token] 🔍 Starting verification');
    console.log('[Firebase Token] 📊 Token length:', token.length);
    console.log('[Firebase Token] 🏢 Project ID:', projectId);

    const JWKS = getJWKS();

    // JWT 검증 (서명, issuer, audience, 만료 시간)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });

    console.log('[Firebase Token] ✅ JWT signature verified');

    // 필수 필드 검증
    if (!payload.sub) {
      throw new Error('Token missing subject (uid)');
    }

    // 시간 검증 강화
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      console.error('[Firebase Token] ❌ Token expired:', {
        exp: payload.exp,
        now,
        expiredBy: now - payload.exp
      });
      throw new errors.JWTExpired('Token has expired');
    }

    if (payload.iat && payload.iat > now + 300) { // 5분 클락 스큐 허용
      console.error('[Firebase Token] ❌ Token issued in future:', {
        iat: payload.iat,
        now,
        diff: payload.iat - now
      });
      throw new Error('Token not yet valid (issued in future)');
    }

    console.log('[Firebase Token] ✅ Time validation passed:', {
      iat: payload.iat,
      exp: payload.exp,
      now
    });

    // Custom Claims 타입 가드
    const uid = payload.sub;
    const role = typeof payload.role === 'string' ? payload.role : undefined;
    const userId = typeof payload.userId === 'number' ? payload.userId : undefined;
    const userName = typeof payload.userName === 'string' ? payload.userName : undefined;
    const email = typeof payload.email === 'string' ? payload.email : undefined;

    console.log('[Firebase Token] ✅ Token verified successfully');
    console.log('[Firebase Token] 👤 User:', {
      uid,
      role,
      userId,
      userName,
      email: email ? 'exists' : 'none'
    });

    return {
      ...payload,
      uid,
      role,
      userId,
      userName,
      email,
    };

  } catch (error) {
    console.error('[Firebase Token] ❌ Verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown',
      name: error instanceof Error ? error.name : undefined,
      tokenPreview: token.substring(0, 30) + '...',
    });

    // JWKS 캐시 문제 시 강제 갱신 (kid not found 등)
    if (error instanceof errors.JWTInvalid && error.message.includes('kid')) {
      invalidateJWKSCache();
      console.warn('[Firebase Token] 🔄 JWKS cache invalidated → retry possible');
    }

    throw error;
  }
}

/**
 * 검증 에러를 클라이언트 친화적 형태로 변환
 */
export function parseVerifyError(error: unknown): { code: string; message: string } {
  if (error instanceof errors.JWTExpired) {
    return { code: 'TOKEN_EXPIRED', message: 'Token has expired. Please login again.' };
  }
  
  if (error instanceof errors.JWTInvalid) {
    if (error.message.includes('issuer')) {
      return { code: 'INVALID_ISSUER', message: 'Token issuer mismatch' };
    }
    if (error.message.includes('audience')) {
      return { code: 'INVALID_AUDIENCE', message: 'Token audience mismatch' };
    }
    if (error.message.includes('signature')) {
      return { code: 'INVALID_SIGNATURE', message: 'Invalid token signature' };
    }
    if (error.message.includes('kid')) {
      return { code: 'INVALID_KID', message: 'Public key not found for token' };
    }
  }

  if (error instanceof Error && error.message.includes('not yet valid')) {
    return { code: 'TOKEN_NOT_YET_VALID', message: 'Token issued in the future' };
  }

  return {
    code: 'VERIFICATION_FAILED',
    message: error instanceof Error ? error.message : 'Token verification failed'
  };
}

export default {
  verifyFirebaseIdToken,
  parseVerifyError,
  invalidateJWKSCache
};
