import type { D1Database } from '@cloudflare/workers-types';
/**
 * Google OAuth 2.0 인증 서비스
 * 
 * 책임:
 * - Google OAuth ID Token 검증
 * - Google 사용자 정보 추출
 * - DB에 사용자 저장/업데이트
 */

import type { User, FirebaseCustomClaims } from '../types';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  profileImage?: string;
}

export interface GoogleIdTokenPayload {
  sub: string; // Google User ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export class GoogleAuthService {
  constructor(private db: D1Database) {}
  
  /**
   * Google ID Token에서 사용자 정보 추출
   * (Firebase Auth에서 이미 검증된 토큰 사용)
   */
  extractUserFromToken(tokenPayload: GoogleIdTokenPayload): GoogleUser {
    if (!tokenPayload.email_verified) {
      throw new Error('Google email not verified');
    }
    
    return {
      googleId: tokenPayload.sub,
      email: tokenPayload.email ?? "",
      name: tokenPayload.name || (tokenPayload.email ?? "").split('@')[0],
      profileImage: tokenPayload.picture
    };
  }
  
  /**
   * DB에 Google 사용자 저장 또는 업데이트
   *
   * 보안: 반드시 google_id 로만 기존 계정을 매칭한다. 이메일 매칭은 금지 —
   * 동일 이메일이 이미 Kakao/로컬 계정으로 존재하면 명시적인 계정 연동
   * 단계 없이 Google 로그인으로 계정 탈취가 가능하기 때문.
   */
  async upsertUser(googleUser: GoogleUser): Promise<User> {
    try {
      // 1) google_id 로만 매칭
      const existingUser = await this.db.prepare(`
        SELECT id, google_id, name, email, profile_image, created_at
        FROM users
        WHERE google_id = ?
      `).bind(googleUser.googleId).first<User>();

      let userId: number;

      if (existingUser) {
        // 기존 Google 사용자 업데이트
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
          googleUser.name,
          googleUser.email,
          googleUser.profileImage || null,
          userId
        ).run();

      } else {
        // 2) google_id 매칭이 없으면, 동일 이메일을 다른 방식(카카오/로컬)으로
        //    이미 사용 중인지 확인. 사용 중이면 차단.
        const emailOwner = await this.db.prepare(`
          SELECT id, kakao_id, password_hash, google_id
          FROM users
          WHERE email = ?
        `).bind(googleUser.email).first<{
          id: number;
          kakao_id: string | null;
          password_hash: string | null;
          google_id: string | null;
        }>().catch(() => null);

        if (emailOwner && emailOwner.id && (emailOwner.kakao_id || emailOwner.password_hash)) {
          // 다른 방식으로 이미 가입된 이메일 — 명시적 계정 연동 필요
          throw new Error('EMAIL_ALREADY_LINKED_TO_OTHER_PROVIDER');
        }

        // 신규 사용자 생성
        const result = await this.db.prepare(`
          INSERT INTO users (
            google_id,
            name,
            email,
            profile_image,
            created_at,
            last_login_at,
            updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(
          googleUser.googleId,
          googleUser.name,
          googleUser.email,
          googleUser.profileImage || null
        ).run();

        userId = result.meta.last_row_id as number;
      }

      // 사용자 정보 다시 조회하여 반환
      const user = await this.db.prepare(`
        SELECT id, google_id, name, email, profile_image, firebase_uid, created_at
        FROM users
        WHERE id = ?
      `).bind(userId).first<User>();

      if (!user) {
        throw new Error('Failed to retrieve user after upsert');
      }

      return user;

    } catch (error) {
      const msg = (error as Error).message || '';
      // Re-throw explicit account-linking signal so callers can surface a user-facing error.
      if (msg === 'EMAIL_ALREADY_LINKED_TO_OTHER_PROVIDER') {
        throw error;
      }
      console.error('[GoogleAuthService] DB error:', error);
      throw new Error(`Database error: ${msg}`);
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
      console.warn('[GoogleAuthService] firebase_uid column not found, skipping update:', error);
    }
  }
}
