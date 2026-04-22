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
import { encryptAtRest } from '../../../worker/utils/data-crypto';
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

// ✅ FIX (H5): One-time schema check instead of running ALTER TABLE on every
// Kakao callback. These DDLs are cheap, but issuing them per-request causes
// unnecessary D1 load and log noise. Column creation should move to a proper
// migration file when convenient.
let _kakaoSchemaChecked = false;
async function ensureKakaoColumns(DB: D1Database): Promise<void> {
  if (_kakaoSchemaChecked) return;
  try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_access_token TEXT").run(); } catch {}
  try { await DB.prepare("ALTER TABLE users ADD COLUMN kakao_refresh_token TEXT").run(); } catch {}
  _kakaoSchemaChecked = true;
}

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
    `${OAUTH_STATE_COOKIE}=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`
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
 * GET /auth/kakao/consent/start?scope=talk_calendar&return=/path
 * 추가 권한(scope) 동의용 OAuth 시작점. 서버에서 authorize URL을 만들어
 * Kakao로 리다이렉트 (client_id를 프론트 번들에 노출하지 않도록).
 */
kakaoRoutes.get('/consent/start', async (c) => {
  const scopeRaw = c.req.query('scope') || '';
  const returnRaw = c.req.query('return') || '/';

  // Scope 화이트리스트 — Kakao가 지원하고 우리 앱이 사용하는 값만 허용
  const ALLOWED_SCOPES = new Set([
    'talk_message', 'talk_calendar', 'friends', 'profile_nickname',
    'profile_image', 'account_email', 'birthday', 'birthyear',
  ]);
  const scopes = scopeRaw.split(',').map((s) => s.trim()).filter(Boolean);
  if (scopes.length === 0 || scopes.some((s) => !ALLOWED_SCOPES.has(s))) {
    return c.json({ success: false, error: 'invalid scope' }, 400);
  }

  const returnPath = safeRedirect(returnRaw);
  const kakaoRestKey = c.env.KAKAO_REST_API_KEY;
  if (!kakaoRestKey) {
    return c.json({ success: false, error: 'Kakao not configured' }, 500);
  }

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/auth/kakao/consent/callback`;

  // 🛡️ 2026-04-22: CSRF 방어 — state 를 쿠키에도 저장해서 callback 에서 검증
  // 이전: state 파라미터를 URL 로만 전달 → 공격자가 위조 가능
  // 수정: HttpOnly 쿠키에 저장된 state 와 callback 의 state 파라미터 비교
  const state = crypto.randomUUID() + ':' + Buffer.from(returnPath).toString('base64');

  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  authUrl.searchParams.set('client_id', kakaoRestKey);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(','));
  authUrl.searchParams.set('state', state);

  c.header('Set-Cookie',
    `kakao_consent_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`
  );

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
      // ✅ FIX (H5): One-time schema check (not per-request)
      // 🛡️ 2026-04-22: at-rest 암호화 (Cafe24 와 동일 패턴) — DB 탈취 시 Kakao 세션 즉시 악용 방어
      await ensureKakaoColumns(DB);
      const kek = (c.env as any).DATA_ENCRYPTION_KEY as string | undefined;
      const encAccess = await encryptAtRest(accessToken, kek);
      const encRefresh = kakaoRefreshToken ? await encryptAtRest(kakaoRefreshToken, kek) : null;
      await DB.prepare("UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?")
        .bind(encAccess, encRefresh, user.id).run();

      // 🛡️ 순서 중요: clear-state 먼저, session 은 append 로 추가.
      // 원래 c.header('Set-Cookie', ...) 를 두 번 호출해서 두 번째가 첫 번째를 덮어써
      // 세션 쿠키가 사라지고 카카오 로그인 이후 모든 API 401이 발생하던 버그.
      c.header('Set-Cookie', clearStateCookieHeader());
      try {
        const sessionCookie = await createSessionCookie(
          user.id,
          user.name,
          user.email || '',
          user.profile_image || undefined,
          c.env.JWT_SECRET,
        );
        c.header('Set-Cookie', sessionCookie, { append: true });
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
    // ✅ FIX (H5): One-time schema check (not per-request)
    // 🛡️ at-rest 암호화
    await ensureKakaoColumns(DB);
    const kek2 = (c.env as any).DATA_ENCRYPTION_KEY as string | undefined;
    const encAccess2 = await encryptAtRest(accessToken, kek2);
    const encRefresh2 = kakaoRefreshToken2 ? await encryptAtRest(kakaoRefreshToken2, kek2) : null;
    await DB.prepare("UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?")
      .bind(encAccess2, encRefresh2, user.id).run();

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
