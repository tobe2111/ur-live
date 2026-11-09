/**
 * 🔐 2026-11-09 보안 전수조사 — 대표 *"모두 다 순서대로 진행해줘"* 로 고친 것들의 불변식.
 *
 * 항목마다 describe 하나. 각 항목은 "가드 GREEN 인데 실제로는 뚫려 있던" 클래스라
 * 모양(인증 미들웨어가 붙어 있나)이 아니라 **동작**(그 검사가 실제로 거부하나)을 고정한다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 라이브 설정값(웹훅 IP 허용목록 등) — 코드가 아니라 Cloudflare 설정이다.
 * - 런타임 요청 흐름 전체 — 여기서는 핵심 판정 함수와 소스 모양만 본다.
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

describe('① verifyPassword 결과는 객체다 — `.valid` 를 꺼내 판정한다', () => {
  // verifyPassword 는 { valid, isLegacy } 를 돌려준다. 객체 자체는 늘 참이라
  // `if (!result)` 로 판정하면 아무 PIN·비밀번호나 통과한다(2026-11-09 셀러 PIN 3곳 실측).
  const files = walk('src').map((p) => ({ p, code: readCode(p) }))

  it('측정 대상이 비어 있지 않다', () => {
    const callers = files.filter((f) => /await verifyPassword\(/.test(f.code))
    expect(callers.length, 'verifyPassword 호출 파일을 못 찾았다 — 검사가 헛돈다').toBeGreaterThan(8)
  })

  it('`const x = await verifyPassword(` 로 받은 값을 `!x` / `x` 로 판정하지 않는다', () => {
    const bad: string[] = []
    for (const { p, code } of files) {
      const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+verifyPassword\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(code))) {
        const name = m[1]
        const rest = code.slice(m.index + m[0].length, m.index + m[0].length + 400)
        const usesValid = new RegExp(`\\b${name}\\.valid\\b`).test(rest)
        if (!usesValid) bad.push(`${p}: ${name}`)
      }
    }
    expect(bad, '객체를 그대로 참/거짓으로 쓰면 검사가 늘 통과한다 — `{ valid }` 로 꺼낼 것').toEqual([])
  })

  it('셀러 PIN 검증은 `valid` 로 판정한다', () => {
    const code = readFileSync('src/features/seller/api/seller-pin.routes.ts', 'utf8')
    expect(code).toMatch(/const \{ valid: ok \} = await verifyPassword\(pin, pinHash\)/)
  })
})

describe('② 공개 레포에 적힌 키로 여는 쓰기 엔드포인트가 없다', () => {
  it('데모 시드 엔드포인트가 삭제돼 있다', () => {
    const code = readCode('src/features/products/api/products.routes.ts')
    expect(code).not.toMatch(/demo-seed-linkshop/)
    expect(code).not.toMatch(/DEMO_SEED_KEY/)
  })
  it('소스 어디에도 그 키 문자열이 없다', () => {
    const hits = walk('src').filter((p) => readFileSync(p, 'utf8').includes('urdeal-demo-seed-2026'))
    expect(hits).toEqual([])
  })
})

describe('③ 요청 본문의 키를 SQL 열 이름으로 쓰려면 허용 목록을 거친다', () => {
  it('알림 채널 설정 PUT 은 허용된 열만 받는다', () => {
    const code = readCode('src/features/admin/api/admin-notification-settings.routes.ts')
    expect(code).toMatch(/CHANNEL_COLUMNS = new Set\(\['dashboard_enabled', 'email_enabled', 'alimtalk_enabled', 'push_enabled'\]\)/)
    expect(code).toMatch(/typeof v === 'boolean' && CHANNEL_COLUMNS\.has\(k\)/)
  })
})

describe('④ 이미지 변환 프록시는 래스터 이미지만 내보내고, /api 응답엔 nonce 를 박지 않는다', () => {
  const code = readCode('src/worker/index.ts')
  it('판정 함수가 래스터만 통과시킨다 (SVG·HTML 거부)', async () => {
    const { isRasterImageType } = await import('@/worker/utils/image-proxy-safety')
    for (const t of ['image/jpeg', 'image/png', 'image/webp; charset=binary', 'image/gif', 'image/avif']) expect(isRasterImageType(t), t).toBe(true)
    for (const t of ['text/html', 'image/svg+xml', 'application/xhtml+xml', '', null]) expect(isRasterImageType(t), String(t)).toBe(false)
  })
  it('비-래스터 응답을 415 로 거부한다', () => {
    expect(code).toMatch(/if \(!isRasterImageType\(type\)\) return c\.json\(\{ success: false, error: 'not an image' \}, 415\)/)
  })
  it('캐시 적중도 래스터일 때만 쓴다', () => {
    expect(code).toMatch(/if \(hit && isRasterImageType\(hit\.headers\.get\('Content-Type'\)\)\) return hit;/)
  })
  it('프록시 응답에 nosniff 와 sandbox CSP 를 붙인다', () => {
    expect(code).toMatch(/headers\.set\('Content-Type', type\); hardenImageHeaders\(headers\);/)
    const util = readFileSync('src/worker/utils/image-proxy-safety.ts', 'utf8')
    expect(util).toMatch(/'X-Content-Type-Options', 'nosniff'/)
    expect(util).toMatch(/"default-src 'none'; sandbox"/)
  })
  it('nonce 리라이터는 /api/* 를 건너뛴다', () => {
    // 디코드된 경로(c.req.path)로 본다 — 원문으로 보면 /%61pi/... 가 /api 밖으로 읽힌다(라우터는 /api 로 보낸다).
    expect(code).toMatch(/ct\.includes\('text\/html'\) && c\.res\.body && !c\.req\.path\.startsWith\('\/api\/'\)/)
  })
})

describe('⑤ 로그인 신원의 "종류"는 서명된 값으로만 정하고, 소비자 기능은 소비자 토큰만 받는다', () => {
  const SECRET = 'test-secret-security-hardening'
  const now = () => Math.floor(Date.now() / 1000)

  it('용도 토큰(purpose)은 Bearer 로그인으로 받지 않는다', async () => {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { Hono } = await import('hono')
    const { requireAuth, optionalAuth, getCurrentUser } = await import('@/worker/middleware/auth')
    const pin = await jwt.sign({ sub: '5', seller_id: 5, purpose: 'pin_verified', iat: now(), exp: now() + 600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.get('/must', requireAuth(), (c) => c.json({ id: getCurrentUser(c)?.id }))
    app.get('/opt', optionalAuth(), (c) => c.json({ id: getCurrentUser(c)?.id ?? null }))
    const env = { JWT_SECRET: SECRET }
    const r1 = await app.request('/must', { headers: { Authorization: `Bearer ${pin}` } }, env)
    expect(r1.status).toBe(401)
    const r2 = await app.request('/opt', { headers: { Authorization: `Bearer ${pin}` } }, env)
    expect(await r2.json()).toEqual({ id: null })
  })

  it('보통 소비자 토큰(type 없음)은 그대로 통과한다 — 반대 방향', async () => {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { Hono } = await import('hono')
    const { requireUser, getCurrentUser } = await import('@/worker/middleware/auth')
    const tok = await jwt.sign({ sub: '7', email: 'a@b.c', role: 'BUYER', iat: now(), exp: now() + 600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.get('/me', requireUser(), (c) => c.json({ id: getCurrentUser(c)?.id }))
    const r = await app.request('/me', { headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ id: '7' })
  })

  it('소비자 전용 문은 셀러 토큰을 거부한다', async () => {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { Hono } = await import('hono')
    const { requireUser } = await import('@/worker/middleware/auth')
    const tok = await jwt.sign({ sub: '3', type: 'seller', seller_id: 3, iat: now(), exp: now() + 600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string; DB?: unknown } }>()
    app.get('/me', requireUser(), (c) => c.json({ ok: true }))
    const fakeDb = { prepare: () => ({ bind: () => ({ first: async () => null }) }) }
    const r = await app.request('/me', { headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET, DB: fakeDb })
    expect([401, 403]).toContain(r.status)
  })

  it('쿠키 이름을 바꿔도 종류가 바뀌지 않는다', async () => {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { parseSessionCookie } = await import('@/worker/utils/session')
    const userTok = await jwt.sign({ sub: '9', type: 'user', iat: now(), exp: now() + 600 }, SECRET)
    expect(await parseSessionCookie(`ur_admin_session=${userTok}`, SECRET)).toBeNull()
    expect(await parseSessionCookie(`ur_seller_session=${userTok}`, SECRET)).toBeNull()
    const ok = await parseSessionCookie(`ur_session=${userTok}`, SECRET)
    expect(ok?.type).toBe('user')
    expect(ok?.role).toBe('user')
    const pin = await jwt.sign({ sub: '5', purpose: 'pin_verified', iat: now(), exp: now() + 600 }, SECRET)
    expect(await parseSessionCookie(`ur_session=${pin}`, SECRET)).toBeNull()
  })

  it('돈·개인정보·삭제를 다루는 소비자 파일은 requireAuth() 가 아니라 requireUser() 를 쓴다', () => {
    for (const f of [
      'src/features/points/api/points.routes.ts',
      'src/features/group-buy/api/voucher-gift.routes.ts',
      'src/features/account/api/account.routes.ts',
      'src/worker/routes/users.routes.ts',
      'src/features/shipping/api/shipping-address.routes.ts',
      'src/features/mall/api/mall-admin.routes.ts',
      'src/features/appointments/api/appointments.routes.ts',
    ]) {
      const code = readCode(f)
      expect(code, f).not.toMatch(/requireAuth\(\)/)
      expect(code, f).toMatch(/requireUser\(\)/)
    }
    expect(readCode('src/worker/routes/curator.routes.ts')).not.toMatch(/curatorRoutes\.\w+\('\/me\/[^']*',[^\n]*requireAuth\(\)/)
    expect(readCode('src/features/group-buy/api/group-buy-public.routes.ts')).toMatch(/router\.get\('\/my', requireUser\(\)/)
    expect(readCode('src/features/group-buy/api/group-buy-voucher.routes.ts')).toMatch(/'\/voucher\/:code\/cancel',\n\s+rateLimit\([^)]*\),\n\s+requireUser\(\)/)
  })

  it('재고 도구는 셀러/어드민만, 주문 확정은 구매자/어드민만', () => {
    const inv = readCode('src/features/inventory/api/inventory.routes.ts')
    expect(inv).not.toMatch(/requireAuth\(\)/)
    expect(inv).toMatch(/requireUserType\('seller', 'admin'\)/)
    const orders = readCode('src/features/orders/api/orders.routes.ts')
    expect(orders.match(/\} else if \(authUser\.type !== 'admin'\) \{\n\s+return c\.json\(\{ success: false, error: 'Forbidden' \}, 403\);/g)?.length).toBe(2)
  })
})

describe('⑥ 관리자 역할 검사는 라우터와 같은(디코드된) 경로로 판정하고, 비밀 설정은 최고관리자만 본다', () => {
  const SECRET = 'test-secret-rbac'
  const now = () => Math.floor(Date.now() / 1000)
  async function call(role: string, method: string, path: string) {
    const jwt = await import('@tsndr/cloudflare-worker-jwt')
    const { Hono } = await import('hono')
    const { adminRbacMiddleware } = await import('@/worker/middleware/admin-rbac')
    const tok = await jwt.sign({ sub: '20', type: 'admin', role, iat: now(), exp: now() + 600 }, SECRET)
    const app = new Hono<{ Bindings: { JWT_SECRET: string } }>()
    app.use('/api/admin/*', adminRbacMiddleware())
    app.on(['GET', 'PUT', 'POST'], '/api/admin/*', (c) => c.text('HIT'))
    const r = await app.request(path, { method, headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET })
    return r.status
  }

  it('ops 의 플랫폼 설정 변경은 인코딩해도 막힌다', async () => {
    expect(await call('ops', 'PUT', '/api/admin/tools/settings')).toBe(403)
    expect(await call('ops', 'PUT', '/api/admin/tools/%73ettings')).toBe(403)
  })
  it('cs 의 딜 지급은 인코딩해도 막힌다', async () => {
    expect(await call('cs', 'POST', '/api/admin/users/3/gift-deal')).toBe(403)
    expect(await call('cs', 'POST', '/api/admin/users/3/%67ift-deal')).toBe(403)
  })
  it('최고관리자 전용 영역은 인코딩해도 막힌다', async () => {
    expect(await call('cs', 'GET', '/api/admin/admins')).toBe(403)
    expect(await call('cs', 'GET', '/api/admin/%61dmins')).toBe(403)
  })
  it('반대 방향: 허용된 일은 그대로 된다', async () => {
    expect(await call('ops', 'PUT', '/api/admin/products/1')).toBe(200)
    expect(await call('cs', 'GET', '/api/admin/orders')).toBe(200)
  })

  it('비밀 설정 키 판정과 가리기', async () => {
    const m = await import('@/features/admin/api/platform-settings-secrets')
    for (const k of ['cf_api_token', 'buyer_ingest_token', 'x_secret', 'naver_api_key']) expect(m.isSecretSettingKey(k), k).toBe(true)
    for (const k of ['commission_rate_default', 'fee_channel_rates_enabled', 'cf_account_id']) expect(m.isSecretSettingKey(k), k).toBe(false)
    expect(m.maskSecret('abcdefgh1234')).toBe('••••1234')
    expect(m.maskSecret('')).toBe('')
  })
  it('설정 GET 은 최고관리자가 아니면 비밀값을 가리고, PUT 은 비밀값 변경을 막는다', () => {
    const code = readCode('src/features/admin/api/admin-tools.routes.ts')
    expect(code).toMatch(/!showSecrets && isSecretSettingKey\(r\.key\) \? maskSecret\(r\.value\) : r\.value/)
    expect(code).toMatch(/Object\.keys\(body\)\.some\(isSecretSettingKey\) && !\(await isSuperAdminRequest\(c\)\)/)
  })
  it('DDL·백필·최고관리자 승격·환경 키 목록은 최고관리자만', () => {
    const rs = readCode('src/worker/routes/repair-schema.routes.ts')
    expect(rs).not.toMatch(/requireAdmin\(\)/)
    expect(rs, '인자 없는 requireAdminRole() = 최고관리자만').toMatch(/const superOnly = \(\) => requireAdminRole\(\);/)
    expect(rs).toMatch(/repairSchemaRoutes\.get\('\/api\/_internal\/bootstrap-super', superOnly\(\)/)
    expect(readCode('src/worker/routes/debug.routes.ts')).toMatch(/debugRoutes\.get\('\/bindings', requireAdminRole\(\)/)
  })
  it('admins 행이 없는 관리자 토큰은 역할 게이트를 못 넘는다', () => {
    const auth = readCode('src/worker/middleware/auth.ts')
    expect(auth).not.toMatch(/row\?\.role \|\| 'super'/)
    expect(auth).not.toMatch(/retry\?\.role \|\| 'super'/)
  })
  it('소셜 홍보 위임 전에 역할 검사를 거친다', () => {
    expect(readCode('src/worker/index.ts')).toMatch(/if \(isAdminSocial\) \{ let ok = false; const denied = await adminRbacMiddleware\(\)/)
  })
})
