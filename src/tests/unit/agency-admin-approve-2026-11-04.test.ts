/**
 * ✅ **어드민이 '인증 전' 에이전시를 직접 연다** — 2026-11-04 대표 확정
 *   대표: *"에이전시 가입 중에 이메일 인증이 있는데 지금 안돼. 다른 방법 없을까?"* → 안 셋 중 *"2번"*(어드민 승인).
 *   라이브 실측: 그날 가입 두 건 모두 인증 링크가 한 번도 안 눌렸다(서버는 메일을 넘겼고 실패 기록 0 —
 *   받은편지함에 안 닿은 것). 메일이 유일한 문이면 가입자는 '인증 전' 에 갇힌다.
 *
 * 실제 라우트 · 실제 SQLite(node:sqlite) 로 판정한다.
 *   ① pending 에이전시 → 승인 → 계정·주인 직원 active, 남은 인증 링크 삭제
 *   ② 가입 때 정한 비밀번호로 바로 로그인된다
 *   ③ 인증 전이 아닌 에이전시(이용 중·정지)는 409 — 정지된 에이전시를 승인으로 풀 수 없다
 *   ④ 같은 에이전시를 두 번 승인하면 두 번째는 409(멱등)
 *   ⑤ 화면: 인증 전 줄에만 [승인] 버튼
 *
 * ⚠️ 못 보는 것: 어드민 미들웨어 체인(adminApp 의 requireAdmin·IP 화이트리스트)은 여기서 안 돈다 —
 *   대신 라우트 자신의 requireAdminRole 은 실제로 돈다(cs 역할은 403). 화면이 보기 좋은지.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { stripComments } from '../helpers/source-text'
import { agencyAdminRoutes } from '@/features/agency-console/api/agency-admin.routes'
import { agencyConsoleRoutes } from '@/features/agency-console/api/agency-auth.routes'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { hashPassword } from '@/lib/password'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-approve-0123456789'

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
const env = () => ({ DB, JWT_SECRET: SECRET, RESEND_API_KEY: 're_test', RESEND_FROM: 'no-reply@urdeal.kr' })

function adminApp(adminId: number) {
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('user' as never, { id: adminId, type: 'admin' } as never); await next() })
  app.route('/', agencyAdminRoutes)
  return app
}
async function approve(id: number, adminId = 1) {
  const res = await adminApp(adminId).request(`/agency-accounts/${id}/approve`, { method: 'POST' }, env())
  return { status: res.status, data: await res.json() as Record<string, any> }
}
const row = (sql: string, ...a: unknown[]) => db.prepare(sql).get(...(a as never[])) as Record<string, any>

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  db = new DatabaseSync(':memory:')
  DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`CREATE TABLE admins (id INTEGER PRIMARY KEY, role TEXT);
           INSERT INTO admins (id, role) VALUES (1, 'super_admin'), (2, 'cs');`)
  // 로그인 레이트리밋은 저장소가 없으면 429 로 닫힌다(인증성 요청) — 표를 깔아 둔다.
  db.exec('CREATE TABLE rate_limit_attempts (key TEXT, action TEXT, window_start INTEGER, count INTEGER, PRIMARY KEY (key, action, window_start))')
  const hash = await hashPassword('Abcd1234!@')
  db.exec(`INSERT INTO agency_accounts (id, name, kind, status) VALUES
    (1, '아인종합기획', 'business', 'pending'), (2, '정지된 곳', 'individual', 'suspended'), (3, '이용 중', 'individual', 'active')`)
  db.prepare(`INSERT INTO agency_staff (id, agency_id, email, password_hash, role, is_owner, status) VALUES
    (10, 1, 'boss@ain.kr', ?, 'admin', 1, 'pending'), (20, 2, 'b@x.kr', ?, 'admin', 1, 'active'), (30, 3, 'c@x.kr', ?, 'admin', 1, 'active')`)
    .run(hash, hash, hash)
  db.exec(`INSERT INTO agency_tokens (staff_id, kind, token_hash, expires_at) VALUES (10, 'verify', 'h1', '2099-01-01T00:00:00Z')`)
})

describe('어드민 에이전시 승인 (2026-11-04)', () => {
  it('① 인증 전 → 승인하면 계정·주인 직원이 열리고 남은 인증 링크가 지워진다', async () => {
    const r = await approve(1)
    expect(r.status).toBe(200)
    expect(r.data.success).toBe(true)
    expect(row('SELECT status FROM agency_accounts WHERE id = 1').status).toBe('active')
    expect(row('SELECT status FROM agency_staff WHERE id = 10').status).toBe('active')
    expect(row("SELECT COUNT(*) n FROM agency_tokens WHERE staff_id = 10 AND kind = 'verify'").n).toBe(0)
  })

  it('② 승인 뒤 가입 때 비밀번호로 바로 로그인된다(승인 전엔 EMAIL_NOT_VERIFIED)', async () => {
    const login = async () => {
      const res = await agencyConsoleRoutes.request('/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'boss@ain.kr', password: 'Abcd1234!@' }),
      }, env())
      return { status: res.status, data: await res.json() as Record<string, any> }
    }
    const before = await login()
    expect(before.data, JSON.stringify(before)).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' })
    await approve(1)
    const after = await login()
    expect(after.data.success).toBe(true)
    expect(after.data.agency?.name).toBe('아인종합기획')
  })

  it('③ 정지·이용 중 에이전시는 승인 대상이 아니다(409) — 정지를 승인으로 풀 수 없다', async () => {
    expect((await approve(2)).status).toBe(409)
    expect(row('SELECT status FROM agency_accounts WHERE id = 2').status).toBe('suspended')
    expect((await approve(3)).status).toBe(409)
  })

  it('④ 두 번 승인하면 두 번째는 409', async () => {
    expect((await approve(1)).status).toBe(200)
    expect((await approve(1)).status).toBe(409)
  })

  it('역할: cs 는 승인할 수 없다(super·ops 만)', async () => {
    expect((await approve(1, 2)).status).toBe(403)
    expect(row('SELECT status FROM agency_accounts WHERE id = 1').status).toBe('pending')
  })

  it('⑤ 화면: 인증 전 줄에만 [승인] 버튼이 있고 approve 를 부른다', () => {
    const s = stripComments(readFileSync('src/pages/admin/AdminAgencyAccountsPage.tsx', 'utf-8'))
    expect(s).toMatch(/r\.status === 'pending' && \(\s*<button[^>]*onClick=\{\(\) => approve\(r\)\}/)
    expect(s).toMatch(/\/api\/admin\/agency-accounts\/\$\{row\.id\}\/approve/)
  })
})
