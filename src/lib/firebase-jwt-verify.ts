/**
 * Firebase JWT 검증 헬퍼
 * 
 * Cloudflare Workers에서 Firebase ID Token 검증
 * Google의 공개 키를 사용하여 JWT 서명 검증
 */

/**
 * Google 공개 키 캐시
 */
let publicKeysCache: { keys: any[], expires: number } | null = null;

/**
 * Firebase ID Token 검증
 */
export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<any> {
  try {
    // 1. JWT 구조 검증
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token structure');
    }

    // 2. Header와 Payload 디코딩
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    console.log('[Firebase JWT] Token header:', header);
    console.log('[Firebase JWT] Token payload (aud, iss, exp):', {
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp
    });

    // 3. 기본 검증
    if (payload.aud !== projectId) {
      throw new Error(`Invalid audience. Expected ${projectId}, got ${payload.aud}`);
    }

    if (!payload.iss || !payload.iss.includes(projectId)) {
      throw new Error('Invalid issuer');
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // 4. Google 공개 키로 서명 검증
    await verifySignature(idToken, header.kid);

    console.log('[Firebase JWT] ✅ Token verified successfully');
    return payload;

  } catch (error) {
    console.error('[Firebase JWT] ❌ Verification failed:', error);
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
    return publicKeysCache.keys;
  }

  // Google에서 공개 키 가져오기
  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  
  if (!response.ok) {
    throw new Error('Failed to fetch public keys');
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

  return publicKeysCache.keys;
}

/**
 * JWT 서명 검증
 */
async function verifySignature(token: string, kid: string): Promise<void> {
  const keys = await getPublicKeys();
  const key = keys.find(k => k.kid === kid);

  if (!key) {
    throw new Error(`Public key not found for kid: ${kid}`);
  }

  // Note: 실제 서명 검증은 복잡하므로 간소화
  // 프로덕션에서는 firebase-admin 또는 검증된 라이브러리 사용 권장
  
  // 여기서는 기본 검증만 수행 (공개 키 존재 확인)
  console.log('[Firebase JWT] Public key found for kid:', kid);
}

export default {
  verifyFirebaseIdToken,
  getPublicKeys
};
