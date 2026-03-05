/**
 * Kakao OAuth 2.0 API Routes
 * 
 * Endpoints:
 * - GET  /auth/kakao/sync/callback - 카카오싱크 OAuth 콜백
 * - POST /api/auth/kakao/callback  - 카카오 로그인 콜백 (REST API)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { KakaoAuthService } from '../services/KakaoAuthService';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import type { AuthResponse, KakaoLoginResponse } from '../types';

type Bindings = {
  DB: D1Database;
  KAKAO_REST_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL: string;
};

export const kakaoRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /auth/kakao/sync/callback
 * 카카오싱크 OAuth 리다이렉트 콜백
 * 
 * Query params:
 * - code: Authorization code
 * - state: Redirect URL after login
 * - error: OAuth error (optional)
 */
kakaoRoutes.get('/sync/callback', async (c) => {
  const { DB } = c.env;
  
  try {
    console.log('[Kakao Sync] Callback started');
    
    const code = c.req.query('code');
    const state = c.req.query('state') || '/';
    const error = c.req.query('error');
    
    console.log('[Kakao Sync] Query params:', { 
      hasCode: !!code, 
      state, 
      error 
    });
    
    // OAuth 에러 처리
    if (error) {
      console.error('[Kakao Sync] OAuth error:', error);
      return c.redirect(`${state}?error=kakao_oauth_${error}`);
    }
    
    // Authorization code 필수
    if (!code) {
      console.error('[Kakao Sync] No authorization code');
      return c.redirect(`${state}?error=no_code`);
    }
    
    // Redirect URI 생성
    const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;
    
    // Services 초기화
    const kakaoService = new KakaoAuthService(DB, c.env.KAKAO_REST_API_KEY);
    const firebaseService = new FirebaseAuthService(c.env);
    
    try {
      // 1. Code → Access Token 교환
      console.log('[Kakao Sync] Step 1: Exchanging code for token...');
      const accessToken = await kakaoService.exchangeCode(code, KAKAO_REDIRECT_URI);
      
      // 2. 사용자 정보 가져오기
      console.log('[Kakao Sync] Step 2: Fetching user info...');
      const kakaoUser = await kakaoService.getUserInfo(accessToken);
      
      // 2.5. 서비스 약관 조회 (선택)
      console.log('[Kakao Sync] Step 2.5: Fetching service terms...');
      const serviceTerms = await kakaoService.getServiceTerms(accessToken);
      console.log('[Kakao Sync] Service terms:', serviceTerms);
      
      // 3. DB에 사용자 저장/업데이트
      console.log('[Kakao Sync] Step 3: Saving user to database...');
      const user = await kakaoService.upsertUser(kakaoUser);
      
      // 4. Firebase Custom Token 생성
      console.log('[Kakao Sync] Step 4: Generating Firebase Custom Token...');
      const firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);
      const customToken = await firebaseService.createCustomToken(firebaseUID, {
        role: 'user',
        userId: user.id,
        userName: user.name,
        email: user.email,
        kakaoId: kakaoUser.kakaoId
      });
      
      // 5. Firebase UID 저장
      await kakaoService.updateFirebaseUID(user.id, firebaseUID);
      
      console.log('[Kakao Sync] ✅ Login successful for user:', user.id);
      
      // 6. 프론트엔드로 리다이렉트 (Firebase token 포함)
      const stateUrl = new URL(state, 'https://dummy.com');
      stateUrl.searchParams.set('firebase_token', customToken);
      stateUrl.searchParams.set('userName', user.name);
      
      const redirectUrl = stateUrl.pathname + stateUrl.search;
      console.log('[Kakao Sync] Redirecting to:', redirectUrl.substring(0, 100) + '...');
      
      return c.redirect(redirectUrl);
      
    } catch (serviceError) {
      console.error('[Kakao Sync] Service error:', serviceError);
      const errorMsg = (serviceError as Error).message || 'Unknown error';
      
      // Firebase 설정 오류인 경우
      if (errorMsg.includes('Firebase')) {
        console.error('[Kakao Sync] Firebase config check:', {
          hasProjectId: !!c.env.FIREBASE_PROJECT_ID,
          hasPrivateKey: !!c.env.FIREBASE_PRIVATE_KEY,
          hasClientEmail: !!c.env.FIREBASE_CLIENT_EMAIL,
          hasDatabaseURL: !!c.env.FIREBASE_DATABASE_URL
        });
        return c.redirect(`${state}?error=firebase_config_error&detail=${encodeURIComponent(errorMsg)}`);
      }
      
      // DB 에러인 경우
      if (errorMsg.includes('Database')) {
        return c.redirect(`${state}?error=database_error&detail=${encodeURIComponent(errorMsg)}`);
      }
      
      // 기타 에러
      return c.redirect(`${state}?error=kakao_auth_failed&detail=${encodeURIComponent(errorMsg)}`);
    }
    
  } catch (error) {
    console.error('[Kakao Sync] Unexpected error:', error);
    const state = c.req.query('state') || '/';
    const errorMsg = encodeURIComponent((error as Error).message || 'unknown');
    return c.redirect(`${state}?error=kakao_sync_failed&detail=${errorMsg}`);
  }
});

