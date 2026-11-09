/**
 * 🔐 2026-11-09 보안 전수조사 2차 — 대표 *"계속 진행"* 으로 고친 중간 등급 항목의 불변식.
 * 1차(7건)는 `security-hardening-2026-11-09.test.ts`.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 이미 발급된 옛 재발급 토큰(옛 키)은 만료까지 로그인 토큰으로도 통한다 — 이행기 한계(코드 주석 참조).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '@/tests/helpers/source-text'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const SECRET = 'test-secret-hardening-2'
const now = () => Math.floor(Date.now() / 1000)

describe('① 재발급 토큰은 로그인 토큰과 다른 키로 서명되고, 로그인 검사에서 통하지 않는다', () => {
  it('새 재발급 토큰은 requireAuth 에서 401, 일반 키로는 서명 확인조차 안 된다', async () => {
    const { signRefreshToken } = await import('@/worker/utils/refresh-token-key')
    const { Hono } = await import('hono')
    const { verify } = await import('hono/jwt')
    const { requireAuth } = await import('@/worker/middleware/auth')
    const tok = await signRefreshToken({ sub: '10', type: 'admin', role: 'super_admin', iat: now(), exp: now() + 3600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.get('/x', requireAuth(), (c) => c.text('ok'))
    const r = await app.request('/x', { headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET })
    expect(r.status).toBe(401)
    await expect(verify(tok, SECRET, 'HS256')).rejects.toBeTruthy()
  })

  it('재발급 주소는 새 토큰과 옛 키 토큰을 모두 받는다 — 사용자를 강제 로그아웃시키지 않는다', async () => {
    const { signRefreshToken, verifyRefreshToken } = await import('@/worker/utils/refresh-token-key')
    const { sign } = await import('hono/jwt')
    const fresh = await signRefreshToken({ sub: '5', type: 'seller', exp: now() + 3600 }, SECRET)
    const legacy = await sign({ sub: '5', type: 'seller', exp: now() + 3600 }, SECRET)
    expect((await verifyRefreshToken(fresh, SECRET)).sub).toBe('5')
    expect((await verifyRefreshToken(legacy, SECRET)).sub).toBe('5')
    await expect(verifyRefreshToken(fresh, 'other-secret')).rejects.toBeTruthy()
  })

  it('token_use:refresh 클레임이 붙은 토큰은 같은 키로 서명돼도 로그인으로 받지 않는다', async () => {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { Hono } = await import('hono')
    const { requireAuth } = await import('@/worker/middleware/auth')
    const tok = await jwt.sign({ sub: '1', type: 'agency', token_use: 'refresh', exp: now() + 3600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.get('/x', requireAuth(), (c) => c.text('ok'))
    const r = await app.request('/x', { headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET })
    expect(r.status).toBe(401)
  })

  it('재발급 토큰을 로그인 키로 서명하는 곳이 없다', () => {
    const bad = walk('src').filter((p) => /await (?:sign|jwtSign)\((?:refreshPayload|newRefreshPayload)\b/.test(readCode(p)))
    expect(bad).toEqual([])
    const consumer = readCode('src/worker/routes/auth.routes.ts')
    expect(consumer.match(/refreshSigningKey\(secret\),\n\s+JWT_REFRESH_TOKEN_EXPIRY/g)?.length).toBe(2)
  })
})

describe('② 관리자 PIN 실패도 계정 잠금에 센다', () => {
  const code = readCode('src/features/auth/api/admin.routes.ts')
  it('PIN 불일치에서 recordFailure 를 부른다', () => {
    expect(code).toMatch(/if \(!pinOk\) \{\n\s+await recordFailure\(DB, 'admin', String\(admin\.id\)\);/)
  })
  it('실패 카운터 초기화는 PIN 확인 뒤에만 있다', () => {
    const clearAt = code.indexOf("await clearFailures(DB, 'admin', String(admin.id));")
    const pinAt = code.indexOf('const { valid: pinOk } = await verifyPassword(pin')
    expect(pinAt).toBeGreaterThan(0)
    expect(clearAt).toBeGreaterThan(pinAt)
    expect(code.split("await clearFailures(DB, 'admin', String(admin.id));").length - 1).toBe(1)
  })
})
