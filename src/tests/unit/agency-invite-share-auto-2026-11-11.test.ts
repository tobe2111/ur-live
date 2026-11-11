/**
 * 🤝 에이전시 몫 자동 확정 (2026-11-11 대표 *"모두가 번거롭지 않게 자동화"* → *"응 그렇게 진행해줘"*)
 *
 * 흐름: 에이전시가 **우리 몫 %** 를 한 번 정해 둔다 → 사장님이 초대 화면에서 그 % 를 보고 [맡기기] →
 *       그 순간 그 매장의 몫(`agency_share_terms`)으로 저장된다. 사장님이 따로 적을 일이 없다.
 *
 * 지키는 것 (진짜 라우트 + 진짜 SQLite):
 *  ① 새로 맡긴 매장에 그 % 가 저장된다 · 사장님이 본 % 와 다르면 409(동의 안 한 % 금지)
 *  ② 0%(정하지 않음)면 아무것도 저장하지 않는다(종전 동작)
 *  ③ 이미 운영 중인 매장은 링크를 다시 눌러도 % 가 바뀌지 않는다(사장님이 따로 정한 값 보존)
 *  ④ 대기 중 요청이 링크로 수락되면 그때 저장된다
 *  ⑤ 몫을 정하는 것은 관리자만(adminOnly) · 사장님 화면이 그 % 를 보여 주고 보낸다
 *
 * ⚠️ 못 보는 것: 돈 이동(이 단계는 저장만 — 지급은 `agency_share_payout_enabled` 뒤, 결재 대기) · 화면 모양 · 라이브 D1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { readCode } from '../helpers/source-text'

let SESSION_USER = 0
vi.mock('@/worker/utils/session', () => ({ parseSessionCookie: async () => (SESSION_USER ? { userId: SESSION_USER } : null) }))
vi.mock('@/lib/system-email', () => ({ buildSystemEmailHtml: () => '', sendSystemEmail: async () => ({}) }))

import { storeAgencyInviteRoutes } from '@/features/seller/api/store-agency-invite.routes'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

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

const TOKEN = 'a'.repeat(64)

async function fresh(pct: number | null) {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT, name TEXT)')
  db.exec('CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER, user_id INTEGER, role TEXT, revoked_at TEXT, granted_by_user_id INTEGER, created_at TEXT)')
  db.exec("INSERT INTO sellers (id, linked_user_id, business_name) VALUES (7, 3, '청룡갈비'), (8, 3, '오레노라멘'), (9, 3, '달빛')")
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec("INSERT INTO agency_accounts (id, name, kind, status) VALUES (1, '리스터', 'business', 'active')")
  if (pct !== null) db.exec(`INSERT INTO agency_share_defaults (agency_id, pct) VALUES (1, ${pct})`)
  db.exec(`INSERT INTO agency_store_invites (agency_id, token, created_by_staff_id, expires_at) VALUES (1, '${TOKEN}', 11, datetime('now', '+30 days'))`)
  return { db, env: { DB, JWT_SECRET: 'x' } }
}

async function accept(env: unknown, body: Record<string, unknown>) {
  const r = await storeAgencyInviteRoutes.request('/accept', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN, ...body }),
  }, env as never)
  return { status: r.status, json: await r.json() as Record<string, unknown> }
}
const terms = (db: Db, sellerId: number) =>
  db.prepare('SELECT pct FROM agency_share_terms WHERE seller_id = ? AND agency_id = 1 ORDER BY id').all(sellerId).map((r) => Number((r as { pct: number }).pct))

beforeEach(() => { SESSION_USER = 3 })

describe('① 맡기는 순간 미리 정한 % 가 저장된다', () => {
  it('초대 조회가 % 를 알려 준다', async () => {
    const { env } = await fresh(3)
    const r = await storeAgencyInviteRoutes.request(`/${TOKEN}`, {}, env as never)
    expect((await r.json() as { sharePct: number }).sharePct).toBe(3)
  })
  it('여러 매장을 한 번에 맡기면 매장마다 저장된다', async () => {
    const { db, env } = await fresh(3)
    const r = await accept(env, { seller_ids: [7, 8], share_pct: 3 })
    expect(r.status).toBe(200)
    expect(terms(db, 7)).toEqual([3])
    expect(terms(db, 8)).toEqual([3])
  })
  it('사장님이 본 % 와 지금 % 가 다르면 맡기지도, 저장하지도 않는다', async () => {
    const { db, env } = await fresh(5)
    const r = await accept(env, { seller_ids: [7], share_pct: 3 })
    expect(r.status).toBe(409)
    expect(r.json.code).toBe('SHARE_CHANGED')
    expect(r.json.sharePct).toBe(5)
    expect(terms(db, 7)).toEqual([])
    expect(db.prepare('SELECT COUNT(*) n FROM agency_store_links').get()).toMatchObject({ n: 0 })
  })
})

describe('② 0% 면 저장하지 않는다', () => {
  it('정하지 않은 에이전시', async () => {
    const { db, env } = await fresh(null)
    expect((await accept(env, { seller_ids: [7], share_pct: 0 })).status).toBe(200)
    expect(terms(db, 7)).toEqual([])
  })
})

describe('③ 이미 운영 중인 매장의 % 는 그대로', () => {
  it('사장님이 따로 2% 로 정해 둔 매장에서 링크를 다시 눌러도 2% 다', async () => {
    const { db, env } = await fresh(3)
    db.exec("INSERT INTO agency_store_links (agency_id, seller_id, status, accepted_at) VALUES (1, 7, 'active', datetime('now'))")
    db.exec("INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, 2, datetime('now'))")
    const r = await accept(env, { seller_ids: [7], share_pct: 3 })
    expect(r.json.already).toBe(true)
    expect(terms(db, 7)).toEqual([2])
  })
})

describe('④ 대기 요청이 링크로 수락되면 그때 저장된다', () => {
  it('pending → active', async () => {
    const { db, env } = await fresh(4)
    db.exec("INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (1, 9, 'pending')")
    await accept(env, { seller_ids: [9], share_pct: 4 })
    expect(db.prepare('SELECT status FROM agency_store_links WHERE seller_id = 9').get()).toMatchObject({ status: 'active' })
    expect(terms(db, 9)).toEqual([4])
  })
})

describe('⑤ 배선', () => {
  it('몫을 정하는 엔드포인트는 관리자만', () => {
    expect(readCode('src/features/agency-console/api/agency-stores.routes.ts'))
      .toMatch(/post\('\/store-invite\/share', cors\(\), requireAgencyStaff\(\{ adminOnly: true \}\)/)
  })
  it('사장님 두 화면(초대 · 등록)이 본 % 를 같이 보낸다', () => {
    expect(readCode('src/pages/StoreAgencyInvitePage.tsx')).toMatch(/seller_ids: picked, share_pct: sharePct/)
    expect(readCode('src/pages/StoreClaimPage.tsx')).toMatch(/seller_id: sellerId, share_pct: inviteShare/)
    expect(readCode('src/pages/store-new/AgencyInviteBanner.tsx')).toMatch(/에이전시 몫 \$\{sharePct\}%/)
  })
})
