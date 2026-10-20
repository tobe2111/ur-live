/**
 * 🎁 이용권 선물(넘기기) — 실제 SQLite 로 돌린다 (2026-10-11 대표 결정 "내 이용권 넘기기" + "받은 뒤엔 환불 막기")
 *
 * 지키는 것
 *  ① 받으면 이용권 주인이 받는 사람으로 바뀌고 보낸 사람이 `gift_from_user_id` 에 남는다
 *  ② 링크는 이용권 코드(QR)를 받기 전에 절대 안 준다
 *  ③ 보낸 사람이 그 사이 쓰거나 무르면 받을 수 없고, 선물은 닫힌다(반쯤 넘어간 상태 없음)
 *  ④ 받은 뒤엔 셀프 환불 경로 셋이 막힌다(이용권 취소 · 주문 취소 · 환불 요청), 어드민은 통과
 *  ⑤ 받은 이용권은 다시 선물할 수 없다 · 내가 보낸 선물은 내가 못 받는다 · 회수는 보낸 사람만
 *
 * ⚠️ 못 막는 것: 카카오 공유창이 실제로 뜨는지(브라우저·카카오 앱) — 폰에서 한 번 눌러 봐야 한다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import * as jwt from '@tsndr/cloudflare-worker-jwt'
import { voucherGiftRoutes } from '@/features/group-buy/api/voucher-gift.routes'
import { orderHasGiftedVoucher, newGiftToken, GIFT_TOKEN_RE, noPendingGiftSql, ensureVoucherGiftTable } from '@/worker/utils/voucher-gift'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }

function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  for (const sql of [
    'CREATE TABLE rate_limit_attempts (key TEXT NOT NULL, action TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, UNIQUE(key, action, window_start))',
    'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, firebase_uid TEXT)',
    'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, image_url TEXT, restaurant_name TEXT, restaurant_address TEXT, kt_alpha_gift_code TEXT)',
    'CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, user_id TEXT, code TEXT, status TEXT, expires_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, gift_from_user_id TEXT)',
    'CREATE TABLE user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT, title TEXT, message TEXT, link TEXT)',
    "INSERT INTO users (id, name) VALUES (1, '보낸이'), (2, '친구'), (3, '제3자')",
    "INSERT INTO products (id, name, image_url, restaurant_name, restaurant_address) VALUES (10, '치즈돈가스', 'https://x/img.jpg', '돈가스집', '전주시')",
  ]) db.prepare(sql).run()
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
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

const SECRET = 'test-secret-voucher-gift'
async function auth(userId: string) {
  const now = Math.floor(Date.now() / 1000)
  return { Authorization: `Bearer ${await jwt.sign({ userId, email: `${userId}@x.com`, type: 'user', iat: now, exp: now + 3600 }, SECRET)}`, 'Content-Type': 'application/json' }
}

let DB: D1Database
let env: { DB: D1Database; JWT_SECRET: string }
const FUTURE = "datetime('now', '+30 days')"
async function seedVoucher(id: number, code: string, owner = '1', status = 'unused') {
  await DB.prepare(`INSERT INTO vouchers (id, order_id, product_id, user_id, code, status, expires_at) VALUES (?, ?, 10, ?, ?, ?, ${FUTURE})`)
    .bind(id, 500 + id, owner, code, status).run()
}
async function voucher(id: number) {
  return DB.prepare('SELECT user_id, gift_from_user_id, status FROM vouchers WHERE id = ?').bind(id).first<{ user_id: string; gift_from_user_id: string | null; status: string }>()
}
async function call(path: string, method: 'GET' | 'POST', userId?: string, body?: unknown) {
  const headers = userId ? await auth(userId) : {}
  const res = await voucherGiftRoutes.request(path, { method, headers, body: body ? JSON.stringify(body) : undefined }, env)
  return { status: res.status, json: await res.json() as { success: boolean; data?: Record<string, unknown> | null; code?: string } }
}

beforeEach(async () => {
  DB = makeD1()
  env = { DB, JWT_SECRET: SECRET }
  await seedVoucher(100, 'GBTEST1000')
})

describe('① 받으면 주인이 바뀐다', () => {
  it('만들기 → 같은 링크 재사용 → 받기 → 주인 변경 + 보낸 사람 알림', async () => {
    const a = await call('/', 'POST', '1', { code: 'GBTEST1000', message: '맛있게 먹어' })
    expect(a.status).toBe(200)
    const token = String(a.json.data?.token)
    expect(GIFT_TOKEN_RE.test(token)).toBe(true)
    const b = await call('/', 'POST', '1', { code: 'GBTEST1000' })
    expect(b.json.data?.token).toBe(token)

    const accept = await call(`/${token}/accept`, 'POST', '2')
    expect(accept.status).toBe(200)
    expect(await voucher(100)).toEqual({ user_id: '2', gift_from_user_id: '1', status: 'unused' })
    const n = await DB.prepare("SELECT COUNT(*) AS n FROM user_notifications WHERE user_id = '1' AND type = 'gift_accepted'").first<{ n: number }>()
    expect(n?.n).toBe(1)

    const again = await call(`/${token}/accept`, 'POST', '3')
    expect(again.status).toBe(409)
    expect((await voucher(100))?.user_id).toBe('2')
  })
})

describe('② 받기 전 화면에 코드가 없다', () => {
  it('공개 조회 응답 어디에도 이용권 코드가 없다', async () => {
    const token = String((await call('/', 'POST', '1', { code: 'GBTEST1000' })).json.data?.token)
    const view = await call(`/${token}`, 'GET')
    expect(view.status).toBe(200)
    expect(view.json.data?.state).toBe('pending')
    expect(view.json.data?.product_name).toBe('치즈돈가스')
    expect(JSON.stringify(view.json)).not.toContain('GBTEST1000')
  })
})

describe('③ 보낸 사람이 그 사이 쓰면 받을 수 없다', () => {
  it('사용됨 → 409 + 선물 닫힘 + 주인 그대로', async () => {
    const token = String((await call('/', 'POST', '1', { code: 'GBTEST1000' })).json.data?.token)
    await DB.prepare("UPDATE vouchers SET status = 'used' WHERE id = 100").run()
    expect((await call(`/${token}`, 'GET')).json.data?.state).toBe('unavailable')
    const r = await call(`/${token}/accept`, 'POST', '2')
    expect(r.status).toBe(409)
    expect(r.json.code).toBe('UNAVAILABLE')
    expect((await voucher(100))?.user_id).toBe('1')
    const g = await DB.prepare('SELECT status FROM voucher_gifts WHERE token = ?').bind(token).first<{ status: string }>()
    expect(g?.status).toBe('cancelled')
  })
  it('그 사이 주인이 바뀌었으면(보낸 사람 것이 아니면) 못 가져간다', async () => {
    const token = String((await call('/', 'POST', '1', { code: 'GBTEST1000' })).json.data?.token)
    await DB.prepare("UPDATE vouchers SET user_id = '3' WHERE id = 100").run()
    const r = await call(`/${token}/accept`, 'POST', '2')
    expect(r.status).toBe(409)
    expect((await voucher(100))?.user_id).toBe('3')
  })
})

describe('④ 받은 뒤 환불 경로가 막힌다', () => {
  it('주문 단위 판정 — 받은 선물이 있으면 true, 조회 실패도 true', async () => {
    expect(await orderHasGiftedVoucher(DB, 600)).toBe(false)
    const token = String((await call('/', 'POST', '1', { code: 'GBTEST1000' })).json.data?.token)
    await call(`/${token}/accept`, 'POST', '2')
    expect(await orderHasGiftedVoucher(DB, 600)).toBe(true)
    const broken = { prepare: () => { throw new Error('no such column') } } as unknown as D1Database
    expect(await orderHasGiftedVoucher(broken, 600)).toBe(true)
  })

  it('이용권 셀프 취소 CAS 가 받은 이용권을 건드리지 않는다(소스의 문장을 그대로 실행)', async () => {
    const src = readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8')
    const m = src.match(/`(UPDATE vouchers SET status = 'refunded' WHERE id = \? AND status = 'unused' AND created_at > datetime\('now', '-7 days'\)[^`]*)`/)
    expect(m).not.toBeNull()
    // 2026-10-12: 선물 중 술어가 템플릿으로 들어갔다 — 같은 SSOT 로 펼쳐 실행한다
    m![1] = m![1].replace("${noPendingGiftSql('vouchers.id')}", noPendingGiftSql('vouchers.id'))
    await ensureVoucherGiftTable(DB)
    await DB.prepare("UPDATE vouchers SET gift_from_user_id = '1', user_id = '2' WHERE id = 100").run()
    const r = await DB.prepare(m![1]).bind(100).run()
    expect(r.meta.changes).toBe(0)
    await seedVoucher(101, 'GBTEST1010')
    expect((await DB.prepare(m![1]).bind(101).run()).meta.changes).toBe(1)
  })

  it('세 자리 모두 배선돼 있다 — 주문 취소는 어드민만 통과', () => {
    const vr = stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))
    expect(vr).toMatch(/if \(voucher\.gift_from_user_id\) \{\s*return c\.json\(\{ success: false, error: GIFTED_REFUND_BLOCKED, code: 'GIFTED' \}, 400\)/)
    const or = stripComments(readFileSync('src/worker/routes/order.routes.ts', 'utf8'))
    const i = or.indexOf("if (c.get('user').type !== 'admin' && await orderHasGiftedVoucher(c.env.DB, orderId)) return c.json({ success: false, error: GIFTED_REFUND_BLOCKED")
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(or.indexOf('const vPartial = await tryVoucherPartialRefund('))
    const rr = stripComments(readFileSync('src/features/returns/api/returns.routes.ts', 'utf8'))
    const j = rr.indexOf('if (voucher && await orderHasGiftedVoucher(DB, order.id)) return c.json({ success: false, error: GIFTED_REFUND_BLOCKED')
    expect(j).toBeGreaterThan(0)
    expect(j).toBeLessThan(rr.indexOf('INSERT INTO returns'))
  })

  it('지갑 화면도 받은 이용권엔 취소·환불 버튼을 안 그린다', () => {
    const qr = stripComments(readFileSync('src/pages/my-vouchers/QRModal.tsx', 'utf8'))
    expect(qr).toContain('const canSelfCancel = !gifted &&')
    expect(qr).toContain('const canRequestRefund = !gifted &&')
  })
})

describe('⑤ 경계', () => {
  it('받은 이용권 재선물 금지 · 셀프 받기 금지 · 회수는 보낸 사람만', async () => {
    const token = String((await call('/', 'POST', '1', { code: 'GBTEST1000' })).json.data?.token)
    expect((await call(`/${token}/accept`, 'POST', '1')).json.code).toBe('SELF')
    expect((await call(`/${token}/cancel`, 'POST', '2')).status).toBe(409)
    expect((await call(`/${token}/cancel`, 'POST', '1')).status).toBe(200)
    expect((await call(`/${token}/accept`, 'POST', '2')).status).toBe(409)

    const t2 = String((await call('/', 'POST', '1', { code: 'GBTEST1000' })).json.data?.token)
    expect(t2).not.toBe(token)
    await call(`/${t2}/accept`, 'POST', '2')
    // 2026-10-12: 받으면 코드가 새로 바뀐다(보낸 사람이 옛 QR 로 쓰는 것 차단) — 받은 사람의 새 코드로 시도
    const newCode = (await DB.prepare('SELECT code FROM vouchers WHERE id = 100').first<{ code: string }>())!.code
    expect(newCode).not.toBe('GBTEST1000')
    const re = await call('/', 'POST', '2', { code: newCode })
    expect(re.json.code).toBe('ALREADY_GIFTED')
  })
  it('남의 이용권으로는 링크를 못 만든다', async () => {
    expect((await call('/', 'POST', '3', { code: 'GBTEST1000' })).status).toBe(404)
  })
  it('토큰은 매번 다르고 형식을 지킨다', () => {
    const a = newGiftToken(); const b = newGiftToken()
    expect(a).not.toBe(b)
    expect(GIFT_TOKEN_RE.test(a)).toBe(true)
  })
  it('받기 화면 라우트가 있다', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('<Route path="/gift/v/:token" element={<VoucherGiftReceivePage />} />')
  })
})
