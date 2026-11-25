/**
 * 🚪 로그인 문 점검 (2026-11-25 대표 *"나머지 빠짐없이 모두 해줘야지."* — 로그인·가입·탈퇴 조사 뒤 재현)
 *
 * ① 카카오 콜백이 state 가 **아예 없는** 요청을 그대로 받아 로그인시켰다(쿠키도 없고 `?state=` 도 없으면 검사를 건너뛴다).
 *    남이 만든 인가 코드를 붙인 주소 하나로 피해자를 **공격자 계정**에 로그인시킬 수 있다(로그인 CSRF).
 *    라이브 실측(2026-06-20 ~ 11-25, 성공 111건): 쿠키 일치 86 · 서명 state 복구 25 · **state 없음 0** — 정상 사용자는 이 길을 쓴 적이 없다.
 * 실제 라우트를 라이브 구조 DB 위에서 돌리고, 카카오로 나가는 요청이 있었는지를 본다.
 * 못 보는 것: 카카오 콘솔에 등록된 다른 redirect URI · 진짜 카카오의 응답.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q, makeCtx, stubOutbound, SECRET } from '../helpers/live-d1'
import { kakaoRoutes, __signOauthStateForTest } from '@/features/auth/api/kakao.routes'
import { accountRoutes } from '@/features/account/api/account.routes'
import { userToken, q1 } from '../helpers/live-d1'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'

async function setup() {
  const raw = openLiveSchema()
  const env = { DB: d1(raw), JWT_SECRET: SECRET, KAKAO_REST_API_KEY: 'test-kakao-key', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
  const app = new Hono()
  app.route('/auth/kakao', kakaoRoutes)
  const out = stubOutbound()
  const get = async (path: string, cookie?: string) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const headers: Record<string, string> = { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 authdoors' }
    if (cookie) headers.Cookie = cookie
    const res = await app.request(`https://urdeal.kr${path}`, { method: 'GET', headers }, env, ctx)
    await drain()
    return { status: res.status, location: res.headers.get('Location') || '' }
  }
  const kakaoCalls = () => out.other.filter((u) => u.includes('kauth.kakao.com') || u.includes('kapi.kakao.com'))
  /** 카카오가 이 사람이라고 답하게 한다(토큰 교환 + 내 정보). */
  const kakaoSays = (who: { id: number; email: string; name: string }) => {
    const inner = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('kauth.kakao.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url.includes('kapi.kakao.com/v2/user/me')) return new Response(JSON.stringify({ id: who.id, kakao_account: { email: who.email, is_email_verified: true, name: who.name, profile: { nickname: who.name } }, properties: { nickname: who.name } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      return inner(input as never, init)
    }) as typeof fetch
  }
  return { raw, get, kakaoCalls, kakaoSays, out }
}

describe('카카오 콜백 — state 없는 요청은 로그인시키지 않는다', () => {
  it('쿠키도 state 도 없이 코드만 붙인 주소: 카카오에 코드를 바꾸러 가지 않고 돌려보낸다', async () => {
    const { get, kakaoCalls, out } = await setup()
    const r = await get('/auth/kakao/sync/callback?code=ATTACKER_CODE')
    out.restore()
    expect(r.status).toBe(302)
    expect(r.location).toContain('error=oauth_state_expired')
    expect(kakaoCalls(), '인가 코드를 토큰으로 바꾸러 갔다 — 로그인이 진행됐다').toEqual([])
  })

  it('우리가 서명한 state 가 붙어 있으면 종전대로 진행한다(쿠키가 사라진 iOS 길)', async () => {
    const { get, kakaoCalls, out } = await setup()
    const state = await __signOauthStateForTest('/', 'user', 'nonce-1', SECRET)
    const r = await get(`/auth/kakao/sync/callback?code=REAL_CODE&state=${encodeURIComponent(String(state))}`)
    out.restore()
    expect(kakaoCalls().length, `진행하지 않았다: ${r.status} ${r.location}`).toBeGreaterThan(0)
  })
})

