import type { D1Database } from '@cloudflare/workers-types';
/**
 * Kakao OAuth 2.0 인증 서비스
 * 
 * 책임:
 * - Kakao OAuth 토큰 교환
 * - Kakao 사용자 정보 조회
 * - DB에 사용자 저장/업데이트
 * - 서비스 약관 조회
 */

import type { 
  KakaoTokenResponse, 
  KakaoUserInfoResponse,
  KakaoServiceTermsResponse,
  KakaoUser,
  User 
} from '../types';

export class KakaoAuthService {
  private readonly KAKAO_AUTH_URL = 'https://kauth.kakao.com';
  private readonly KAKAO_API_URL = 'https://kapi.kakao.com';
  
  constructor(
    private db: D1Database,
    private kakaoRestApiKey: string
  ) {
    if (!kakaoRestApiKey) {
      throw new Error('KAKAO_REST_API_KEY is required');
    }
  }
  
  /**
   * Authorization Code를 Access Token으로 교환
   */
  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const response = await fetch(`${this.KAKAO_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.kakaoRestApiKey,
        redirect_uri: redirectUri,
        code: code,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KakaoAuthService] Token exchange failed:', errorText);
      throw new Error(`Kakao token exchange failed: ${errorText}`);
    }
    
    const data: KakaoTokenResponse = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  }

  /**
   * Authorization Code → Access Token + Refresh Token 반환
   */
  async exchangeCodeFull(code: string, redirectUri: string): Promise<KakaoTokenResponse> {
    const response = await fetch(`${this.KAKAO_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.kakaoRestApiKey,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kakao token exchange failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Refresh Token으로 새 Access Token 발급
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string }> {
    const response = await fetch(`${this.KAKAO_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.kakaoRestApiKey,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kakao token refresh failed: ${errorText}`);
    }

    return response.json();
  }
  
  /**
   * Access Token으로 사용자 정보 조회
   */
  async getUserInfo(accessToken: string): Promise<KakaoUser> {
    // property_keys를 명시적으로 요청하여 닉네임/프로필 이미지가 반드시 포함되도록 함
    const response = await fetch(`${this.KAKAO_API_URL}/v2/user/me`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: 'property_keys=["kakao_account.profile","kakao_account.email","properties.nickname","properties.profile_image"]',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KakaoAuthService] User info fetch failed:', errorText);
      throw new Error(`Failed to get Kakao user info: ${errorText}`);
    }
    
    const data: KakaoUserInfoResponse = await response.json();
    
    if (!data.id) {
      throw new Error('Invalid user data from Kakao');
    }
    
    const kakaoUser: KakaoUser = {
      kakaoId: data.id.toString(),
      name: data.properties?.nickname || 
            data.kakao_account?.profile?.nickname || 
            'Kakao User',
      email: data.kakao_account?.email,
      profileImage: (data.properties?.profile_image ||
                    data.kakao_account?.profile?.profile_image_url || '')
                    .replace(/^http:\/\//, 'https://'),
    };
    
    return kakaoUser;
  }
  
  /**
   * 서비스 약관 동의 내역 조회 (카카오싱크 전용)
   */
  async getServiceTerms(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.KAKAO_API_URL}/v2/user/service_terms`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        console.warn('[KakaoAuthService] Service terms fetch failed (non-critical)');
        return [];
      }
      
      const data: KakaoServiceTermsResponse = await response.json();
      const tags = data.allowed_service_terms?.map(t => t.tag) || [];
      return tags;
      
    } catch (error) {
      console.warn('[KakaoAuthService] Service terms error (non-critical):', error);
      return [];
    }
  }
  
  /**
   * DB에 사용자 저장 또는 업데이트 (Upsert)
   */
  async upsertUser(kakaoUser: KakaoUser): Promise<User> {
    try {
      // 기존 사용자 확인
      const existingUser = await this.db.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(kakaoUser.kakaoId).first<User>();
      
      let userId: number;
      
      if (existingUser) {
        // 기존 사용자 업데이트
        userId = existingUser.id;
        await this.db.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = datetime('now'),
              last_login_at = datetime('now')
          WHERE id = ?
        `).bind(
          kakaoUser.name, 
          kakaoUser.email || null, 
          kakaoUser.profileImage || null, 
          userId
        ).run();
        
      } else {
        // 새 사용자 생성
        const result = await this.db.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at,
            updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(
          kakaoUser.kakaoId, 
          kakaoUser.name, 
          kakaoUser.email || null, 
          kakaoUser.profileImage || null
        ).run();
        
        userId = result.meta.last_row_id as number;
      }
      
      // 사용자 정보 다시 조회하여 반환
      const user = await this.db.prepare(`
        SELECT id, kakao_id, name, email, profile_image, firebase_uid, created_at
        FROM users
        WHERE id = ?
      `).bind(userId).first<User>();
      
      if (!user) {
        throw new Error('Failed to retrieve user after upsert');
      }
      
      return user;
      
    } catch (error) {
      console.error('[KakaoAuthService] DB error:', error);
      throw new Error(`Database error: ${(error as Error).message}`);
    }
  }
  
  /**
   * Firebase UID를 DB에 저장
   */
  async updateFirebaseUID(userId: number, firebaseUID: string): Promise<void> {
    try {
      await this.db.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(firebaseUID, userId).run();
      
    } catch (error) {
      // firebase_uid 컬럼이 없을 수 있으므로 경고만 출력
      console.warn('[KakaoAuthService] firebase_uid column not found, skipping update:', error);
    }
  }
}
