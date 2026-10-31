/**
 * 🤝 제휴사 입점 위젯 (2026-10-31 대표 *"제휴사들이 … 자신들의 사이트에서 유어딜 서비스를 파는거지"* →
 *    확정 "사장님께 입점 영업 · 소개 + 가입 버튼").
 *
 * 지키는 것:
 *   ① 공개 주소로 들어온 요청은 **대기(pending)** 만 — 에이전시가 수락해야 운영이 시작된다
 *      (위젯 코드는 누구나 보므로, 바로 active 를 열면 아무나 아무 매장을 남의 에이전시에 떠넘긴다)
 *   ② 그 매장의 **주인**만 · 로그인 필요 · 정지된 에이전시는 거절
 *   ③ 매장이 없는 사장님은 등록 후 **이 제휴 화면으로 돌아온다**(어느 제휴사인지 잃지 않게)
 *   ④ 위젯 문구에 요율 숫자가 없다(어드민이 바꾸는 값 — 남의 사이트에 박히면 곧 거짓말)
 *   ⑤ 요청 경로에 CSRF
 *
 * ⚠️ 못 보는 것: 브라우저에서 로그인 → 등록 → 되돌아오기 전 과정(라우터·로그인 리다이렉트는 이 시험 밖).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { agencyStoresRoutes } from '@/features/agency-console/api/agency-stores.routes'
import { storeAgencyInviteRoutes } from '@/features/seller/api/store-agency-invite.routes'
import { createSessionCookie } from '@/worker/utils/session'
import { renderPartner } from '@/worker/utils/embed-widget'
import { embedSrc, embedSnippet } from '@/worker/utils/embed-builder'
import { rememberPartner, takePartnerReturn } from '@/utils/partner-return'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-embed-partner-0123'

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

/** 매장 7(주인 100) · 매장 8(주인 11). 에이전시 1 바른대행(관리자 5) · 2 정지됨. */
async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT, name TEXT,
    username TEXT, email TEXT, status TEXT, seller_type TEXT, is_distributor INTEGER, address TEXT)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, status) VALUES (7, 100, '직접카페', 'approved'), (8, 11, '옛날분식', 'approved')`)
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active'), (2, '정지대행', 'suspended')`)
  db.exec(`INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES (5, 1, 'boss@ag.kr', 'admin', 1, 'active')`)
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  app.route('/api/store-agency-invite', storeAgencyInviteRoutes)
  app.route('/api/agency-console', agencyStoresRoutes)
  const env = { DB, JWT_SECRET: SECRET }
  return {
    db,
    lookup: (id: string | number) => app.request(`/api/store-agency-invite/partner/${id}`, {}, env),
    request: (body: unknown, cookie?: string) => app.request('/api/store-agency-invite/partner-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
    }, env),
    agency: async (method: string, path: string) => {
      const { token } = await issueAgencyStaffToken(SECRET, { id: 5, agency_id: 1 })
      return app.request(`/api/agency-console${path}`, { method, headers: { Authorization: `Bearer ${token}` } }, env)
    },
  }
}
const cookieOf = async (userId: number) => (await createSessionCookie(userId, '사장님', 'o@x.kr', null, SECRET)).split(';')[0]

describe('① 공개 주소 → 요청(pending)만, 에이전시가 수락해야 시작', () => {
  it('주인이 요청하면 pending 행이 생기고, 에이전시 수락 뒤에야 active', async () => {
    const t = await fresh()
    const r = await t.request({ agency_id: 1, seller_id: 7 }, await cookieOf(100))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ success: true, agencyName: '바른대행', status: 'pending' })
    const row = t.db.prepare('SELECT id, status, requested_by_user_id FROM agency_store_links WHERE seller_id = 7').get() as { id: number; status: string; requested_by_user_id: number }
    expect(row.status).toBe('pending')
    expect(row.requested_by_user_id).toBe(100)
    // 수락 전엔 직원이 못 들어간다
    expect((await t.agency('POST', '/stores/7/seat')).status).not.toBe(200)
    expect((await t.agency('POST', `/stores/${row.id}/accept`)).status).toBe(200)
    expect((t.db.prepare('SELECT status FROM agency_store_links WHERE id = ?').get(row.id) as { status: string }).status).toBe('active')
  })
  it('같은 에이전시에 두 번 보내면 이미 요청함으로 알린다(행은 하나)', async () => {
    const t = await fresh()
    await t.request({ agency_id: 1, seller_id: 7 }, await cookieOf(100))
    const again = await (await t.request({ agency_id: 1, seller_id: 7 }, await cookieOf(100))).json()
    expect(again).toMatchObject({ success: true, already: true, status: 'pending' })
    expect((t.db.prepare('SELECT COUNT(*) AS n FROM agency_store_links WHERE seller_id = 7').get() as { n: number }).n).toBe(1)
  })
})

