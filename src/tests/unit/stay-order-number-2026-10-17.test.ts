/**
 * 🏨 2026-10-17 숙소 예약 '주문 생성 실패' — 대표 신고 스크린샷(그린스테이인해운대 · 2명 · ₩181,000).
 *
 * orders.order_number 는 라이브에서 `TEXT UNIQUE NOT NULL` 인데 숙소 예약의 두 INSERT(단건·다객실)가
 * 그 컬럼을 안 넣었다 → INSERT 가 늘 실패하고 `.catch(() => null)` 이 삼켜 '주문 생성 실패' 만 떴다.
 * 라이브 stay_bookings 는 **0건** — 한 번도 예약된 적이 없다.
 *
 * 이 시험은 소스에서 **진짜 INSERT 문을 떼어** 라이브와 같은 NOT NULL 제약을 가진 SQLite 에 넣어 본다
 * (문자열 검사가 아니다). 못 보는 것: 결제(토스) 승인 · 달력 차감 — 그건 staging 실결제가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { stayOrderNumber, kstToday } from '@/features/group-buy/api/stays-public.routes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const SRC = readFileSync('src/features/group-buy/api/stays-public.routes.ts', 'utf8')

/** 소스의 `INSERT INTO orders (` 템플릿 문자열을 전부 떼어 낸다. */
function orderInserts(): string[] {
  const out: string[] = []
  let i = 0
  while ((i = SRC.indexOf('`INSERT INTO orders (', i)) !== -1) {
    const end = SRC.indexOf('`', i + 1)
    out.push(SRC.slice(i + 1, end))
    i = end + 1
  }
  return out
}

function liveLikeDb() {
  const db = new DatabaseSync(':memory:')
  // 라이브 orders 의 NOT NULL 제약(2026-10-17 pragma 실측)과 숙소 INSERT 가 쓰는 컬럼.
  db.exec(`CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_status TEXT DEFAULT 'pending',
    seller_id INTEGER, shipping_name TEXT, shipping_phone TEXT,
    created_at DATETIME, stay_check_in_date TEXT, stay_check_out_date TEXT, stay_nights INTEGER,
    extra_shipping_fee INTEGER NOT NULL DEFAULT 0, agency_settled INTEGER NOT NULL DEFAULT 0,
    deal_used INTEGER NOT NULL DEFAULT 0)`)
  return db
}

describe('숙소 예약 주문 INSERT 가 라이브 제약을 통과한다', () => {
  const inserts = orderInserts()

  it('INSERT 가 둘(단건·다객실) 다 잡힌다 — 0이면 시험이 헛돈다', () => {
    expect(inserts.length).toBe(2)
  })

  it('두 INSERT 모두 order_number 를 넣고, 실제로 행이 생긴다', () => {
    for (const sql of inserts) {
      expect(sql).toMatch(/order_number/)
      const db = liveLikeDb()
      const stmt = db.prepare(sql)
      const r = stmt.run(stayOrderNumber(), 7, 3, 181000, '현정', '010-0000-7390', '2026-10-20', '2026-10-21', 1)
      expect(Number(r.lastInsertRowid)).toBeGreaterThan(0)
    }
  })

  it('주문번호는 매번 달라 UNIQUE 에 안 걸린다', () => {
    const seen = new Set(Array.from({ length: 500 }, stayOrderNumber))
    expect(seen.size).toBe(500)
  })

  it('주문번호는 토스 orderId(STAY-{id})와 겹치지 않는다 — 겹치면 결제 webhook 이 일반 주문으로 처리한다', () => {
    expect(stayOrderNumber()).not.toMatch(/^STAY-\d+$/)
  })

  it('INSERT 실패를 조용히 삼키지 않는다', () => {
    expect(SRC).not.toMatch(/INSERT INTO orders[\s\S]{0,600}?\.run\(\)\.catch\(\(\) => null\)/)
  })
})

describe('지난 날짜 체크인은 막는다', () => {
  it('KST 기준 오늘 날짜를 준다', () => {
    // 2026-10-16 15:30 UTC = 2026-10-17 00:30 KST
    expect(kstToday(Date.UTC(2026, 9, 16, 15, 30))).toBe('2026-10-17')
    expect(kstToday(Date.UTC(2026, 9, 16, 14, 59))).toBe('2026-10-16')
  })

  it('단건·다객실 두 경로 모두 오늘보다 이른 체크인을 거절한다', () => {
    expect(SRC.match(/checkIn < kstToday\(\)/g)?.length).toBe(2)
  })
})
