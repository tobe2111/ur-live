/**
 * 🏨 2026-10-31 (대표 "부산에 휴가스테이 이용권이 3개나 나와. 심지어 스탠다드 텐트는 중복으로 2개 … 방 옵션은
 *   이용권 상세페이지 하나에서 다 볼 수 있게"): 같은 숙소로 갈라진 데모 숙소를 한 상세로 합친다.
 * 진짜 SQLite 로 판정한다. ⚠️ 못 보는 것: 라이브 D1 의 실제 행(cron 이 돈 뒤 어드민에서 확인).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { mergeDuplicateDemoStays, findExistingStay } from '@/features/admin/api/admin-stays/dedupe-demo-stays'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function d1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const st = db.prepare(sql)
      let args: unknown[] = []
      const api = {
        bind(...v: unknown[]) { args = v; return api },
        async all() { return { results: st.all(...(args as never[])) } },
        async first() { return (st.get(...(args as never[])) ?? null) },
        async run() { const r = st.run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return api
    },
  } as never
}

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, category TEXT, restaurant_name TEXT, is_active INTEGER DEFAULT 1, price INTEGER, updated_at TEXT);
    CREATE TABLE product_stay_rooms (id INTEGER PRIMARY KEY, product_id INTEGER, name TEXT, base_price_weekday INTEGER, is_active INTEGER DEFAULT 1);
    CREATE TABLE product_stay_calendar (id INTEGER PRIMARY KEY, room_id INTEGER, product_id INTEGER);`)
  const P = (id: number, slug: string, store: string, price: number) =>
    db.prepare(`INSERT INTO products (id,name,slug,category,restaurant_name,price) VALUES (?,?,?,'stay_voucher',?,?)`).run(id, `평일 1박 숙박권 (${id})`, slug, store, price)
  const R = (id: number, pid: number, name: string, p: number) =>
    db.prepare(`INSERT INTO product_stay_rooms (id,product_id,name,base_price_weekday) VALUES (?,?,?,?)`).run(id, pid, name, p)
  // 휴가스테이 3개 — 스탠다드 텐트가 두 상품에 중복, 리버뷰 스위트는 셋째에만
  P(1, 'demo-stay-1', '휴가스테이', 150000); R(11, 1, '스탠다드 텐트', 150000); R(12, 1, '디럭스 텐트', 180000)
  P(2, 'demo-stay-2', '휴가스테이', 150000); R(21, 2, '스탠다드 텐트', 150000); R(22, 2, '디럭스 텐트', 180000)
  P(3, 'demo-stay-3', '휴가스테이', 120000); R(31, 3, '프리미엄 리버뷰 스위트', 120000)
  db.prepare(`INSERT INTO product_stay_calendar (room_id, product_id) VALUES (31, 3)`).run()
  // 다른 숙소는 그대로
  P(4, 'demo-stay-4', '호텔휴', 90000); R(41, 4, '스탠다드 룸', 90000)
  // 실숙소(데모 아님)는 이름이 같아도 안 건드린다
  P(5, 'real-5', '휴가스테이', 99000); R(51, 5, '오두막', 99000)
  return db
}

describe('데모 숙소 합치기', () => {
  it('같은 숙소의 데모는 하나만 남고, 없는 객실만 옮겨 온다(중복 객실은 안 옮긴다)', async () => {
    const db = setup()
    const n = await mergeDuplicateDemoStays(d1(db))
    expect(n).toBe(2)
    const active = db.prepare(`SELECT id FROM products WHERE is_active=1 ORDER BY id`).all().map((r) => (r as { id: number }).id)
    expect(active).toEqual([1, 4, 5])
    const rooms = db.prepare(`SELECT name FROM product_stay_rooms WHERE product_id=1 ORDER BY name`).all().map((r) => (r as { name: string }).name)
    expect(rooms).toEqual(['디럭스 텐트', '스탠다드 텐트', '프리미엄 리버뷰 스위트'])
    expect((db.prepare(`SELECT product_id FROM product_stay_calendar WHERE room_id=31`).get() as { product_id: number }).product_id).toBe(1)
    expect((db.prepare(`SELECT price FROM products WHERE id=1`).get() as { price: number }).price).toBe(120000)
    // 실숙소 객실은 그대로
    expect((db.prepare(`SELECT product_id FROM product_stay_rooms WHERE id=51`).get() as { product_id: number }).product_id).toBe(5)
  })
  it('두 번 돌려도 무해하다', async () => {
    const db = setup()
    await mergeDuplicateDemoStays(d1(db))
    expect(await mergeDuplicateDemoStays(d1(db))).toBe(0)
  })
  it('시드 검사는 숙소명(restaurant_name)으로 이미 있는 숙소를 찾는다', async () => {
    const db = setup()
    expect(await findExistingStay(d1(db), '호텔휴')).toBe(4)
    expect(await findExistingStay(d1(db), '없는숙소')).toBeNull()
  })
})
