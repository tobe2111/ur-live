/**
 * 🔐 `/api/admin/*` 밖에 있는 어드민 환불 경로에도 역할 검사가 걸린다 (2026-11-25 대표 *"그래서 찾은 에러들은?"*)
 *
 * 역할 게이트(`adminRbacMiddleware`)는 `/api/admin/*` · `/api/admin-payouts/*` 에만 걸려 있었다.
 * 분쟁 승인(`/api/disputes/admin/:id/approve` = 환불 실행)과 반품 처리(`/api/returns/:id/refund` 등)는 그 밖이라
 * 핸들러가 "어드민 토큰인가" 만 보고 통과시켰다 ⇒ 조회 전용(viewer) 계정이 환불을 실행할 수 있었다.
 * 실제 라우트를 돌려, viewer 는 403 · 담당 역할(cs)은 게이트를 지나는지 본다.
 *
 * 못 막는 것: 이 두 파일 밖의 어드민 쓰기 경로. 같은 모양(핸들러 안 `type === 'admin'` 만 검사)이 다른 라우트 파일에도 있다 —
 * 돈이 나가는 것은 이 둘과 지급(`admin-payouts`)이고, 나머지는 인계 문서에 남겼다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { d1, openLiveSchema, insert, makeCtx, SECRET } from '../helpers/live-d1'
import { disputesRoutes } from '@/worker/routes/disputes.routes'
import { returnsRoutes } from '@/features/returns/api/returns.routes'
import { canAdminRoleMutate } from '@/shared/admin-roles'

const now = () => Math.floor(Date.now() / 1000)

async function setup() {
  const raw = openLiveSchema()
  const env = { DB: d1(raw), JWT_SECRET: SECRET, ENVIRONMENT: 'development' } as Record<string, unknown>
  const app = new Hono()
  app.route('/api/disputes', disputesRoutes)
  app.route('/api/returns', returnsRoutes)
  const tokOf = async (role: string) => {
    const id = insert(raw, 'admins', { username: `a-${role}`, email: `${role}@example.test`, password_hash: 'x', name: role, role })
    return sign({ type: 'admin', sub: String(id), admin_id: id, userId: id, role, iat: now(), exp: now() + 3600 }, SECRET)
  }
  const call = async (method: string, path: string, token: string) => {
    const { ctx, drain } = makeCtx()
    try { raw.exec('DELETE FROM rate_limit_attempts') } catch { /* 표가 없으면 넘어간다 */ }
    const res = await app.request(path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 rolegate' }, body: '{}',
    }, env, ctx)
    await drain()
    const data = await res.json().catch(() => ({})) as { code?: string }
    return { status: res.status, code: data.code }
  }
  return { tokOf, call }
}

const PATHS: Array<[string, string]> = [
  ['POST', '/api/disputes/admin/999/approve'],
  ['POST', '/api/disputes/admin/999/reject'],
  ['PUT', '/api/returns/999/refund'],
  ['PUT', '/api/returns/999/inspect'],
  ['PUT', '/api/returns/999/approve'],
  ['PUT', '/api/returns/999/reject'],
]

describe('조회 전용 어드민은 /api/admin 밖의 환불·반품 처리도 못 한다', () => {
  it('viewer → 403 ADMIN_ROLE_FORBIDDEN (핸들러에 닿기 전에)', async () => {
    const { tokOf, call } = await setup()
    const viewer = await tokOf('viewer')
    for (const [method, path] of PATHS) {
      const r = await call(method, path, viewer)
      expect([path, r.status, r.code]).toEqual([path, 403, 'ADMIN_ROLE_FORBIDDEN'])
    }
  })

  it('담당 역할(cs)과 최고 관리자는 게이트를 지난다 — 없는 번호라 404·400 이지 403 이 아니다', async () => {
    const { tokOf, call } = await setup()
    for (const role of ['cs', 'super_admin']) {
      const tok = await tokOf(role)
      for (const [method, path] of PATHS) {
        const r = await call(method, path, tok)
        expect([role, path, r.code === 'ADMIN_ROLE_FORBIDDEN']).toEqual([role, path, false])
      }
    }
  })

  it('역할 표: 환불 실행은 cs·finance, 반품 검수는 cs·ops, viewer 는 전부 불가', () => {
    expect(canAdminRoleMutate('finance', '/api/disputes/admin/3/approve')).toBe(true)
    expect(canAdminRoleMutate('ops', '/api/disputes/admin/3/approve')).toBe(false)
    expect(canAdminRoleMutate('finance', '/api/returns/3/refund')).toBe(true)
    expect(canAdminRoleMutate('ops', '/api/returns/3/refund')).toBe(false)
    expect(canAdminRoleMutate('ops', '/api/returns/3/inspect')).toBe(true)
    expect(canAdminRoleMutate('finance', '/api/returns/3/inspect')).toBe(false)
    for (const [, path] of PATHS) expect(canAdminRoleMutate('viewer', path)).toBe(false)
  })
})
