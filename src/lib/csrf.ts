/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * 토큰 기반 CSRF 보호 구현
 * - 세션별 고유 토큰 생성
 * - 요청 시 토큰 검증
 * - Double Submit Cookie 패턴 사용
 *
 * ⚠️ KNOWN LIMITATION — Double Submit without session binding:
 *    The plain Double Submit Cookie pattern only verifies that the header
 *    value matches the cookie value. If an attacker controls any subdomain
 *    (e.g. compromised blog.example.com) they can SET the csrf_token cookie
 *    on the parent domain and then forge requests — their chosen cookie
 *    value will match their chosen header value.
 *
 *    Mitigations in place:
 *      1. SameSite=Strict on the cookie (blocks most cross-site sends).
 *      2. Bearer-token requests skip CSRF (Authorization header can't be set
 *         cross-origin without CORS pre-flight).
 *
 *    For stronger protection use `generateSignedCsrfToken(sessionId, secret)`
 *    and `verifySignedCsrfToken(...)` below, which HMAC-bind the token to a
 *    server-side session identifier. Migration is tracked as a follow-up.
 */

import { Context } from 'hono';

/**
 * CSRF 토큰 생성
 * 암호학적으로 안전한 랜덤 문자열 생성
 */
export function generateCsrfToken(): string {
  // 32바이트 랜덤 데이터 생성 (256비트)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Base64 URL-safe 인코딩
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ──────────────────────────────────────────────────────────────
// Session-bound (HMAC) CSRF tokens
// ──────────────────────────────────────────────────────────────
//
// Format: base64url(random16).base64url(HMAC-SHA256(secret, sessionId))
//
// Attacker cannot forge a valid second half without the server secret, so
// even if they force-set the csrf_token cookie from a subdomain, the HMAC
// portion will still be bound to the ACTUAL session (which they don't have).

function b64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function hmacSessionId(sessionId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sessionId));
  return b64urlEncode(new Uint8Array(sig));
}

/**
 * Generate a CSRF token bound (via HMAC) to the server-side session.
 * Defends against subdomain cookie-forcing attacks that defeat plain
 * Double-Submit.
 */
export async function generateSignedCsrfToken(
  sessionId: string,
  secret: string,
): Promise<string> {
  if (!sessionId || !secret) {
    throw new Error('generateSignedCsrfToken: sessionId and secret are required');
  }
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const randPart = b64urlEncode(rand);
  const sigPart = await hmacSessionId(sessionId, secret);
  return `${randPart}.${sigPart}`;
}

/**
 * Verify a session-bound CSRF token. Returns true only if the signature
 * part was produced by our server (via `secret`) for this exact `sessionId`.
 */
export async function verifySignedCsrfToken(
  token: string | undefined,
  sessionId: string,
  secret: string,
): Promise<boolean> {
  if (!token || !sessionId || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [, providedSig] = parts;
  const expectedSig = await hmacSessionId(sessionId, secret);
  return timingSafeEqualStr(providedSig, expectedSig);
}

/** Constant-time string comparison to avoid timing leaks on token check. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * CSRF 토큰 검증 (Double Submit Cookie)
 * 헤더와 쿠키의 토큰이 constant-time으로 정확히 일치해야 통과.
 */
export function verifyCsrfToken(
  tokenFromHeader: string | undefined,
  tokenFromCookie: string | undefined
): boolean {
  if (!tokenFromHeader || !tokenFromCookie) {
    return false;
  }
  return timingSafeEqualStr(tokenFromHeader, tokenFromCookie);
}

/**
 * CSRF 토큰을 쿠키에 설정
 *
 * ⚠️ HttpOnly 금지: Double Submit Cookie 패턴은 JS가 쿠키를 읽어
 *    X-CSRF-Token 헤더에 복사해야 동작함. HttpOnly면 JS가 못 읽어서 무용지물.
 *    대신 SameSite=Strict + Secure 로 방어.
 */
export function setCsrfCookie(c: Context, token: string): void {
  c.header('Set-Cookie',
    `csrf_token=${token}; Path=/; SameSite=Strict; Max-Age=86400${
      c.req.url.startsWith('https') ? '; Secure' : ''
    }`
  );
}

/**
 * CSRF 미들웨어 생성
 * 
 * @param options 설정 옵션
 * @returns Hono 미들웨어
 */
export function csrfProtection(options?: {
  /** CSRF 보호를 적용할 HTTP 메서드 (기본: POST, PUT, DELETE, PATCH) */
  methods?: string[];
  /** CSRF 보호를 건너뛸 경로 패턴 */
  skipPaths?: RegExp[];
  /** 토큰 헤더 이름 (기본: X-CSRF-Token) */
  headerName?: string;
  /** 쿠키 이름 (기본: csrf_token) */
  cookieName?: string;
}) {
  const {
    methods = ['POST', 'PUT', 'DELETE', 'PATCH'],
    skipPaths = [],
    headerName = 'X-CSRF-Token',
    cookieName = 'csrf_token'
  } = options || {};

  return async (c: Context, next: () => Promise<void>) => {
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;

    // GET, HEAD, OPTIONS는 CSRF 보호 불필요
    if (!methods.includes(method)) {
      return next();
    }

    // 특정 경로는 건너뛰기
    if (skipPaths.some(pattern => pattern.test(path))) {
      return next();
    }

    // ── Bearer 토큰 인증 요청은 CSRF 불필요 ────────────────────
    // 공격자가 cross-origin에서 Authorization 헤더를 못 세팅하므로
    // CSRF 위협이 성립하지 않음. 쿠키 기반 인증일 때만 검증.
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    // 토큰 추출
    const tokenFromHeader = c.req.header(headerName);
    const cookies = c.req.header('Cookie');
    const tokenFromCookie = cookies
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${cookieName}=`))
      ?.split('=')[1];

    // 토큰 검증
    if (!verifyCsrfToken(tokenFromHeader, tokenFromCookie)) {
      return c.json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF token validation failed. Please refresh the page and try again.'
        }
      }, 403);
    }

    return next();
  };
}

/**
 * CSRF 토큰 발급 엔드포인트 핸들러
 * 
 * 프론트엔드에서 GET /api/csrf-token을 호출하여 토큰 획득
 */
export function csrfTokenHandler(c: Context) {
  const token = generateCsrfToken();
  setCsrfCookie(c, token);

  return c.json({
    success: true,
    data: {
      token,
      expiresIn: 86400 // 24시간 (초)
    }
  });
}

/**
 * 프론트엔드용 CSRF 토큰 가져오기 유틸리티
 * 
 * 사용 예시:
 * ```typescript
 * import { getCsrfToken } from '@/lib/csrf-client';
 * 
 * const token = await getCsrfToken();
 * fetch('/api/orders', {
 *   method: 'POST',
 *   headers: {
 *     'X-CSRF-Token': token,
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify(data)
 * });
 * ```
 */
export const csrfClient = {
  /**
   * 서버에서 CSRF 토큰 가져오기
   */
  async getToken(): Promise<string | null> {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include' // 쿠키 포함
      });

      if (!response.ok) {
        console.error('Failed to get CSRF token:', response.status);
        return null;
      }

      const data = await response.json() as { data?: { token?: string } };
      return data.data?.token || null;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      return null;
    }
  },

  /**
   * 쿠키에서 CSRF 토큰 읽기
   */
  getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf_token') {
        return value;
      }
    }
    return null;
  }
};
