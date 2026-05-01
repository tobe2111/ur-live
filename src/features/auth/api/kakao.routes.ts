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
// 🛡️ 2026-05-01: FirebaseAuthService import 제거 — KR Kakao 흐름은 Firebase 0.
import { createSessionCookie } from '@/worker/utils/session';
import { encryptAtRest } from '@/worker/utils/data-crypto';
import type { AuthResponse, KakaoLoginResponse } from '../types';

/**
 * 카카오 로그인 완료 시 linked seller / agency 있으면 자동 JWT 발급.
 * - seller: sellers.linked_user_id = user.id AND status IN ('active', 'approved')
 *   ('approved' 는 레거시 승인 상태. 어드민 승인 플로우가 approved 를 세팅.)
 * - agency: agencies.linked_user_id = user.id AND status = 'active'
 * Pending/suspended 는 토큰 발급 안 함 (승인 대기).
 */
async function issueLinkedRoleTokens(
  DB: D1Database,
  jwtSecret: string,
  userId: number
): Promise<{ seller_token?: string; agency_token?: string; seller?: { id: number; status: string; business_name?: string }; agency?: { id: number; status: string; name?: string } }> {
  const out: { seller_token?: string; agency_token?: string; seller?: any; agency?: any } = {}
  try {
    const seller = await DB.prepare(
      'SELECT id, status, business_name, email, name, seller_type FROM sellers WHERE linked_user_id = ?'
    ).bind(userId).first<{ id: number; status: string; business_name: string; email: string; name: string; seller_type: string }>()
    if (seller) {
      out.seller = { id: seller.id, status: seller.status, business_name: seller.business_name }
      // 레거시 호환: 'approved' 도 active 와 동등하게 취급 (구 승인 데이터)
      if (seller.status === 'active' || seller.status === 'approved') {
        const payload = {
          sub: String(seller.id),
          seller_id: seller.id,
          email: seller.email,
          name: seller.name,
          type: 'seller',
          seller_type: seller.seller_type || 'influencer',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 🛡️ 2026-04-30: 7일 → 30일
        }
        out.seller_token = await jwtSign(payload, jwtSecret)
      }
    }
  } catch { /* sellers 테이블 없거나 linked_user_id 컬럼 없음 — skip */ }

  try {
    const agency = await DB.prepare(
      'SELECT id, status, name, email, contact_name FROM agencies WHERE linked_user_id = ?'
    ).bind(userId).first<{ id: number; status: string; name: string; email: string; contact_name: string }>()
    if (agency) {
      out.agency = { id: agency.id, status: agency.status, name: agency.name }
      if (agency.status === 'active') {
        const payload = {
          sub: String(agency.id),
          agency_id: agency.id,
          email: agency.email,
          name: agency.name,
          contact_name: agency.contact_name,
          type: 'agency',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 🛡️ 2026-04-30: 7일 → 30일
        }
        out.agency_token = await jwtSign(payload, jwtSecret)
      }
    }
  } catch { /* agencies 테이블 없거나 linked_user_id 컬럼 없음 — skip */ }

  return out
}

