/**
 * 🛡️ 2026-05-15: Double-submit cookie CSRF token middleware.
 *
 * 메커니즘 (stateless, KV/DB 불필요):
 *   1. GET 요청 시 set-cookie 'csrf_token' (HttpOnly=false, Secure, SameSite=Strict, 1h TTL)
 *   2. POST/PATCH/DELETE 시 X-CSRF-Token 헤더 == cookie 값 일치 여부 확인
 *   3. 같은 도메인의 javascript 만 cookie 읽기 가능 → 외부 사이트 forge 불가
 *   4. SameSite=Strict 가 1차 방어, double-submit 가 2차 방어
 *
 * 면제:
 *   - Bearer 토큰 사용 endpoint (Authorization 헤더 → 외부 사이트 자동 첨부 X)
 *   - GET/HEAD/OPTIONS
 *   - webhook (외부 시스템 — signature 검증으로 별도 방어)
 *
 * 사용:
 *   import { csrfGuard, csrfIssue } from '@/worker/middleware/csrf'
 *   app.use('*', csrfIssue())  // 모든 응답에 cookie 발급
 *   app.post('/api/sensitive', csrfGuard(), handler)  // 검증 필요 endpoint
 */

import type { Context, Next, MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'

const COOKIE_NAME = 'csrf_token'
const HEADER_NAME = 'X-CSRF-Token'
const TTL_SEC = 60 * 60  // 1h

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 32)
}

function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('Cookie') || ''
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * GET 응답마다 cookie 발급 (없거나 만료 임박).
 * 글로벌 use 권장.
 */
export function csrfIssue(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    await next()
    const method = c.req.method
    if (method !== 'GET' && method !== 'HEAD') return
    const existing = readCookie(c.req.raw, COOKIE_NAME)
    if (existing && existing.length === 32) return  // 이미 valid
    const token = generateToken()
    const url = new URL(c.req.url)
    const isHttps = url.protocol === 'https:'
    c.header('Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; ` +
      `Path=/; Max-Age=${TTL_SEC}; SameSite=Strict; ` +
      (isHttps ? 'Secure; ' : '') +
      `HttpOnly=false`
    )
  }
}

/**
 * 검증 — POST/PATCH/DELETE/PUT 에서 사용.
 * Bearer 토큰 사용 endpoint 는 자동 면제 (Authorization 헤더 존재 시).
 */
export function csrfGuard(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const method = c.req.method
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return await next()
    }
    // Bearer 토큰 사용 시 면제 (외부 사이트가 Authorization 헤더 자동 첨부 불가)
    const auth = c.req.header('Authorization')
    if (auth && auth.startsWith('Bearer ')) {
      return await next()
    }

    const cookieToken = readCookie(c.req.raw, COOKIE_NAME)
    const headerToken = c.req.header(HEADER_NAME)
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return c.json({
        success: false,
        error: 'CSRF token mismatch',
        code: 'CSRF_INVALID',
      }, 403)
    }
    return await next()
  }
}
