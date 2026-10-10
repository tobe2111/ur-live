/**
 * 🎟️ 카운터 사용 처리 — 매장 확인코드를 맞게 넣어도 실패하던 것 (2026-10-10 전수조사)
 *
 * **실제 SQLite 에 넣고** `redeemByCounterSecret` 를 돌려 몇 행이 바뀌는지 센다(문자열 검사 아님).
 *  ① 상품 PIN 이 없고 매장 확인코드가 맞으면 → 사용 처리(종전: 언제나 실패)
 *  ② 상품 PIN 이 있으면 PIN 으로도, 확인코드로도 된다
 *  ③ 틀린 값·빈 값은 안 된다
 *  ④ PIN·확인코드 **둘 다 없는** 상품은 무슨 값을 넣어도 안 된다(코드만 알면 소각되던 07-02 구멍 재발 방지)
 *  ⑤ 남의 매장 확인코드로는 안 된다
 *  ⑥ 이미 쓴 이용권은 다시 안 된다(CAS)
 * ⚠️ 못 보는 것: 라우트의 rate limit·가드 문구(라우트 배선은 아래 배선 시험이 따로 본다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { redeemByCounterSecret } from '@/worker/utils/counter-redeem'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }

let raw: InstanceType<typeof DatabaseSync>
let DB: D1Database
function d1(db: InstanceType<typeof DatabaseSync>): D1Database {
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

beforeEach(() => {
  raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, store_verify_pin TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, code TEXT, product_id INTEGER, status TEXT, used_at TEXT, expires_at TEXT);
    INSERT INTO products VALUES (1, 10, NULL), (2, 20, '4321'), (3, 30, NULL), (4, NULL, NULL), (5, 50, '');
    INSERT INTO vouchers (code, product_id, status) VALUES ('A',1,'unused'),('B',2,'unused'),('C',3,'unused'),('D',4,'unused'),('E',5,'unused');
  `)
  DB = d1(raw)
})
async function setCode(sellerId: number, code: string) {
  await DB.prepare('CREATE TABLE IF NOT EXISTS seller_redemption_settings (seller_id INTEGER PRIMARY KEY, mode TEXT, store_code TEXT, updated_at TEXT)').run()
  await DB.prepare('INSERT INTO seller_redemption_settings (seller_id, mode, store_code) VALUES (?, ?, ?)').bind(sellerId, 'store_code', code).run()
}
const changes = async (code: string, secret: string) => Number((await redeemByCounterSecret(DB, code, secret)).meta?.changes ?? 0)

describe('redeemByCounterSecret', () => {
  it('① 상품 PIN 없음 + 매장 확인코드 일치 → 사용 처리', async () => {
    await setCode(10, '123456')
    expect(await changes('A', '123456')).toBe(1)
  })
  it('② 상품 PIN 이 있으면 PIN 으로도, 확인코드로도 된다', async () => {
    await setCode(20, '777777')
    expect(await changes('B', '4321')).toBe(1)
    raw.exec("UPDATE vouchers SET status='unused' WHERE code='B'")
    expect(await changes('B', '777777')).toBe(1)
  })
  it('③ 틀린 값 · 빈 값은 안 된다', async () => {
    await setCode(10, '123456')
    expect(await changes('A', '000000')).toBe(0)
    expect(await changes('A', '')).toBe(0)
  })
  it('④ PIN·확인코드 둘 다 없는 상품은 어떤 값으로도 안 된다', async () => {
    expect(await changes('C', '')).toBe(0)
    expect(await changes('C', 'anything')).toBe(0)
    expect(await changes('D', '')).toBe(0)    // 플랫폼 상품
    expect(await changes('E', '')).toBe(0)    // 빈 문자열 PIN 은 비밀이 아니다
  })
  it('⑤ 남의 매장 확인코드로는 안 된다', async () => {
    await setCode(10, '123456')
    expect(await changes('C', '123456')).toBe(0)
  })
  it('⑥ 이미 쓴 이용권은 다시 안 된다', async () => {
    await setCode(10, '123456')
    expect(await changes('A', '123456')).toBe(1)
    expect(await changes('A', '123456')).toBe(0)
  })
})

describe('배선', () => {
  it('카운터 경로가 이 함수를 쓴다(손으로 쓴 PIN 전용 UPDATE 로 되돌아가지 않는다)', () => {
    const src = readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8')
    expect(src).toMatch(/const result = await redeemByCounterSecret\(DB, code, pin\)/)
  })
})

describe('ensureStoreCode — 매장이 생기는 순간 확인코드', () => {
  const getRow = (id: number) => raw.prepare('SELECT mode, store_code FROM seller_redemption_settings WHERE seller_id = ?').get(id as never) as { mode: string; store_code: string } | undefined
  it('없으면 6자리 코드를 만들고, 그 코드로 바로 사용 처리가 된다', async () => {
    const { ensureStoreCode } = await import('@/worker/utils/redemption-settings')
    await ensureStoreCode(DB, 10)
    const row = getRow(10)
    expect(row?.store_code).toMatch(/^\d{6}$/)
    expect(row?.mode).toBe('store_code')
    expect(await changes('A', row!.store_code)).toBe(1)
  })
  it('이미 있으면 코드도 모드도 덮어쓰지 않는다(붙여 둔 스티커가 살아 있다)', async () => {
    const { ensureStoreCode } = await import('@/worker/utils/redemption-settings')
    await setCode(10, '123456')
    raw.exec("UPDATE seller_redemption_settings SET mode='scan_only' WHERE seller_id=10")
    await ensureStoreCode(DB, 10)
    expect(getRow(10)).toEqual({ mode: 'scan_only', store_code: '123456' })
  })
  it('빈 문자열 코드는 없는 것으로 보고 채운다', async () => {
    const { ensureStoreCode } = await import('@/worker/utils/redemption-settings')
    await setCode(10, '')
    await ensureStoreCode(DB, 10)
    expect(getRow(10)?.store_code).toMatch(/^\d{6}$/)
  })
  it('배선 — 매장 등록 두 문이 모두 부른다', () => {
    expect(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf8')).toMatch(/await ensureStoreCode\(c\.env\.DB, newSellerId\)/)
    const reg = readFileSync('src/features/seller/api/seller-registration.routes.ts', 'utf8')
    expect(reg).toMatch(/await ensureStoreCode\(db, Number\(newSellerId\)\)/)
    expect(reg).toMatch(/BIZ_CERT_PATH\.test\(fromUserCert\)/)
  })
})