type Bindings = {
  DB: D1Database;
  KAKAO_REST_API_KEY: string;
  JWT_SECRET: string;
  FRONTEND_URL?: string;
  // 🛡️ 2026-05-01: FIREBASE_* env vars 제거 — KR Kakao 흐름에서 미사용.
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
 *  - must NOT contain "\\" (path traversal)
 *  - must NOT contain control chars (\n, \t, \r, \0)
 *  - must NOT be /login·/auth/*·/oauth/* (자기참조 OAuth hop 루프 방지)
 *
 * 🛡️ 2026-04-29: 프론트엔드 safe-internal-path.ts 와 동일한 규칙. Worker
 *   코드라 import 못 하므로 동일 규칙을 인라인으로 유지. 양쪽 같이 갱신할 것.
 */
function safeRedirect(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  if (path.includes('\\')) return '/';
  if (/[\n\t\r\0]/.test(path)) return '/';
  // 🛡️ 2026-05-01: query string / hash 제거 — 사용자 신고: 에러 URL 누적 (?error=...?error=...)
  //   redirect 대상은 pathname only. ?error=, ?login=success 등은 worker 가 새로 부착.
  const queryIdx = path.search(/[?#]/);
  if (queryIdx >= 0) path = path.slice(0, queryIdx);
  if (!path) return '/';
  const FORBIDDEN = ['/login', '/seller/login', '/admin/login', '/agency/login', '/auth/', '/oauth/'];
  for (const prefix of FORBIDDEN) {
    if (prefix.endsWith('/')) {
      if (path.startsWith(prefix)) return '/';
    } else {
      if (path === prefix || path.startsWith(prefix + '?') || path.startsWith(prefix + '/') || path.startsWith(prefix + '#')) {
        return '/';
      }
    }
  }
  return path;
}

// 🧪 단위 테스트용 export — frontend safeInternalPath 와 양쪽 일관성 검증
export { safeRedirect as __safeRedirectForTest };

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
  // 🛡️ 2026-05-01: prompt=login 강제 — 디바이스에 이미 다른 사용자의 카카오 세션이
  //   있을 경우 자동 로그인 방지 (사용자 신고: "다른 사람 폰에서 로그인했는데 그 사람
  //   계정으로 됨"). 매번 카카오 인증 화면 표시.
  //   ?force_account=1 query 로 명시적으로 끌 수 있게 (단일 사용자 디바이스 UX).
  if (c.req.query('force_account') !== '0') {
    authUrl.searchParams.set('prompt', 'login');
  }

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

  // 🛡️ 2026-05-01: 필수 환경변수 사전 검증 — 미설정 시 명시 에러로 redirect.
  //   silent fail 시 createSessionCookie throw → 무한 로딩 시나리오.
  if (!c.env.JWT_SECRET) {
    if (import.meta.env.DEV) console.error('[Kakao Sync] JWT_SECRET not configured');
    return c.redirect(`/?error=env_missing&detail=JWT_SECRET`);
  }
  if (!c.env.KAKAO_REST_API_KEY) {
    if (import.meta.env.DEV) console.error('[Kakao Sync] KAKAO_REST_API_KEY not configured');
    return c.redirect(`/?error=env_missing&detail=KAKAO_REST_API_KEY`);
  }

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
    // 🛡️ 2026-05-01: Firebase 100% 제거 — 카카오 로그인은 세션 쿠키 인증 only.
    //   사용자 신고: 신규 가입 시 무한 로딩 → 원인은 Firebase 네트워크 hang.
    //   한국·글로벌 모두 customToken 생성 안 함. firebase_token URL 부착 안 함.
    //   글로벌 사용자도 카카오 로그인은 세션 쿠키 / Bearer 토큰만 사용.

    try {
      const tokenData = await kakaoService.exchangeCodeFull(code, KAKAO_REDIRECT_URI);
      const accessToken = tokenData.access_token;
      const kakaoRefreshToken = tokenData.refresh_token || null;
      const kakaoUser = await kakaoService.getUserInfo(accessToken);
      const serviceTerms = await kakaoService.getServiceTerms(accessToken);
      const user = await kakaoService.upsertUser(kakaoUser);

      // 🛡️ 2026-05-01: Firebase 100% 제거 — firebase_uid 컬럼 UPDATE 호출 제거.
      //   (이전 코드가 'kakao_<id>' 를 firebase_uid 에 채웠지만, KR Firebase 미사용이라
      //    의미 없음. production 에 컬럼 없을 수도 있어 제거가 더 안전.)

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
      // 🛡️ 2026-05-01: 세션 쿠키 발급 실패는 fatal — silent fail 하면 무한 로딩.
      //   JWT_SECRET 미설정 / 만료된 secret 등 환경 문제. 명시적 에러로 전환.
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
        const detail = encodeURIComponent((e as Error).message || 'session_cookie_failed');
        return c.redirect(`${redirectTarget}?error=session_cookie_failed&detail=${detail}`, 302);
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
        if (import.meta.env.DEV) console.error('[Kakao Sync] Linked role tokens issuance failed:', e);
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
      // 🛡️ 2026-05-01: Firebase 100% 제거 — 한국·글로벌 모두 세션 쿠키 인증 only.
      //   firebase_token URL 부착 안 함 (App.tsx 의 firebase_token branch 는 dead path).
      stateUrl.searchParams.set('login', 'success');
      stateUrl.searchParams.set('userId', String(user.id));
      stateUrl.searchParams.set('userName', user.name);
      if (user.profile_image) {
        stateUrl.searchParams.set('profileImage', user.profile_image);
      }
      // 🛡️ 2026-04-30: 신규 사용자 onboarding 트리거 — 환영 모달 + 카테고리 선택
      const userWithFlag = user as typeof user & { isNewUser?: boolean };
      if (userWithFlag.isNewUser) {
        stateUrl.searchParams.set('new', '1');

        // 🛡️ 2026-05-01: Option B — 같은 카카오로 재가입이면 복원 동의 안내.
        //   30일 내 탈퇴 기록 있으면 'restorable=1&restored_user_id=X' 부착.
        //   프론트가 복원 동의 모달 표시 → 동의 시 /api/account/restore 호출.
        try {
          const restorable = await kakaoService.checkRestorable(kakaoUser.kakaoId);
          if (restorable.isRestorable) {
            stateUrl.searchParams.set('restorable', '1');
            if (restorable.originalName) stateUrl.searchParams.set('originalName', restorable.originalName);
          }
        } catch { /* 복원 체크 실패해도 신규 가입 자체는 진행 */ }
      }

      const redirectUrl = stateUrl.pathname + stateUrl.search;
      // 302 명시: Set-Cookie 헤더가 일부 브라우저에서 303에 무시되는 문제 회피
      return c.redirect(redirectUrl, 302);

    } catch (serviceError) {
      if (import.meta.env.DEV) console.error('[Kakao Sync] Service error:', serviceError);
      const errorMsg = (serviceError as Error).message || 'Unknown error';
      c.header('Set-Cookie', clearStateCookieHeader());

      // 🛡️ 2026-05-01: Firebase 분기 제거 (KR 미사용). Database 만 별도 처리.
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
    // 🛡️ 2026-05-01: Firebase 인스턴스 생성 제거 (Firebase 100% 미사용)
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

    // 🛡️ 2026-05-01: Firebase 100% 제거 — firebase_uid UPDATE 도 제거.
    //   응답 호환성 유지 위해 빈 customToken 만 응답에 포함 (legacy 클라이언트 대응).
    const customToken = '';

    // Set httpOnly session cookie for user auth (new flow)
    // 🛡️ 2026-05-01: 세션 쿠키 발급 실패 = fatal. silent fail 차단.
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
      return c.json({
        success: false,
        error: 'session_cookie_failed',
        detail: (e as Error).message || 'unknown',
      }, 500);
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
          firebaseUID: ''  // 🛡️ legacy field — Firebase 미사용
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

// 🛡️ 2026-05-01: /api/auth/kakao/firebase POST endpoint REMOVED.
//   이 endpoint 는 Kakao SDK access_token 으로 Firebase customToken 을 발급했으나,
//   Firebase 의존성 100% 제거 (2026-05-01) 로 dead path 가 됨.
//   모든 카카오 로그인은 server-side OAuth (/auth/kakao/start → /auth/kakao/callback) 로 통일.
//   세션 쿠키 OR Bearer 토큰만 사용. customToken 생성 안 함.

// NOTE: A legacy `/users/role` route previously lived here that returned
// `{role:'user'}` without verifying the caller's token. It was a security
// smell (misleading callers into thinking role was verified) and has been
// removed. Real role resolution lives in `/api/users/role` (usersRouter).

/**
 * POST /api/auth/kakao/stepup-callback
 * 카카오 재인증 step-up — 민감 액션 전 카카오 로그인을 다시 요구.
 *
 * Flow:
 *  1. 프론트: 민감 액션 프롬프트에서 "카카오 재인증" 선택
 *  2. /auth/kakao/start?redirect=/auth/kakao/stepup&role=seller 로 이동
 *  3. 카카오 OAuth 완료 → code 받음
 *  4. 프론트: 이 엔드포인트로 code + role + role_id 전달
 *  5. 백엔드: 카카오 사용자 검증 + linked role 인지 확인 + 15분 쿠키 발급
 *
 * 쿠키:
 *   ur_kakao_stepup = JWT {
 *     purpose: 'kakao_stepup',
 *     role: 'seller' | 'agency',
 *     seller_id / agency_id: number,
 *     exp: +15min
 *   }
 */
kakaoRoutes.post('/stepup-callback', cors(), async (c) => {
  const { DB } = c.env
  const { code, redirect_uri, role } = await c.req.json<{ code: string; redirect_uri: string; role: 'seller' | 'agency' }>()
  if (!code || !role) return c.json({ success: false, error: 'code + role 필수' }, 400)

  const kakaoKey = c.env.KAKAO_REST_API_KEY
  if (!kakaoKey) return c.json({ success: false, error: '카카오 API 설정 누락' }, 500)

  try {
    const kakaoService = new KakaoAuthService(DB, kakaoKey)
    const tokenData = await kakaoService.exchangeCodeFull(code, redirect_uri)
    const kakaoUser = await kakaoService.getUserInfo(tokenData.access_token)
    const user = await kakaoService.upsertUser(kakaoUser)

    // linked role 검증
    let roleId: number | null = null
    if (role === 'seller') {
      const row = await DB.prepare('SELECT id FROM sellers WHERE linked_user_id = ?')
        .bind(user.id).first<{ id: number }>()
      roleId = row?.id || null
    } else if (role === 'agency') {
      const row = await DB.prepare('SELECT id FROM agencies WHERE linked_user_id = ?')
        .bind(user.id).first<{ id: number }>()
      roleId = row?.id || null
    }
    if (!roleId) {
      return c.json({ success: false, error: `이 카카오 계정에 ${role} 권한이 연동되지 않았습니다.` }, 403)
    }

    // 15분 step-up 토큰 발급
    const { sign } = await import('hono/jwt')
    const payload: Record<string, unknown> = {
      sub: String(user.id),
      purpose: 'kakao_stepup',
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    }
    payload[`${role}_id`] = roleId
    const stepupToken = await sign(payload, c.env.JWT_SECRET)

    c.header('Set-Cookie', `ur_kakao_stepup=${stepupToken}; Path=/; Max-Age=900; SameSite=Lax; Secure; HttpOnly`)
    return c.json({ success: true, message: '카카오 재인증 완료. 15분간 민감 액션 사용 가능.' })
  } catch (error) {
    if (import.meta.env.DEV) console.error('[Kakao stepup] error:', error)
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

export default kakaoRoutes;
