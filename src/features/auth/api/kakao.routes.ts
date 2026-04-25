/**
 * Kakao OAuth 2.0 API Routes
 * 
 * Endpoints:
 * - GET  /auth/kakao/sync/callback - 카카오싱크 OAuth 콜백
 * - POST /api/auth/kakao/callback  - 카카오 로그인 콜백 (REST API)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign as jwtSign } from 'hono/jwt';
import { KakaoAuthService } from '../services/KakaoAuthService';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { createSessionCookie } from '../../../worker/utils/session';
import { encryptAtRest } from '../../../worker/utils/data-crypto';
import type { AuthResponse, KakaoLoginResponse } from '../types';
import { logWarn } from '@/worker/utils/logger';

/**
 * 카카오 로그인 완료 시 linked seller / agency 있으면 자동 JWT 발급.
 * - seller: sellers.linked_user_id = user.id AND status IN ('active', 'approved')
 *   ('approved' 는 레거시 승인 상태. 어드민 승인 플로우가 approved 를 세팅.)
 * - agency: agencies.linked_user_id = user.id AND status IN ('active', 'approved')
 * Pending/suspended 는 토큰 발급 안 함 (승인 대기).
 */
async function issueLinkedRoleTokens(
  DB: D1Database,
  jwtSecret: string,
  userId: number
): Promise<{ seller_token?: string; agency_token?: string; seller?: { id: number; status: string; business_name?: string }; agency?: { id: number; status: string; name?: string } }> {
  const out: { seller_token?: string; agency_token?: string; seller?: any; agency?: any } = {}
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 7 * 24 * 60 * 60

  // ⚡ 병렬 조회: seller + agency SELECT 를 동시에 실행해 1개 D1 RTT 절약
  const [sellerRow, agencyRow] = await Promise.allSettled([
    DB.prepare(
      'SELECT id, status, business_name, email, name, seller_type FROM sellers WHERE linked_user_id = ?'
    ).bind(userId).first<{ id: number; status: string; business_name: string; email: string; name: string; seller_type: string }>(),
    DB.prepare(
      'SELECT id, status, name, email, contact_name FROM agencies WHERE linked_user_id = ?'
    ).bind(userId).first<{ id: number; status: string; name: string; email: string; contact_name: string }>(),
  ])

  if (sellerRow.status === 'fulfilled' && sellerRow.value) {
    const seller = sellerRow.value
    out.seller = { id: seller.id, status: seller.status, business_name: seller.business_name }
    // 레거시 호환: 'approved' 도 active 와 동등하게 취급 (구 승인 데이터)
    if (seller.status === 'active' || seller.status === 'approved') {
      out.seller_token = await jwtSign({
        sub: String(seller.id), seller_id: seller.id, email: seller.email,
        name: seller.name, type: 'seller',
        seller_type: seller.seller_type || 'influencer', iat: now, exp,
      }, jwtSecret)
    }
  }

  if (agencyRow.status === 'fulfilled' && agencyRow.value) {
    const agency = agencyRow.value
    out.agency = { id: agency.id, status: agency.status, name: agency.name }
    // 레거시 호환: 에이전시 로그인 엔드포인트(agency.routes.ts) 가 'approved' 도 허용
    if (agency.status === 'active' || agency.status === 'approved') {
      out.agency_token = await jwtSign({
        sub: String(agency.id), agency_id: agency.id, email: agency.email,
        name: agency.name, contact_name: agency.contact_name, type: 'agency', iat: now, exp,
      }, jwtSecret)
    }
  }

  return out
}

