/**
 * CSRF (Cross-Site Request Forgery) Protection
 * 
 * 토큰 기반 CSRF 보호 구현
 * - 세션별 고유 토큰 생성
 * - 요청 시 토큰 검증
 * - Double Submit Cookie 패턴 사용
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

/**
 * CSRF 토큰 검증
 */
export function verifyCsrfToken(
  tokenFromHeader: string | undefined,
  tokenFromCookie: string | undefined
): boolean {
  // 토큰이 없으면 실패
  if (!tokenFromHeader || !tokenFromCookie) {
    return false;
  }

  // Double Submit Cookie 패턴: 헤더와 쿠키의 토큰이 일치해야 함
  return tokenFromHeader === tokenFromCookie;
}

/**
 * CSRF 토큰을 쿠키에 설정
 */
export function setCsrfCookie(c: Context, token: string): void {
  // SameSite=Strict for CSRF protection
  // Secure flag는 HTTPS에서만 활성화
  c.header('Set-Cookie', 
    `csrf_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${
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

      const data = await response.json() as any;
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
