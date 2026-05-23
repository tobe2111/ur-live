/**
 * 🛡️ 2026-05-23 Request tracing — 500 발생 시 재현용 데이터 보존.
 *
 * 핵심 endpoint 에 wrapping middleware 로 사용:
 *   - 1% 무작위 샘플링 (정상 응답)
 *   - 500 응답 시 무조건 저장 (샘플링 우회)
 *   - body / headers 마스킹 (토큰/비밀번호 제거)
 *
 * D1 테이블: request_traces (repair-schema 등록)
 */

import type { Context, MiddlewareHandler } from 'hono'

const SAMPLE_RATE = 0.01 // 1%
const MAX_BODY_BYTES = 4000

// 마스킹할 필드 (case-insensitive 포함 검사)
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'api_key',
  'authorization', 'cookie', 'access_token', 'refresh_token',
  'paymentkey', 'paymentKey', 'card_number', 'cvc', 'cvv',
  'phone', 'email', 'resident', 'rrn',
]

function maskValue(v: unknown): unknown {
  if (typeof v === 'string') {
    if (v.length === 0) return v
    if (v.length <= 4) return '***'
    return `${v.slice(0, 2)}***${v.slice(-2)}`
  }
  return '***'
}

function maskDeep(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '...'
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(o => maskDeep(o, depth + 1))
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const lower = k.toLowerCase()
      if (SENSITIVE_FIELDS.some(s => lower.includes(s))) {
        result[k] = maskValue(v)
      } else {
        result[k] = maskDeep(v, depth + 1)
      }
    }
    return result
  }
  return obj
}

function maskBody(body: string): string {
  try {
    const parsed = JSON.parse(body)
    return JSON.stringify(maskDeep(parsed))
  } catch {
    // not JSON — truncate
    return body.slice(0, MAX_BODY_BYTES)
  }
}

interface TraceEnv {
  DB: D1Database
}

/**
 * Request tracing middleware. 사용:
 *   ordersRouter.post('/', tracedEndpoint('orders:create'), rateLimit(...), async (c) => {...})
 *
 * @param name 추적 식별자 (예: 'orders:create', 'group-buy:join')
 */
export function tracedEndpoint(name: string): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()
    const url = c.req.path
    const method = c.req.method
    const userAgent = c.req.header('user-agent')?.slice(0, 150) || ''
    const ip = (c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '').slice(0, 64)

    // body 캡처 (request 만, response 는 별도)
    let bodyStr = ''
    try {
      const ct = c.req.header('content-type') || ''
      if (ct.includes('application/json')) {
        const raw = await c.req.raw.clone().text()
        bodyStr = raw.slice(0, MAX_BODY_BYTES)
      }
    } catch { /* ignore */ }

    await next()

    const status = c.res.status
    const durationMs = Date.now() - start
    const shouldSample = status >= 500 || Math.random() < SAMPLE_RATE
    if (!shouldSample) return

    // 비동기 저장 (응답 차단 X)
    const env = c.env as TraceEnv
    const maskedBody = bodyStr ? maskBody(bodyStr) : ''
    c.executionCtx?.waitUntil?.(
      env.DB.prepare(
        `INSERT INTO request_traces (name, method, path, status, duration_ms, body, user_agent, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).bind(
        name,
        method,
        url.slice(0, 200),
        status,
        durationMs,
        maskedBody.slice(0, MAX_BODY_BYTES),
        userAgent,
        ip,
      ).run().catch(() => null),
    )
  }
}
