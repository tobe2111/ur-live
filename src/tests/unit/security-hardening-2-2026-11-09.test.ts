/**
 * 🔐 2026-11-09 보안 전수조사 2차 — 대표 *"계속 진행"* 으로 고친 중간 등급 항목의 불변식.
 * 1차(7건)는 `security-hardening-2026-11-09.test.ts`.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 이미 발급된 옛 재발급 토큰(옛 키)은 만료까지 로그인 토큰으로도 통한다 — 이행기 한계(코드 주석 참조).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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

describe('③ 이용권 조회의 전체 잠금은 정상 손님을 막지 않는다', () => {
  // 가짜 DB — countOf 가 읽는 행만 흉내낸다.
  function fakeDb(mine: number, all: number) {
    return {
      prepare: (sql: string) => ({
        bind: (key: string) => ({
          first: async () => (sql.includes('SELECT count') ? { count: key === 'all' ? all : mine } : null),
        }),
      }),
    } as unknown as D1Database
  }
  const ctx = { req: { header: () => '1.2.3.4' } } as never

  it('전체 한도를 넘겨도 틀린 적 없는 IP(자기 이용권을 조회하는 손님)는 통과', async () => {
    const { lookupLocked, LOOKUP_MISS_GLOBAL } = await import('@/worker/utils/voucher-code-guard')
    expect(await lookupLocked(ctx, fakeDb(0, LOOKUP_MISS_GLOBAL.max + 50))).toBe(false)
  })
  it('전체 한도를 넘기면 틀린 적 있는 IP 는 막힌다', async () => {
    const { lookupLocked, LOOKUP_MISS_GLOBAL } = await import('@/worker/utils/voucher-code-guard')
    expect(await lookupLocked(ctx, fakeDb(1, LOOKUP_MISS_GLOBAL.max))).toBe(true)
  })
  it('IP 당 한도는 그대로', async () => {
    const { lookupLocked, LOOKUP_MISS_PER_IP } = await import('@/worker/utils/voucher-code-guard')
    expect(await lookupLocked(ctx, fakeDb(LOOKUP_MISS_PER_IP.max, 0))).toBe(true)
    expect(await lookupLocked(ctx, fakeDb(LOOKUP_MISS_PER_IP.max - 1, 0))).toBe(false)
  })
})

describe('④ 관리자 삭제는 동시 로그인 허용 계정의 토큰도 끊는다', () => {
  it('삭제 시 multi_session 을 끈 뒤 세션 경계를 올린다', () => {
    const code = readCode('src/features/admin/api/admin-accounts.routes.ts')
    const off = code.indexOf("UPDATE dashboard_sessions SET multi_session = 0 WHERE account_type = 'admin' AND account_id = ?")
    const bump = code.indexOf("await startDashboardSession(DB, 'admin', Number(adminId)")
    expect(off).toBeGreaterThan(0)
    expect(bump).toBeGreaterThan(off)
  })
})

describe('⑤ 응급·cron·웹훅 토큰은 상수 시간으로 비교하고, 응급 재설정은 표 이름을 정해진 값만 받는다', () => {
  it('secretEquals: 같으면 참 · 다르거나 기대값이 없으면 거짓', async () => {
    const { secretEquals } = await import('@/worker/utils/secret-compare')
    expect(secretEquals('abc123', 'abc123')).toBe(true)
    expect(secretEquals('abc123', 'abc124')).toBe(false)
    expect(secretEquals('abc123', 'abc12')).toBe(false)
    expect(secretEquals('abc123', 'abc1234')).toBe(false)
    expect(secretEquals('abc123', '')).toBe(false)
    expect(secretEquals('abc123', null)).toBe(false)
    expect(secretEquals(undefined, undefined)).toBe(false)
    expect(secretEquals('', '')).toBe(false)
  })
  it('토큰 비교 자리에 !== 가 남아 있지 않다', () => {
    const files = {
      'src/worker/routes/internal-admin-tools.routes.ts': 3,
      'src/worker/routes/repair-schema.routes.ts': 2,
      'src/features/orders/api/orders.routes.ts': 2,
      'src/worker/routes/kakao-skill-webhook.routes.ts': 1,
    }
    for (const [f, n] of Object.entries(files)) {
      const code = readCode(f)
      expect(code.match(/secretEquals\(/g)?.length, f).toBe(n)
      expect(code, f).not.toMatch(/(?:expected|opsToken|expectedToken|secret) !== (?:provided|reqToken|got)|!== (?:expectedToken|secret)\b/)
    }
  })
  it('응급 재설정은 role 을 표 이름으로 그대로 쓰지 않고, 삭제된 계정을 되살리지 않는다', () => {
    const code = readCode('src/worker/routes/internal-admin-tools.routes.ts')
    expect(code).not.toMatch(/`\$\{role\}s`/)
    expect(code).toMatch(/if \(role !== 'all' && !ROLE_TABLE\[role\]\)/)
    expect(code.match(/NOT IN \('deleted', 'withdrawn'\)/g)?.length).toBe(2)
  })
})

describe('⑥ 로그인 토큰 판정은 한 곳 — 옛 재발급 토큰은 수명으로 가른다 (4차)', () => {
  const now = Math.floor(Date.now() / 1000)
  const DAY = 86400
  it('isNonLoginToken', async () => {
    const { isNonLoginToken } = await import('@/worker/utils/login-token-policy')
    expect(isNonLoginToken({ sub: '1', type: 'admin', iat: now, exp: now + DAY })).toBe(false)
    expect(isNonLoginToken({ sub: '1', type: 'admin', iat: now, exp: now + 30 * DAY })).toBe(true) // 옛 관리자 재발급
    expect(isNonLoginToken({ sub: '1', type: 'seller', iat: now, exp: now + 30 * DAY })).toBe(false)
    expect(isNonLoginToken({ sub: '1', type: 'seller', iat: now, exp: now + 90 * DAY })).toBe(true) // 옛 셀러 재발급
    expect(isNonLoginToken({ sub: '1', email: 'a', iat: now, exp: now + 30 * DAY })).toBe(false) // 소비자(종류 없음)
    expect(isNonLoginToken({ sub: '5', purpose: 'pin_verified' })).toBe(true)
    expect(isNonLoginToken({ sub: '5', type: 'agency', token_use: 'refresh' })).toBe(true)
  })
  it('requireAuth 가 옛 관리자 재발급 토큰(같은 키·30일)을 거부한다', async () => {
    const { sign } = await import('hono/jwt')
    const { Hono } = await import('hono')
    const { requireAuth } = await import('@/worker/middleware/auth')
    const legacy = await sign({ sub: '10', type: 'admin', role: 'super_admin', iat: now, exp: now + 30 * DAY }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.get('/x', requireAuth(), (c) => c.text('ok'))
    expect((await app.request('/x', { headers: { Authorization: `Bearer ${legacy}` } }, { JWT_SECRET: SECRET })).status).toBe(401)
  })
  it('verifyLogin 은 로그인 토큰만 돌려주고 나머지는 던진다', async () => {
    const { sign } = await import('hono/jwt')
    const { verifyLogin } = await import('@/worker/utils/login-token-policy')
    const ok = await sign({ sub: '3', type: 'seller', seller_id: 3, iat: now, exp: now + 30 * DAY }, SECRET)
    const bad = await sign({ sub: '3', type: 'seller', seller_id: 3, iat: now, exp: now + 90 * DAY }, SECRET)
    expect((await verifyLogin(ok, SECRET)).sub).toBe('3')
    await expect(verifyLogin(bad, SECRET)).rejects.toBeTruthy()
  })
  it('Bearer 로그인 토큰을 직접 확인하는 곳은 hono verify 대신 verifyLogin 을 쓴다', async () => {
    const { execSync } = await import('node:child_process')
    const files = execSync("git grep -l \"hono/jwt\" -- src", { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('/tests/'))
    // hono verify 를 직접 써도 되는 곳 — 로그인 토큰이 아닌 것을 확인한다(재발급·에이전시 좌석·유어애즈·판정 함수 자신).
    const ALLOWED = new Set([
      'src/worker/utils/refresh-token-key.ts', 'src/features/agency-console/api/agency-session.ts',
      'src/features/marketing/api/ads-account.ts', 'src/worker/utils/login-token-policy.ts',
      'src/features/auth/api/kakao.routes.ts', // OAuth state·확정 티켓(로그인 토큰 아님)
      'src/features/seller/api/seller-pin.routes.ts', // PIN 확인 토큰(purpose) 자체를 검증
    ])
    // hono verify 를 **실제로 Bearer 에 부르는** 곳만 센다(import 만 하고 안 쓰는 파일은 해가 없다).
    const bad = files.filter((f) => !ALLOWED.has(f)).filter((f) => {
      const s = readFileSync(f, 'utf8')
      const honoVerify = /import\s*\{[^}]*\bverify\b[^}]*\}\s*from\s*'hono\/jwt'|const\s*\{\s*verify\s*\}\s*=\s*await import\('hono\/jwt'\)/.test(s)
      return (honoVerify && /\bverify\(/.test(s)) || /import\('hono\/jwt'\)\.then\(m\s*=>\s*m\.verify\(/.test(s)
    })
    expect(bad, '로그인 토큰을 직접 확인하면 utils/login-token-policy 의 verifyLogin 을 쓸 것').toEqual([])
  })
})
