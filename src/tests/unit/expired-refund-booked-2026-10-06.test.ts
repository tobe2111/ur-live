/**
 * 🧾 만료 환불을 **주문 장부에 적는다** — 같은 돈이 두 번 나가는 것을 막는다 (2026-10-06)
 *
 * 결재 `docs/decisions/2026-10-02-expired-refund-not-booked.md` (대표 2026-10-06 "모두 다 해줘").
 *
 * ## 무엇이 깨져 있었나 (2026-10-02 라이브 실측)
 *
 * 만료 환불이 처음 돌아 user 3 에게 **1,800딜이 실제로 들어갔는데** `orders.refunded_amount` 는
 * **0 그대로**였다. 그 칸은 전액환불 경로의 **상한**이다(`order-refund.ts` →
 * `amount = total_amount − refunded_amount`) ⇒ 어드민·셀러·주문 세 자리 중 하나에서 그 주문에
 * 환불을 누르면 `1800 − 0 = 1800` 이 **또** 나간다. **1,800 받고 3,600 환불.**
 *
 * ## 이 시험이 **문자열이 아니라 실행으로** 판정한다
 *
 * `node:sqlite` 에 주문 1건 + 이용권을 넣고 **SSOT SQL 을 실제로 돌린** 뒤, 전액환불 경로와 **같은
 * 식**으로 두 번째 환불액을 계산해 **0** 인지 센다. 문자열 비교는 SQL 의미를 못 본다 —
 * 2026-09-30 에 깨진 것이 정확히 의미였다(같은 모듈 주석 참조).
 *
 * ⚠️ **이 시험이 못 보는 것**: 라이브 cron 이 실제로 이 SQL 을 부르는지는 배선이고, 그건 아래
 *   `describe('배선')` 이 소스로 본다. 실제 발화는 **staging(S-EXBOOK)** 이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readCode } from '../helpers/source-text'
import {
  expiredVoucherSelectSql,
  expiredVoucherClaimSql,
  expiredVoucherBookRefundSql,
} from '@/worker/cron/expired-voucher-refund-sql'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

const CRON = readCode('src/worker/cron/auto-settlement.ts')

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
}

/** 최소 스키마 — 이 결함을 재현하는 데 필요한 것만. `orders` 에 금액 두 칸이 **있다**. */
function seed(total = 1800): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE products (id INTEGER PRIMARY KEY, price INTEGER, name TEXT, seller_id INTEGER);
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY, user_id TEXT, payment_method TEXT, payment_key TEXT,
      total_amount INTEGER, refunded_amount INTEGER
    );
    CREATE TABLE vouchers (
      id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, code TEXT,
      status TEXT, expires_at TEXT, applied_price INTEGER, refund_status TEXT
    );
    INSERT INTO products VALUES (7, 9000, '아메리카노(Hot)', 14);
  `)
  db.prepare('INSERT INTO orders (id, user_id, payment_method, total_amount, refunded_amount) VALUES (70, ?, ?, ?, NULL)')
    .run('u3', 'deal_points', total)
  return db
}

function addVoucher(db: Db, id: number, price: number, days = -40) {
  db.prepare(
    `INSERT INTO vouchers (id, order_id, product_id, code, status, expires_at, applied_price, refund_status)
     VALUES (?, 70, 7, ?, 'expired', ?, ?, NULL)`,
  ).run(id, `UR-${id}`, daysFromNow(days), price)
}

function book(db: Db, amount: number, orderId = 70): number {
  return Number(db.prepare(expiredVoucherBookRefundSql()).run(amount, orderId, amount).changes)
}

/** 전액환불 경로(`order-refund.ts`)와 **같은 식**: 총액 − 이미 환불된 누적. */
function nextFullRefundAmount(db: Db, orderId = 70): number {
  const r = db.prepare('SELECT total_amount AS t, COALESCE(refunded_amount, 0) AS ra FROM orders WHERE id = ?')
    .get(orderId) as { t: number; ra: number }
  return Math.max(0, Math.floor(Number(r.t)) - Math.floor(Number(r.ra)))
}

describe('🔴 핵심 — 적고 나면 두 번째 환불액이 0 이다', () => {
  it('적기 전에는 **1,800 이 또 나간다** (결함 재현 — 이게 안 되면 시험이 헛돈다)', () => {
    const db = seed(1800)
    addVoucher(db, 1, 1800)
    // 조회·선점까지는 이미 돌아간다(2026-09-30 수리). 돈도 나갔다. 그런데 장부는 0 이다.
    expect(db.prepare(expiredVoucherSelectSql(true)).all().length, '대상이 0이면 픽스처가 고장').toBe(1)
    expect(Number(db.prepare(expiredVoucherClaimSql(true)).run(1).changes)).toBe(1)
    expect(nextFullRefundAmount(db), '적지 않으면 상한이 그대로다 — 같은 돈이 또 나간다').toBe(1800)
  })

  it('적으면 0 이다 — 전액환불 경로가 더 보낼 것이 없다', () => {
    const db = seed(1800)
    addVoucher(db, 1, 1800)
    db.prepare(expiredVoucherClaimSql(true)).run(1)
    expect(book(db, 1800), '기록이 실패했다').toBe(1)
    expect(nextFullRefundAmount(db), '이중환불 구멍이 그대로다').toBe(0)
  })
})

describe('CAS 상한 — 총액을 넘지 못한다', () => {
  it('같은 금액을 두 번 적으면 두 번째는 실패한다(changes 0)', () => {
    const db = seed(1800)
    expect(book(db, 1800)).toBe(1)
    expect(book(db, 1800), '총액을 넘겨 적었다 — 상한이 거짓이 되어 정당한 환불을 막는다').toBe(0)
    expect(nextFullRefundAmount(db)).toBe(0)
  })

  it('한 주문에 이용권 여러 장 — 장당 누적되고 총액에서 멈춘다', () => {
    const db = seed(1800)
    addVoucher(db, 1, 900)
    addVoucher(db, 2, 900)
    expect(book(db, 900)).toBe(1)
    expect(nextFullRefundAmount(db)).toBe(900)
    expect(book(db, 900)).toBe(1)
    expect(nextFullRefundAmount(db)).toBe(0)
    expect(book(db, 900), '세 번째는 총액을 넘으므로 막혀야 한다').toBe(0)
  })

  it('NULL 에서 시작해도 더해진다 — COALESCE 가 빠지면 NULL 전파로 조용히 안 적힌다', () => {
    const db = seed(1800)
    const before = db.prepare('SELECT refunded_amount AS ra FROM orders WHERE id = 70').get() as { ra: number | null }
    expect(before.ra, '픽스처 전제: 처음엔 NULL 이다(라이브도 그랬다)').toBeNull()
    expect(book(db, 500)).toBe(1)
    expect(nextFullRefundAmount(db)).toBe(1300)
  })
})

describe('배선 — 라이브 cron 이 두 결제수단 **모두** 적는다', () => {
  it('SSOT 를 쓴다 (인라인 SQL 로 복제하면 두 벌이 갈린다)', () => {
    expect(CRON, 'SSOT import 가 사라졌다').toContain('expiredVoucherBookRefundSql')
  })

  it('딜·카드 두 경로에서 모두 부른다 — 한쪽만 적으면 결제수단에 따라 상한이 갈린다', () => {
    const calls = (CRON.match(/bookRefundOnOrder\(DB, voucher\.order_id, refundAmount/g) || []).length
    expect(calls, `장부 기록 호출이 ${calls}곳이다 — 환불 성공 자리는 둘(딜·토스)이다`).toBe(2)
  })

  it('🔴 실패를 삼키지 않는다 — 돈은 이미 나갔으므로 크게 로그한다', () => {
    const i = CRON.indexOf('async function bookRefundOnOrder')
    expect(i, '헬퍼가 사라졌다').toBeGreaterThan(0)
    const body = CRON.slice(i, i + 1200)
    expect(body, 'changes 를 안 보면 기록 실패가 조용히 지나간다').toMatch(/meta\?\.changes/)
    expect(body, '실패를 로그하지 않으면 사람이 알 길이 없다').toContain('logError(')
  })

  it('🔒 금액을 지어내지 않는다 — 이미 환불한 액수를 그대로 적는다', () => {
    expect(CRON, '장부 기록이 자기 금액을 계산하면 환불액과 장부가 갈린다')
      .not.toMatch(/bookRefundOnOrder\(DB, voucher\.order_id, (?!refundAmount)/)
  })
})
