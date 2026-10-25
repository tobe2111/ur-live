/**
 * 🏡 숙소 = 이용권 통일 — 실제 SQLite 위에서 진짜 함수를 돌려 판정한다.
 * 대표 2026-10-25 *"숙소를 이용권 방식으로 합치는 안으로 진행하자. 끝까지."*
 *
 * 지키는 것: ① 게이트 OFF 면 발급 0 ② 예약당 1장(멱등) ③ 체크인 날짜 판정(한국 날짜)
 *   ④ 사용 → 예약 체크인 ⑤ 취소가 이용권을 먼저 잡고, 이미 쓴 이용권은 취소를 막는다
 *   ⑥ 앞선 취소가 잡은 이용권을 되살리지 않는다 ⑦ 모든 사용·환불 입구가 이 모듈을 지난다(배선).
 * ⚠️ 못 보는 것: Toss 환불 · 원장 금액(그건 `recordVoucherUsedLedger` 가 원래 쓰던 경로 그대로다) ·
 *   실제 D1 의 ALTER 동작 — staging S-STAYV 가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import {
  issueStayVouchers, stayLinkForVoucher, stayRedeemBlock, markStayBookingUsed,
  holdStayVoucherForCancel, releaseStayVoucherHold, kstToday, stayVoucherExpiresAt,
} from '@/features/group-buy/api/stay-voucher-unify'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/** node:sqlite 를 D1 모양으로 감싼다(prepare/bind/first/all/run/batch). */
function d1(db: InstanceType<typeof DatabaseSync>): D1Database {
  const stmt = (sql: string, args: unknown[] = []) => {
    const conv = (a: unknown[]) => a.map((v) => (v === undefined ? null : v)) as never[]
    const s = {
      bind: (...a: unknown[]) => stmt(sql, a),
      first: async <T,>() => (db.prepare(sql).get(...conv(args)) as T) ?? null,
      all: async <T,>() => ({ results: db.prepare(sql).all(...conv(args)) as T[] }),
      run: async () => { const r = db.prepare(sql).run(...conv(args)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
    }
    return s
  }
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => Promise.all(list.map((s) => s.run())),
  } as unknown as D1Database
}

function setup(gate: 'true' | 'false' = 'true') {
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, user_id TEXT,
      code TEXT UNIQUE, status TEXT DEFAULT 'unused', expires_at TEXT, used_at TEXT, applied_discount_pct INTEGER, applied_price INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE stay_bookings (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, user_id INTEGER, seller_id INTEGER,
      total_amount INTEGER, status TEXT, sale_mode TEXT, check_in_date TEXT, check_out_date TEXT, nights INTEGER,
      voucher_expires_at TEXT, voucher_used_at TEXT, voucher_used_check_in TEXT, voucher_used_check_out TEXT,
      checked_in_at TEXT, checked_in_by INTEGER, checked_out_at TEXT, updated_at TEXT);
    CREATE TABLE stay_booking_status_log (id INTEGER PRIMARY KEY, booking_id INTEGER, prev_status TEXT, new_status TEXT,
      changed_by_role TEXT, changed_by_id INTEGER, reason TEXT);
    INSERT INTO platform_settings VALUES ('stay_voucher_unify_enabled', '${gate}');
    INSERT INTO stay_bookings (id, order_id, product_id, user_id, seller_id, total_amount, status, sale_mode, check_in_date, check_out_date, nights)
      VALUES (1, 100, 50, 7, 9, 149000, 'confirmed', 'date', '2026-10-25', '2026-10-26', 1),
             (2, 101, 51, 7, 9, 129000, 'confirmed', 'voucher', NULL, NULL, 1),
             (3, 102, 50, 7, 9, 149000, 'pending', 'date', '2026-10-25', '2026-10-26', 1);
  `)
  return { raw, DB: d1(raw) }
}

describe('발급', () => {
  it('게이트 OFF 면 한 장도 안 만든다', async () => {
    const { raw, DB } = setup('false')
    expect(await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1] })).toBe(0)
    expect((raw.prepare('SELECT COUNT(*) n FROM vouchers').get() as { n: number }).n).toBe(0)
  })
  it('확정된 예약마다 1장 — 금액·만료·예약 id 가 실린다, 미확정은 건너뛴다', async () => {
    const { raw, DB } = setup()
    expect(await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1, 3] })).toBe(1)
    const v = raw.prepare('SELECT * FROM vouchers').get() as Record<string, unknown>
    expect(v.stay_booking_id).toBe(1)
    expect(v.applied_price).toBe(149000)
    expect(v.expires_at).toBe('2026-10-26 14:59:59')
    expect(v.user_id).toBe('7')
    expect(String(v.code)).toMatch(/^\d{6}$/)
  })
  it('같은 예약을 다시 확정해도 두 장이 되지 않는다(UNIQUE + INSERT OR IGNORE)', async () => {
    const { raw, DB } = setup()
    await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1] })
    await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1] })
    expect((raw.prepare('SELECT COUNT(*) n FROM vouchers').get() as { n: number }).n).toBe(1)
  })
  it('숙박권 만료는 예약의 만료, 날짜 예약은 체크아웃날 한국 23:59', () => {
    expect(stayVoucherExpiresAt({ sale_mode: 'voucher', check_out_date: null, voucher_expires_at: '2027-01-01 00:00:00' })).toBe('2027-01-01 00:00:00')
    expect(stayVoucherExpiresAt({ sale_mode: 'voucher', check_out_date: null, voucher_expires_at: null })).toBeNull()
    expect(stayVoucherExpiresAt({ sale_mode: 'date', check_out_date: '2026-10-26', voucher_expires_at: null })).toBe('2026-10-26 14:59:59')
  })
})

describe('사용 판정', () => {
  const link = { booking_id: 1, status: 'confirmed', sale_mode: 'date', check_in_date: '2026-10-25', check_out_date: '2026-10-27', nights: 2 }
  it('체크인 날 ~ 체크아웃 전날만 연다', () => {
    expect(stayRedeemBlock(link, { today: '2026-10-24' })).toMatch(/체크인 날짜/)
    expect(stayRedeemBlock(link, { today: '2026-10-25' })).toBeNull()
    expect(stayRedeemBlock(link, { today: '2026-10-26' })).toBeNull()
    expect(stayRedeemBlock(link, { today: '2026-10-27' })).toMatch(/체크아웃/)
  })
  it('취소·체크인된 예약은 거절, 손으로 체크인한 뒤 정리는 허용', () => {
    expect(stayRedeemBlock({ ...link, status: 'cancelled' }, { today: '2026-10-25' })).toMatch(/취소/)
    expect(stayRedeemBlock({ ...link, status: 'checked_in' }, { today: '2026-10-25' })).toMatch(/이미 체크인/)
    expect(stayRedeemBlock({ ...link, status: 'checked_in' }, { afterManual: true })).toBeNull()
  })
  it('숙박권은 날짜를 안 본다', () => {
    expect(stayRedeemBlock({ ...link, sale_mode: 'voucher', check_in_date: null, check_out_date: null }, { today: '2030-01-01' })).toBeNull()
  })
  it('한국 날짜 — UTC 자정 직후(한국 오전 9시 전)에도 오늘이 맞다', () => {
    expect(kstToday(Date.parse('2026-10-24T16:00:00Z'))).toBe('2026-10-25')
  })
})

describe('사용 → 예약 이동', () => {
  it('날짜 예약은 checked_in, 숙박권은 오늘부터 박 수만큼 쓴 것으로 checked_out', async () => {
    const { raw, DB } = setup()
    await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1, 2] })
    const l1 = await stayLinkForVoucher(DB, { id: 1 })
    const l2 = await stayLinkForVoucher(DB, { id: 2 })
    expect(l1?.booking_id).toBe(1)
    await markStayBookingUsed(DB, l1!, 9)
    await markStayBookingUsed(DB, l2!, 9, '2026-11-02')
    const b = raw.prepare('SELECT id, status, voucher_used_check_in, voucher_used_check_out FROM stay_bookings ORDER BY id').all() as Array<Record<string, unknown>>
    expect(b[0].status).toBe('checked_in')
    expect(b[1]).toMatchObject({ status: 'checked_out', voucher_used_check_in: '2026-11-02', voucher_used_check_out: '2026-11-03' })
    // 두 번 불러도 로그는 한 줄씩(CAS)
    await markStayBookingUsed(DB, l1!, 9)
    expect((raw.prepare('SELECT COUNT(*) n FROM stay_booking_status_log').get() as { n: number }).n).toBe(2)
  })
  it('숙소와 안 묶인 이용권은 link 가 없다', async () => {
    const { raw, DB } = setup()
    raw.exec("ALTER TABLE vouchers ADD COLUMN stay_booking_id INTEGER; INSERT INTO vouchers (code, product_id) VALUES ('111111', 1)")
    expect(await stayLinkForVoucher(DB, { code: '111111' })).toBeNull()
  })
})

describe('취소가 이용권을 먼저 잡는다', () => {
  it('미사용이면 잡고(refunded), 예약 취소가 실패하면 되돌린다', async () => {
    const { raw, DB } = setup()
    await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1] })
    expect(await holdStayVoucherForCancel(DB, 1)).toBe('held')
    expect((raw.prepare('SELECT status FROM vouchers').get() as { status: string }).status).toBe('refunded')
    await releaseStayVoucherHold(DB, 1)
    expect((raw.prepare('SELECT status FROM vouchers').get() as { status: string }).status).toBe('unused')
  })
  it('이미 쓴 이용권이면 used — 취소 거절', async () => {
    const { raw, DB } = setup()
    await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1] })
    raw.exec("UPDATE vouchers SET status = 'used'")
    expect(await holdStayVoucherForCancel(DB, 1)).toBe('used')
  })
  it('앞선 취소가 잡아 둔 이용권은 gone — 되살리지 않는다', async () => {
    const { raw, DB } = setup()
    await issueStayVouchers(DB, { orderId: 100, userId: 7, bookingIds: [1] })
    expect(await holdStayVoucherForCancel(DB, 1)).toBe('held')
    expect(await holdStayVoucherForCancel(DB, 1)).toBe('gone')
    expect((raw.prepare('SELECT status FROM vouchers').get() as { status: string }).status).toBe('refunded')
  })
  it('묶인 이용권이 없는 옛 예약은 none', async () => {
    const { DB } = setup()
    expect(await holdStayVoucherForCancel(DB, 1)).toBe('none')
  })
})

describe('배선 — 모든 입구가 이 모듈을 지난다', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('숙소 결제 확정이 발급을 부른다', () => {
    expect(read('src/features/group-buy/api/stays-public.routes.ts')).toMatch(/issueStayVouchers\(c\.env\.DB, \{ orderId, userId, bookingIds: claimed\.map/)
  })
  it('숙소 취소가 예약 CAS 보다 먼저 이용권을 잡고, 실패하면 held 일 때만 되돌린다', () => {
    const s = read('src/features/group-buy/api/stays-public.routes.ts')
    const hold = s.indexOf('holdStayVoucherForCancel(c.env.DB, id)')
    const claim = s.indexOf("const cancelClaim = await c.env.DB.prepare(")
    expect(hold).toBeGreaterThan(0)
    expect(hold).toBeLessThan(claim)
    expect(s).toMatch(/if \(voucherHold === 'used'\)/)
    expect(s).toMatch(/if \(voucherHold === 'held'\) await releaseStayVoucherHold/)
  })
  it('사장님 스캔이 숙소 판정을 하고 사용 뒤 예약을 옮긴다', () => {
    const s = read('src/worker/utils/voucher-seller-redeem.ts')
    expect(s).toMatch(/stayRedeemBlock\(stay/)
    expect(s).toMatch(/if \(checked\.stay\) await markStayBookingUsed/)
  })
  it('손님 셀프·PIN 사용, 셀프 취소, 부분 환불이 숙소 이용권을 거절한다', () => {
    expect(read('src/worker/utils/self-redeem-gate.ts')).toMatch(/STAY_SCAN_ONLY/)
    const v = read('src/features/group-buy/api/group-buy-voucher.routes.ts')
    expect(v.match(/stayLinkForVoucher\(DB/g)?.length).toBe(3)
    expect(v).toMatch(/code: 'STAY_SCAN_ONLY'/)
    expect(v.match(/code: 'STAY_CANCEL'/g)?.length).toBe(2)
  })
  it('사장님 수동 체크인·숙박권 사용이 이용권도 정리한다', () => {
    expect(read('src/features/seller/api/seller-stays.routes.ts').match(/settleStayVoucherAfterManual\(c\.env\.DB/g)?.length).toBe(2)
  })
  it('컬럼은 repair-schema 와 마이그레이션 둘 다에 있다', () => {
    expect(read('src/worker/routes/repair-schema/column-repairs.ts')).toMatch(/vouchers ADD COLUMN stay_booking_id INTEGER/)
    expect(read('migrations/0290_vouchers_stay_booking.sql')).toMatch(/idx_vouchers_stay_booking_unique/)
  })
})
