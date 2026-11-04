/**
 * 🚀 에이전시 첫 화면 안 A + 비밀번호 바꾸기 · 문의 · 로그아웃 맨 아래 · 유어샵 탭 안내 — 2026-11-04 대표
 *   *"들어오면 이런 시안으로만 뜨네 너무 뭐가 없이 나온다"* → *"A로 하자. 그리고 남은 1,2,3도 다 해줘."*
 *   시안: `docs/design/agency-first-screen-2026-11-04.md`.
 *
 * 지키는 것:
 *   ① 매장 0곳 관리자(토스 판)에는 오늘 매출 `—`·할 일 판 대신 '시작하기' 3단계가 서고, 빈 '맡은 매장' 판은 숨는다
 *   ② 시작하기: 0/3 · 맡김 요청이 있으면 1단계가 '요청 보기' · 직원 2명이면 3단계 완료(1/3)
 *   ③ `POST /me/password` — 지금 비밀번호 확인 · 틀리면 잠금 카운트 · 바꾸면 다른 로그인 끊고 새 토큰 · 카카오 계정 409
 *   ④ 에이전시 전용 마이: 비밀번호 바꾸기 · 문의하기 · 로그아웃이 설정 맨 아래
 *   ⑤ 에이전시로만 로그인한 사람이 유어샵 탭(손님 화면)을 보면 '마이에서 관리' 줄
 *
 * ⚠️ 못 보는 것: 실제 화면 모양·다크 대비(그려서 봐야 한다) · D1 과 node:sqlite 차이 · 카카오톡 상담 링크가 열리는지.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { stripComments } from '../helpers/source-text'
import { AgencyGettingStarted } from '@/pages/agency-console/AgencyGettingStarted'
import { agencyStaffRoutes } from '@/features/agency-console/api/agency-staff.routes'
import { agencyConsoleRoutes } from '@/features/agency-console/api/agency-auth.routes'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { hashPassword, verifyPassword } from '@/lib/password'

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const noop = () => {}

describe('① 매장 0곳 첫 화면 배선', () => {
  const s = code('src/pages/agency-console/AgencyStoresPanel.tsx')
  it('토스 판 · 응답 옴 · 오류 없음 · 운영 매장 0 · 관리자일 때만', () => {
    expect(s).toMatch(/const firstRun = toss && !error && rows !== null && active\.length === 0 && canManage/)
  })
  it('firstRun 이면 시작하기, 아니면 오늘 매출 + 할 일 판', () => {
    expect(s).toMatch(/\{firstRun \? \(\s*<AgencyGettingStarted/)
    expect(s).toMatch(/<AgencyTodayCard rows=/)
  })
  it('빈 맡은 매장 판·PC 목록은 숨고, 매장 대신 등록 줄은 체크리스트로 옮겨 간다', () => {
    expect(s).toMatch(/coveredByMine \|\| firstRun \? 'hidden'/)
    expect(s).toMatch(/stacked \|\| firstRun \? 'hidden'/)
    expect(s).toMatch(/canManage && !firstRun && <FlatRow[^\n]*매장 대신 등록/)
  })
  it('AgencySection 이 직원 수와 직원 시트를 넘긴다', () => {
    const sec = code('src/pages/agency-console/AgencySection.tsx')
    expect(sec).toMatch(/staffCount=\{staff \? staff\.length : null\}/)
    expect(sec).toMatch(/onInviteStaff=\{\(\) => setSheet\('staff'\)\}/)
  })
})

describe('② 시작하기 3단계', () => {
  it('처음엔 0/3 · 링크 보내기 · 대신 등록 · 직원 초대', () => {
    const r = render(<AgencyGettingStarted staffCount={1} pendingCount={0} onRegister={noop} onInviteStaff={noop} onRequests={noop} />)
    expect(r.getByText('0 / 3')).toBeTruthy()
    expect(r.getByText('사장님께 영입 링크 보내기')).toBeTruthy()
    expect(r.getByText('링크 보내기')).toBeTruthy()
    expect(r.getByText('유어딜에 없는 매장은 대신 등록')).toBeTruthy()
    expect(r.getByText('함께 일할 직원 초대')).toBeTruthy()
  })
  it('맡김 요청이 있으면 1단계가 요청 보기로 바뀌고 누르면 요청 시트', () => {
    let opened = 0
    const r = render(<AgencyGettingStarted staffCount={1} pendingCount={2} onRegister={noop} onInviteStaff={noop} onRequests={() => { opened++ }} />)
    expect(r.getByText('맡김 요청 2건 수락하기')).toBeTruthy()
    fireEvent.click(r.getByText('요청 보기'))
    expect(opened).toBe(1)
  })
  it('직원이 2명 이상이면 3단계 완료 → 1/3', () => {
    const r = render(<AgencyGettingStarted staffCount={3} pendingCount={0} onRegister={noop} onInviteStaff={noop} onRequests={noop} />)
    expect(r.getByText('1 / 3')).toBeTruthy()
    expect(r.getByText('지금 3명이 함께 써요')).toBeTruthy()
  })
})

// ── ③ 비밀번호 바꾸기 — 실제 라우트 · 실제 SQLite ─────────────────────────────
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-pw-0123456789abcdef'
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
  return { prepare: stmt, batch: async (l: Array<{ run: () => Promise<unknown> }>) => { const o = []; for (const x of l) o.push(await x.run()); return o } } as unknown as D1Database
}
let db: Db
let DB: D1Database
const env = () => ({ DB, JWT_SECRET: SECRET })
const app = new Hono().route('/', agencyStaffRoutes).route('/', agencyConsoleRoutes)
async function tokenFor(id: number) {
  const r = db.prepare('SELECT id, agency_id, role, is_owner FROM agency_staff WHERE id = ?').get(id) as { id: number; agency_id: number; role: string; is_owner: number }
  return (await issueAgencyStaffToken(SECRET, r as never)).token
}
async function change(token: string | null, body: unknown) {
  const res = await app.request('/me/password', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }, env())
  return { status: res.status, data: await res.json() as Record<string, any> }
}

describe('③ POST /me/password', () => {
  beforeEach(async () => {
    db = new DatabaseSync(':memory:')
    DB = d1(db)
    await ensureAgencyConsoleTables(DB)
    const h = await hashPassword('Old1234!@#')
    db.exec("INSERT INTO agency_accounts (id, name, status) VALUES (1, '아인', 'active')")
    db.prepare("INSERT INTO agency_staff (id, agency_id, email, password_hash, role, is_owner, status) VALUES (5, 1, 'boss@ain.kr', ?, 'admin', 1, 'active')").run(h)
    db.exec("INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES (6, 1, 'kakao-9@kakao.agency.urdeal.invalid', 'admin', 0, 'active')")
  })

  it('로그인 없이는 못 바꾼다', async () => {
    expect((await change(null, { current_password: 'Old1234!@#', new_password: 'New5678!@#' })).status).toBe(401)
  })

  it('지금 비밀번호가 틀리면 400 · 잠금 카운트가 쌓이고 · 비밀번호는 그대로', async () => {
    const r = await change(await tokenFor(5), { current_password: 'Wrong999!@', new_password: 'New5678!@#' })
    expect(r.status).toBe(400)
    expect(r.data.code).toBe('WRONG_PASSWORD')
    const row = db.prepare("SELECT failure_count n FROM account_lockouts WHERE user_id = 'staff:5'").get() as { n: number }
    expect(row.n).toBe(1)
    const s = db.prepare('SELECT password_hash FROM agency_staff WHERE id = 5').get() as { password_hash: string }
    expect((await verifyPassword('Old1234!@#', s.password_hash)).valid).toBe(true)
  })

  it('맞으면 바뀌고 · 옛 토큰은 끊기고 · 받은 새 토큰은 산다', async () => {
    const old = await tokenFor(5)
    await new Promise((r) => setTimeout(r, 1100)) // 옛 토큰 iat 가 바꾼 시각보다 앞서게
    const r = await change(old, { current_password: 'Old1234!@#', new_password: 'New5678!@#' })
    expect(r.status).toBe(200)
    expect(typeof r.data.token).toBe('string')
    const s = db.prepare('SELECT password_hash FROM agency_staff WHERE id = 5').get() as { password_hash: string }
    expect((await verifyPassword('New5678!@#', s.password_hash)).valid).toBe(true)
    const me = async (t: string) => (await app.request('/me', { headers: { Authorization: `Bearer ${t}` } }, env())).status
    expect(await me(old)).toBe(401)
    expect(await me(r.data.token)).toBe(200)
  })

  it('카카오로 만든 계정은 409', async () => {
    const r = await change(await tokenFor(6), { current_password: 'x', new_password: 'New5678!@#' })
    expect(r.status).toBe(409)
    expect(r.data.code).toBe('KAKAO_ACCOUNT')
  })

  it('새 비밀번호가 규칙에 안 맞거나 지금과 같으면 400', async () => {
    const t = await tokenFor(5)
    expect((await change(t, { current_password: 'Old1234!@#', new_password: 'short' })).status).toBe(400)
    expect((await change(t, { current_password: 'Old1234!@#', new_password: 'Old1234!@#' })).status).toBe(400)
  })
})

describe('④ 에이전시 전용 마이 설정', () => {
  const s = code('src/pages/agency-console/AgencyMyPage.tsx')
  it('이메일 계정만 비밀번호 바꾸기 · 문의하기는 회사 정보 SSOT 의 카카오 상담', () => {
    expect(s).toMatch(/emailAccount && <ListRow[^\n]*label="비밀번호 바꾸기"/)
    expect(s).toMatch(/label="문의하기"[\s\S]{0,200}COMPANY\.kakaoChatUrl/)
  })
  it('로그아웃은 설정 맨 아래 한 줄이고, 구역 안 로그아웃은 끈다', () => {
    expect(s).toMatch(/<AgencySection headless toss hideLogout/)
    const settings = s.slice(s.indexOf('<SectionTitle>설정</SectionTitle>'))
    const rows = [...settings.matchAll(/<ListRow[\s\S]*?label="([^"]+)"/g)].map((m) => m[1])
    expect(rows[rows.length - 1]).toBe('에이전시 로그아웃')
  })
})

describe('⑤ 유어샵 탭(손님 화면) — 에이전시로만 로그인', () => {
  it('마운트 뒤 에이전시 로그인을 읽어 맨 아래에 마이로 가는 줄', () => {
    const s = code('src/pages/guest/GuestUrShopPage.tsx')
    expect(s).toMatch(/useEffect\(\(\) => \{ try \{ setAgencyOnly\(hasAgencyLogin\(\)\)/)
    expect(s).toMatch(/agencyOnly && \([\s\S]{0,200}to="\/user\/profile"/)
    // 첫 화면을 밀지 않게 손님 안내 묶음(hero) 뒤에 선다
    expect(s.indexOf('agencyOnly && (')).toBeGreaterThan(s.indexOf('GUEST_CLS.hero'))
  })
})
