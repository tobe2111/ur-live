/**
 * 📟🔐 2026-11-18 — 계산대 스캔 기기 키는 만든 사람의 위임과 함께 끝난다 · 에이전시 지급 처리는 상위 관리자만.
 *
 * 진짜 `node:sqlite` 에 넣고 함수를 돌린다(문자열 검사만이 아니다).
 *
 * ## ⚠️ 못 보는 것
 * - 이 변경 이전에 운영자가 만든 키(발급자 기록 없음) — 주인이 목록에서 꺼야 한다.
 * - 에이전시 직원 좌석이 만든 키.
 * - 라이브에서 실제 좌석 토큰으로 발급·회수하는 왕복(운영자 토큰이 없어 못 잰다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'
import { recordScanDeviceIssuer, revokeScanDevicesIssuedBy, revokeAllScanDevices } from '@/worker/utils/scan-device-revoke'
import { revokeOperator } from '@/worker/utils/seller-operators'
import { canAdminRoleMutate } from '@/shared/admin-roles'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] }
    exec: (sql: string) => void
  }
}
type RawDb = InstanceType<typeof DatabaseSync>

function makeD1(): { DB: D1Database; db: RawDb } {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { DB: { prepare: (sql: string) => wrap(sql) } as unknown as D1Database, db }
}

function seed(db: RawDb) {
  db.exec(`
    CREATE TABLE seller_scan_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, name TEXT, token_hash TEXT NOT NULL UNIQUE, created_at TEXT, last_used_at TEXT, revoked_at TEXT);
    CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at DATETIME, revoked_at DATETIME, created_at DATETIME);
    INSERT INTO seller_scan_devices (id, seller_id, name, token_hash) VALUES (1, 10, '주인 기기', 'h1'), (2, 10, '운영자 기기', 'h2'), (3, 10, '다른 운영자 기기', 'h3'), (4, 20, '남의 매장 기기', 'h4');
    INSERT INTO seller_operators (seller_id, user_id, role) VALUES (10, 100, 'owner'), (10, 300, 'operator'), (10, 400, 'operator'), (20, 300, 'operator');
  `)
}
const live = (db: RawDb) => (db.prepare('SELECT id FROM seller_scan_devices WHERE revoked_at IS NULL ORDER BY id').all() as Array<{ id: number }>).map((r) => r.id)

describe('① 스캔 기기 키 — 만든 사람의 위임과 함께 끝난다', () => {
  it('주인 발급분은 발급자 행을 남기지 않는다', async () => {
    const { DB, db } = makeD1(); seed(db)
    await recordScanDeviceIssuer(DB, 1, 10, null)
    await recordScanDeviceIssuer(DB, 2, 10, 300)
    expect(db.prepare('SELECT device_id, user_id FROM seller_scan_device_issuers').all()).toEqual([{ device_id: 2, user_id: 300 }])
  })
  it('위임 회수 → 그 사람이 이 매장에서 만든 키만 꺼진다', async () => {
    const { DB, db } = makeD1(); seed(db)
    await recordScanDeviceIssuer(DB, 2, 10, 300)
    await recordScanDeviceIssuer(DB, 3, 10, 400)
    await recordScanDeviceIssuer(DB, 4, 20, 300) // 같은 사람이 다른 매장에서 만든 키
    const r = await revokeOperator(DB, 10, 300)
    expect(r.ok).toBe(true)
    expect(live(db)).toEqual([1, 3, 4]) // 주인 것 · 다른 운영자 것 · 다른 매장 것은 그대로
  })
  it('직접 호출도 매장을 넘지 않는다', async () => {
    const { DB, db } = makeD1(); seed(db)
    await recordScanDeviceIssuer(DB, 4, 20, 300)
    expect(await revokeScanDevicesIssuedBy(DB, 10, 300)).toBe(0)
    expect(live(db)).toEqual([1, 2, 3, 4])
  })
  it('주인 변경·탈퇴 → 그 매장 키 전부', async () => {
    const { DB, db } = makeD1(); seed(db)
    expect(await revokeAllScanDevices(DB, 10)).toBe(3)
    expect(live(db)).toEqual([4])
  })
  it('배선 — 발급·회수·이전·탈퇴', () => {
    expect(readCode('src/features/seller/api/seller-scan-devices.routes.ts')).toMatch(/recordScanDeviceIssuer\(DB, Number\(r\.meta\?\.last_row_id\), Number\(sellerId\), actor\.isOwner \? null : actor\.operatorUserId\)/)
    expect(readCode('src/worker/utils/store-ownership-transfer.ts')).toMatch(/await revokeAllScanDevices\(DB, sellerId\)/)
    expect(readCode('src/features/seller/api/seller-withdraw.routes.ts')).toMatch(/revokeAllScanDevices\(c\.env\.DB, Number\(seat\)\)/)
  })
})

describe('② 에이전시 지급 처리·매장 이전은 상위 관리자(super·admin)만', () => {
  const paths = ['/api/admin/agency-payouts/7/paid', '/api/admin/agency-payouts/7/reject', '/api/admin/agency-accounts/migrate-broker']
  it('제한 역할은 못 한다', () => {
    for (const p of paths) for (const role of ['ops', 'cs', 'finance', 'viewer'] as const) expect(canAdminRoleMutate(role, p), `${role} ${p}`).toBe(false)
    for (const p of paths) for (const role of ['super', 'admin'] as const) expect(canAdminRoleMutate(role, p), `${role} ${p}`).toBe(true)
  })
})
