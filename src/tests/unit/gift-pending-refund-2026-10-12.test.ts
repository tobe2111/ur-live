/**
 * 🎁 2026-10-12 대표 *"둘 다 해줘. 그리고 선물받은 사람은 환불이 안되게 해야지?"*
 *
 * 지키는 것
 *  ① 선물 링크가 살아 있는 동안 **보낸 사람**의 셀프 환불 세 곳(이용권 취소 · 주문 취소 · 환불 요청)이 막힌다 — 먼저 회수.
 *     어드민은 통과(고객센터). 실제 SQLite 로 판정 함수와 이용권 취소 CAS 를 돌린다.
 *  ② **받은 사람**의 셀프 환불은 그대로 막혀 있다(2026-10-11 — `voucher-gift-2026-10-11.test.ts` ④ 가 지킨다).
 *  ③ 지갑 지도: 같은 이용권 카드를 다시 눌러도(지도를 손으로 옮긴 뒤) 핀으로 돌아간다.
 *
 * ⚠️ 못 막는 것: 만료 자동 환불(보낸 사람 결제수단)은 일부러 막지 않는다 — 기한이 지나면 선물도 받을 수 없다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { orderHasPendingGift, ensureVoucherGiftTable, noPendingGiftSql } from '@/worker/utils/voucher-gift'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }

function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  for (const sql of [
    "CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, user_id TEXT, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, gift_from_user_id TEXT)",
    "INSERT INTO vouchers (id, order_id, user_id, status) VALUES (100, 600, '1', 'unused'), (101, 601, '1', 'unused')",
  ]) db.prepare(sql).run()
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

describe('① 선물 중이면 보낸 사람이 먼저 회수해야 환불된다', () => {
  it('주문 단위 판정 — 선물 중 true · 회수 후 false · 조회 실패는 막는 쪽', async () => {
    const DB = makeD1()
    await ensureVoucherGiftTable(DB)
    expect(await orderHasPendingGift(DB, 600)).toBe(false)
    await DB.prepare("INSERT INTO voucher_gifts (token, voucher_id, order_id, sender_user_id) VALUES ('t', 100, 600, '1')").run()
    expect(await orderHasPendingGift(DB, 600)).toBe(true)
    expect(await orderHasPendingGift(DB, 601)).toBe(false)   // 다른 주문은 영향 없음
    await DB.prepare("UPDATE voucher_gifts SET status = 'cancelled' WHERE token = 't'").run()
    expect(await orderHasPendingGift(DB, 600)).toBe(false)
    const broken = { prepare: () => { throw new Error('boom') } } as unknown as D1Database
    expect(await orderHasPendingGift(broken, 600)).toBe(true)
  })

  it('이용권 취소 CAS 도 선물 중이면 0행(소스의 문장을 그대로 실행)', async () => {
    const DB = makeD1()
    await ensureVoucherGiftTable(DB)
    const src = readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8')
    const m = src.match(/`(UPDATE vouchers SET status = 'refunded' WHERE id = \? AND status = 'unused' AND created_at > datetime\('now', '-7 days'\)[^`]*)`/)
    expect(m).not.toBeNull()
    expect(m![1]).toContain("${noPendingGiftSql('vouchers.id')}")
    const sql = m![1].replace("${noPendingGiftSql('vouchers.id')}", noPendingGiftSql('vouchers.id'))
    await DB.prepare("INSERT INTO voucher_gifts (token, voucher_id, order_id, sender_user_id) VALUES ('t', 100, 600, '1')").run()
    expect((await DB.prepare(sql).bind(100).run()).meta.changes).toBe(0)
    expect((await DB.prepare(sql).bind(101).run()).meta.changes).toBe(1)
  })

  it('세 자리 모두 배선 — 주문 취소는 어드민만 통과, 환불 실행보다 앞', () => {
    const vr = stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))
    const a = vr.indexOf("if (await voucherHasPendingGift(DB, { id: voucher.id })) return c.json({ success: false, error: GIFT_PENDING_REFUND_BLOCKED")
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(vr.indexOf("UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused' AND created_at"))
    const or = stripComments(readFileSync('src/worker/routes/order.routes.ts', 'utf8'))
    const b = or.indexOf("if (c.get('user').type !== 'admin' && await orderHasPendingGift(c.env.DB, orderId)) return c.json({ success: false, error: GIFT_PENDING_REFUND_BLOCKED")
    expect(b).toBeGreaterThan(0)
    expect(b).toBeLessThan(or.indexOf('const vPartial = await tryVoucherPartialRefund('))
    const rr = stripComments(readFileSync('src/features/returns/api/returns.routes.ts', 'utf8'))
    const d = rr.indexOf('if (voucher && await orderHasPendingGift(DB, order.id)) return c.json({ success: false, error: GIFT_PENDING_REFUND_BLOCKED')
    expect(d).toBeGreaterThan(0)
    expect(d).toBeLessThan(rr.indexOf('INSERT INTO returns'))
  })
})

describe('② 받은 사람 환불은 여전히 막혀 있다', () => {
  it('세 자리의 GIFTED 차단이 살아 있다', () => {
    expect(stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))).toMatch(/if \(voucher\.gift_from_user_id\) \{\s*return c\.json\(\{ success: false, error: GIFTED_REFUND_BLOCKED/)
    expect(stripComments(readFileSync('src/worker/routes/order.routes.ts', 'utf8'))).toContain('await orderHasGiftedVoucher(c.env.DB, orderId)) return c.json({ success: false, error: GIFTED_REFUND_BLOCKED')
    expect(stripComments(readFileSync('src/features/returns/api/returns.routes.ts', 'utf8'))).toContain('await orderHasGiftedVoucher(DB, order.id)) return c.json({ success: false, error: GIFTED_REFUND_BLOCKED')
  })
})

describe('③ 같은 카드를 다시 눌러도 핀으로', () => {
  it('누를 때마다 값이 바뀌고 지도가 그 값을 본다', () => {
    const page = stripComments(readFileSync('src/pages/MyVouchersPage.tsx', 'utf8'))
    expect(page).toContain('onClick={() => { setMapSelected(v); setMapFocusTick(t => t + 1) }}')
    expect(page).toContain('focusKey={mapFocusTick}')
    const map = stripComments(readFileSync('src/pages/my-vouchers/VoucherMap.tsx', 'utf8'))
    expect(map).toContain('}, [focus?.lat, focus?.lng, focusKey])')
  })
})
