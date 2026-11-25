/**
 * 🔐 `/api/admin/*` 밖의 쓰기에도 어드민 역할이 적용된다 — 전수 (2026-11-25 대표 *"끝까지 다 고쳐줘"*)
 *
 * 조사(2026-11-25)에서 그 접두사 밖에 "어드민 토큰인가" 만 보는 쓰기 핸들러가 66개 나왔다. 조회 전용(viewer) 어드민이
 * 이용권 일괄 환불·주문 취소·커미션 출금 승인·기능 플래그 변경까지 할 수 있었다. 전역 게이트 하나로 닫고,
 * 손님·사장님 요청은 건드리지 않는다는 것을 실제 미들웨어를 돌려 본다.
 *
 * 못 막는 것: 게이트가 `app.use('/api/*')` 로 **실제로 걸려 있는가** 는 여기서 문자열로만 본다(워커 전체를 띄우지 않는다).
 * ops·cs·finance 는 표에 적힌 경로만 가른다 — 표에 없는 운영 쓰기(상품·섹션·재고)는 종전대로 셋 다 된다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, userToken, sellerToken, SECRET } from '../helpers/live-d1'
import { adminOutsideWriteGate, adminRbacMiddleware } from '@/worker/middleware/admin-rbac'
import { canAdminRoleWriteOutside, isGetMutationOutside } from '@/shared/admin-roles'
import { sellerAnalyticsRoutes } from '@/features/seller/api/seller-analytics.routes'

const now = () => Math.floor(Date.now() / 1000)

async function setup() {
  const raw = openLiveSchema()
  const env = { DB: d1(raw), JWT_SECRET: SECRET, ENVIRONMENT: 'development' } as Record<string, unknown>
  const app = new Hono()
  app.use('/api/*', adminOutsideWriteGate())
  app.all('/api/*', (c) => c.json({ reached: true }))
  const adminTok = async (role: string) => {
    const id = insert(raw, 'admins', { username: `a-${role}`, email: `${role}@example.test`, password_hash: 'x', name: role, role })
    return { id, token: await sign({ type: 'admin', sub: String(id), admin_id: id, userId: id, role, iat: now(), exp: now() + 3600 }, SECRET) }
  }
  const adminCookie = async (id: number) => `ur_admin_session=${await sign({ sub: String(id), type: 'admin', iat: now(), exp: now() + 3600 }, SECRET)}`
  const call = async (method: string, path: string, headers: Record<string, string>) => {
    const res = await app.request(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: method === 'GET' ? undefined : '{}' }, env)
    const j = await res.json().catch(() => ({})) as { code?: string; reached?: boolean }
    return res.status === 200 && j.reached ? 'pass' : `${res.status} ${j.code ?? ''}`.trim()
  }
  return { raw, env, adminTok, adminCookie, call }
}

const MONEY: Array<[string, string]> = [
  ['POST', '/api/group-buy/admin/force-refund/12'],
  ['POST', '/api/vouchers/admin/force-refund/12'],
  ['POST', '/api/group-buy/admin/seller-closure/3'],
  ['POST', '/api/group-buy/refund/12'],
  ['POST', '/api/group-buy/voucher/ABCD/partial-refund'],
  ['POST', '/api/orders/55/cancel'],
  ['PATCH', '/api/returns/7/amount'],
  ['POST', '/api/community-group-buy/4/refund'],
  ['PATCH', '/api/referral-tree/admin/withdrawals/9/approve'],
  ['POST', '/api/referral-tree/register'],
  ['POST', '/api/auction/2/winner-paid'],
  ['GET', '/api/coupons/seed'],
]
const OTHER: Array<[string, string]> = [
  ['POST', '/api/products'], ['POST', '/api/sections'], ['POST', '/api/flags/some_flag'], ['PATCH', '/api/guides/seller/faq'],
  ['POST', '/api/inventory/stock/adjust'], ['POST', '/api/shipping/admin/bulk-tracking'], ['DELETE', '/api/upload/image/abc'],
]

describe('조회 전용(viewer) 어드민은 밖에서도 아무것도 못 바꾼다', () => {
  it('돈이 나가는 경로 · 운영 쓰기 전부 403, 읽기는 통과', async () => {
    const t = await setup()
    const v = await t.adminTok('viewer')
    for (const [m, p] of [...MONEY, ...OTHER]) expect([p, await t.call(m, p, { Authorization: `Bearer ${v.token}` })]).toEqual([p, '403 ADMIN_ROLE_FORBIDDEN'])
    expect(await t.call('GET', '/api/products', { Authorization: `Bearer ${v.token}` })).toBe('pass')
  })
  it('쿠키만으로 와도 같다(Bearer 없이 어드민 쿠키)', async () => {
    const t = await setup()
    const v = await t.adminTok('viewer')
    expect(await t.call('POST', '/api/orders/55/cancel', { Cookie: await t.adminCookie(v.id) })).toBe('403 ADMIN_ROLE_FORBIDDEN')
  })
  it('본인 계정 일(2단계 인증 · 내 알림 읽음)은 된다', async () => {
    const t = await setup()
    const v = await t.adminTok('viewer')
    for (const [m, p] of [['POST', '/api/2fa/verify'], ['PUT', '/api/dashboard-notifications/read-all'], ['POST', '/api/auth/logout']] as const) {
      expect([p, await t.call(m, p, { Authorization: `Bearer ${v.token}` })]).toEqual([p, 'pass'])
    }
  })
})

describe('제한 역할(ops · cs · finance)은 표에 적힌 대로 갈린다', () => {
  it('환불은 cs·finance, 폐업 일괄 환불·추천 관계 지정은 최고 관리자만, 그 밖의 운영 쓰기는 종전대로', () => {
    expect(canAdminRoleWriteOutside('cs', '/api/orders/55/cancel')).toBe(true)
    expect(canAdminRoleWriteOutside('finance', '/api/orders/55/cancel')).toBe(true)
    expect(canAdminRoleWriteOutside('ops', '/api/orders/55/cancel')).toBe(false)
    expect(canAdminRoleWriteOutside('finance', '/api/referral-tree/admin/withdrawals/9/approve')).toBe(true)
    expect(canAdminRoleWriteOutside('cs', '/api/referral-tree/admin/withdrawals/9/approve')).toBe(false)
    for (const r of ['ops', 'cs', 'finance'] as const) {
      expect(canAdminRoleWriteOutside(r, '/api/group-buy/admin/seller-closure/3')).toBe(false)
      expect(canAdminRoleWriteOutside(r, '/api/referral-tree/register')).toBe(false)
      expect(canAdminRoleWriteOutside(r, '/api/products')).toBe(true)
    }
    expect(canAdminRoleWriteOutside('ops', '/api/flags/x')).toBe(true)
    expect(canAdminRoleWriteOutside('cs', '/api/flags/x')).toBe(false)
    expect(canAdminRoleWriteOutside('ops', '/api/vouchers/ABCD/use-by-seller')).toBe(true)
    expect(canAdminRoleWriteOutside('finance', '/api/vouchers/ABCD/use-by-seller')).toBe(false)
    expect(isGetMutationOutside('/api/coupons/seed')).toBe(true)
    expect(isGetMutationOutside('/api/coupons/list')).toBe(false)
  })
  it('최고 관리자·일반 관리자(admin)는 전부 된다', async () => {
    const t = await setup()
    for (const role of ['super_admin', 'admin']) {
      const a = await t.adminTok(role)
      for (const [m, p] of MONEY) expect([role, p, await t.call(m, p, { Authorization: `Bearer ${a.token}` })]).toEqual([role, p, 'pass'])
    }
  })
})

describe('손님·사장님 요청은 건드리지 않는다', () => {
  it('유저 토큰 · 셀러 토큰 · 로그인 없는 요청은 그대로 지나간다', async () => {
    const t = await setup()
    const u = await userToken(11), s = await sellerToken(5)
    for (const h of [{ Authorization: `Bearer ${u}` }, { Authorization: `Bearer ${s}` }, {}] as Array<Record<string, string>>) {
      expect(await t.call('POST', '/api/orders/55/cancel', h)).toBe('pass')
      expect(await t.call('POST', '/api/group-buy/join/3', h)).toBe('pass')
    }
  })
  it('같은 브라우저에 조회 전용 어드민 쿠키가 남아 있어도, 유효한 유저·셀러 토큰이면 그 사람으로 본다', async () => {
    const t = await setup()
    const v = await t.adminTok('viewer')
    const cookie = await t.adminCookie(v.id)
    expect(await t.call('POST', '/api/orders/55/cancel', { Authorization: `Bearer ${await userToken(11)}`, Cookie: cookie })).toBe('pass')
    expect(await t.call('PUT', '/api/returns/7/approve', { Authorization: `Bearer ${await sellerToken(5)}`, Cookie: cookie })).toBe('pass')
  })
  it('기존 게이트(/api/admin/*)도 같은 판정을 쓴다 — 유효한 셀러 토큰 + 어드민 쿠키를 어드민 역할로 막지 않는다', async () => {
    const t = await setup()
    const v = await t.adminTok('viewer')
    const app = new Hono()
    app.use('/api/returns/*', adminRbacMiddleware())
    app.all('/api/*', (c) => c.json({ reached: true }))
    const res = await app.request('/api/returns/7/approve', { method: 'PUT', headers: { Authorization: `Bearer ${await sellerToken(5)}`, Cookie: await t.adminCookie(v.id) }, body: '{}' }, t.env)
    expect(res.status).toBe(200)
  })
})

describe('어드민 토큰이 번호가 같은 매장으로 동작하지 않는다', () => {
  it('셀러 분석·쿠폰 라우트는 어드민 토큰을 받지 않는다 (종전: admins.id 를 sellers.id 로 읽었다)', async () => {
    const t = await setup()
    const a = await t.adminTok('super_admin')
    // 어드민과 번호가 같은 매장을 만든다
    t.raw.prepare('DELETE FROM sellers').run()
    insert(t.raw, 'sellers', { id: a.id, username: 'same-id', email: 's@example.test', business_name: '번호가 같은 매장', status: 'approved' })
    const app = new Hono()
    app.route('/api/seller/analytics', sellerAnalyticsRoutes)
    const res = await app.request('/api/seller/analytics/coupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 x' },
      body: JSON.stringify({ code: 'TESTCODE1', discount_type: 'fixed', discount_value: 1000 }),
    }, t.env)
    expect(res.status).toBe(403)
    const coupons = t.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'coupons'").all()
    const n = coupons.length ? (t.raw.prepare('SELECT COUNT(*) AS n FROM coupons').get() as { n: number }).n : 0
    expect(n).toBe(0)
  })
})

describe('배선', () => {
  it('전역 게이트가 /api/* 에 걸려 있고, 라우트 등록보다 앞이다', () => {
    const s = readFileSync('src/worker/index.ts', 'utf8')
    const gate = s.indexOf("app.use('/api/*', adminOutsideWriteGate());")
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(s.indexOf("app.route('/', internalDiagnosticsRoutes);"))
    expect(gate).toBeLessThan(s.indexOf("app.route('/api/orders'"))
  })
})
