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
      signal: AbortSignal.timeout(8000), // 15s timeout
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
      signal: AbortSignal.timeout(8000), // 15s timeout
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
      signal: AbortSignal.timeout(8000), // 15s timeout
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
      body: 'property_keys=["kakao_account.profile","kakao_account.email","kakao_account.name","kakao_account.phone_number","properties.nickname","properties.profile_image"]',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KakaoAuthService] User info fetch failed:', errorText);
      throw new Error(`Failed to get Kakao user info: ${errorText}`);
    }

    const data: KakaoUserInfoResponse = await response.json();

    // 🛡️ 2026-05-01 진단 로그 — DEV 모드만 (production console 노이즈 방지).
    //   사용자 신고 추적용 — Kakao API 응답 raw 데이터 확인.
    if (import.meta.env.DEV) {
      console.log('[Kakao API RAW RESPONSE]', JSON.stringify({
        id: data.id,
        properties: data.properties,
        kakao_account: {
          email: data.kakao_account?.email,
          // @ts-expect-error — name 필드는 type 정의에 없을 수 있음
          name: data.kakao_account?.name,
          // @ts-expect-error — phone_number 필드도
          phone_number: data.kakao_account?.phone_number,
          profile: data.kakao_account?.profile,
        },
      }, null, 2));
    }

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
        signal: AbortSignal.timeout(8000), // 15s timeout
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
  /**
   * 🛡️ 2026-05-01: Option B — 탈퇴 후 재가입 시 복원 가능 계정 체크.
   *   같은 kakao_id 의 deleted_accounts row 가 30일 내 있으면 isRestorable: true 반환.
   *   사용자에게 "이전 계정 복원" 동의 화면 표시 후 restoreUser 호출.
   *   동의 거부 시 그냥 신규 계정 생성 (옛 계정은 30일 후 hard purge cron 이 처리).
   */
  async checkRestorable(kakaoId: string): Promise<{ isRestorable: boolean; deletedAt?: string; originalName?: string | null; reregisterAvailableAt?: string }> {
    try {
      const row = await this.db
        .prepare(
          `SELECT original_name, deleted_at, reregister_available_at FROM deleted_accounts
           WHERE kakao_id = ? AND datetime(reregister_available_at) > datetime('now')
           ORDER BY deleted_at DESC LIMIT 1`
        )
        .bind(kakaoId)
        .first<{ original_name: string | null; deleted_at: string; reregister_available_at: string }>()
      if (!row) return { isRestorable: false }
      return {
        isRestorable: true,
        deletedAt: row.deleted_at,
        originalName: row.original_name,
        reregisterAvailableAt: row.reregister_available_at,
      }
    } catch {
      return { isRestorable: false }
    }
  }

  async upsertUser(kakaoUser: KakaoUser): Promise<User & { isNewUser?: boolean }> {
    try {
      // 기존 사용자 확인
      const existingUser = await this.db.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(kakaoUser.kakaoId).first<User>();
      
      let userId: number;
      // 🛡️ 2026-04-30: 신규 사용자 detect — onboarding flow trigger 용
      const isNewUser = !existingUser;

      if (existingUser) {
        // 기존 사용자 업데이트
        userId = existingUser.id;
        // 🛡️ 2026-05-01: last_login_at / profile_image 컬럼이 production 에 없을 수 있음.
        //   첫 시도 → 컬럼 없으면 catch → 핵심 컬럼만 UPDATE.
        try {
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
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[KakaoAuthService] UPDATE with last_login_at/profile_image failed, retrying with minimal columns:', e);
          // Fallback: 핵심 컬럼만 (name, email, updated_at)
          try {
            await this.db.prepare(`
              UPDATE users
              SET name = ?,
                  email = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `).bind(
              kakaoUser.name,
              kakaoUser.email || null,
              userId
            ).run();
          } catch (e2) {
            if (import.meta.env.DEV) console.warn('[KakaoAuthService] minimal UPDATE also failed (non-fatal — login can still proceed):', e2);
          }
        }

      } else {
        // 🛡️ 2026-05-01: production users 테이블에 toss_user_id 컬럼 없음.
        //   kakao_id UNIQUE constraint 도 production 에 없을 가능성 — 보강 시도.
        try {
          await this.db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id_unique ON users(kakao_id) WHERE kakao_id IS NOT NULL`).run()
        } catch { /* 인덱스 이미 존재 또는 권한 X */ }

        // 🛡️ 2026-05-01 (CRITICAL fix): last_row_id 의존 제거 — 사용자 신고로
        //   "다른 카카오 계정 신규 가입자도 유어팀(정지원) 으로 표시" 가능성:
        //   D1 의 last_row_id 가 항상 새 row 의 ID 를 반환한다고 보장 X.
        //   해결: INSERT 후 kakao_id 로 다시 SELECT — 100% 새 사용자 row 보장.
        try {
          await this.db.prepare(`
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
        } catch (insertErr) {
          // INSERT 실패 — UNIQUE constraint 위반 (race condition) 가능. 무시 후 아래 SELECT.
          if (import.meta.env.DEV) console.warn('[KakaoAuthService] INSERT failed (likely race or UNIQUE):', insertErr);
        }

        // 🛡️ INSERT 성공/race 무관 — kakao_id 로 SELECT 해서 정확한 user 찾음.
        //   last_row_id 가 0 또는 다른 row 의 ID 를 반환하더라도 안전.
        const insertedUser = await this.db.prepare(`
          SELECT id FROM users WHERE kakao_id = ?
        `).bind(kakaoUser.kakaoId).first<{ id: number }>();
        if (!insertedUser) {
          throw new Error(`Failed to find user after INSERT for kakao_id=${kakaoUser.kakaoId}`);
        }
        userId = insertedUser.id;
      }
      
      // 사용자 정보 다시 조회하여 반환.
      // 🛡️ 2026-05-01: firebase_uid 컬럼 production 에 없을 수도 있어 SELECT projection 에서 제거.
      //   downstream 어디서도 user.firebase_uid 를 읽지 않음 (firebaseUID 는 kakao_<id> 정적 생성).
      const user = await this.db.prepare(`
        SELECT id, kakao_id, name, email, profile_image, created_at
        FROM users
        WHERE id = ?
      `).bind(userId).first<User>();
      
      if (!user) {
        throw new Error('Failed to retrieve user after upsert');
      }

      return { ...user, isNewUser };
      
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