describe('② 로그인 · 주인 · 살아 있는 에이전시', () => {
  it('비로그인 401 · 남의 매장 403 · 정지·없는 에이전시 404', async () => {
    const t = await fresh()
    expect((await t.request({ agency_id: 1, seller_id: 7 })).status).toBe(401)
    expect((await t.request({ agency_id: 1, seller_id: 7 }, await cookieOf(11))).status).toBe(403)
    expect((await t.request({ agency_id: 2, seller_id: 7 }, await cookieOf(100))).status).toBe(404)
    expect((await t.request({ agency_id: 99, seller_id: 7 }, await cookieOf(100))).status).toBe(404)
    expect((t.db.prepare('SELECT COUNT(*) AS n FROM agency_store_links').get() as { n: number }).n).toBe(0)
  })
  it('조회 — 살아 있으면 이름, 아니면 404', async () => {
    const t = await fresh()
    expect(await (await t.lookup(1)).json()).toMatchObject({ success: true, agencyName: '바른대행' })
    expect((await t.lookup(2)).status).toBe(404)
    expect((await t.lookup('abc')).status).toBe(404)
  })
})

describe('③ 등록하고 돌아오기', () => {
  beforeEach(() => { try { localStorage.clear() } catch { /* */ } })
  it('기억한 제휴사로 한 번만 돌아오고, 7일이 지나면 잊는다', () => {
    rememberPartner(3, 1_000)
    expect(takePartnerReturn(2_000)).toBe('/store/partner/3')
    expect(takePartnerReturn(3_000)).toBeNull()
    rememberPartner(3, 0)
    expect(takePartnerReturn(8 * 24 * 3600 * 1000)).toBeNull()
  })
  it('매장 등록 완료가 그 기억을 읽는다 · 제휴 화면이 기억을 남긴다', () => {
    const claim = readFileSync('src/pages/StoreClaimPage.tsx', 'utf8')
    expect(claim).toMatch(/navigate\(takePartnerReturn\(\) \?\? MY_PATH, \{ replace: true \}\)/)
    const page = readFileSync('src/pages/StoreAgencyInvitePage.tsx', 'utf8')
    expect(page).toMatch(/if \(partnerId\) rememberPartner\(partnerId\)/)
    expect(page).toMatch(/partner-request/)
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/<Route path="\/store\/partner\/:agencyId" element=\{<ProtectedRoute requireUser>/)
  })
})

describe('④ 위젯 · ⑤ CSRF', () => {
  it('버튼이 제휴 화면으로 가고, 숫자(요율)를 적지 않으며, 이름은 탈출', () => {
    const html = renderPartner('light', '<i>바른</i>대행', 1)
    expect(html).toContain('href="/store/partner/1?utm_source=embed&amp;utm_medium=partner"')
    expect(html).toContain('&lt;i&gt;바른&lt;/i&gt;대행')
    const text = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ')
    expect(text).toContain('유어딜 입점 신청') // 본문을 실제로 읽고 있다는 증거
    expect(text).not.toMatch(/\d+(\.\d+)?\s*%/)
    expect(html).not.toMatch(/<script/i)
    expect(embedSrc('partner', '1', 8, 'light')).toBe('/embed/partner/1')
    expect(embedSnippet('partner', '/embed/partner/1')).toContain('height:260px')
  })
  it('요청 경로에 CSRF 가 걸린다', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toContain("app.use('/api/store-agency-invite/partner-request', csrfProtection())")
  })
})