/**
 * POST /api/auth/kakao/callback
 * 카카오 로그인 REST API 콜백
 * 
 * Request body:
 * - code: Authorization code
 * - redirect_uri: OAuth redirect URI
 * 
 * Response:
 * - customToken: Firebase Custom Token
 * - user: User 정보
 */
kakaoRoutes.post('/callback', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { code, redirect_uri } = await c.req.json();
    
    // Validation
    if (!code) {
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Authorization code is required' 
      }, 400);
    }
    
    if (!c.env.KAKAO_REST_API_KEY) {
      console.error('[Kakao Callback] KAKAO_REST_API_KEY not configured');
      return c.json<AuthResponse>({ 
        success: false, 
        error: 'Server configuration error',
        code: 'MISSING_API_KEY'
      }, 500);
    }
    
    const redirectUri = redirect_uri || 'https://live.ur-team.com/auth/kakao/callback';
    console.log('[Kakao Callback] Starting OAuth flow...');
    
    // Services 초기화
    const kakaoService = new KakaoAuthService(DB, c.env.KAKAO_REST_API_KEY);
    const firebaseService = new FirebaseAuthService(c.env);
    
    // 1. Code → Access Token 교환
    const accessToken = await kakaoService.exchangeCode(code, redirectUri);
    
    // 2. 사용자 정보 가져오기
    const kakaoUser = await kakaoService.getUserInfo(accessToken);
    
    // 3. DB에 사용자 저장/업데이트
    const user = await kakaoService.upsertUser(kakaoUser);
    
    // 4. Firebase Custom Token 생성
    const firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);
    const customToken = await firebaseService.createCustomToken(firebaseUID, {
      role: 'user',
      userId: user.id,
      userName: user.name,
      email: user.email,
      kakaoId: kakaoUser.kakaoId
    });
    
    // 5. Firebase UID 저장
    await kakaoService.updateFirebaseUID(user.id, firebaseUID);
    
    console.log('[Kakao Callback] ✅ Login successful for user:', user.id);
    
    // 6. 응답 반환
    return c.json<AuthResponse<KakaoLoginResponse>>({
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
    console.error('[Kakao Callback] Error:', error);
    
    const errorMsg = (error as Error).message || 'Unknown error';
    const statusCode = errorMsg.includes('Firebase') ? 500 :
                      errorMsg.includes('Database') ? 500 :
                      errorMsg.includes('Kakao') ? 502 : 500;
    
    return c.json<AuthResponse>({
      success: false,
      error: errorMsg,
      code: 'KAKAO_LOGIN_FAILED'
    }, statusCode);
  }
});

/**
 * GET /api/users/role
 * Get user role from Firebase Auth token
 * 
 * Headers:
 * - Authorization: Bearer <firebase-id-token>
 */
kakaoRoutes.get('/users/role', cors(), async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: true, 
        role: 'user' 
      }, 200); // Return default role instead of 401
    }
    
    // For now, return default 'user' role
    // TODO: Implement Firebase token verification and database lookup
    return c.json({
      success: true,
      role: 'user' // Default role for all authenticated users
    }, 200);
    
  } catch (err) {
    console.error('[/api/users/role] Error:', err);
    return c.json({ 
      success: true, 
      role: 'user' // Fallback to user role on error
    }, 200);
  }
});

export default kakaoRoutes;
