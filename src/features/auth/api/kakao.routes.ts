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
  FRONTEND_URL?: string;
};

export const kakaoRoutes = new Hono<{ Bindings: Bindings }>();

// ────────────────────────────────────────────────────────────
// OAuth state & redirect path safety helpers (CSRF / open redirect)
// ────────────────────────────────────────────────────────────

const OAUTH_STATE_COOKIE = 'kakao_oauth_state';

/**
 * Only accept internal paths as redirect target:
 *  - must start with "/"
 *  - must NOT start with "//" (protocol-relative URL)
 */
function safeRedirect(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  if (path.includes('\\')) return '/';
  return path;
}

/** Extract a named cookie value from a Cookie header string. */
function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

/**
 * Parse the oauth state cookie: "<state>|<base64url(redirectPath)>"
 * The redirect path is sanitized before use.
 */
function parseStateCookie(value: string | null): { state: string; redirect: string } | null {
  if (!value) return null;
  const parts = value.split('|');
  if (parts.length !== 2) return null;
  const [state, encoded] = parts;
  if (!state || !encoded) return null;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    const redirect = decodeURIComponent(atob(padded));
    return { state, redirect: safeRedirect(redirect) };
  } catch {
    return null;
  }
}

/** Clear the oauth state cookie. */
function clearStateCookieHeader(): string {
  return `${OAUTH_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * GET /auth/kakao/start?redirect=/path
 * Initiates OAuth: generates random state, stores signed short-lived cookie,
 * and redirects to Kakao authorize URL. This is the CSRF-safe entry point.
 */
kakaoRoutes.get('/start', async (c) => {
  const redirectRaw = c.req.query('redirect') || '/';
  const redirect = safeRedirect(redirectRaw);

  const kakaoRestKey = c.env.KAKAO_REST_API_KEY;
  if (!kakaoRestKey) {
    return c.json({ success: false, error: 'Kakao not configured' }, 500);
  }

  const state = crypto.randomUUID();
  const b64Redirect = btoa(encodeURIComponent(redirect))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const cookieValue = `${state}|${b64Redirect}`;

  c.header(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/auth/kakao/sync/callback`;
  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  authUrl.searchParams.set('client_id', kakaoRestKey);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  return c.redirect(authUrl.toString(), 302);
});

/**
 * GET /auth/kakao/sync/callback
 * 카카오싱크 OAuth 리다이렉트 콜백
 */
