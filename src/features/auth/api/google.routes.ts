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
import { logError } from '@/worker/utils/logger';

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
 */
googleRoutes.post('/register', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const body = await c.req.json() as Record<string, any>;
    const idToken: string = body.idToken;
    
    if (!idToken) {
      return c.json({ success: false, error: 'Firebase ID token is required' }, 400);
    }
    
    // 1. Firebase ID Token 검증 (projectId 필요)
    const projectId = c.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      return c.json({ success: false, error: 'Firebase project not configured' }, 500);
    }
    
    const tokenPayload = await verifyFirebaseIdToken(idToken, projectId);
    
    if (!tokenPayload || !tokenPayload.sub) {
      return c.json({ success: false, error: 'Invalid Firebase ID token' }, 401);
    }
    
    // 2. Google 사용자 정보 추출
    const googleService = new GoogleAuthService(DB);
    const googleUser = googleService.extractUserFromToken({
      sub: tokenPayload.sub as string,
      email: (tokenPayload.email as string) || '',
      email_verified: (tokenPayload.email_verified as boolean) || false,
      name: (tokenPayload.name as string) || (tokenPayload.email as string || '').split('@')[0],
      picture: tokenPayload.picture as string | undefined
    });
    
    // 3. DB에 사용자 저장/업데이트
    const user = await googleService.upsertUser(googleUser);
    
    // 4. Firebase Custom Token 생성
    const firebaseService = new FirebaseAuthService(c.env);
    const firebaseUID = tokenPayload.sub as string;
    const customToken = await firebaseService.createCustomToken(firebaseUID, {
      role: 'user',
      userId: user.id,
      userName: user.name,
      email: user.email,
      kakaoId: googleUser.googleId // reuse kakaoId field for googleId (optional claim)
    });
    
    // 5. Firebase UID 저장
    await googleService.updateFirebaseUID(user.id, firebaseUID);
    
    return c.json({
      success: true,
      data: {
        customToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_image: user.profile_image,
          firebaseUID
        }
      },
      message: 'Login successful'
    });
    
  } catch (error) {
    logError('google.auth.error', { error: (error as Error)?.message });
    const errorMsg = (error as Error).message || 'Unknown error';
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default googleRoutes;
