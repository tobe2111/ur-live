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
import { renderPartner, EMBED_HEIGHT } from '@/worker/utils/embed-widget'
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
    // 🎫 대표 확정 시안 B(2026-11-01, 10-31 A 를 대체) — 훅 문장 + 체험단 ↔ 유어딜 비교.
    //   비교의 유어딜 쪽은 정책과 맞는 말만. 비교 블록 마크업은 A 와 byte-동일이다(칸은 CSS 선이 가른다).
    expect(text).toContain('체험단에 지치셨나요?')
    expect(html).toMatch(/<div class="col old"><b>체험단<\/b>[\s\S]*?<\/div><div class="col new"><b>유어딜 이용권<\/b>/)
    for (const claim of ['손님이 선결제', 'QR로 바로 사용', '팔린 만큼 정산', '가입비·월 이용료 0원']) expect(text).toContain(claim)
    expect(text).not.toContain('—') // 대외 문구 em-dash 0(anti-slop)
    expect(text).not.toMatch(/\d+(\.\d+)?\s*%/)
    expect(html).not.toMatch(/<script/i)
    expect(embedSrc('partner', '1', 8, 'light')).toBe('/embed/partner/1')
    expect(embedSnippet('partner', '/embed/partner/1')).toContain(`height:${EMBED_HEIGHT.partner}px`)
  })
  it('시안 B — 두 브랜드가 나란히, 비교는 박스가 아니라 선, 다른 위젯 바탕은 불변', () => {
    const html = renderPartner('light', '한빛 마케팅', 3)
    const src = readFileSync('src/worker/utils/embed-widget.ts', 'utf8')
    // ① 시안 A 잔재 0 — 통짜 파란 띠·절취선·티켓 래퍼가 되살아나면 다시 전단지가 된다.
    for (const dead of ['class="tk"', 'class="band"', 'class="perf"']) expect(html).not.toContain(dead)
    // ② 머리띠에 유어딜 로고와 제휴사 이름이 **나란히**. 이 위젯은 제휴사가 자기 사이트에 거는 물건이라
    //    한쪽이 곁다리로 보이면 제안의 무게가 사라진다.
    expect(html).toMatch(/<div class="bar">[\s\S]*?class="logo"[\s\S]*?<span class="sep"><\/span><span class="co">한빛 마케팅<\/span>/)
    // ③ 비교 두 칸은 색 박스가 아니라 선 하나로 가른다.
    expect(src).toMatch(/\.pt \.new\{[^}]*border-left:1px solid var\(--rule\)/)
    expect(src).not.toMatch(/\.pt \.(old|new)[^{]*\{[^}]*background:/)
    // ④ 🔴 반대 방향 — 바깥 바탕은 제휴 전용 변수(--pbg)다. --bg 를 건드리면 strip·single 위젯이
    //    남의 흰 사이트에서 회색 사각형이 된다(제휴 위젯을 고치다 다른 다섯을 망가뜨리는 길).
    expect(src).toMatch(/\.pt\{[^}]*background:var\(--pbg\)/)
    //    🩸 값을 **파싱해서** 본다. `toContain('--bg:#FFFFFF')` 로 쓰면 뒤에 `--bg:#F8F7FC` 를
    //    덧붙이는 수법에 초록이 뜬다(CSS 는 나중 선언이 이기는데 옛 문자열은 그대로 남는다 — 주입이 잡았다).
    const tok = (name: string) => {
      const m = src.match(new RegExp(`^const ${name} = '([^']*)'`, 'm'))
      if (!m) throw new Error(`${name} 토큰을 못 찾았다 — 이 가드가 헛돌고 있다`)
      return m[1]
    }
    for (const [name, want] of [['LIGHT', '#FFFFFF'], ['DARK', '#11141C']] as const) {
      const decls = tok(name).split(';').filter((d) => d.startsWith('--bg:'))
      expect(decls).toEqual([`--bg:${want}`]) // 정확히 하나, 그리고 그 값
    }
  })

  it('요청 경로에 CSRF 가 걸린다', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toContain("app.use('/api/store-agency-invite/partner-request', csrfProtection())")
  })
})
