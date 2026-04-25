import { Context, Next } from 'hono';

/**
 * 보안 응답 헤더 추가:
 *  - X-Content-Type-Options: nosniff (MIME sniffing 방지)
 *  - X-Frame-Options: DENY (clickjacking 방지)
 *  - Referrer-Policy: strict-origin-when-cross-origin (referrer 누출 최소화)
 *  - Strict-Transport-Security: HSTS 1년 (HTTPS 강제)
 *  - Permissions-Policy: 위치/카메라/마이크 등 기본 차단
 *
 * CSP 는 별도 설정 (worker/index.ts 에 있는 경우 그대로 유지).
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // API 응답에만 적용 (HTML 응답에는 영향 최소화)
    const ct = c.res.headers.get('Content-Type') || '';

    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HTML 이 아닌 경우만 X-Frame-Options DENY (HTML 은 페이지 중첩 가능성 고려)
    if (!ct.includes('text/html')) {
      c.res.headers.set('X-Frame-Options', 'DENY');
    } else {
      c.res.headers.set('X-Frame-Options', 'SAMEORIGIN');
    }

    // HSTS - max-age 1년, includeSubDomains
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Permissions Policy - 위치/카메라/마이크 기본 차단
    c.res.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=(self)');
  };
}
