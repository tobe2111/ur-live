import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { expiredVoucherSelectSql, expiredVoucherClaimSql } from '@/worker/cron/expired-voucher-refund-sql'
import { stayNoShowSelectSql, stayNoShowClaimSql } from '@/worker/cron/stay-no-show'

/**
 * 🏨 2026-11-25 대표 *"날짜 지정 시에 오지 않으면 환불되는게 아니라 소비한 것으로 해야하지 않을까?"*
 *
 * 종전: 날짜 예약의 이용권은 체크아웃 날 밤에 만료되고, 일반 만료 환불 cron 이 숙소를 가리지 않아 안 오면 **전액 환불**됐다.
 * 지금: 만료 환불은 날짜 예약을 빼고(`notDateStaySql`), `stay-no-show` 가 그 이용권을 **사용한 것으로** 닫아 정산에 넣는다.
 *
 * 실제 sqlite 에 돌려서 고정하는 것:
 *   ① 같은 이용권을 두 cron 이 **둘 다 잡는 일은 없다**(환불 + 정산 = 돈이 두 번 나간다)
 *   ② **아무도 안 잡는 만료 미사용 이용권도 없다**(환불도 정산도 없이 플랫폼이 돈을 쥐고 있게 된다)
 *   ③ 먼저 판매 숙박권 · 일반 이용권은 종전대로 환불 쪽
 *   ④ 취소·환불된 예약, 이미 쓴 이용권, 기한이 안 지난 이용권은 어느 쪽도 안 잡는다
 *   ⑤ 선점은 한 번만 — 한쪽이 잡으면 다른 쪽 선점은 changes = 0
 * 못 막는 것: 원장 금액이 맞는지(스캔과 같은 함수 `recordVoucherUseSettlement` 를 쓴다는 배선만 본다) · 실결제(staging S-STAYNOSHOW).
 */
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function seed(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE products (id INTEGER PRIMARY KEY, price INTEGER, name TEXT, seller_id INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, user_id TEXT, payment_method TEXT, payment_key TEXT);
    CREATE TABLE stay_bookings (id INTEGER PRIMARY KEY, sale_mode TEXT, status TEXT);
    CREATE TABLE voucher_gifts (id INTEGER PRIMARY KEY, voucher_id INTEGER, status TEXT);
    CREATE TABLE vouchers (
      id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, user_id TEXT, code TEXT,
      status TEXT, expires_at TEXT, used_at TEXT, applied_price INTEGER, refund_status TEXT, stay_booking_id INTEGER
    );
    INSERT INTO products VALUES (7, 90000, '바다펜션', 14);
    INSERT INTO orders VALUES (70, NULL, 'u3', 'toss', 'pk');
  `)
  return db
}
const ago = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')

function add(db: Db, v: { id: number; status?: string; days?: number; refund?: string | null; booking?: { mode: string | null; status: string } | null }) {
  let bookingId: number | null = null
  if (v.booking) {
    bookingId = 1000 + v.id
    db.prepare('INSERT INTO stay_bookings (id, sale_mode, status) VALUES (?, ?, ?)').run(bookingId, v.booking.mode, v.booking.status)
  }
  db.prepare(
    `INSERT INTO vouchers (id, order_id, product_id, user_id, code, status, expires_at, applied_price, refund_status, stay_booking_id)
     VALUES (?, 70, 7, 'u3', ?, ?, ?, 90000, ?, ?)`,
  ).run(v.id, `UR-${v.id}`, v.status ?? 'unused', ago(v.days ?? -2), v.refund ?? null, bookingId)
}
const ids = (db: Db, sql: string) => (db.prepare(sql).all() as Array<{ id: number }>).map((r) => Number(r.id)).sort((a, b) => a - b)
const refundPicks = (db: Db) => ids(db, expiredVoucherSelectSql(true))
const noShowPicks = (db: Db) => ids(db, stayNoShowSelectSql())

/** 한 판에 모든 종류 — 번호가 곧 종류다. */
function world(): Db {
  const db = seed()
  add(db, { id: 1 })                                                        // 일반 이용권, 만료 미사용
  add(db, { id: 2, booking: { mode: 'voucher', status: 'confirmed' } })     // 먼저 판매 숙박권, 만료 미사용
  add(db, { id: 3, booking: { mode: 'date', status: 'confirmed' } })        // 날짜 예약, 안 옴
  add(db, { id: 4, status: 'expired', booking: { mode: null, status: 'confirmed' } }) // sale_mode 없는 옛 예약 = 날짜 · 매시 cron 이 먼저 expired 로 표시
  add(db, { id: 5, booking: { mode: 'date', status: 'no_show' } })          // 사장님이 손으로 노쇼를 눌렀다
  add(db, { id: 6, booking: { mode: 'date', status: 'checked_in' } })       // 체크인은 눌렀는데 이용권 정리가 실패했다
  add(db, { id: 7, status: 'refunded', booking: { mode: 'date', status: 'refunded' } }) // 취소·환불 끝
  add(db, { id: 8, status: 'used', booking: { mode: 'date', status: 'checked_out' } })  // 정상 이용
  add(db, { id: 9, days: 3, booking: { mode: 'date', status: 'confirmed' } })           // 아직 기간 안
  add(db, { id: 10, status: 'unused', booking: { mode: 'date', status: 'cancelled' } }) // 취소됐는데 이용권이 남았다(이례)
  return db
}

describe('날짜 지정 숙소 노쇼 — 환불이 아니라 이용한 것으로', () => {
  it('픽스처가 비어 있지 않다(0건이면 통과가 아니라 고장)', () => {
    const db = world()
    expect(refundPicks(db).length).toBeGreaterThan(0)
    expect(noShowPicks(db).length).toBeGreaterThan(0)
  })
  it('③ 일반 이용권과 먼저 판매 숙박권은 환불 쪽, 날짜 예약은 노쇼 마감 쪽', () => {
    const db = world()
    expect(refundPicks(db)).toEqual([1, 2])
    expect(noShowPicks(db)).toEqual([3, 4, 5, 6])
  })
  it('① 두 cron 이 같은 이용권을 둘 다 잡지 않는다', () => {
    const db = world()
    const both = refundPicks(db).filter((id) => noShowPicks(db).includes(id))
    expect(both).toEqual([])
  })
  it('② 만료된 미사용 이용권 중 아무도 안 잡는 것은 취소된 예약뿐이다', () => {
    const db = world()
    const open = ids(db, "SELECT id FROM vouchers WHERE expires_at < datetime('now') AND status IN ('unused','expired') AND COALESCE(refund_status,'') = ''")
    const taken = [...refundPicks(db), ...noShowPicks(db)]
    expect(open.filter((id) => !taken.includes(id))).toEqual([10])
  })
  it('⑤ 선점: 노쇼 쪽이 잡은 이용권을 환불 쪽은 못 잡고, 환불 쪽 선점은 날짜 예약을 건드리지 않는다', () => {
    const db = world()
    expect(Number(db.prepare(expiredVoucherClaimSql(true)).run(3).changes)).toBe(0)   // 날짜 예약 — 환불 선점 거절
    expect(Number(db.prepare(expiredVoucherClaimSql(false)).run(3).changes)).toBe(0)  // 폴백 문장도 같다
    expect(Number(db.prepare(stayNoShowClaimSql()).run(3).changes)).toBe(1)
    expect(Number(db.prepare(stayNoShowClaimSql()).run(3).changes)).toBe(0)           // 두 번째는 0
    expect((db.prepare('SELECT status FROM vouchers WHERE id = 3').get() as { status: string }).status).toBe('used')
    expect(Number(db.prepare(expiredVoucherClaimSql(true)).run(2).changes)).toBe(1)   // 먼저 판매 숙박권은 환불 선점된다
    expect(Number(db.prepare(stayNoShowClaimSql()).run(2).changes)).toBe(0)           // 환불이 잡은 것은 노쇼가 못 잡는다
  })
  it('선물 중(받기 전)인 이용권은 건너뛰고, 회수하면 잡는다', () => {
    const db = world()
    db.prepare("INSERT INTO voucher_gifts (voucher_id, status) VALUES (3, 'pending')").run()
    expect(Number(db.prepare(stayNoShowClaimSql()).run(3).changes)).toBe(0)
    db.prepare("UPDATE voucher_gifts SET status = 'cancelled' WHERE voucher_id = 3").run()
    expect(Number(db.prepare(stayNoShowClaimSql()).run(3).changes)).toBe(1)
  })
})

describe('배선', () => {
  const cron = readFileSync('src/worker/cron/stay-no-show.ts', 'utf8')
  it('정산 원장은 스캔과 같은 함수로 남긴다(두 벌 금지)', () => {
    expect(cron).toMatch(/recordVoucherUseSettlement\(DB, \{/)
    const redeem = readFileSync('src/worker/utils/voucher-seller-redeem.ts', 'utf8')
    expect(redeem).toMatch(/opts\.waitUntil\(recordVoucherUseSettlement\(DB, voucher\)/)
    expect(redeem.match(/recordVoucherUsedLedger\(DB, \{/g)?.length).toBe(1)
  })
  it('선점(changes) 뒤에만 예약 마감·원장으로 간다', () => {
    const claim = cron.indexOf('stayNoShowClaimSql()).bind(v.id).run()')
    const guard = cron.indexOf('if (!claim.meta?.changes) continue')
    const ledger = cron.indexOf('await recordVoucherUseSettlement(')
    expect(claim).toBeGreaterThan(0)
    expect(guard).toBeGreaterThan(claim)
    expect(ledger).toBeGreaterThan(guard)
  })
  it('매일 머니 레인에서 돌고 하트비트 필수 목록에 있다', () => {
    expect(readFileSync('src/worker/cron/daily-lane.ts', 'utf8')).toMatch(/run\('stay-no-show-settle', async \(\) => \{/)
    expect(readFileSync('scripts/check-cron-heartbeat.mjs', 'utf8')).toContain("'stay-no-show-settle'")
  })
  it('손님에게 결제 전·지갑에서 알린다', () => {
    expect(readFileSync('src/pages/stay-detail/StayInfoSections.tsx', 'utf8')).toContain('체크인하지 않으면 이용한 것으로 처리돼요(환불 없음)')
    expect(readFileSync('src/pages/my-vouchers/QRModal.tsx', 'utf8')).toMatch(/voucher\.stay_booking_id\s+\? t\('wallet\.qr\.caution4Stay'/)
    expect(readFileSync('src/features/group-buy/api/group-buy-public.routes.ts', 'utf8')).toMatch(/v\.applied_discount_pct, v\.stay_booking_id,/)
  })
})
