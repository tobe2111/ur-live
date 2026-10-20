/**
 * 🧾 **판정 패널의 수수료 쿼리를 실제 원장 행에 돌려 본다** (2026-10-01)
 *
 * ■ 왜 이 파일이 필요했나 — 텍스트 검사가 통과하는 동안 판정이 틀려 있었다
 *   같은 쿼리를 보던 `promo-ledger-order-verdict.test.ts` 는 `SUM(fee_amount)` 가 **있는지**만
 *   봤다. 있었다. 그런데 *어떤 행에* 더하는지가 틀려서, 라이브의 유일한 주문을 넣으면 **0원**이
 *   나왔다. 수수료가 0 이면 예산도 0 이고, 그러면 S1 의 합격선(`Σ적립 ≤ 예산`)이
 *   `0 ≤ 0` 으로 **늘 참**이거나, 적립이 1원만 있어도 **늘 거짓**이 된다 — 양쪽으로 다 틀린다.
 *
 *   ⇒ 교훈: **"쿼리가 있는가" 는 "쿼리가 맞는가" 를 전혀 말해 주지 않는다.**
 *   그래서 여기서는 라이브와 같은 스키마·같은 행 모양을 실제 sqlite 에 넣고,
 *   라우트가 쓰는 **그 SQL 문자열 자체**(`platformFeeQuery`)를 돌려 금액을 센다.
 *   SQL 을 여기 베껴 쓰면 두 벌이 갈려 이 시험이 의미를 잃는다 — 그래서 SSOT 를 import 한다.
 *
 * ■ 라이브 실측(2026-10-01, `ledger_entries` 전수 3행)
 *   id=3 · event_type='group_buy_join' · reference_id='GB-3-1789611467065'(주문번호)
 *        · amount=1000 · debit='user:3' · credit='seller:14'
 *        · fee_amount=50 · fee_account='platform:commission'
 *
 * ■ 못 보는 것
 *   - 그 주문의 적립 축(affiliate 등)이 정말 전부인지는 여기서 모른다(S1 실결제의 몫).
 *   - 환불 역전 후 "지금도 유어딜 것인가" 는 안 센다 — 여기 합계는 "떼었던 금액" 이다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { platformFeeQuery, orderLedgerRefs, PLATFORM_FEE_ACCOUNT } from '@/worker/utils/order-platform-fee'
import { readCode } from '../helpers/source-text'

// 기본 환경이 jsdom 이라 `node:sqlite` 를 정적 import 하면 번들러가 막는다
// (`search-bind-order-2026-09-30.test.ts` 등 기존 SQLite 시험과 같은 방식).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

/** 라이브 `sqlite_master` 에서 그대로 떠 온 정의(2026-10-01) — 컬럼이 바뀌면 여기서 먼저 깨진다. */
const LEDGER_DDL = `CREATE TABLE ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  fee_amount INTEGER DEFAULT 0,
  fee_account TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`

type Row = {
  event_type: string; reference_id: string; amount: number
  debit_account: string; credit_account: string
  fee_amount?: number | null; fee_account?: string | null
}

