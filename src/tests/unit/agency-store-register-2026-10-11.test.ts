/**
 * 🏢 2026-10-11 대표 *"모두 다 하자"* — 대신 등록·운영은 **에이전시 계정 하나로**
 *   (결재 `docs/decisions/2026-10-11-agency-ideal-open-questions.md` 안 1).
 *
 * 두 가지를 판정한다:
 *   ① 에이전시가 매장을 대신 등록한다 — 실제 라우트 · 실제 SQLite. 결과는 개인 중개 등록과 같되
 *      **돈 쪽은 하나도 안 건드린다**(에이전시 몫 요율·영입 귀속 없음 — 3단계 머니 경로).
 *   ② 개인 카카오 계정의 '중개' 등록 문은 닫혔다 — 서버 410 + 모달 안내(스위치 `PERSONAL_BROKER_SIGNUP_DISABLED`).
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - `POST /api/seller/stores` 를 실제로 부르지는 않는다(그 핸들러는 카카오 세션·국세청·R2 를 다 끌고 온다) —
 *   410 거절은 **배선 순서**로 고정한다(행이 생기기 전, 요율 검증보다 앞).
 * - D1 과 node:sqlite 의 차이 · 사장님이 승계 코드로 소유권을 받는 뒤쪽 흐름(종전 `/store-claims` 그대로 — 기존 시험 몫).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import { stripComments } from '../helpers/source-text'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { issueAgencyStaffToken } from '@/features/agency-console/api/agency-session'
import { agencyStoresRoutes } from '@/features/agency-console/api/agency-stores.routes'
import { validateAgencyStoreBody } from '@/features/agency-console/api/agency-store-register'
import { verifyStoreSeat, invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { resolveStoreOwnerUserId } from '@/worker/utils/seller-operators'
import { PERSONAL_BROKER_SIGNUP_DISABLED } from '@/shared/feature-flags'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
const SECRET = 'test-secret-agency-register-0123'

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

async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, linked_user_id INTEGER, business_name TEXT, name TEXT,
    username TEXT, email TEXT, password_hash TEXT, business_number TEXT UNIQUE, phone TEXT, address TEXT, seller_type TEXT,
    status TEXT, is_distributor INTEGER, business_registration_image_url TEXT, created_at TEXT, updated_at TEXT)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  db.exec('CREATE TABLE rate_limit_attempts (key TEXT, action TEXT, window_start INTEGER, count INTEGER, PRIMARY KEY (key, action, window_start))')
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec(`INSERT INTO agency_accounts (id, name, status) VALUES (1, '바른대행', 'active')`)
  db.exec(`INSERT INTO agency_staff (id, agency_id, email, role, is_owner, status) VALUES
    (5, 1, 'boss@ag.kr', 'admin', 1, 'active'), (6, 1, 'staff@ag.kr', 'staff', 0, 'active')`)
  invalidateStoreSeatCache(DB)
  const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>()
  app.route('/api/agency-console', agencyStoresRoutes)
  const call = async (path: string, staff: number, body?: unknown) => {
    const token = (await issueAgencyStaffToken(SECRET, { id: staff, agency_id: 1 })).token
    return app.request(`/api/agency-console${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, { DB, JWT_SECRET: SECRET })
  }
  return { db, DB, call }
}

const GOOD = { name: '성수 김밥', address: '서울 성동구 성수이로 1', manager_phone: '010-1234-5678', terms_agreed_version: '1.0' }
const meta = (db: Db, sellerId: number) =>
  Object.fromEntries((db.prepare('SELECT key, value FROM seller_meta WHERE seller_id = ?').all(sellerId) as Array<{ key: string; value: string }>)
    .map((r) => [r.key, r.value]))

describe('① 에이전시가 매장을 대신 등록한다', () => {
  it('관리자가 올리면 매장(승인 대기) + 맡김(바로 운영 중) + 사장님 승계 코드가 생긴다', async () => {
    const { db, call } = await fresh()
    const r = await call('/stores/register', 5, GOOD)
    expect(r.status).toBe(200)
    const j = await r.json() as { data: { seller_id: number; status: string; owner_claim_code: string; owner_claim_url: string } }
    const id = j.data.seller_id
    expect(j.data.status).toBe('pending')
    expect(j.data.owner_claim_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(j.data.owner_claim_url).toContain(`/store/find?code=${encodeURIComponent(j.data.owner_claim_code)}`)
    expect(db.prepare('SELECT status, name FROM sellers WHERE id = ?').get(id)).toEqual({ status: 'pending', name: '성수 김밥' })
    expect(db.prepare('SELECT agency_id, status, decided_by_staff_id FROM agency_store_links WHERE seller_id = ?').get(id))
      .toEqual({ agency_id: 1, status: 'active', decided_by_staff_id: 5 })
    const m = meta(db, id)
    expect(m).toMatchObject({ registered_by_agency_id: '1', registered_by_agency_staff_id: '5', manager_phone: '01012345678', store_channel: 'brokered' })
  })

  it('💰 돈 쪽은 안 건드린다 — 에이전시 몫 요율·영입 귀속이 없다', async () => {
    const { db, call } = await fresh()
    const id = ((await (await call('/stores/register', 5, GOOD)).json()) as { data: { seller_id: number } }).data.seller_id
    const m = meta(db, id)
    expect(m.broker_share_pct).toBeUndefined()
    expect(m.broker_user_id).toBeUndefined()
    expect(m.influencer_pct_cap).toBeUndefined()
    const src = stripComments(readFileSync('src/features/agency-console/api/agency-store-register.ts', 'utf-8'))
    expect(src).not.toMatch(/saveBrokerTerms|finalizeBrokeredStore|matchProspectOnSignup|introduced_by_influencer_id/)
  })

  it('사장님 자리는 비어 있다(승계 코드로 신청 가능) · 사람 운영자 행이 없다 · 들어가는 길은 에이전시 좌석', async () => {
    const { db, DB, call } = await fresh()
    const id = ((await (await call('/stores/register', 5, GOOD)).json()) as { data: { seller_id: number } }).data.seller_id
    expect(await resolveStoreOwnerUserId(DB, id)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM seller_operators WHERE seller_id = ?').get(id)).toEqual({ n: 0 })
    const seat = await call(`/stores/${id}/seat`, 6)
    expect(seat.status).toBe(200)
    const token = ((await seat.json()) as { data: { seller_token: string } }).data.seller_token
    const v = await verifyStoreSeat(DB, await verify(token, SECRET, 'HS256') as never)
    expect(v).toMatchObject({ kind: 'live', sellerId: id, userId: null, agency: true })
  })

  it('판매자 이용약관 동의를 대신 등록한 직원 이름으로 남긴다', async () => {
    const { db, call } = await fresh()
    const id = ((await (await call('/stores/register', 5, GOOD)).json()) as { data: { seller_id: number } }).data.seller_id
    expect(db.prepare("SELECT user_id, terms_slug, terms_version FROM terms_consents WHERE subject_type = 'seller' AND subject_id = ?").get(String(id)))
      .toEqual({ user_id: 'agency_staff:5', terms_slug: 'seller', terms_version: '1.0' })
  })

  it('직원(관리자 아님)은 대신 등록할 수 없다 — 매장은 안 생긴다', async () => {
    const { db, call } = await fresh()
    expect((await call('/stores/register', 6, GOOD)).status).toBe(403)
    expect(db.prepare('SELECT COUNT(*) AS n FROM sellers').get()).toEqual({ n: 0 })
  })

  it('사장님 휴대폰·약관 동의가 없으면 행을 만들기 전에 400', async () => {
    const { db, call } = await fresh()
    expect((await call('/stores/register', 5, { ...GOOD, manager_phone: '02-123-4567' })).status).toBe(400)
    expect((await call('/stores/register', 5, { ...GOOD, terms_agreed_version: undefined })).status).toBe(400)
    expect(db.prepare('SELECT COUNT(*) AS n FROM sellers').get()).toEqual({ n: 0 })
    expect(validateAgencyStoreBody({ ...GOOD, business_cert_url: 'https://evil.example/x.jpg' })).toMatch(/올바르지/)
    expect(validateAgencyStoreBody({ ...GOOD, business_number: '123' })).toMatch(/10자리/)
    expect(validateAgencyStoreBody(GOOD)).toBeNull()
  })

  it('이미 유어딜에 있는 가게(같은 카카오 플레이스)는 새로 만들지 않고 초대 링크로 보낸다', async () => {
    const { db, call } = await fresh()
    expect((await call('/stores/register', 5, { ...GOOD, kakao_place_id: 'kp-1' })).status).toBe(200)
    const again = await call('/stores/register', 5, { ...GOOD, kakao_place_id: 'kp-1' })
    expect(again.status).toBe(409)
    expect(((await again.json()) as { code: string }).code).toBe('STORE_EXISTS')
    expect(db.prepare('SELECT COUNT(*) AS n FROM sellers').get()).toEqual({ n: 1 })
  })

  it('같은 사업자번호의 두 번째 매장도 등록된다(컬럼은 첫 매장만 · 번호는 meta 에)', async () => {
    const { db, call } = await fresh()
    expect((await call('/stores/register', 5, { ...GOOD, business_number: '1234567890' })).status).toBe(200)
    const r = await call('/stores/register', 5, { ...GOOD, name: '성수 김밥 2호점', business_number: '123-45-67890' })
    expect(r.status).toBe(200)
    const id = ((await r.json()) as { data: { seller_id: number } }).data.seller_id
    expect(db.prepare('SELECT business_number FROM sellers WHERE id = ?').get(id)).toEqual({ business_number: null })
    expect(Object.values(meta(db, id))).toContain('1234567890')
  })
})

describe('② 개인 카카오 계정의 "중개" 등록 문은 닫혔다', () => {
  const stores = stripComments(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf-8'))
  const modal = stripComments(readFileSync('src/components/seller/StoreRegisterModal.tsx', 'utf-8'))

  it('스위치는 켜져 있다(닫힘)', () => {
    expect(PERSONAL_BROKER_SIGNUP_DISABLED).toBe(true)
  })

  it('서버는 brokered 를 410 으로 거절한다 — 요율 검증·행 생성보다 앞에서', () => {
    const gate = stores.indexOf("b.channel === 'brokered' && PERSONAL_BROKER_SIGNUP_DISABLED")
    expect(gate).toBeGreaterThan(0)
    expect(stores.slice(gate, gate + 300)).toMatch(/BROKERED_VIA_AGENCY'.*410/)
    expect(gate).toBeLessThan(stores.indexOf('const brokerTerms = prepareBrokerTerms(b)'))
    expect(gate).toBeLessThan(stores.indexOf('INSERT INTO sellers'))
  })

  it('모달은 중개를 고르면 요율 입력 대신 에이전시 안내를 띄우고, 제출을 막는다', () => {
    expect(modal).toMatch(/channel === 'brokered' && PERSONAL_BROKER_SIGNUP_DISABLED && <BrokeredViaAgencyNote \/>/)
    expect(modal).toMatch(/channel === 'brokered' && !PERSONAL_BROKER_SIGNUP_DISABLED && \(/)
    expect(modal).toMatch(/if \(channel === 'brokered' && PERSONAL_BROKER_SIGNUP_DISABLED\) return BROKERED_VIA_AGENCY_MSG/)
  })

  it('서버와 모달이 같은 문장을 쓴다(SSOT)', () => {
    expect(stores).toMatch(/import \{ BROKERED_VIA_AGENCY_MSG \} from '@\/shared\/agency-copy'/)
    const note = readFileSync('src/components/seller/BrokeredViaAgencyNote.tsx', 'utf-8')
    expect(note).toMatch(/from '@\/shared\/agency-copy'/)
    expect(note).toMatch(/AGENCY_SIGNUP_PATH/)
  })

  it('에이전시 콘솔에 [매장 대신 등록]이 있다(닫은 문의 대체 경로)', () => {
    const panel = readFileSync('src/pages/agency-console/AgencyStoresPanel.tsx', 'utf-8')
    expect(panel).toMatch(/<AgencyRegisterStoreCard onRegistered=\{load\} \/>/)
    const card = readFileSync('src/pages/agency-console/AgencyRegisterStoreCard.tsx', 'utf-8')
    expect(card).toMatch(/'\/stores\/register'/)
  })
})
