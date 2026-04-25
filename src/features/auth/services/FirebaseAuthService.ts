/**
 * Firebase Admin Auth 서비스
 * 
 * 책임:
 * - Firebase Custom Token 생성
 * - Custom Claims 관리
 */

import { initFirebaseAdmin } from '@/lib/firebase-admin';
import type { FirebaseCustomClaims } from '../types';
import { logError } from '@/worker/utils/logger';

export class FirebaseAuthService {
  private firebase: ReturnType<typeof initFirebaseAdmin>;
  
  constructor(env: any) {
    this.firebase = initFirebaseAdmin(env);
  }
  
  /**
   * Firebase Custom Token 생성
   * 
   * @param uid - Firebase UID (예: "kakao_123456789")
   * @param claims - Custom Claims (role, userId, userName 등)
   * @returns Custom Token string
   */
  async createCustomToken(
    uid: string, 
    claims: FirebaseCustomClaims
  ): Promise<string> {
    try {
      const customToken = await this.firebase.createCustomToken(uid, claims as unknown as Record<string, unknown>);
      return customToken;
    } catch (error) {
      logError('firebase.auth.customTokenFailed', { error: (error as Error)?.message });
      throw new Error(`Firebase custom token creation failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Kakao 사용자용 Firebase UID 생성
   */
  static getKakaoFirebaseUID(kakaoId: string): string {
    return `kakao_${kakaoId}`;
  }
  
  /**
   * Google 사용자용 Firebase UID 생성
   */
  static getGoogleFirebaseUID(googleId: string): string {
    return `google_${googleId}`;
  }
}
