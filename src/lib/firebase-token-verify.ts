/**
 * Firebase ID Token 검증 헬퍼 (100% Firebase 표준)
 * 
 * Cloudflare Workers에서 Firebase ID Token 검증
 * Google의 공개 키를 사용하여 서명 검증
 * 
 * 참고: Firebase ID Token은 JWT 형식이지만, 이는 Firebase의 표준 방식입니다.
 *       커스텀 JWT(access_token, refresh_token)와는 다릅니다.
 * 
 * jose 라이브러리: Cloudflare Workers와 호환되는 표준 Web Crypto 래퍼
 */

import * as jose from 'jose';

/**
 * Google 공개 키 캐시
 */
let publicKeysCache: { keys: any[], expires: number } | null = null;

/**
 * Firebase ID Token 검증
 */
export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<any> {
  try {
    console.log('[Firebase Token] 🔍 Starting ID Token verification');
    console.log('[Firebase Token] 📊 Token length:', idToken.length);
    console.log('[Firebase Token] 🏢 Project ID:', projectId);
    
    // 1. Token 구조 검증
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error(`Invalid token structure: expected 3 parts, got ${parts.length}`);
    }

    // 2. Header와 Payload 디코딩
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    console.log('[Firebase Token] 🔑 Token header:', { alg: header.alg, kid: header.kid });
    console.log('[Firebase Token] 📝 Token payload:', {
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp,
      iat: payload.iat,
      uid: payload.uid || payload.user_id
    });

    // 3. 기본 검증
    if (payload.aud !== projectId) {
      throw new Error(`Invalid audience. Expected ${projectId}, got ${payload.aud}`);
    }

    if (!payload.iss || !payload.iss.includes(projectId)) {
      throw new Error(`Invalid issuer. Expected to include ${projectId}, got ${payload.iss}`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }

    if (payload.iat > now + 300) { // 5분 클락 스큐 허용
      throw new Error('Token issued in the future');
    }

    console.log('[Firebase Token] ✅ Basic validation passed');

    // 4. Google 공개 키로 서명 검증
    await verifySignatureWithJose(idToken, header.kid);

    console.log('[Firebase Token] ✅ Token verified successfully');
    console.log('[Firebase Token] 👤 User ID:', payload.uid || payload.user_id);
    console.log('[Firebase Token] 🏷️ Custom Claims:', {
      role: payload.role,
      userId: payload.userId,
      userName: payload.userName
    });
    
    return payload;

  } catch (error) {
    console.error('[Firebase Token] ❌ Verification failed:', error);
    if (error instanceof Error) {
      console.error('[Firebase Token] ❌ Error message:', error.message);
      console.error('[Firebase Token] ❌ Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Google 공개 키 가져오기
 */
async function getPublicKeys(): Promise<any[]> {
  const now = Date.now();

  // 캐시가 유효하면 반환
  if (publicKeysCache && publicKeysCache.expires > now) {
    console.log('[Firebase Token] 🎯 Using cached public keys');
    return publicKeysCache.keys;
  }

  console.log('[Firebase Token] 📥 Fetching public keys from Google');
  
  // Google에서 공개 키 가져오기
  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch public keys: ${response.status} ${response.statusText}`);
  }

  const keys = await response.json();
  
  // Cache-Control 헤더에서 만료 시간 파싱
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600; // 기본 1시간

  publicKeysCache = {
    keys: Object.entries(keys).map(([kid, cert]) => ({ kid, cert })),
    expires: now + maxAge * 1000
  };

  console.log('[Firebase Token] ✅ Public keys fetched:', publicKeysCache.keys.length, 'keys');
  console.log('[Firebase Token] ⏰ Cache expires in:', maxAge, 'seconds');

  return publicKeysCache.keys;
}

/**
 * jose 라이브러리를 사용한 JWT 서명 검증
 */
async function verifySignatureWithJose(token: string, kid: string): Promise<void> {
  try {
    console.log('[Firebase Token] 🔐 Verifying signature with kid:', kid);
    
    const keys = await getPublicKeys();
    const key = keys.find(k => k.kid === kid);

    if (!key) {
      throw new Error(`Public key not found for kid: ${kid}`);
    }

    console.log('[Firebase Token] 🔑 Public key found for kid:', kid);
    
    // PEM 인증서를 JWK로 변환
    // Firebase는 X.509 인증서 형식으로 제공하지만, jose는 PEM을 직접 import 가능
    const publicKey = await jose.importX509(key.cert, 'RS256');
    
    console.log('[Firebase Token] 🔓 Public key imported successfully');
    
    // JWT 서명 검증
    const { payload, protectedHeader } = await jose.jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
    });
    
    console.log('[Firebase Token] ✅ Signature verified successfully');
    console.log('[Firebase Token] 🛡️ Protected header:', protectedHeader);
    
  } catch (error) {
    console.error('[Firebase Token] ❌ Signature verification error:', error);
    if (error instanceof Error) {
      console.error('[Firebase Token] ❌ Error name:', error.name);
      console.error('[Firebase Token] ❌ Error message:', error.message);
    }
    throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default {
  verifyFirebaseIdToken,
  getPublicKeys
};
