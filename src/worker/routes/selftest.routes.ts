/**
 * 🛡️ 2026-05-23 Self-test endpoint — 운영 인프라 정상성 확인.
 *
 * GET /api/_selftest  (admin only)
 *   각 sub-check 결과 + 전체 healthy 반환.
 *
 * 활용: 배포 후 1번 호출 → 어떤 인프라가 깨졌는지 즉시 식별.
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const selftestRoutes = new Hono<{ Bindings: Env }>()

interface CheckResult {
  name: string
  ok: boolean
  ms: number
  detail?: string
}

async function runCheck(name: string, fn: () => Promise<string | void>): Promise<CheckResult> {
  const start = Date.now()
  try {
    const detail = await fn()
    return { name, ok: true, ms: Date.now() - start, detail: detail || undefined }
  } catch (e) {
    return { name, ok: false, ms: Date.now() - start, detail: (e as Error).message.slice(0, 200) }
  }
}

selftestRoutes.get('/api/_selftest', async (c) => {
  // 어드민 권한 검증
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

  const checks: CheckResult[] = []

  // 1. D1 ping
  checks.push(await runCheck('D1 ping', async () => {
    const r = await c.env.DB.prepare('SELECT 1 as one').first<{ one: number }>()
    if (r?.one !== 1) throw new Error('unexpected ping result')
    return 'OK'
  }))

  // 2. Toss client key
  checks.push(await runCheck('TOSS_CLIENT_KEY', async () => {
    const key = (c.env as { TOSS_CLIENT_KEY?: string }).TOSS_CLIENT_KEY || ''
    if (!key) throw new Error('not set')
    const { detectTossKeyType } = await import('../utils/toss-gateway')
    const t = detectTossKeyType(key)
    if (t === 'missing') throw new Error('detect=missing')
    return `prefix=${key.slice(0, 8)}, type=${t}`
  }))

  // 3. Toss secret key
  checks.push(await runCheck('TOSS_SECRET_KEY', async () => {
    const key = (c.env as { TOSS_SECRET_KEY?: string }).TOSS_SECRET_KEY || ''
    if (!key) throw new Error('not set')
    return `prefix=${key.slice(0, 8)}`
  }))

  // 4. Toss env match
  checks.push(await runCheck('Toss live/test match', async () => {
    const ck = (c.env as { TOSS_CLIENT_KEY?: string }).TOSS_CLIENT_KEY || ''
    const sk = (c.env as { TOSS_SECRET_KEY?: string }).TOSS_SECRET_KEY || ''
    const ckEnv = /^live_/.test(ck) ? 'live' : /^test_/.test(ck) ? 'test' : 'unknown'
    const skEnv = /^live_/.test(sk) ? 'live' : /^test_/.test(sk) ? 'test' : 'unknown'
    if (ckEnv !== skEnv) throw new Error(`mismatch: client=${ckEnv}, secret=${skEnv}`)
    return `both ${ckEnv}`
  }))

  // 5. JWT secret
  checks.push(await runCheck('JWT_SECRET', async () => {
    if (!c.env.JWT_SECRET) throw new Error('not set')
    if (c.env.JWT_SECRET.length < 16) throw new Error('too short')
    return 'OK'
  }))

  // 6. Kakao keys
  checks.push(await runCheck('KAKAO_REST_KEY', async () => {
    if (!(c.env as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY) throw new Error('not set')
    return 'OK'
  }))

  // 7. Critical tables (frontend_errors / orders / users / sellers)
  checks.push(await runCheck('Critical tables', async () => {
    const tables = ['users', 'orders', 'sellers', 'frontend_errors']
    const missing: string[] = []
    for (const t of tables) {
      try {
        await c.env.DB.prepare(`SELECT 1 FROM ${t} LIMIT 1`).first()
      } catch {
        missing.push(t)
      }
    }
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`)
    return `present: ${tables.join(', ')}`
  }))

  // 8. Cloudflare bindings
  checks.push(await runCheck('Bindings', async () => {
    const binds: string[] = []
    if (c.env.DB) binds.push('DB')
    if ((c.env as { RATE_LIMIT_KV?: unknown }).RATE_LIMIT_KV) binds.push('RATE_LIMIT_KV')
    if ((c.env as { IMAGES_KV?: unknown }).IMAGES_KV) binds.push('IMAGES_KV')
    return binds.join(', ') || '(none)'
  }))

  const allOk = checks.every(c => c.ok)
  return c.json({
    success: true,
    healthy: allOk,
    data: {
      checks,
      passed: checks.filter(c => c.ok).length,
      total: checks.length,
      checked_at: new Date().toISOString(),
    },
  }, allOk ? 200 : 503)
})