function feeOf(rows: Row[], orderIds: number[], orderNumber: string): number {
  const db = new DatabaseSync(':memory:')
  db.exec(LEDGER_DDL)
  const ins = db.prepare(
    `INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount, fee_account)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const r of rows) {
    ins.run(r.event_type, r.reference_id, r.amount, r.debit_account, r.credit_account,
      r.fee_amount ?? 0, r.fee_account ?? null)
  }
  const q = platformFeeQuery(orderIds, orderNumber)
  const out = db.prepare(q.sql).get(...(q.binds as (string | number)[])) as { fee: number }
  db.close()
  return Number(out?.fee ?? 0)
}

/** 라이브 유일 주문(이용권·공구 레일) — 참조 키가 **주문번호**다. */
const LIVE_VOUCHER_ROW: Row = {
  event_type: 'group_buy_join', reference_id: 'GB-3-1789611467065', amount: 1000,
  debit_account: 'user:3', credit_account: 'seller:14',
  fee_amount: 50, fee_account: 'platform:commission',
}

/** 쇼핑 레일 — 참조 키가 `order:N` 이다(`order-ledger-credit.ts`). */
const SHOPPING_ROW: Row = {
  event_type: 'order_paid', reference_id: 'order:89', amount: 10000,
  debit_account: 'user:3', credit_account: 'seller:14',
  fee_amount: 500, fee_account: 'platform:commission',
}

describe('플랫폼 수수료 — 라이브와 같은 행 모양으로 실제 조회', () => {
  it('🔴 이용권·공구 주문(참조 키 = 주문번호)에서 0 이 아니다 — 이것이 틀려 있던 결함', () => {
    // `order:N` 만 묻던 종전 쿼리는 여기서 0 을 돌려줬다. 그 0 이 S1 의 예산이 됐다.
    expect(feeOf([LIVE_VOUCHER_ROW], [89], 'GB-3-1789611467065')).toBe(50)
  })

  it('쇼핑 주문(참조 키 = order:N)도 센다 — 한 레일만 맞으면 다른 레일이 조용히 0 이 된다', () => {
    expect(feeOf([SHOPPING_ROW], [89], 'ORD-없는번호')).toBe(500)
  })

  it('장바구니처럼 한 주문번호에 셀러가 여럿이면 합산한다', () => {
    const a = { ...LIVE_VOUCHER_ROW, credit_account: 'seller:14', fee_amount: 50 }
    const b = { ...LIVE_VOUCHER_ROW, credit_account: 'seller:15', fee_amount: 70 }
    expect(feeOf([a, b], [89], 'GB-3-1789611467065')).toBe(120)
  })

  it('🔴 `credit_account` 로 거르지 않는다 — 매장이 있는 주문의 크레딧은 seller:N 이다', () => {
    // 종전 쿼리는 `credit_account='platform:revenue'` 를 요구했다. 매장이 있는 주문엔
    // 그런 행이 아예 없어서(크레딧은 seller:N) 라이브 전부가 0 으로 읽혔다.
    expect(LIVE_VOUCHER_ROW.credit_account).not.toBe('platform:revenue')
    expect(feeOf([LIVE_VOUCHER_ROW], [89], 'GB-3-1789611467065')).toBeGreaterThan(0)
  })

  it('매장 없는 플랫폼 상품(교환권·KT)도 센다 — credit 이 platform:revenue 여도 수수료는 fee_amount 다', () => {
    const platformOwned: Row = {
      ...LIVE_VOUCHER_ROW, credit_account: 'platform:revenue', fee_amount: 200,
    }
    expect(feeOf([platformOwned], [89], 'GB-3-1789611467065')).toBe(200)
  })

  it('환불 역전 기록은 합계를 부풀리지 않는다 — 역전은 fee_account 를 안 쓴다', () => {
    const reversal: Row = {
      event_type: 'order_paid_refund', reference_id: 'order:89', amount: 9500,
      debit_account: 'seller:14', credit_account: 'platform:escrow',
      fee_amount: 0, fee_account: null,
    }
    expect(feeOf([SHOPPING_ROW, reversal], [89], 'x')).toBe(500)
  })

  it('다른 주문의 수수료를 끌어오지 않는다', () => {
    const other: Row = { ...LIVE_VOUCHER_ROW, reference_id: 'GB-9-999', fee_amount: 9999 }
    expect(feeOf([LIVE_VOUCHER_ROW, other], [89], 'GB-3-1789611467065')).toBe(50)
  })

  it('수수료가 없는 주문은 0 이다 — 0 을 만들 수 있어야 이 시험이 헛돌지 않는다', () => {
    expect(feeOf([{ ...LIVE_VOUCHER_ROW, fee_amount: 0 }], [89], 'GB-3-1789611467065')).toBe(0)
  })
})

describe('참조 키 SSOT', () => {
  it('두 형태를 모두 낸다 — 한쪽만이면 그 레일이 조용히 0 이 된다', () => {
    const refs = orderLedgerRefs([7, 8], 'GB-3-1789611467065')
    expect(refs).toContain('order:7')
    expect(refs).toContain('order:8')
    expect(refs).toContain('GB-3-1789611467065')
  })

  it('주문번호가 없거나 id 가 쓰레기면 바인딩에 안 섞는다', () => {
    expect(orderLedgerRefs([0, -1, NaN], '')).toEqual([])
    expect(orderLedgerRefs([5], '   ')).toEqual(['order:5'])
  })

  it('SQL 과 바인딩 개수가 맞는다 — 갈리면 D1 이 런타임에 죽는다', () => {
    const q = platformFeeQuery([1, 2], 'GB-X')
    expect((q.sql.match(/\?/g) || []).length).toBe(q.binds.length)
    expect(q.binds[0]).toBe(PLATFORM_FEE_ACCOUNT)
  })
})

describe('판정 패널이 그 SSOT 를 쓴다', () => {
  const ROUTE = readCode('src/features/admin/api/admin-promo-ledger.routes.ts')
  const HANDLER = ROUTE.slice(ROUTE.indexOf("adminPromoLedgerRoutes.get('/order/:orderNumber'"))

  it('수수료를 손으로 다시 묻지 않는다 — SSOT 호출로만', () => {
    expect(HANDLER).toContain('platformFeeQuery(orderIds, orderNumber)')
    // 종전의 틀린 조건이 되살아나면 여기서 잡힌다.
    expect(HANDLER).not.toMatch(/SUM\(fee_amount\)[\s\S]{0,120}credit_account = 'platform:revenue'/)
  })

  it('원장 참조 키도 SSOT 로 만든다 — 공구·이용권 주문번호가 빠지면 라이브 전부가 0 이다', () => {
    expect(HANDLER).toContain('orderLedgerRefs(orderIds, orderNumber)')
    expect(HANDLER).not.toMatch(/const refs = orderIds\.map\(\(id\) => `order:\$\{id\}`\)/)
  })
})