describe('카카오 가입 — 같은 이메일이 이미 다른 방법으로 가입돼 있을 때', () => {
  it('"서버 오류" 가 아니라 그 사실을 알려준다 · 새 계정을 만들지 않는다', async () => {
    const { raw, get, kakaoSays, out } = await setup()
    insert(raw, 'users', { name: '이메일가입', email: 'same@example.test', password_hash: 'pbkdf2$x' })
    kakaoSays({ id: 990001, email: 'same@example.test', name: '카카오사람' })
    const state = await __signOauthStateForTest('/', 'user', 'nonce-2', SECRET)
    const r = await get(`/auth/kakao/sync/callback?code=REAL_CODE&state=${encodeURIComponent(state)}`)
    out.restore()
    expect(r.location, `${r.status} ${r.location}`).toContain('error=email_already_linked')
    expect(r.location).toContain('method=password')
    expect(r.location).not.toContain('database_error')
    expect(q(raw, 'SELECT id FROM users').length).toBe(1)
  })
  it('그 오류 코드에 손님이 읽을 안내 문구가 있다(없으면 "로그인 중 오류가 발생했어요 (코드)" 로 보인다)', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).toMatch(/email_already_linked: '[^']*이메일로 이미 가입/)
  })
})

describe('회원 탈퇴 — 남은 로그인 · 남의 가게 자리 · 카카오로 만든 에이전시', () => {
  async function accountApp() {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const env = { DB, JWT_SECRET: SECRET, ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
    const app = new Hono()
    app.route('/api/account', accountRoutes)
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const { ctx, drain } = makeCtx()
      raw.exec('DELETE FROM rate_limit_attempts')
      const res = await app.request(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 authdoors' }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
      await drain()
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 200) } }
      return { status: res.status, json }
    }
    return { raw, DB, call }
  }

  it('탈퇴한 뒤 다른 기기에 남은 로그인으로는 쓰기를 못 한다(종전: 30일 동안 통과)', async () => {
    const { raw, call } = await accountApp()
    const U = insert(raw, 'users', { name: '탈퇴할사람', email: 'leave@example.test', kakao_id: 'k-1' })
    const phone = await userToken(U), laptop = await userToken(U)
    const before = await call('PATCH', '/api/account/notification-prefs', laptop, { push: false })
    expect(before.status, JSON.stringify(before.json)).toBeLessThan(400)
    const del = await call('DELETE', '/api/account/delete', phone, { reason: '시험' })
    expect(del.status, JSON.stringify(del.json).slice(0, 300)).toBe(200)
    expect(q1<{ name: string }>(raw, 'SELECT name FROM users WHERE id = ?', U)?.name).toBe('탈퇴 회원')
    const after = await call('PATCH', '/api/account/notification-prefs', laptop, { push: true })
    expect([after.status, after.json.code]).toEqual([401, 'ACCOUNT_DELETED'])
  })

  it('탈퇴하면 남의 가게에 받아 둔 운영 자리가 회수된다', async () => {
    const { raw, call } = await accountApp()
    const U = insert(raw, 'users', { name: '직원', email: 'staff@example.test', kakao_id: 'k-2' })
    const S = insert(raw, 'sellers', { username: 'other-store', password_hash: '', name: '남의사장', email: 'o@example.test', business_name: '남의가게', status: 'approved' })
    insert(raw, 'seller_operators', { seller_id: S, user_id: U, role: 'operator' })
    const del = await call('DELETE', '/api/account/delete', await userToken(U), { reason: '시험' })
    expect(del.status, JSON.stringify(del.json).slice(0, 300)).toBe(200)
    expect(q1<{ revoked_at: string | null }>(raw, 'SELECT revoked_at FROM seller_operators WHERE user_id = ?', U)?.revoked_at).toBeTruthy()
  })

  it('카카오로 만든 에이전시의 주인은 에이전시를 정리하기 전에는 탈퇴할 수 없다', async () => {
    const { raw, DB, call } = await accountApp()
    await ensureAgencyConsoleTables(DB)
    const U = insert(raw, 'users', { name: '에이전시주인', email: 'ag@example.test', kakao_id: 'k-3' })
    const A = insert(raw, 'agency_accounts', { name: '시험에이전시', kind: 'individual', status: 'active' })
    insert(raw, 'agency_staff', { agency_id: A, email: 'kakao-3@agency.invalid', name: '주인', role: 'admin', is_owner: 1, status: 'active', tokens_valid_after: 0, user_id: U })
    const tok = await userToken(U)
    const blockers = await call('GET', '/api/account/delete-blockers', tok)
    expect(JSON.stringify(blockers.json)).toContain('"owned_agencies":1')
    const del = await call('DELETE', '/api/account/delete', tok, { reason: '시험' })
    expect([del.status, del.json.code]).toEqual([409, 'DELETE_BLOCKED'])
    expect(q1<{ name: string }>(raw, 'SELECT name FROM users WHERE id = ?', U)?.name).toBe('에이전시주인')
  })
})
