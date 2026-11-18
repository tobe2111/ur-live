/**
 * 🌏 외국인 손님 구글 로그인 (2026-11-18 대표 지시).
 *
 * 지키는 것(실제 함수 · 실제 라우트 · 실제 SQLite):
 *   ① id_token 클레임 — aud·iss·exp·email_verified 하나라도 어긋나면 거절
 *   ② state — 서명이 없거나 다른 용도(카카오 state)·다른 키·만료면 거절, 쿠키가 없어도(iOS) 서명이 맞으면 통과
 *   ③ 같은 이메일 회원(카카오)이 있으면 잇지 않고 `/login?error=email_in_use_kakao`
 *   ④ 자격이 없으면 enabled=false · start 는 구글로 가지 않는다
 *   ⑤ 새 회원 → 신원 한 줄(멱등) · 세션 쿠키 + `#st=` 티켓 · 두 번째 로그인은 같은 회원
 *   ⑥ 버튼은 기기 언어가 한국어가 아니고 서버가 켜졌다고 할 때만 — 한국어면 요청조차 안 한다
 *
 * ⚠️ 못 보는 것: 실제 구글 동의 화면·토큰 엔드포인트(자격이 아직 없다 — 인계 문서의 콘솔 절차 뒤 라이브에서 재야 한다)
 *   · D1 과 node:sqlite 의 차이 · 버튼이 보기 좋은지.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import { Hono } from 'hono'
import { render, screen, waitFor } from '@testing-library/react'
import { sign } from 'hono/jwt'
import {
  validateGoogleIdTokenClaims, decodeJwtPayload, isGoogleLoginConfigured, findOrCreateGoogleUser,
} from '@/features/auth/services/google-oauth'
import { googleOauthRoutes, resolveGoogleState, GOOGLE_STATE_PURPOSE, loginErrorPath } from '@/features/auth/api/google.routes'
import { __signOauthStateForTest as signKakaoState } from '@/features/auth/api/kakao.routes'
import { signPurposeState } from '@/worker/utils/oauth-signed-state'
import GoogleLoginButton, { isForeignLanguage } from '@/pages/login/GoogleLoginButton'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-google-login-0123456789'
const CLIENT = 'client-123.apps.googleusercontent.com'
const now = () => Math.floor(Date.now() / 1000)

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = db.prepare(sql).run(...(binds as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    }
    return self
  }
  return { prepare: stmt, batch: async (l: Array<{ run: () => Promise<unknown> }>) => Promise.all(l.map((s) => s.run())) } as unknown as D1Database
}

function freshDb(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, kakao_id TEXT, name TEXT, email TEXT, profile_image TEXT,
    phone TEXT, password_hash TEXT, handle TEXT, email_verified INTEGER, created_at TEXT, last_login_at TEXT, updated_at TEXT)`)
  return db
}

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const idToken = (claims: Record<string, unknown>) => `${b64u({ alg: 'RS256' })}.${b64u(claims)}.sig`
const goodClaims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com', aud: CLIENT, sub: '1100220033', email: 'Visitor@Example.com',
  email_verified: true, name: 'Jane Visitor', picture: 'https://lh3.googleusercontent.com/a/x', exp: now() + 600, ...over,
})

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('① id_token 클레임', () => {
  it('정상 → sub·소문자 이메일·이름', () => {
    expect(validateGoogleIdTokenClaims(decodeJwtPayload(idToken(goodClaims())), CLIENT)).toEqual({
      sub: '1100220033', email: 'visitor@example.com', name: 'Jane Visitor', picture: 'https://lh3.googleusercontent.com/a/x',
    })
    expect(validateGoogleIdTokenClaims(goodClaims({ iss: 'accounts.google.com' }), CLIENT)).not.toBeNull()
    expect(validateGoogleIdTokenClaims(goodClaims({ aud: ['other', CLIENT] }), CLIENT)).not.toBeNull()
  })
  it.each([
    ['다른 클라이언트(aud)', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['다른 발급자(iss)', { iss: 'https://evil.example.com' }],
    ['만료(exp 과거)', { exp: now() - 1 }],
    ['exp 없음', { exp: undefined }],
    ['이메일 미확인', { email_verified: false }],
    ['email_verified 누락', { email_verified: undefined }],
    ['sub 없음', { sub: '' }],
    ['이메일 없음', { email: '' }],
  ])('%s → null', (_n, over) => {
    expect(validateGoogleIdTokenClaims(goodClaims(over), CLIENT)).toBeNull()
  })
  it('모양이 틀린 토큰 · 빈 client id → null', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
    expect(decodeJwtPayload(undefined)).toBeNull()
    expect(validateGoogleIdTokenClaims(goodClaims(), '')).toBeNull()
  })
})

describe('② state', () => {
  it('서명 왕복 · 쿠키 없어도 통과(iOS) · 복귀 주소는 safeRedirect', async () => {
    const s = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: 'n1', r: '/pass/12?via=login&qty=2' }, SECRET)
    expect(await resolveGoogleState(s, 'n1', SECRET)).toEqual({ redirect: '/pass/12?via=login&qty=2', cookieMatched: true })
    expect(await resolveGoogleState(s, null, SECRET)).toEqual({ redirect: '/pass/12?via=login&qty=2', cookieMatched: false })
    const evil = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: 'n', r: '//evil.com' }, SECRET)
    expect((await resolveGoogleState(evil, null, SECRET))?.redirect).toBe('/')
  })
  it('다른 키 · 카카오 state · 만료 · opaque → null', async () => {
    const s = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: 'n', r: '/' }, SECRET)
    expect(await resolveGoogleState(s, null, 'another-secret-0123456789abcdef')).toBeNull()
    expect(await resolveGoogleState(await signKakaoState('/', 'user', 'n', SECRET), null, SECRET)).toBeNull()
    const expired = await sign({ p: GOOGLE_STATE_PURPOSE, n: 'n', r: '/', iat: now() - 4000, exp: now() - 10 }, SECRET)
    expect(await resolveGoogleState(expired, null, SECRET)).toBeNull()
    expect(await resolveGoogleState('3f1c-uuid', null, SECRET)).toBeNull()
  })
})

describe('③⑤ 계정 찾기/만들기', () => {
  it('같은 이메일 카카오 회원 → email_in_use(kakao), 아무것도 안 만든다', async () => {
    const db = freshDb()
    db.exec(`INSERT INTO users (kakao_id, name, email) VALUES ('k-1', '정지원', 'visitor@example.com')`)
    const claims = validateGoogleIdTokenClaims(goodClaims(), CLIENT)!
    expect(await findOrCreateGoogleUser(d1(db), claims)).toEqual({ kind: 'email_in_use', via: 'kakao' })
    expect((db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n).toBe(1)
    expect((db.prepare('SELECT COUNT(*) n FROM user_identities').get() as { n: number }).n).toBe(0)
  })
  it('이메일·비번 회원 → email_in_use(other)', async () => {
    const db = freshDb()
    db.exec(`INSERT INTO users (name, email, password_hash) VALUES ('a', 'visitor@example.com', 'h')`)
    expect(await findOrCreateGoogleUser(d1(db), validateGoogleIdTokenClaims(goodClaims(), CLIENT)!)).toEqual({ kind: 'email_in_use', via: 'other' })
  })
  it('새 회원 → 신원 한 줄 · 두 번째는 같은 회원 · 탈퇴 행은 다시 쓰지 않는다', async () => {
    const db = freshDb(); const D = d1(db)
    const claims = validateGoogleIdTokenClaims(goodClaims(), CLIENT)!
    const a = await findOrCreateGoogleUser(D, claims)
    expect(a.kind).toBe('created')
    const b = await findOrCreateGoogleUser(D, claims)
    expect(b.kind).toBe('existing')
    expect(b.kind !== 'email_in_use' && a.kind !== 'email_in_use' && b.user.id === a.user.id).toBe(true)
    expect(db.prepare('SELECT provider, subject, email FROM user_identities').all()).toEqual([{ provider: 'google', subject: '1100220033', email: 'visitor@example.com' }])
    // 탈퇴(익명화) → 그 구글 계정은 새 회원으로
    db.exec(`UPDATE users SET email = 'deleted_1@deleted.invalid', name = '탈퇴 회원'`)
    const c = await findOrCreateGoogleUser(D, claims)
    expect(c.kind).toBe('created')
  })
})

function app() {
  const a = new Hono()
  a.route('/auth/google', googleOauthRoutes)
  a.route('/api/auth/google', googleOauthRoutes)
  return a
}

describe('④ 자격이 없으면 아무것도 안 한다', () => {
  it('enabled=false · start 는 /login 으로', async () => {
    expect(isGoogleLoginConfigured({})).toBe(false)
    expect(isGoogleLoginConfigured({ GOOGLE_CLIENT_ID: CLIENT })).toBe(false)
    expect(isGoogleLoginConfigured({ GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: ' ' })).toBe(false)
    const env = { JWT_SECRET: SECRET }
    const r = await app().request('/api/auth/google/enabled', {}, env)
    expect(await r.json()).toEqual({ enabled: false })
    const s = await app().request('/auth/google/start?redirect=/pass/1', {}, env)
    expect(s.status).toBe(302)
    expect(s.headers.get('location')).toBe('/login?error=google_unavailable&returnUrl=%2Fpass%2F1')
  })
  it('둘 다 있으면 enabled=true · start 는 구글 동의 화면(scope·prompt·state·쿠키)', async () => {
    const env = { JWT_SECRET: SECRET, GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 'sec' }
    expect(await (await app().request('/api/auth/google/enabled', {}, env)).json()).toEqual({ enabled: true })
    const s = await app().request('https://urdeal.kr/auth/google/start?redirect=/pass/1', {}, env)
    const loc = new URL(s.headers.get('location')!)
    expect(loc.origin + loc.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(loc.searchParams.get('scope')).toBe('openid email profile')
    expect(loc.searchParams.get('prompt')).toBe('select_account')
    expect(loc.searchParams.get('redirect_uri')).toBe('https://urdeal.kr/auth/google/callback')
    expect((await resolveGoogleState(loc.searchParams.get('state'), null, SECRET))?.redirect).toBe('/pass/1')
    expect(s.headers.get('set-cookie')).toMatch(/^google_oauth_state=[^;]+; HttpOnly; Secure; SameSite=Lax/)
    expect(JSON.stringify(Object.fromEntries(s.headers))).not.toContain('sec&') // 시크릿은 브라우저로 안 간다
    expect(loc.searchParams.get('client_secret')).toBeNull()
  })
})

describe('⑤ 콜백 끝까지', () => {
  const env = (db: Db) => ({ DB: d1(db), JWT_SECRET: SECRET, GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 'sec' })
  const stubToken = (claims: Record<string, unknown>) => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims), access_token: 'x' }), { status: 200 }))
    vi.stubGlobal('fetch', f)
    return f
  }
  it('잘못된 state → 구글을 부르지 않고 /login?error=oauth_state_expired', async () => {
    const f = stubToken(goodClaims())
    const r = await app().request('https://urdeal.kr/auth/google/callback?code=c&state=forged', {}, env(freshDb()))
    expect(r.headers.get('location')).toBe('/login?error=oauth_state_expired')
    expect(f).not.toHaveBeenCalled()
  })
  it('새 회원 → 세션 쿠키 + #st= 티켓 + new=1, 토큰 교환은 서버에서 시크릿과 함께', async () => {
    const db = freshDb(); const f = stubToken(goodClaims())
    const state = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: 'n', r: '/pass/7' }, SECRET)
    const r = await app().request(`https://urdeal.kr/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, {}, env(db))
    expect(r.status).toBe(302)
    const loc = r.headers.get('location')!
    expect(loc).toMatch(/^\/pass\/7\?login=success&userId=1&userName=Jane\+Visitor&profileImage=.+&new=1#st=/)
    expect(r.headers.get('set-cookie')).toContain('ur_session=')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const body = new URLSearchParams(String(init.body))
    expect(body.get('client_secret')).toBe('sec')
    expect(body.get('redirect_uri')).toBe('https://urdeal.kr/auth/google/callback')
  })
  it('id_token 클레임이 틀리면(aud) 로그인 안 됨', async () => {
    stubToken(goodClaims({ aud: 'other' }))
    const state = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: 'n', r: '/' }, SECRET)
    const r = await app().request(`https://urdeal.kr/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, {}, env(freshDb()))
    expect(r.headers.get('location')).toBe('/login?error=google_auth_failed')
    expect(r.headers.get('set-cookie') || '').not.toContain('ur_session=ey')
  })
  it('같은 이메일 카카오 회원 → /login?error=email_in_use_kakao (세션 없음)', async () => {
    const db = freshDb()
    db.exec(`INSERT INTO users (kakao_id, name, email) VALUES ('k-1', '정지원', 'VISITOR@example.com')`)
    stubToken(goodClaims())
    const state = await signPurposeState(GOOGLE_STATE_PURPOSE, { n: 'n', r: '/pass/7' }, SECRET)
    const r = await app().request(`https://urdeal.kr/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, {}, env(db))
    expect(r.headers.get('location')).toBe(loginErrorPath('email_in_use_kakao', '/pass/7'))
    expect(r.headers.get('set-cookie') || '').not.toContain('ur_session=ey')
  })
})

describe('⑥ 버튼은 외국어 기기 + 켜짐일 때만', () => {
  const setLang = (l: string) => Object.defineProperty(window.navigator, 'language', { value: l, configurable: true })
  it('isForeignLanguage', () => {
    for (const l of ['ko', 'ko-KR', 'KO-kr']) expect(isForeignLanguage(l)).toBe(false)
    for (const l of ['en-US', 'ja', 'zh-CN', 'fr-FR']) expect(isForeignLanguage(l)).toBe(true)
    expect(isForeignLanguage('')).toBe(false)
  })
  it('한국어 기기 → 요청도 안 하고 안 그린다', async () => {
    setLang('ko-KR')
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const { container } = render(<GoogleLoginButton returnUrl="/" />)
    await new Promise((r) => setTimeout(r, 10))
    expect(f).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
  })
  it('외국어 기기 + enabled=false → 안 그린다', async () => {
    setLang('en-US')
    const f = vi.fn(async () => new Response(JSON.stringify({ enabled: false })))
    vi.stubGlobal('fetch', f)
    const { container } = render(<GoogleLoginButton returnUrl="/" />)
    await waitFor(() => expect(f).toHaveBeenCalledWith('/api/auth/google/enabled', expect.anything()))
    await new Promise((r) => setTimeout(r, 10))
    expect(container.innerHTML).toBe('')
  })
  it('외국어 기기 + enabled=true → Continue with Google', async () => {
    setLang('en-US')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ enabled: true }))))
    render(<GoogleLoginButton returnUrl="/pass/3" />)
    expect(await screen.findByText('Continue with Google')).toBeTruthy()
  })
})
