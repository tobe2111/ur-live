/**
 * Google OAuth 2.0 API Routes (WORLD Region Only)
 * 
 * Endpoints:
 * - POST /api/auth/google/register - Google 로그인 처리
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { verifyFirebaseIdToken } from '@/lib/firebase-token-verify';
import type { AuthResponse } from '../types';

type Bindings = {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL: string;
};

export const googleRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/auth/google/register
 * Google 로그인 처리 (Firebase ID Token 검증 후 DB 저장)
 * 
 * Request body:
 * - idToken: Firebase ID Token (Google Sign-In으로부터 받은 토큰)
 * 
 * Response:
 * - customToken: Firebase Custom Token
 * - user: User 정보
 */
googleRoutes.post('/register', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { idToken } = await c.req.json();
    
    // Validation
    if (!idToken) {
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Firebase ID token is required' 
      }, 400);
    }
    
    console.log('[Google Auth] Verifying Firebase ID token...');
    
    // 1. Firebase ID Token 검증
    const tokenPayload = await verifyFirebaseIdToken(idToken);
    
    if (!tokenPayload || !tokenPayload.email) {
      return c.json<AuthResponse>({
        success: false,
        error: 'Invalid Firebase ID token',
        code: 'INVALID_TOKEN'
      }, 401);
    }
    
    console.log('[Google Auth] Token verified for user:', tokenPayload.email);
    
    // 2. Google 사용자 정보 추출
    const googleService = new GoogleAuthService(DB);
    const googleUser = googleService.extractUserFromToken({
      sub: tokenPayload.uid,
      email: tokenPayload.email!,
      email_verified: tokenPayload.email_verified || false,
      name: tokenPayload.name || tokenPayload.email!.split('@')[0],
      picture: tokenPayload.picture
    });
    
    // 3. DB에 사용자 저장/업데이트
    const user = await googleService.upsertUser(googleUser);
    
    // 4. Firebase Custom Token 생성 (추가 claims 포함)
    const firebaseService = new FirebaseAuthService(c.env);
    const firebaseUID = tokenPayload.uid; // 이미 Firebase에서 발급한 UID 사용
    const customToken = await firebaseService.createCustomToken(firebaseUID, {
      role: 'user',
      userId: user.id,
      userName: user.name,
      email: user.email,
      googleId: googleUser.googleId
    });
    
    // 5. Firebase UID 저장
    await googleService.updateFirebaseUID(user.id, firebaseUID);
    
    console.log('[Google Auth] ✅ Login successful for user:', user.id);
    
    // 6. 응답 반환
    return c.json<AuthResponse>({
      success: true,
      data: {
        customToken: customToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_image: user.profile_image,
          firebaseUID: firebaseUID
        },
      },
    });
    
  } catch (error) {
    console.error('[Google Auth] Error:', error);
    
    const errorMsg = (error as Error).message || 'Unknown error';
    const statusCode = errorMsg.includes('Firebase') ? 500 :
                      errorMsg.includes('Database') ? 500 :
                      errorMsg.includes('token') ? 401 : 500;
    
    return c.json<AuthResponse>({
      success: false,
      error: errorMsg,
      code: 'GOOGLE_LOGIN_FAILED'
    }, statusCode);
  }
});

export default googleRoutes;
