/**
 * 🛡️ 2026-05-23 Frontend 에러 수집 endpoint.
 *
 * POST /api/_errors/log  — sendBeacon 또는 fetch
 *   body: { message, stack?, url, type, user_id?, user_agent }
 *   응답: 204 (No Content) — telemetry 자체가 에러내면 안 됨, 모두 silent OK
 *
 * GET /api/_errors/recent?hours=1  — 어드민만 (최근 에러 목록)
 *
 * D1 테이블: frontend_errors (repair-schema 에서 ensure)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const errorTelemetryRoutes = new Hono<{ Bindings: Env }>()

interface ErrorPayload {
  message?: string
  stack?: string
  url?: string
  type?: string
  user_id?: string | null
  user_agent?: string
}

errorTelemetryRoutes.post('/api/_errors/log', async (c) => {
  try {
    const body = await c.req.json<ErrorPayload>().catch(() => ({} as ErrorPayload))
    const message = String(body.message || '').slice(0, 500)
    if (!message) return c.body(null, 204)

    const stack = body.stack ? String(body.stack).slice(0, 2000) : null
    const url = String(body.url || '').slice(0, 300)
    const type = String(body.type || 'unknown').slice(0, 30)
    const userId = body.user_id ? String(body.user_id).slice(0, 50) : null
    const ua = String(body.user_agent || c.req.header('user-agent') || '').slice(0, 200)
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''

    // best-effort INSERT — 테이블 없으면 silent ignore.
    try {
      await c.env.DB.prepare(
        `INSERT INTO frontend_errors (message, stack, url, type, user_id, user_agent, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).bind(message, stack, url, type, userId, ua, ip.slice(0, 64)).run()
    } catch (e) {
      // 테이블 없으면 console.log 만 (Cloudflare logs 에서 보임)
      console.error('[frontend_errors] INSERT failed:', (e as Error).message, '| msg:', message)
    }

    return c.body(null, 204)
  } catch {
    // 절대 throw 안 함 — telemetry 가 클라이언트에 에러 주면 안 됨.
    return c.body(null, 204)
  }
})

errorTelemetryRoutes.get('/api/_errors/recent', async (c) => {
  // 어드민만 — JWT 검증.
  const auth = c.req.header('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return c.json({ success: false, error: 'auth required' }, 401)

  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(token, c.env.JWT_SECRET || '', 'HS256') as { role?: string; user_type?: string }
    if (payload.role !== 'admin' && payload.user_type !== 'admin') {
      return c.json({ success: false, error: 'admin only' }, 403)
    }
  } catch {
    return c.json({ success: false, error: 'invalid token' }, 401)
  }

  const hours = Math.min(Math.max(1, Number(c.req.query('hours') || '1')), 168)
  const limit = Math.min(Math.max(1, Number(c.req.query('limit') || '100')), 1000)

  try {
    const rows = await c.env.DB.prepare(
      `SELECT id, message, type, url, user_id, created_at
       FROM frontend_errors
       WHERE created_at > datetime('now', '-${hours} hours')
       ORDER BY created_at DESC
       LIMIT ?`,
    ).bind(limit).all<{ id: number; message: string; type: string; url: string; user_id: string; created_at: string }>()
    return c.json({ success: true, data: rows.results || [] })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message, code: 'TABLE_MISSING_PROBABLY' }, 500)
  }
})
