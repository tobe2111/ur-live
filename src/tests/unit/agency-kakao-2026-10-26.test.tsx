/**
 * 🟡 **카카오로 만든 에이전시** — 2026-10-26 대표 확정
 *   대표: *"아무튼 에이전시 계정은 이메일로만 로그인 되긴 해야해. 카카오 로그인으로 해도 되고, 대신 카카오
 *   로그인 시, 여러명이 함께 관리는 힘들다고 해두면 되는거 아닌가?"* → `AskUserQuestion` *"이메일 계정으로 옮기기 제공"*.
 *
 * 실제 라우트 · 실제 JWT · 실제 SQLite(node:sqlite) 로 판정한다.
 *
 * 지키는 것:
 *   ① 카카오(손님) 로그인으로 에이전시를 바로 만든다 — 한 카카오 계정은 에이전시 하나
 *   ② 셀러 토큰으로는 못 만든다(셀러 id 를 손님 id 로 쓰면 남의 계정과 이어진다)
 *   ③ 카카오 계정은 혼자 쓴다 — 직원 초대가 막힌다
 *   ④ 이메일 계정으로 옮기기 — 확인 메일의 링크를 눌러야 옮겨지고, 그다음 이메일 로그인·초대가 열린다
 *   ⑤ 카카오로 이은 에이전시 로그인은 그 카카오 계정에 묶인다 — 로그아웃·다른 사람이면 지워진다
 *   ⑥ 화면: 가입 화면의 카카오 선택 · 직원 시트의 '혼자 쓰는 계정' · 마이가 한 탭에 한 번 잇는다
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 카카오 세션 쿠키(Bearer 손님 토큰으로 대신한다) · 메일이 실제로 배달되는지 ·
 *   D1 과 node:sqlite 의 차이 · 화면이 보기 좋은지.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { sign as jwtSign } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import { agencyStaffRoutes } from '@/features/agency-console/api/agency-staff.routes'
import { agencyConsoleRoutes } from '@/features/agency-console/api/agency-auth.routes'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import {
  KAKAO_STAFF_EMAIL_DOMAIN, agencyStaffLoginLabel, isKakaoOnlyStaffEmail, kakaoStaffEmail,
} from '@/shared/agency-kakao'
import {
  AGENCY_KAKAO_UID_KEY, AGENCY_PROFILE_KEY_MIRROR, AGENCY_TOKEN_KEY_MIRROR, bindAgencyToKakao, hasAgencyLogin,
} from '@/lib/agency-presence'
import { AGENCY_TOKEN_KEY, PROFILE_KEY } from '@/pages/agency-console/agency-api'
import { KAKAO_AGENCY_PROBE_KEY } from '@/pages/agency-console/agency-kakao-client'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-kakao-0123456789'
const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

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
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

let db: Db
let DB: D1Database
let mails: Array<{ to: string; html: string }>
const env = () => ({ DB, JWT_SECRET: SECRET, RESEND_API_KEY: 're_test', RESEND_FROM: 'no-reply@urdeal.kr', FRONTEND_URL: 'https://urdeal.kr' })

async function userToken(id: number, type = 'user') {
  return jwtSign({ sub: String(id), userId: id, type, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApp = { request: (...a: any[]) => Response | Promise<Response> }
async function call(app: AnyApp, path: string, token: string | null, body?: unknown) {
  const res = await app.request(`/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  }, env())
  return { status: res.status, data: await res.json() as Record<string, any> }
}
const createBody = { kind: 'individual', agency_name: '성수 마케팅랩', agree_terms: true }

beforeEach(async () => {
  db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')
  db.exec("INSERT INTO users (id, name) VALUES (100, '김사장'), (200, '이손님')")
  // 인증성 요청(verify·login)의 횟수 제한은 저장소가 없으면 **닫힌 쪽**(429)으로 실패한다 — 실제와 같게 표를 둔다.
  db.exec('CREATE TABLE rate_limit_attempts (key TEXT, action TEXT, window_start INTEGER, count INTEGER, PRIMARY KEY (key, action, window_start))')
  DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  mails = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.includes('resend.com')) {
      const b = JSON.parse(String(init?.body || '{}'))
      mails.push({ to: Array.isArray(b.to) ? b.to[0] : b.to, html: String(b.html || '') })
      return new Response(JSON.stringify({ id: 'm1' }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe('공용 판정', () => {
  it('자리표시 주소는 배달 안 되는 .invalid 이고, 사람에게는 숨긴다', () => {
    expect(KAKAO_STAFF_EMAIL_DOMAIN.endsWith('.invalid')).toBe(true)
    expect(kakaoStaffEmail(3)).toBe(`kakao-3@${KAKAO_STAFF_EMAIL_DOMAIN}`)
    expect(isKakaoOnlyStaffEmail(kakaoStaffEmail(3))).toBe(true)
    expect(isKakaoOnlyStaffEmail('boss@company.com')).toBe(false)
    expect(agencyStaffLoginLabel(kakaoStaffEmail(3))).toBe('카카오 로그인')
    expect(agencyStaffLoginLabel('boss@company.com')).toBe('boss@company.com')
  })
})

describe('① 카카오로 바로 만든다', () => {
  it('손님 토큰으로 만들면 살아 있는 에이전시 + 주인 직원(자리표시 주소, 비밀번호 없음)', async () => {
    const r = await call(agencyStaffRoutes, '/kakao/create', await userToken(100), createBody)
    expect(r.status).toBe(200)
    expect(r.data.token).toBeTruthy()
    expect(r.data.staff.loginKind).toBe('kakao')
    expect(r.data.staff.isOwner).toBe(true)
    const row = db.prepare('SELECT s.email, s.password_hash, s.status, s.user_id, s.name, a.status AS a FROM agency_staff s JOIN agency_accounts a ON a.id = s.agency_id').get() as Record<string, unknown>
    expect(row).toMatchObject({ email: kakaoStaffEmail(100), password_hash: null, status: 'active', user_id: 100, name: '김사장', a: 'active' })
    expect(mails).toHaveLength(0)
  })
  it('한 카카오 계정은 에이전시 하나 — 두 번째는 같은 에이전시로 들어간다', async () => {
    const t = await userToken(100)
    const a = await call(agencyStaffRoutes, '/kakao/create', t, createBody)
    const b = await call(agencyStaffRoutes, '/kakao/create', t, { ...createBody, agency_name: '다른 이름' })
    expect(b.data.already).toBe(true)
    expect(b.data.agency.id).toBe(a.data.agency.id)
    expect((db.prepare('SELECT COUNT(*) n FROM agency_accounts').get() as { n: number }).n).toBe(1)
    // 선확인이 먼저 막는다 — 둘째 시도는 계정 행을 만들었다 지우지도 않는다(번호가 안 늘어난다).
    //   (유일 인덱스만 남으면 결과 개수는 같지만 매번 만들고 지운다 — 그 차이를 번호로 잰다.)
    expect((db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'agency_accounts'").get() as { seq: number }).seq).toBe(1)
  })
  it('동시에 눌러도 둘째는 유일 인덱스가 막는다(user_id 하나에 직원 행 하나)', () => {
    db.exec("INSERT INTO agency_accounts (id, name, status) VALUES (70, 'a', 'active'), (71, 'b', 'active')")
    db.exec("INSERT INTO agency_staff (agency_id, email, role, status, user_id) VALUES (70, 'x@a.invalid', 'admin', 'active', 300)")
    expect(() => db.exec("INSERT INTO agency_staff (agency_id, email, role, status, user_id) VALUES (71, 'y@a.invalid', 'admin', 'active', 300)")).toThrow()
  })
  it('로그인 없이는 못 만든다', async () => {
    const r = await call(agencyStaffRoutes, '/kakao/create', null, createBody)
    expect(r.status).toBe(401)
  })
})

describe('② 셀러 토큰으로는 안 된다', () => {
  it('type=seller 토큰은 손님이 아니다', async () => {
    const r = await call(agencyStaffRoutes, '/kakao/create', await userToken(100, 'seller'), createBody)
    expect(r.status).toBe(401)
    expect((db.prepare('SELECT COUNT(*) n FROM agency_accounts').get() as { n: number }).n).toBe(0)
  })
})

describe('잇기 — 마이가 부르는 /kakao/session', () => {
  it('이어진 손님은 에이전시 토큰을 받고, 다른 손님은 404', async () => {
    await call(agencyStaffRoutes, '/kakao/create', await userToken(100), createBody)
    const mine = await call(agencyStaffRoutes, '/kakao/session', await userToken(100))
    expect(mine.status).toBe(200)
    expect(mine.data.token).toBeTruthy()
    const other = await call(agencyStaffRoutes, '/kakao/session', await userToken(200))
    expect(other.status).toBe(404)
    expect(other.data.code).toBe('NO_AGENCY')
  })
})

describe('③ 혼자 쓰는 계정 — 초대가 막힌다', () => {
  it('카카오 계정의 초대는 KAKAO_SOLO', async () => {
    const c = await call(agencyStaffRoutes, '/kakao/create', await userToken(100), createBody)
    const r = await call(agencyStaffRoutes, '/staff/invite', c.data.token, { email: 'staff@company.com' })
    expect(r.status).toBe(409)
    expect(r.data.code).toBe('KAKAO_SOLO')
    expect(mails).toHaveLength(0)
  })
})

describe('④ 이메일 계정으로 옮기기', () => {
  it('확인 메일 → 링크 → 이메일 계정이 되고, 이메일 로그인과 초대가 열린다', async () => {
    const c = await call(agencyStaffRoutes, '/kakao/create', await userToken(100), createBody)
    const m = await call(agencyStaffRoutes, '/move-to-email', c.data.token, { email: 'Boss@Company.com', password: 'Strong!Pass123' })
    expect(m.status).toBe(200)
    // 링크를 누르기 전에는 아직 카카오 계정이다
    expect((db.prepare('SELECT email FROM agency_staff').get() as { email: string }).email).toBe(kakaoStaffEmail(100))
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('boss@company.com')
    const token = mails[0].html.match(/kind=move&(?:amp;)?token=([0-9a-f]{64})/)?.[1]
    expect(token).toBeTruthy()

    const v = await call(agencyStaffRoutes, '/verify-move', null, { token })
    expect(v.status).toBe(200)
    expect(v.data.staff.loginKind).toBe('email')
    expect(v.data.staff.email).toBe('boss@company.com')
    // 같은 링크는 한 번만
    expect((await call(agencyStaffRoutes, '/verify-move', null, { token })).status).toBe(400)

    const login = await call(agencyConsoleRoutes, '/login', null, { email: 'boss@company.com', password: 'Strong!Pass123' })
    expect(login.status).toBe(200)
    // 카카오로도 계속 들어올 수 있다(같은 사람)
    expect((await call(agencyStaffRoutes, '/kakao/session', await userToken(100))).status).toBe(200)
    // 초대가 열린다
    const inv = await call(agencyStaffRoutes, '/staff/invite', v.data.token, { email: 'staff@company.com' })
    expect(inv.status).toBe(200)
  })
  it('이미 에이전시가 쓰는 이메일로는 못 옮긴다', async () => {
    db.exec("INSERT INTO agency_accounts (id, name, status) VALUES (90, '남의 회사', 'active')")
    db.exec("INSERT INTO agency_staff (agency_id, email, role, is_owner, status) VALUES (90, 'taken@company.com', 'admin', 1, 'active')")
    const c = await call(agencyStaffRoutes, '/kakao/create', await userToken(100), createBody)
    const m = await call(agencyStaffRoutes, '/move-to-email', c.data.token, { email: 'taken@company.com', password: 'Strong!Pass123' })
    expect(m.status).toBe(409)
    expect(mails).toHaveLength(0)
  })
  it('이메일 계정은 옮길 것이 없다', async () => {
    db.exec("INSERT INTO agency_accounts (id, name, status) VALUES (91, '이메일 회사', 'active')")
    db.exec("INSERT INTO agency_staff (id, agency_id, email, password_hash, role, is_owner, status) VALUES (50, 91, 'a@company.com', 'x', 'admin', 1, 'active')")
    const { issueAgencyStaffToken } = await import('@/features/agency-console/api/agency-session')
    const { token } = await issueAgencyStaffToken(SECRET, { id: 50, agency_id: 91 })
    const m = await call(agencyStaffRoutes, '/move-to-email', token, { email: 'b@company.com', password: 'Strong!Pass123' })
    expect(m.status).toBe(409)
    expect(m.data.code).toBe('NOT_KAKAO_ACCOUNT')
  })
})

describe('⑤ 카카오로 이은 로그인은 그 카카오 계정에 묶인다', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('키 이름이 콘솔과 같다(거울이 갈리면 조용히 안 지워진다)', () => {
    expect(AGENCY_TOKEN_KEY_MIRROR).toBe(AGENCY_TOKEN_KEY)
    expect(AGENCY_PROFILE_KEY_MIRROR).toBe(PROFILE_KEY)
  })
  it('같은 손님이면 남고, 로그아웃·다른 손님이면 지워진다', () => {
    localStorage.setItem('user_id', '100')
    localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 'tok')
    bindAgencyToKakao()
    expect(localStorage.getItem(AGENCY_KAKAO_UID_KEY)).toBe('100')
    expect(hasAgencyLogin()).toBe(true)
    localStorage.setItem('user_id', '200')
    expect(hasAgencyLogin()).toBe(false)
    expect(localStorage.getItem(AGENCY_TOKEN_KEY_MIRROR)).toBeNull()

    localStorage.setItem('user_id', '100')
    localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 'tok')
    bindAgencyToKakao()
    localStorage.removeItem('user_id')
    expect(hasAgencyLogin()).toBe(false)
  })
  it('이메일 로그인(묶음 없음)은 손님 로그인과 무관하게 남는다', () => {
    localStorage.setItem(AGENCY_TOKEN_KEY_MIRROR, 'tok')
    expect(hasAgencyLogin()).toBe(true)
    localStorage.setItem('user_id', '200')
    expect(hasAgencyLogin()).toBe(true)
  })
  it('마이·마이 자리·콘솔 저장이 같은 판정을 쓴다', () => {
    expect(code('src/pages/user-profile/MyAgencyZone.tsx')).toContain("from '@/lib/agency-presence'")
    expect(code('src/routes/agency-console.routes.tsx')).toContain("import { hasAgencyLogin } from '@/lib/agency-presence'")
    expect(code('src/pages/agency-console/agency-api.ts')).toContain('s.removeItem(AGENCY_KAKAO_UID_KEY)')
    const client = code('src/pages/agency-console/agency-kakao-client.ts')
    expect(client.match(/saveAgencySession\(r\.data, true\)\s*bindAgencyToKakao\(\)/g)?.length).toBe(2)
  })
})

describe('⑥ 화면', () => {
  it('가입 화면에 카카오 선택 + 혼자 쓰는 계정 안내', () => {
    const s = code('src/pages/agency-console/AgencySignupPage.tsx')
    expect(s).toContain("['kakao', '카카오로', '혼자 써요']")
    expect(s).toContain('{KAKAO_SOLO_NOTICE}')
    expect(s).not.toContain('카카오가 아니라 이메일로 만들어요')
    expect(s).toContain("navigate(loginPathFromHere('/agency/signup?via=kakao'))")
  })
  it('직원 시트는 혼자 쓰는 계정이면 초대 대신 옮기기', () => {
    expect(code('src/pages/agency-console/AgencySection.tsx')).toContain("const solo = me?.staff.loginKind === 'kakao'")
    expect(code('src/pages/agency-console/AgencyStaffPanel.tsx')).toMatch(/\{solo \? \(/)
  })
  it('마이는 한 탭에 한 번, 첫 화면 뒤에 잇는다(에이전시 코드는 그때 받는다)', () => {
    const z = code('src/pages/user-profile/MyAgencyZone.tsx')
    expect(z).toMatch(/const KAKAO_PROBE_KEY_MIRROR = 'ur_agency_kakao_probe'/)
    expect(KAKAO_AGENCY_PROBE_KEY).toBe('ur_agency_kakao_probe')
    expect(z).toContain('return runAfterLoad(')
    expect(z).toContain('if (!uid || probedThisTab(uid)) return')
    expect(z).toContain("import('@/pages/agency-console/agency-kakao-client')")
    expect(z).not.toMatch(/^import .*agency-kakao-client/m)
  })
  it('이메일로 옮기기 확인 링크는 같은 인증 착지점(kind=move)', () => {
    expect(code('src/pages/agency-console/AgencyVerifyPage.tsx')).toContain("move ? '/verify-move' : '/verify'")
  })
})
