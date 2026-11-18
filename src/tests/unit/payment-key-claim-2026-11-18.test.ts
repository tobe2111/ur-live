/**
 * 🔑🔐 2026-11-18 (대표 *"다 해결해줘"*) — 결제 키 한 개 = 구매 한 곳 · 환불이 주문 전체를 건드리기 전의 문.
 *
 * 진짜 `node:sqlite` 에 넣고 함수를 돌린다.
 *
 * ## ⚠️ 못 보는 것
 * - **토스의 실제 응답.** "재승인 요청에 '이미 처리됨' 으로 답한다" 는 전제는 코드(게이트웨이의 매핑)에서 읽은 것이고
 *   실결제로 재현하지 않았다. 장부는 그 전제가 맞든 틀리든 손해가 없는 쪽으로만 거절한다(승인 전).
 * - 일반 주문 확정(`payment.routes` — 잠금표)과 유어애즈 결제는 장부를 안 쓴다. 그쪽으로 **들어오는** 재사용은
 *   주문 번호가 서버 행에 묶여 있어 막히고, 그쪽에서 **나가는** 재사용은 `orderNumberMustBeOurs` 가 막는다.
 * - 프로모 코드 한도의 동시 요청 초과(`promo_codes` 라이브 0행)는 이번에 안 고쳤다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '@/tests/helpers/source-text'
import { claimPaymentKey, sameClaim } from '@/worker/utils/payment-key-claim'
import { orderHasLiveStay, ORDER_REFUNDED_WHEN_ALL_VOUCHERS_GONE_SQL } from '@/worker/utils/order-refund-guards'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] }
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
      run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } }),
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
    }
    return api
  }
  return { DB: { prepare: (sql: string) => wrap(sql) } as unknown as D1Database, db }
}
const ORDERS = `CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, payment_key TEXT, toss_payment_key TEXT, status TEXT, payment_status TEXT);`

describe('① 결제 키 장부', () => {
  it('처음은 통과 · 같은 구매·같은 주문 재시도는 통과 · 다른 구매는 거절', async () => {
    const { DB, db } = makeD1(); db.exec(ORDERS)
    expect(await claimPaymentKey(DB, 'pk_A', 'seeding-pass', 'SDP-3-basic-1')).toEqual({ ok: true })
    expect(await claimPaymentKey(DB, 'pk_A', 'seeding-pass', 'SDP-3-basic-1')).toEqual({ ok: true }) // 새로고침
    const replay = await claimPaymentKey(DB, 'pk_A', 'gb', 'SDP-3-basic-1') // 같은 값을 이용권 확정에 내민다
    expect(replay).toMatchObject({ ok: false, status: 409, code: 'PAYMENT_KEY_REUSED' })
    expect(await claimPaymentKey(DB, 'pk_A', 'seeding-pass', 'SDP-3-basic-2')).toMatchObject({ ok: false, status: 409 }) // 같은 구매·다른 주문
    expect(await claimPaymentKey(DB, 'pk_B', 'gb', 'GB-1')).toEqual({ ok: true }) // 다른 결제는 무관
  })
  it('주문 번호가 이미 다른 결제의 주문이면 거절(일반 주문 → 이용권 확정)', async () => {
    const { DB, db } = makeD1(); db.exec(ORDERS)
    db.exec(`INSERT INTO orders (id, order_number, payment_key, toss_payment_key) VALUES (1, 'ORD-100', NULL, 'pk_A'), (2, 'GB-200', 'pk_G', NULL)`)
    expect(await claimPaymentKey(DB, 'pk_A', 'gb', 'ORD-100', { orderNumberMustBeOurs: 'ORD-100' })).toMatchObject({ ok: false, status: 409 })
    expect(await claimPaymentKey(DB, 'pk_G', 'gb', 'GB-200', { orderNumberMustBeOurs: 'GB-200' })).toEqual({ ok: true }) // 자기 주문의 재시도
    expect(await claimPaymentKey(DB, 'pk_N', 'gb', 'GB-300', { orderNumberMustBeOurs: 'GB-300' })).toEqual({ ok: true }) // 새 주문
  })
  it('빈 값은 거절 · 장부를 못 읽으면 거절(503)', async () => {
    const { DB, db } = makeD1(); db.exec(ORDERS)
    expect((await claimPaymentKey(DB, '', 'gb', 'x')).ok).toBe(false)
    expect((await claimPaymentKey(DB, 'pk', 'gb', '')).ok).toBe(false)
    const broken = { prepare: () => { throw new Error('D1_ERROR') } } as unknown as D1Database
    expect(await claimPaymentKey(broken, 'pk', 'gb', 'x')).toMatchObject({ ok: false, status: 503, code: 'PAYMENT_CLAIM_UNAVAILABLE' })
  })
  it('sameClaim', () => {
    expect(sameClaim({ scope: 'gb', ref: 'a' }, 'gb', 'a')).toBe(true)
    expect(sameClaim({ scope: 'gb', ref: 'a' }, 'stay', 'a')).toBe(false)
    expect(sameClaim(null, 'gb', 'a')).toBe(false)
  })
  it('토스 승인을 부르는 확정 주소는 전부 장부를 먼저 거친다(잠금 파일·유어애즈 제외)', () => {
    const EXEMPT = new Set([
      'src/worker/routes/payment.routes.ts',            // 잠금표 — 주문 번호가 서버 행에 묶임
      'src/features/marketing/api/ads-pay.routes.ts',   // 유어애즈 — 서버가 저장한 toss_order_id 로만 승인
      'src/worker/utils/checkout.ts',                   // 같은 이름의 다른 함수(옛 유틸)
      'src/worker/utils/toss-gateway.ts', 'src/worker/utils/toss-payments.ts',
    ])
    const sites: string[] = []
    const missing: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) { if (f !== 'tests') walk(p); continue }
        if (!p.endsWith('.ts') || EXEMPT.has(p)) continue
        const code = readCode(p)
        const at = code.search(/await confirmTossPayment\(\{/)
        if (at < 0) continue
        sites.push(p)
        const claim = code.indexOf('.claimPaymentKey(')
        if (claim < 0 || claim > at) missing.push(p)
      }
    }
    walk('src/features'); walk('src/worker')
    expect(sites.length).toBeGreaterThanOrEqual(7)
    expect(missing).toEqual([])
    expect(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')).toMatch(/claimPaymentKey\(DB, paymentKey, 'gb', orderId, \{ orderNumberMustBeOurs: orderId \}\)/)
  })
})

describe('② 이용권 한 장 취소가 주문 전체를 환불됨으로 찍지 않는다', () => {
  it('남은 이용권이 있으면 그대로, 전부 환불됐으면 REFUNDED', () => {
    const { db } = makeD1()
    db.exec(ORDERS + `CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, status TEXT);
      INSERT INTO orders (id, status, payment_status) VALUES (1, 'PAID', 'approved'), (2, 'PAID', 'approved');
      INSERT INTO vouchers (order_id, status) VALUES (1, 'refunded'), (1, 'unused'), (1, 'used'), (2, 'refunded'), (2, 'refunded');`)
    db.prepare(ORDER_REFUNDED_WHEN_ALL_VOUCHERS_GONE_SQL).run(...([1, 1] as never[]))
    db.prepare(ORDER_REFUNDED_WHEN_ALL_VOUCHERS_GONE_SQL).run(...([2, 2] as never[]))
    expect(db.prepare('SELECT id, status FROM orders ORDER BY id').all()).toEqual([{ id: 1, status: 'PAID' }, { id: 2, status: 'REFUNDED' }])
  })
  it('셀프 취소가 그 문장을 쓴다', () => {
    // 2026-11-18: 셀프 취소는 돌려주기 전에 주문에 적는 `bookVoucherRefundOnOrder` 를 거치고, 그 함수가 이 문장을 쓴다.
    expect(readCode('src/features/group-buy/api/voucher-self-cancel-refund.ts')).toContain('await bookVoucherRefundOnOrder(DB, v.order_id, refundAmount)')
    expect(readCode('src/worker/utils/order-refund-guards.ts')).toMatch(/DB\.prepare\(ORDER_REFUNDED_WHEN_ALL_VOUCHERS_GONE_SQL\)\.bind\(orderId, orderId\)/)
  })
})

describe('③ 주문 환불 — 숙소 예약이 살아 있으면 숙소 취소로', () => {
  it('판정', async () => {
    const { DB, db } = makeD1()
    db.exec(`CREATE TABLE stay_bookings (id INTEGER PRIMARY KEY, order_id INTEGER, status TEXT);
      INSERT INTO stay_bookings (order_id, status) VALUES (1, 'confirmed'), (2, 'cancelled'), (3, 'refunded'), (4, 'cancelled'), (4, 'pending');`)
    expect(await orderHasLiveStay(DB, 1)).toBe(true)
    expect(await orderHasLiveStay(DB, 2)).toBe(false)
    expect(await orderHasLiveStay(DB, 3)).toBe(false)
    expect(await orderHasLiveStay(DB, 4)).toBe(true)
    expect(await orderHasLiveStay(DB, 99)).toBe(false) // 숙소가 아닌 주문
  })
  it('모르면 살아 있다고 본다 · 표가 없으면 숙소가 아니다', async () => {
    const boom = (msg: string) => ({ prepare: () => { throw new Error(msg) } }) as unknown as D1Database
    expect(await orderHasLiveStay(boom('D1_ERROR: timeout'), 1)).toBe(true)
    expect(await orderHasLiveStay(boom('no such table: stay_bookings'), 1)).toBe(false)
  })
  it('환불 라우트가 토스 취소보다 먼저 본다', () => {
    const code = readCode('src/worker/routes/order.routes.ts')
    const seg = code.slice(code.indexOf("ordersRouter.post('/refund'"))
    const gate = seg.indexOf('if (await orderHasLiveStay(c.env.DB, order.id)) return c.json(')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(seg.indexOf('getPaymentInfo(body.order_id)'))
  })
})

describe('④ 추천 수수료는 주문 하나에 한 번', () => {
  it('중복 판정이 추천인이 아니라 주문으로 본다', () => {
    const code = readCode('src/worker/utils/affiliate-credit.ts')
    expect(code).toMatch(/'SELECT id FROM affiliate_earnings WHERE order_id = \?'\s*\)\.bind\(order\.id\)\.first\(\)/)
    // (같은 문장이 한 곳 더 남아 있다 — `peekAffiliateIntentRequest` 의 읽기 전용 예산 계산. 적립은 위 한 곳뿐이다.)
    expect(code.match(/WHERE referrer_id = \? AND order_id = \?/g)?.length).toBe(1)
  })
})
