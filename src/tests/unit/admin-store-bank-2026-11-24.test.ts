/**
 * 🏦 어드민이 매장 정산 계좌를 대신 입력 (2026-11-24 대표 *"1번 일단 만들어줘봐"*) — `features/admin/api/admin-store-bank.routes.ts`
 * 돈이 가는 곳을 정하는 값이라 **실제 라우트를 진짜 SQLite 로** 돌린다: 검증 · 덮어쓰기 확인 · 감사 로그 · 사장님 알림 · 역할.
 * ⚠️ 못 막는 것: 어드민이 넣은 계좌가 정말 그 사장님 것인지(사람의 확인) · 어드민 인증 미들웨어 자체(다른 시험 몫).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { adminStoreBankRoutes, parseBankInput } from '@/features/admin/api/admin-store-bank.routes'
import { canAdminRoleMutate } from '@/shared/admin-roles'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => { const r = db.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } } },
    }
    return self
  }
  return { prepare: stmt } as unknown as D1Database
}
function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE sellers (id INTEGER PRIMARY KEY, bank_name TEXT, bank_account TEXT, account_holder TEXT, is_verified INTEGER, updated_at TEXT)')
  db.exec('CREATE TABLE dashboard_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_type TEXT, recipient_id TEXT, type TEXT, title TEXT, message TEXT, link TEXT)')
  db.exec('CREATE TABLE admin_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id TEXT, admin_email TEXT, action TEXT, target_type TEXT, target_id TEXT, before_value TEXT, after_value TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT)')
  db.exec("INSERT INTO sellers (id) VALUES (14)")
  db.exec("INSERT INTO sellers (id, bank_name, bank_account, account_holder, is_verified) VALUES (29, 'KB국민은행', '11112222333', '김사장', 0)")
  const app = new Hono<{ Bindings: { DB: D1Database } }>()
  app.route('/', adminStoreBankRoutes)
  const call = (method: string, id: number, body?: unknown) => app.request(`/sellers/${id}/bank-account`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }, { DB: d1(db) })
  return { db, call }
}
const GOOD = { bank_name: '카카오뱅크', bank_account: '3333-01-2345678', account_holder: '정지원' }

describe('입력 검증', () => {
  it('목록의 은행 · 숫자 8~16자리 · 예금주 — 하이픈은 떼고 저장한다', () => {
    expect(parseBankInput(GOOD)).toEqual({ bank_name: '카카오뱅크', bank_account: '3333012345678', account_holder: '정지원' })
  })
  it('목록 밖 은행 · 글자 섞인 번호 · 짧은 번호 · 빈 예금주는 막는다', () => {
    expect(parseBankInput({ ...GOOD, bank_name: '내맘대로은행' })).toHaveProperty('error')
    expect(parseBankInput({ ...GOOD, bank_account: '3333 abc' })).toHaveProperty('error')
    expect(parseBankInput({ ...GOOD, bank_account: '1234567' })).toHaveProperty('error')
    expect(parseBankInput({ ...GOOD, account_holder: '  ' })).toHaveProperty('error')
    expect(parseBankInput({ ...GOOD, account_holder: '<b>x</b>' })).toHaveProperty('error')
  })
})

describe('등록', () => {
  it('계좌 없는 매장에 넣으면 저장 + 재확인 완료 + 사장님 알림', async () => {
    const { db, call } = fresh()
    const r = await call('PUT', 14, GOOD)
    expect(r.status).toBe(200)
    expect(db.prepare('SELECT bank_name, bank_account, account_holder, is_verified FROM sellers WHERE id = 14').get())
      .toEqual({ bank_name: '카카오뱅크', bank_account: '3333012345678', account_holder: '정지원', is_verified: 1 })
    const n = db.prepare('SELECT recipient_id, type, message FROM dashboard_notifications').all() as Array<{ recipient_id: string; type: string; message: string }>
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ recipient_id: '14', type: 'bank_account_changed' })
    expect(n[0].message).toContain('****5678')
    expect(n[0].message).not.toContain('3333012345678') // 알림에 전체 번호를 싣지 않는다
  })
  it('응답과 조회에는 끝 4자리만 나간다', async () => {
    const { call } = fresh()
    const put = await (await call('PUT', 14, GOOD)).json() as { data: Record<string, unknown> }
    expect(put.data.bank_account_masked).toBe('****5678')
    expect(JSON.stringify(put)).not.toContain('3333012345678')
    const get = await (await call('GET', 14)).json() as { data: Record<string, unknown> }
    expect(get.data).toEqual({ registered: true, bank_name: '카카오뱅크', bank_account_masked: '****5678', account_holder: '정지원' })
  })
  it('잘못된 입력은 아무것도 안 바꾼다 · 없는 매장은 404', async () => {
    const { db, call } = fresh()
    expect((await call('PUT', 14, { ...GOOD, bank_account: 'abc' })).status).toBe(400)
    expect(db.prepare('SELECT bank_account FROM sellers WHERE id = 14').get()).toEqual({ bank_account: null })
    expect((await call('PUT', 999, GOOD)).status).toBe(404)
  })
})

describe('덮어쓰기', () => {
  it('이미 계좌가 있으면 확인 없이는 409 — 값이 그대로다', async () => {
    const { db, call } = fresh()
    const r = await call('PUT', 29, GOOD)
    expect(r.status).toBe(409)
    expect((await r.json() as { code: string }).code).toBe('OVERWRITE_CONFIRM_REQUIRED')
    expect(db.prepare('SELECT bank_account FROM sellers WHERE id = 29').get()).toEqual({ bank_account: '11112222333' })
    expect(db.prepare('SELECT COUNT(*) n FROM dashboard_notifications').get()).toEqual({ n: 0 })
  })
  it('확인을 보내면 바뀐다', async () => {
    const { db, call } = fresh()
    expect((await call('PUT', 29, { ...GOOD, confirm_overwrite: true })).status).toBe(200)
    expect(db.prepare('SELECT bank_account, is_verified FROM sellers WHERE id = 29').get()).toEqual({ bank_account: '3333012345678', is_verified: 1 })
  })
})

describe('역할 · 감사 로그 · 배선', () => {
  it('ops·cs·viewer 는 못 바꾼다 — finance·super·admin 만', () => {
    const path = '/api/admin/sellers/14/bank-account'
    expect(canAdminRoleMutate('ops', path)).toBe(false)
    expect(canAdminRoleMutate('cs', path)).toBe(false)
    expect(canAdminRoleMutate('viewer', path)).toBe(false)
    expect(canAdminRoleMutate('finance', path)).toBe(true)
    expect(canAdminRoleMutate('super', path)).toBe(true)
  })
  it('감사 로그에 계좌번호 전체를 남기지 않는다(끝 4자리)', () => {
    const src = readFileSync('src/features/admin/api/admin-store-bank.routes.ts', 'utf8')
    expect(src).toMatch(/action: 'admin_set_seller_bank'/)
    expect(src).toMatch(/after: \{ bank_name: input\.bank_name, bank_account: mask\(input\.bank_account\)/)
  })
  it('어드민 앱에 마운트돼 있고 매장 카드가 그린다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toMatch(/adminApp\.route\('\/', adminStoreBankRoutes\)/)
    expect(readFileSync('src/pages/AdminMerchantCommissionsPage.tsx', 'utf8')).toMatch(/<StoreBankCard sellerId=\{cs\.id\} \/>/)
  })
})
