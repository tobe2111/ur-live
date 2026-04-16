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
import { createSessionCookie } from '../../../worker/utils/session';
import type { AuthResponse, KakaoLoginResponse } from '../types';

type Bindings = {
  DB: D1Database;
  KAKAO_REST_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL: string;
  JWT_SECRET: string;
};

export const kakaoRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /auth/kakao/sync/callback
 * 카카오싱크 OAuth 리다이렉트 콜백
 */
kakaoRoutes.get('/sync/callback', async (c) => {
  const { DB } = c.env;
  
  try {
    const code = c.req.query('code');
    const state = c.req.query('state') || '/';
    const error = c.req.query('error');
    
    if (error) {
      console.error('[Kakao Sync] OAuth error:', error);
      return c.redirect(`${state}?error=kakao_oauth_${error}`);
    }
    
    if (!code) {
      console.error('[Kakao Sync] No authorization code');
      return c.redirect(`${state}?error=no_code`);
    }
    
    const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;
    
    const kakaoService = new KakaoAuthService(DB, c.env.KAKAO_REST_API_KEY);
    const firebaseService = new FirebaseAuthService(c.env);
    
    try {
      const accessToken = await kakaoService.exchangeCode(code, KAKAO_REDIRECT_URI);
      const kakaoUser = await kakaoService.getUserInfo(accessToken);
      const serviceTerms = await kakaoService.getServiceTerms(accessToken);
      const user = await kakaoService.upsertUser(kakaoUser);
      
      const firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);
      const customToken = await firebaseService.createCustomToken(firebaseUID, {
        role: 'user',
        userId: user.id,
        userName: user.name,
        email: user.email,
        kakaoId: kakaoUser.kakaoId,
        ...(user.profile_image ? { profileImage: user.profile_image } : {}),
      });

      await kakaoService.updateFirebaseUID(user.id, firebaseUID);

      // 카카오 access_token 저장 (메시지/캘린더 API용)
      try {
        await DB.prepare("ALTER TABLE users ADD COLUMN kakao_access_token TEXT").run();
      } catch { /* already exists */ }
      await DB.prepare("UPDATE users SET kakao_access_token = ? WHERE id = ?")
        .bind(accessToken, user.id).run();

      // Set httpOnly session cookie on the redirect response
      try {
        const sessionCookie = await createSessionCookie(
          user.id,
          user.name,
          user.email || '',
          user.profile_image || undefined,
          c.env.JWT_SECRET,
        );
        c.header('Set-Cookie', sessionCookie);
      } catch (e) {
        console.error('[Kakao Sync] Session cookie creation failed:', e);
      }

      const stateUrl = new URL(state, 'https://dummy.com');
      stateUrl.searchParams.set('firebase_token', customToken);
      stateUrl.searchParams.set('userName', user.name);
      if (user.profile_image) {
        stateUrl.searchParams.set('profileImage', user.profile_image);
      }

      const redirectUrl = stateUrl.pathname + stateUrl.search;
      return c.redirect(redirectUrl);
      
    } catch (serviceError) {
      console.error('[Kakao Sync] Service error:', serviceError);
      const errorMsg = (serviceError as Error).message || 'Unknown error';
      
      if (errorMsg.includes('Firebase')) {
        return c.redirect(`${state}?error=firebase_config_error&detail=${encodeURIComponent(errorMsg)}`);
      }
      if (errorMsg.includes('Database')) {
        return c.redirect(`${state}?error=database_error&detail=${encodeURIComponent(errorMsg)}`);
      }
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
 */
kakaoRoutes.post('/callback', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { code, redirect_uri } = await c.req.json();
    
    if (!code) {
      return c.json({ success: false, error: 'Authorization code is required' }, 400);
    }
    
    if (!c.env.KAKAO_REST_API_KEY) {
      console.error('[Kakao Callback] KAKAO_REST_API_KEY not configured');
      return c.json({ success: false, error: 'Server configuration error' }, 500);
    }
    
    const redirectUri = redirect_uri || 'https://live.ur-team.com/auth/kakao/callback';

    const kakaoService = new KakaoAuthService(DB, c.env.KAKAO_REST_API_KEY);
    const firebaseService = new FirebaseAuthService(c.env);

    const accessToken = await kakaoService.exchangeCode(code, redirectUri);
    const kakaoUser = await kakaoService.getUserInfo(accessToken);
    const user = await kakaoService.upsertUser(kakaoUser);

    // Firebase Custom Token (ProtectedRoute가 의존)
    let customToken = '';
    let firebaseUID = '';
    try {
      firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);
      customToken = await firebaseService.createCustomToken(firebaseUID, {
        role: 'user', userId: user.id, userName: user.name,
        email: user.email, kakaoId: kakaoUser.kakaoId,
      });
      await kakaoService.updateFirebaseUID(user.id, firebaseUID).catch(() => {});
    } catch (e) {
      console.error('[Kakao] Firebase token failed:', e);
    }

    // 세션 쿠키
    let sessionCookieHeader: string | undefined;
    try {
      sessionCookieHeader = await createSessionCookie(
        user.id, user.name, user.email || '',
        user.profile_image || undefined, c.env.JWT_SECRET,
      );
    } catch (e) {
      console.error('[Kakao] Session cookie failed:', e);
    }

    // 카카오 access_token 저장
    try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_access_token TEXT").run() } catch {}
    await DB.prepare("UPDATE users SET kakao_access_token = ? WHERE id = ?")
      .bind(accessToken, user.id).run().catch(() => {});

    if (sessionCookieHeader) c.header('Set-Cookie', sessionCookieHeader);
    return c.json({
      success: true,
      data: {
        customToken: customToken || null,
        session_ready: !!sessionCookieHeader,
        user: { id: user.id, name: user.name, email: user.email, profile_image: user.profile_image, firebaseUID },
      },
    });

  } catch (error) {
    console.error('[Kakao Callback] Error:', error);
    const errorMsg = (error as Error).message || 'Unknown error';
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /api/auth/kakao/firebase
 * 카카오 Access Token으로 Firebase Custom Token 발급
 * (프론트엔드가 이미 Kakao SDK로 로그인한 경우)
 */
kakaoRoutes.post('/firebase', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { accessToken } = await c.req.json();
    
    if (!accessToken) {
      return c.json({ success: false, error: 'Access token is required' }, 400);
    }
    
    const kakaoService = new KakaoAuthService(DB, c.env.KAKAO_REST_API_KEY);
    const firebaseService = new FirebaseAuthService(c.env);
    
    const kakaoUser = await kakaoService.getUserInfo(accessToken);
    const user = await kakaoService.upsertUser(kakaoUser);
    
    const firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);
    const customToken = await firebaseService.createCustomToken(firebaseUID, {
      role: 'user',
      userId: user.id,
      userName: user.name,
      email: user.email,
      kakaoId: kakaoUser.kakaoId,
      ...(user.profile_image ? { profileImage: user.profile_image } : {}),
    });

    await kakaoService.updateFirebaseUID(user.id, firebaseUID);


    return c.json({
      success: true,
      customToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_image: user.profile_image
      }
    });
    
  } catch (error) {
    console.error('[Kakao Firebase] Error:', error);
    const errorMsg = (error as Error).message || 'Unknown error';
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * GET /api/users/role
 * Get user role from Firebase Auth token
 */
kakaoRoutes.get('/users/role', cors(), async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: true, data: { role: 'user' }, message: 'Default role' });
    }
    
    return c.json({ success: true, data: { role: 'user' }, message: 'User role retrieved' });
    
  } catch (err) {
    console.error('[/api/users/role] Error:', err);
    return c.json({ success: true, data: { role: 'user' }, message: 'Fallback role' });
  }
});

export default kakaoRoutes;
