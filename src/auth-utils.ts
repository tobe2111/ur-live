/**
 * 백엔드 인증 유틸리티
 * - 카카오 로그인 공통 로직
 * - UPSERT 패턴으로 Race Condition 해결
 * - 보안 강화된 세션 토큰
 */

export interface KakaoUserData {
  id: number;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
    email?: string;
  };
}

export interface User {
  id: number;
  kakao_id: string;
  name: string;
  email: string | null;
  profile_image: string | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * 보안 강화된 세션 토큰 생성
 * - crypto.randomUUID() 사용
 * - 예측 불가능한 128비트 UUID
 */
export function generateSecureSessionToken(userId: number): string {
  // UUID v4: 랜덤 128비트 (예: 550e8400-e29b-41d4-a716-446655440000)
  const uuid = crypto.randomUUID();
  
  // 추가 보안: userId와 타임스탬프를 해시로 조합 (선택사항)
  return `${uuid}-${userId}`;
}

/**
 * 카카오 사용자 정보 추출
 * - NULL 처리 표준화 (빈 문자열 대신 null 사용)
 */
export function extractKakaoUserInfo(userData: KakaoUserData): {
  kakaoId: string;
  nickname: string;
  email: string | null;
  profileImage: string | null;
} {
  const kakaoId = userData.id.toString();
  
  // 닉네임 추출 (기본값: 'Kakao User')
  const nickname = 
    userData.properties?.nickname || 
    userData.kakao_account?.profile?.nickname || 
    'Kakao User';
  
  // 이메일 추출 (없으면 null)
  const email = userData.kakao_account?.email || null;
  
  // 프로필 이미지 추출 (없으면 null)
  const profileImage = 
    userData.properties?.profile_image || 
    userData.kakao_account?.profile?.profile_image_url || 
    null;
  
  return { kakaoId, nickname, email, profileImage };
}

/**
 * UPSERT 패턴으로 사용자 생성/업데이트
 * - Race Condition 해결
 * - 동시 요청 시에도 안전
 */
export async function upsertUser(
  DB: D1Database,
  kakaoId: string,
  nickname: string,
  email: string | null,
  profileImage: string | null
): Promise<User> {
  try {
    // ✅ 최적화: 단일 쿼리로 UPSERT (3개 쿼리 → 1개 쿼리)
    // INSERT ... ON CONFLICT DO UPDATE ... RETURNING 사용
    const user = await DB.prepare(`
      INSERT INTO users (
        kakao_id, name, email, profile_image, 
        created_at, last_login_at, updated_at
      )
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(kakao_id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        profile_image = excluded.profile_image,
        last_login_at = datetime('now'),
        updated_at = datetime('now')
      RETURNING id, kakao_id, name, email, profile_image
    `).bind(kakaoId, nickname, email, profileImage).first<User>();
    
    if (!user) {
      throw new AuthError('Failed to upsert user', 500, 'UPSERT_FAILED');
    }
    
    return user;
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    console.error('[Auth] Database error during upsert:', error);
    throw new AuthError(
      'Database error',
      500,
      'DB_ERROR'
    );
  }
}

/**
 * 카카오 액세스 토큰으로 사용자 정보 가져오기
 */
export async function getKakaoUserInfo(accessToken: string): Promise<KakaoUserData> {
  try {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Kakao API] Failed to get user info:', errorText);
      throw new AuthError(
        'Failed to get user info from Kakao',
        401,
        'KAKAO_USER_INFO_FAILED'
      );
    }
    
    const userData = await response.json() as any;
    
    if (!userData.id) {
      throw new AuthError(
        'Invalid user data from Kakao',
        500,
        'INVALID_KAKAO_DATA'
      );
    }
    
    return userData;
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    console.error('[Kakao API] Network error:', error);
    throw new AuthError(
      'Failed to communicate with Kakao API',
      503,
      'KAKAO_API_ERROR'
    );
  }
}

/**
 * 카카오 OAuth 코드를 액세스 토큰으로 교환
 */
export async function exchangeKakaoCode(
  code: string,
  redirectUri: string,
  clientId: string
): Promise<string> {
  try {
    const response = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code: code,
      }).toString(),
    });
    
    if (!response.ok) {
      const errorData = await response.json() as any;
      console.error('[Kakao OAuth] Token exchange failed:', errorData);
      
      throw new AuthError(
        `Failed to exchange code: ${errorData.error_description || errorData.error}`,
        401,
        errorData.error || 'TOKEN_EXCHANGE_FAILED'
      );
    }
    
    const tokenData = await response.json() as any;
    return tokenData.access_token;
    
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    console.error('[Kakao OAuth] Network error:', error);
    throw new AuthError(
      'Failed to communicate with Kakao OAuth server',
      503,
      'OAUTH_NETWORK_ERROR'
    );
  }
}

/**
 * 완전한 카카오 로그인 처리 (공통 로직)
 * - 액세스 토큰 → 사용자 정보 → DB UPSERT
 */
export async function processKakaoLogin(
  DB: D1Database,
  accessToken: string
): Promise<{ user: User; sessionToken: string }> {
  // 1. 카카오에서 사용자 정보 가져오기
  const userData = await getKakaoUserInfo(accessToken);
  
  // 2. 사용자 정보 추출
  const { kakaoId, nickname, email, profileImage } = extractKakaoUserInfo(userData);
  
  // 3. DB에 UPSERT
  const user = await upsertUser(DB, kakaoId, nickname, email, profileImage);
  
  // 4. 보안 강화된 세션 토큰 생성
  const sessionToken = generateSecureSessionToken(user.id);
  
  return { user, sessionToken };
}