kakaoRoutes.get('/sync/callback', async (c) => {
  const { DB } = c.env;

  // Extract & verify OAuth state (CSRF protection) ─────────────
  const receivedState = c.req.query('state') || '';
  const cookieHeader = c.req.header('Cookie') || '';
  const stateCookie = parseStateCookie(readCookie(cookieHeader, OAUTH_STATE_COOKIE));

  // Resolve redirect target: only trust the path stored in our signed cookie.
  // Backward compat: if no cookie (legacy frontend flow), accept a sanitized
  // internal path from the ?state= param. Never blindly use raw state.
  let redirectTarget = '/';
  let stateMatched = false;
  if (stateCookie) {
    redirectTarget = stateCookie.redirect;
    stateMatched = !!receivedState && receivedState === stateCookie.state;
  } else {
    redirectTarget = safeRedirect(receivedState);
  }

  try {
    const code = c.req.query('code');
    const error = c.req.query('error');

    if (error) {
      console.error('[Kakao Sync] OAuth error:', error);
      c.header('Set-Cookie', clearStateCookieHeader());
      return c.redirect(`${redirectTarget}?error=kakao_oauth_${error}`);
    }

    if (!code) {
      console.error('[Kakao Sync] No authorization code');
      c.header('Set-Cookie', clearStateCookieHeader());
      return c.redirect(`${redirectTarget}?error=no_code`);
    }

    // If a state cookie exists but doesn't match, reject (CSRF guard)
    if (stateCookie && !stateMatched) {
      console.error('[Kakao Sync] OAuth state mismatch');
      c.header('Set-Cookie', clearStateCookieHeader());
      return c.redirect(`${redirectTarget}?error=oauth_state_mismatch`);
    }
    
    const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;
    
    const kakaoService = new KakaoAuthService(DB, c.env.KAKAO_REST_API_KEY);
    const firebaseService = new FirebaseAuthService(c.env);
    
    try {
      const tokenData = await kakaoService.exchangeCodeFull(code, KAKAO_REDIRECT_URI);
      const accessToken = tokenData.access_token;
      const kakaoRefreshToken = tokenData.refresh_token || null;
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

      // 카카오 access_token + refresh_token 저장 (메시지/캘린더 API용)
      try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_access_token TEXT").run() } catch {}
      try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_refresh_token TEXT").run() } catch {}
      await DB.prepare("UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?")
        .bind(accessToken, kakaoRefreshToken, user.id).run();

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

      const stateUrl = new URL(redirectTarget, 'https://dummy.com');
      // 한국: 세션 쿠키로 인증하므로 firebase_token 불필요
      // 글로벌: Firebase customToken 필요
      const isKR = c.env.FRONTEND_URL?.includes('live.ur-team.com') || c.req.header('host')?.includes('live.ur-team.com');
      if (!isKR) {
        stateUrl.searchParams.set('firebase_token', customToken);
      }
      stateUrl.searchParams.set('login', 'success');
      stateUrl.searchParams.set('userId', String(user.id));
      stateUrl.searchParams.set('userName', user.name);
      if (user.profile_image) {
        stateUrl.searchParams.set('profileImage', user.profile_image);
      }

      const redirectUrl = stateUrl.pathname + stateUrl.search;
      // 302 명시: Set-Cookie 헤더가 일부 브라우저에서 303에 무시되는 문제 회피
      c.header('Set-Cookie', clearStateCookieHeader());
      return c.redirect(redirectUrl, 302);

    } catch (serviceError) {
      console.error('[Kakao Sync] Service error:', serviceError);
      const errorMsg = (serviceError as Error).message || 'Unknown error';
      c.header('Set-Cookie', clearStateCookieHeader());

      if (errorMsg.includes('Firebase')) {
        return c.redirect(`${redirectTarget}?error=firebase_config_error&detail=${encodeURIComponent(errorMsg)}`);
      }
      if (errorMsg.includes('Database')) {
        return c.redirect(`${redirectTarget}?error=database_error&detail=${encodeURIComponent(errorMsg)}`);
      }
      return c.redirect(`${redirectTarget}?error=kakao_auth_failed&detail=${encodeURIComponent(errorMsg)}`);
    }

  } catch (error) {
    console.error('[Kakao Sync] Unexpected error:', error);
    const errorMsg = encodeURIComponent((error as Error).message || 'unknown');
    c.header('Set-Cookie', clearStateCookieHeader());
    return c.redirect(`${redirectTarget}?error=kakao_sync_failed&detail=${errorMsg}`);
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
    
    const tokenData = await kakaoService.exchangeCodeFull(code, redirectUri);
    const accessToken = tokenData.access_token;
    const kakaoRefreshToken2 = tokenData.refresh_token || null;
    const kakaoUser = await kakaoService.getUserInfo(accessToken);
    const user = await kakaoService.upsertUser(kakaoUser);

    // 토큰 저장 (consent callback에서도 갱신)
    try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_access_token TEXT").run() } catch {}
    try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_refresh_token TEXT").run() } catch {}
    await DB.prepare("UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?")
      .bind(accessToken, kakaoRefreshToken2, user.id).run();

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

    // Set httpOnly session cookie for user auth (new flow)
    let sessionCookieHeader: string | undefined;
    try {
      sessionCookieHeader = await createSessionCookie(
        user.id,
        user.name,
        user.email || '',
        user.profile_image || undefined,
        c.env.JWT_SECRET,
      );
    } catch (e) {
      console.error('[Kakao Callback] Session cookie creation failed:', e);
    }

    const responseBody = {
      success: true,
      data: {
        customToken,
        session_ready: !!sessionCookieHeader,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_image: user.profile_image,
          firebaseUID
        }
      },
      message: 'Login successful'
    };

    if (sessionCookieHeader) {
      c.header('Set-Cookie', sessionCookieHeader);
    }
    return c.json(responseBody);

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

// NOTE: A legacy `/users/role` route previously lived here that returned
// `{role:'user'}` without verifying the caller's token. It was a security
// smell (misleading callers into thinking role was verified) and has been
// removed. Real role resolution lives in `/api/users/role` (usersRouter).

export default kakaoRoutes;