type Bindings = {
  DB: D1Database;
  KAKAO_REST_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL?: string;
  DATA_ENCRYPTION_KEY?: string;
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
function parseStateCookie(value: string | null): { state: string; redirect: string; intent: 'user' | 'seller' | 'agency' } | null {
  if (!value) return null;
  const parts = value.split('|');
  // 구버전 호환: 2개(state|redirect) 또는 3개(state|redirect|intent) 모두 허용
  if (parts.length < 2 || parts.length > 3) return null;
  const [state, encoded, intentRaw] = parts;
  if (!state || !encoded) return null;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
    const redirect = decodeURIComponent(atob(padded));
    const intent = (intentRaw === 'seller' || intentRaw === 'agency') ? intentRaw : 'user';
    return { state, redirect: safeRedirect(redirect), intent };
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
  // intent: 'seller' | 'agency' | 'user'
  //   - seller: 셀러 등록/대시보드 진입 의도 → linked seller 없으면 /seller/register/business 로
  //   - agency: 에이전시 등록/대시보드 진입 의도
  //   - user (default): 일반 유저 로그인
  const intentRaw = c.req.query('intent') || 'user';
  const intent = (intentRaw === 'seller' || intentRaw === 'agency') ? intentRaw : 'user';

  const kakaoRestKey = c.env.KAKAO_REST_API_KEY;
  if (!kakaoRestKey) {
    return c.json({ success: false, error: 'Kakao not configured' }, 500);
  }

  const state = crypto.randomUUID();
  const b64Redirect = btoa(encodeURIComponent(redirect))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  // state|redirect|intent
  const cookieValue = `${state}|${b64Redirect}|${intent}`;

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
  let intent: 'user' | 'seller' | 'agency' = 'user';
  if (stateCookie) {
    redirectTarget = stateCookie.redirect;
    intent = stateCookie.intent;
    stateMatched = !!receivedState && receivedState === stateCookie.state;
  } else {
    redirectTarget = safeRedirect(receivedState);
  }

  try {
    const code = c.req.query('code');
    const error = c.req.query('error');

    if (error) {
      if (import.meta.env.DEV) console.error('[Kakao Sync] OAuth error:', error);
      c.header('Set-Cookie', clearStateCookieHeader());
      return c.redirect(`${redirectTarget}?error=kakao_oauth_${error}`);
    }

    if (!code) {
      if (import.meta.env.DEV) console.error('[Kakao Sync] No authorization code');
      c.header('Set-Cookie', clearStateCookieHeader());
      return c.redirect(`${redirectTarget}?error=no_code`);
    }

    // If a state cookie exists but doesn't match, reject (CSRF guard)
    if (stateCookie && !stateMatched) {
      if (import.meta.env.DEV) console.error('[Kakao Sync] OAuth state mismatch');
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
      const user = await kakaoService.upsertUser(kakaoUser);

      const firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);

      // ⚡ 성능: Firebase customToken 생성(느린 crypto) 과 DB 업데이트를 병렬 실행.
      //    또한 firebase_uid + kakao tokens 를 한 번의 UPDATE 로 묶어 D1 RTT 1회 절약.
      await ensureKakaoColumns(DB);
      const kek = c.env.DATA_ENCRYPTION_KEY;

      const [customToken, encAccess, encRefresh] = await Promise.all([
        firebaseService.createCustomToken(firebaseUID, {
          role: 'user',
          userId: user.id,
          userName: user.name,
          email: user.email,
          kakaoId: kakaoUser.kakaoId,
          ...(user.profile_image ? { profileImage: user.profile_image } : {}),
        }),
        encryptAtRest(accessToken, kek),
        kakaoRefreshToken ? encryptAtRest(kakaoRefreshToken, kek) : Promise.resolve(null),
      ]);

      // 🛡️ 2026-04-22: at-rest 암호화 — DB 탈취 시 Kakao 세션 즉시 악용 방어
      // firebase_uid + kakao tokens 통합 업데이트 (firebase_uid 컬럼 없으면 조용히 skip)
      try {
        await DB.prepare(
          "UPDATE users SET firebase_uid = ?, kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?"
        ).bind(firebaseUID, encAccess, encRefresh, user.id).run();
      } catch (e) {
        // firebase_uid 컬럼 없는 구버전 환경 fallback
        if (import.meta.env.DEV) console.warn('[Kakao Sync] Combined update failed, falling back:', e);
        await DB.prepare(
          "UPDATE users SET kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?"
        ).bind(encAccess, encRefresh, user.id).run();
      }

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
        if (import.meta.env.DEV) console.error('[Kakao Sync] Session cookie creation failed:', e);
      }

      // 🛡️ linked seller/agency JWT 자동 발급 → 프론트엔드 localStorage 로 이전하도록 transfer cookie
      let linkedRoles: Awaited<ReturnType<typeof issueLinkedRoleTokens>> = {};
      try {
        linkedRoles = await issueLinkedRoleTokens(DB, c.env.JWT_SECRET, user.id);
        // JS-readable cookie (HttpOnly 없음) — 프론트엔드 페이지 로드 시 즉시 읽어서 localStorage 로 이동 후 삭제
        // 60초 만료 — 짧은 윈도우로 XSS 노출 최소화
        if (linkedRoles.seller_token) {
          c.header('Set-Cookie',
            `ur_pending_seller_token=${linkedRoles.seller_token}; Path=/; Max-Age=60; SameSite=Lax; Secure`,
            { append: true });
          if (linkedRoles.seller) {
            c.header('Set-Cookie',
              `ur_pending_seller_info=${encodeURIComponent(JSON.stringify({ id: linkedRoles.seller.id, business_name: linkedRoles.seller.business_name || '' }))}; Path=/; Max-Age=60; SameSite=Lax; Secure`,
              { append: true });
          }
        }
        if (linkedRoles.agency_token) {
          c.header('Set-Cookie',
            `ur_pending_agency_token=${linkedRoles.agency_token}; Path=/; Max-Age=60; SameSite=Lax; Secure`,
            { append: true });
          if (linkedRoles.agency) {
            c.header('Set-Cookie',
              `ur_pending_agency_info=${encodeURIComponent(JSON.stringify({ id: linkedRoles.agency.id, name: linkedRoles.agency.name || '' }))}; Path=/; Max-Age=60; SameSite=Lax; Secure`,
              { append: true });
          }
        }
      } catch (e) {
        // Cloudflare Workers observability 에서 잡히도록 프로덕션에서도 로깅.
        // 실패해도 smart redirect 로 /seller/waiting 등으로 보내지므로 치명적이지 않음.
        logWarn('kakao.sync.linkedRoleTokensFailed', { error: (e as Error)?.message });
      }

      // 🚦 Smart redirect — intent(seller/agency) 와 linked role 상태별 라우팅.
      //   1) intent=seller
      //      - linked seller 없음 → /seller/register/business?from=kakao
      //      - status=pending → /seller/waiting
      //      - status=active → 그대로 (/seller)
      //   2) intent=agency — 동일 패턴
      //   3) intent=user — 원래 redirectTarget 유지
      if (intent === 'seller') {
        if (!linkedRoles.seller) {
          redirectTarget = '/seller/register/business?from=kakao';
        } else if (linkedRoles.seller.status === 'pending') {
          redirectTarget = '/seller/waiting';
        } else if (linkedRoles.seller.status !== 'active') {
          // rejected/suspended 등 → waiting 페이지에서 상태 표시
          redirectTarget = '/seller/waiting';
        }
        // active 는 원래 redirectTarget (보통 /seller) 유지
      } else if (intent === 'agency') {
        if (!linkedRoles.agency) {
          redirectTarget = '/agency/register/business?from=kakao';
        } else if (linkedRoles.agency.status === 'pending') {
          redirectTarget = '/agency/waiting';
        } else if (linkedRoles.agency.status !== 'active') {
          redirectTarget = '/agency/waiting';
        }
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
      if (import.meta.env.DEV) console.error('[Kakao Sync] Service error:', serviceError);
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
    if (import.meta.env.DEV) console.error('[Kakao Sync] Unexpected error:', error);
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
      if (import.meta.env.DEV) console.error('[Kakao Callback] KAKAO_REST_API_KEY not configured');
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

    const firebaseUID = FirebaseAuthService.getKakaoFirebaseUID(kakaoUser.kakaoId);

    // ⚡ 병렬 실행: Firebase customToken 생성(느린 crypto) + at-rest 암호화를 동시에.
    await ensureKakaoColumns(DB);
    const kek2 = c.env.DATA_ENCRYPTION_KEY;
    const [customToken, encAccess2, encRefresh2] = await Promise.all([
      firebaseService.createCustomToken(firebaseUID, {
        role: 'user', userId: user.id, userName: user.name,
        email: user.email, kakaoId: kakaoUser.kakaoId,
        ...(user.profile_image ? { profileImage: user.profile_image } : {}),
      }),
      encryptAtRest(accessToken, kek2),
      kakaoRefreshToken2 ? encryptAtRest(kakaoRefreshToken2, kek2) : Promise.resolve(null),
    ]);

    // firebase_uid + kakao tokens 통합 UPDATE (updateFirebaseUID 별도 RTT 제거)
    await DB.prepare(
      "UPDATE users SET firebase_uid = ?, kakao_access_token = ?, kakao_refresh_token = COALESCE(?, kakao_refresh_token) WHERE id = ?"
    ).bind(firebaseUID, encAccess2, encRefresh2, user.id).run();

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
      if (import.meta.env.DEV) console.error('[Kakao Callback] Session cookie creation failed:', e);
    }

    // 🛡️ linked seller / agency 자동 JWT 발급
    const linkedRoles = await issueLinkedRoleTokens(DB, c.env.JWT_SECRET, user.id);

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
        },
        // 카카오 계정에 연결된 셀러/에이전시 권한이 있으면 같이 전달
        ...(linkedRoles.seller_token ? { seller_token: linkedRoles.seller_token } : {}),
        ...(linkedRoles.agency_token ? { agency_token: linkedRoles.agency_token } : {}),
        ...(linkedRoles.seller ? { seller: linkedRoles.seller } : {}),
        ...(linkedRoles.agency ? { agency: linkedRoles.agency } : {}),
      },
      message: 'Login successful'
    };

    if (sessionCookieHeader) {
      c.header('Set-Cookie', sessionCookieHeader);
    }
    return c.json(responseBody);

  } catch (error) {
    if (import.meta.env.DEV) console.error('[Kakao Callback] Error:', error);
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
    if (import.meta.env.DEV) console.error('[Kakao Firebase] Error:', error);
    const errorMsg = (error as Error).message || 'Unknown error';
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

// NOTE: A legacy `/users/role` route previously lived here that returned
// `{role:'user'}` without verifying the caller's token. It was a security
// smell (misleading callers into thinking role was verified) and has been
// removed. Real role resolution lives in `/api/users/role` (usersRouter).

// NOTE: 과거에 있던 POST /api/auth/kakao/stepup-callback 엔드포인트는 제거됨 (2026-04-24).
//  - 실제 step-up 인증은 /api/seller/request-kakao-stepup, /api/agency/request-kakao-stepup 에서
//    이미 세션 쿠키 기반으로 안전하게 처리 (seller-pin.routes.ts, agency-pin.routes.ts).
//  - 이 엔드포인트는 프론트에서 호출되지 않는 dead code 였고, cors() 허용 + state 미검증으로
//    공격 표면만 늘려서 제거함.

export default kakaoRoutes;
