/**
 * 🎟️ 미사용 만료 이용권 자동환불 — **구조적으로 한 번도 돌지 않던 것** (2026-09-30)
 *
 * ## 무엇이 잘못돼 있었나 (라이브 실측)
 *
 * 만료 표시를 하는 자리가 **셋**인데 그중 하나만 환불을 한다:
 *
 *   ⓐ `cron/auto-settlement.ts handleExpiredVoucherRefunds` — 표시 **+ 환불 + 알림 + 커미션 회수**
 *      · **하루 1회** `0 18 * * *`
 *   ⓑ `cron/scheduled-cleanup.ts` 일괄 UPDATE — 표시**만** · **매시 :10**
 *   ⓒ `group-buy-voucher.routes.ts` 사용 시도 경로 — 손님이 만료 코드를 찍는 순간
 *
 * ⓐ 의 조회 조건이 `status = 'unused'` 하나였으므로, 12배 자주 도는 ⓑ 가 **최대 23시간 먼저**
 * `expired` 로 바꿔 놓으면 ⓐ 는 **아무것도 못 찾는다** → 환불 0건. 그런데 **에러가 안 난다** —
 * "이번엔 만료된 게 없었다" 로 정상 종료하고 하트비트도 `ok:true` 다.
 *
 * 라이브 증거: 이용권 id=1 이 `2026-08-22T02:55Z` 만료 · `deal_points` 1,800원 ·
 * `refund_status` null · `orders.refunded_amount` 0 · 포인트 환불 **0건** · 만료 알림 **0건**.
 * ⓑ 의 hourly 티어가 `03:10Z` 에 잡았고 ⓐ 는 `18:00Z` 에 빈손 — 시각이 정확히 맞는다.
 * 소비자 상세 화면은 *"미사용 시 100% 자동환불"* 을 약속한다.
 *
 * ## 고친 방향 (표시 금지가 아니라 클레임 분리)
 *
 * 만료 표시는 어느 코드나 하고 싶어 하는 자연스러운 일이라(그래서 자리가 셋이 됐다) **금지 규칙은
 * 네 번째 작성자가 또 깬다.** 그래서 **환불 클레임을 표시 상태에서 떼어냈다** — 클레임은
 * `vouchers.refund_status`(ⓐ 만 쓴다)이고, 누가 `expired` 로 바꿔 놨든 환불 안 된 건은 잡힌다.
 * `appointment_bookings` 가 같은 문제를 이미 그 필드로 푼다.
 *
 * ## 이 시험이 지키는 것 — **실제 sqlite 에 돌려서** 판정한다
 *
 * 문자열 비교로는 이 결함을 못 잡는다(깨진 것이 문법이 아니라 **의미**였다). 그래서 SQL SSOT
 * (`worker/cron/expired-voucher-refund-sql.ts`)를 `node:sqlite` 에 실제로 실행해 행을 센다.
 *
 * ## 이 시험이 **못 막는 것**
 *
 * - 환불이 실제로 토스/딜에 닿는지는 안 본다(외부 호출) — `STAGING_CHECKLIST` 의 실결제가 판정한다.
 * - cron 스케줄 자체는 Cloudflare 대시보드에 있어 레포가 못 본다. 여기서는 **ⓐ 가 ⓑ 에게
 *   낚아채이지 않는가**만 고정한다(그게 이번 결함의 전부였다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readCode } from '../helpers/source-text'
import {
  expiredVoucherSelectSql,
  expiredVoucherClaimSql,
} from '@/worker/cron/expired-voucher-refund-sql'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

const CRON = readCode('src/worker/cron/auto-settlement.ts')
const CLEANUP = readCode('src/worker/cron/scheduled-cleanup.ts')

/** 이 결함을 재현할 수 있는 최소 스키마 — vouchers · orders · products 3테이블. */
function seed(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE products (id INTEGER PRIMARY KEY, price INTEGER, name TEXT, seller_id INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id TEXT, payment_method TEXT, payment_key TEXT);
    CREATE TABLE vouchers (
      id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, code TEXT,
      status TEXT, expires_at TEXT, applied_price INTEGER, refund_status TEXT
    );
    INSERT INTO products VALUES (7, 9000, '치즈돈가스', 14);
    INSERT INTO orders VALUES (70, 'u3', 'deal_points', NULL);
  `)
  return db
}

/** `expires_at` 을 sqlite 의 `datetime('now')` 와 같은 규약(UTC naive)으로 만든다. */
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
}

function addVoucher(db: Db, v: { id: number; status: string; days: number; refund?: string | null }) {
  db.prepare(
    `INSERT INTO vouchers (id, order_id, product_id, code, status, expires_at, applied_price, refund_status)
     VALUES (?, 70, 7, ?, ?, ?, 1800, ?)`,
  ).run(v.id, `UR-${v.id}`, v.status, daysFromNow(v.days), v.refund ?? null)
}

function picked(db: Db, withRefundStatus = true): number[] {
  const rows = db.prepare(expiredVoucherSelectSql(withRefundStatus)).all() as Array<{ id: number }>
  return rows.map((r) => Number(r.id)).sort((a, b) => a - b)
}

function claim(db: Db, id: number, withRefundStatus = true): number {
  return Number(db.prepare(expiredVoucherClaimSql(withRefundStatus)).run(id).changes)
}

describe('환불 대상 조회 — 누가 만료 표시를 했든 잡힌다', () => {
  it('픽스처가 비어 있지 않다 (0건이면 통과가 아니라 고장)', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: -10 })
    expect(picked(db).length).toBeGreaterThan(0)
    expect(CRON.length).toBeGreaterThan(500)
    expect(CLEANUP.length).toBeGreaterThan(500)
  })

  it("🔴 다른 cron 이 먼저 'expired' 로 바꿔 놔도 잡힌다 (이 결함의 핵심)", () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: -10 }) // 아직 아무도 안 건드림
    addVoucher(db, { id: 2, status: 'expired', days: -20 }) // ⓑ 가 먼저 표시 (환불 안 함)
    expect(
      picked(db),
      'expired 로 표시된 건이 빠지면 환불이 영구히 0건이 된다 — 그게 2026-09-30 의 결함이었다',
    ).toEqual([1, 2])
  })

  it('이미 처리된 건은 다시 안 잡힌다 (이중 환불 0)', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'expired', days: -10, refund: 'refunded' })
    addVoucher(db, { id: 2, status: 'expired', days: -10, refund: 'forfeited' })
    addVoucher(db, { id: 3, status: 'expired', days: -10, refund: 'failed' })
    addVoucher(db, { id: 4, status: 'expired', days: -10, refund: 'none' })
    addVoucher(db, { id: 5, status: 'expired', days: -10, refund: 'claimed' })
    expect(picked(db), '처리 결과가 남은 건은 대상이 아니다').toEqual([])
  })

  it('만료 기한이 안 지난 건은 안 잡힌다', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: +5 })
    expect(picked(db)).toEqual([])
  })

  it('사용·환불 완료 건은 안 잡힌다', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'used', days: -10 })
    addVoucher(db, { id: 2, status: 'refunded', days: -10 })
    expect(picked(db)).toEqual([])
  })

  it('폴백(컬럼 부재)은 종전과 같은 동작이다 — unused 만', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: -10 })
    addVoucher(db, { id: 2, status: 'expired', days: -10 })
    expect(picked(db, false), '폴백은 고쳐지기 전과 같다(더 나쁘지는 않다)').toEqual([1])
  })
})

describe('선점 — 돈 side-effect 앞의 원자적 클레임', () => {
  it('두 번째 선점은 실패한다 (changes = 0)', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: -10 })
    expect(claim(db, 1), '첫 선점은 성공해야 한다').toBe(1)
    expect(claim(db, 1), '같은 건을 두 번 선점하면 두 번 환불된다').toBe(0)
  })

  it("선점이 status 와 refund_status 를 함께 남긴다", () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: -10 })
    claim(db, 1)
    const row = db.prepare('SELECT status, refund_status FROM vouchers WHERE id = 1').get() as
      { status: string; refund_status: string }
    expect(row.status).toBe('expired')
    expect(row.refund_status).toBe('claimed')
  })

  it("🔴 조회 뒤 손님이 실제로 사용했으면 선점하지 않는다 (쓰고도 환불받는 것 차단)", () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'unused', days: -10 })
    // 조회 시점엔 대상이었는데 그 사이 매장에서 소각됨
    db.prepare("UPDATE vouchers SET status = 'used' WHERE id = 1").run()
    expect(claim(db, 1), 'used 를 강제 만료시켜 환불하면 손님이 쓰고도 돈을 받는다').toBe(0)
  })

  it('이미 다른 cron 이 expired 로 표시한 건도 선점된다', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'expired', days: -10 })
    expect(claim(db, 1)).toBe(1)
  })

  it('폴백 선점은 종전 그대로 (unused 만)', () => {
    const db = seed()
    addVoucher(db, { id: 1, status: 'expired', days: -10 })
    expect(claim(db, 1, false), '폴백은 고쳐지기 전과 같다').toBe(0)
  })
})

describe('배선 — cron 이 이 SSOT 를 실제로 쓴다', () => {
  it('환불 cron 이 SSOT 조회·선점을 호출한다 (자기 SQL 을 다시 쓰지 않는다)', () => {
    // 🩸 2026-09-30 되돌려-검증이 이 단언을 헛돈다고 잡았다: 처음엔 `/expiredVoucherSelectSql\(/`
    //   로만 봤는데, **import 줄과 컬럼-부재 폴백 호출(`(false)`)** 때문에 주 경로를 인라인 SQL 로
    //   갈아도 초록이 떴다(= 가드가 보는 쪽과 실제로 도는 쪽이 갈려도 통과). ⇒ **인자까지** 고정한다.
    expect(CRON, '주 경로가 SSOT 를 안 쓴다').toMatch(/expiredVoucherSelectSql\(true\)/)
    expect(CRON, '컬럼 부재 폴백이 SSOT 를 안 쓴다').toMatch(/expiredVoucherSelectSql\(false\)/)
    expect(CRON, '선점이 SSOT 를 안 쓴다').toMatch(/expiredVoucherClaimSql\(/)
    // 만료 조회의 고유 술어는 `expires_at <` 다 — 이 파일의 다른 SQL(정산용 `status='used'` 조회)엔
    // 없으므로, 여기 다시 나타나면 곧 "인라인으로 또 썼다"는 뜻이다.
    expect(
      CRON,
      '환불 cron 안에 만료 조회 SQL 이 다시 인라인으로 생겼다 — SSOT 로 보낼 것',
    ).not.toMatch(/expires_at\s*</)
  })

  it('처리 결과를 기록한다 (무엇이 일어났는지 모르는 행을 남기지 않는다)', () => {
    expect(CRON, "선점값 'claimed' 를 결과로 확정하지 않는다").toMatch(
      /UPDATE vouchers SET refund_status = \? WHERE id = \?/,
    )
    for (const v of ['refunded', 'forfeited', 'failed']) {
      expect(CRON, `결과값 '${v}' 를 어디서도 안 쓴다`).toMatch(new RegExp(`outcome = '${v}'`))
    }
  })

  it('청소 cron 은 환불을 하지 않는다 — 그래서 그쪽이 표시해도 무해해야 한다', () => {
    // ⓑ 가 환불을 하게 되면 이중 환불이 된다. 표시만 하는 상태를 고정한다.
    expect(CLEANUP, '청소 cron 이 vouchers 만료 표시를 안 한다 — 구조가 바뀌었으면 위 전제를 재검토할 것')
      .toMatch(/UPDATE vouchers\s*\n?\s*SET status = 'expired'/)
    expect(CLEANUP, '청소 cron 이 환불을 하고 있다 — 환불 주인은 하나여야 한다')
      .not.toMatch(/adjustUserPoints|tossCancelPayment|refund_status/)
  })
})
