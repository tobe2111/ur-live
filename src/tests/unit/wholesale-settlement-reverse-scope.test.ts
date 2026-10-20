/**
 * 💰 2026-06-12 (라인 선택 환불): reverseSupplierOnWholesaleRefund 의 productIds 스코프 —
 *   쿼리 구성·바인드 순서 회귀 테스트 (과다 클로백 방지의 핵심 지점).
 *   stub DB 가 SQL/bind 를 캡처하고 빈 결과를 돌려줘 함수는 0 반환(부수효과 없음).
 */
import { describe, it, expect } from 'vitest'
import { reverseSupplierOnWholesaleRefund } from '../../features/supply/api/wholesale-settlement'

function stubDB() {
  const calls: Array<{ sql: string; binds: unknown[] }> = []
  const make = (sql: string) => {
    const stmt = {
      _binds: [] as unknown[],
      bind(...args: unknown[]) { stmt._binds = args; calls.push({ sql, binds: args }); return stmt },
      async all() { return { results: [] } },
      async first() { return null },
      async run() { return { meta: { changes: 0 } } },
    }
    return stmt
  }
  return {
    DB: { prepare: (sql: string) => make(sql), batch: async () => [] } as unknown as D1Database,
    calls,
  }
}

function settlementSelect(calls: Array<{ sql: string; binds: unknown[] }>) {
  return calls.find(c => c.sql.includes('FROM supplier_settlements') && c.sql.includes("source = 'wholesale'"))
}

describe('reverseSupplierOnWholesaleRefund — productIds 스코프', () => {
  it('productIds 미지정 → 기존 쿼리 형태(IN 절 없음), bind = [orderId, supplierId]', async () => {
    const { DB, calls } = stubDB()
    const r = await reverseSupplierOnWholesaleRefund(DB, 77, '테스트', 5)
    expect(r).toBe(0)
    const sel = settlementSelect(calls)
    expect(sel).toBeTruthy()
    expect(sel!.sql).not.toContain('product_id IN')
    expect(sel!.binds).toEqual([77, 5])
  })

  it('productIds 지정 → product_id IN (?,?) + bind 순서 [orderId, supplierId, ...pids]', async () => {
    const { DB, calls } = stubDB()
    await reverseSupplierOnWholesaleRefund(DB, 77, '테스트', 5, [101, 202])
    const sel = settlementSelect(calls)
    expect(sel!.sql).toContain('AND product_id IN (?,?)')
    expect(sel!.binds).toEqual([77, 5, 101, 202])
  })

  it('supplierId 미지정 + productIds → bind [orderId, ...pids]', async () => {
    const { DB, calls } = stubDB()
    await reverseSupplierOnWholesaleRefund(DB, 88, '테스트', undefined, [9])
    const sel = settlementSelect(calls)
    expect(sel!.sql).not.toContain('supplier_id = ?')
    expect(sel!.binds).toEqual([88, 9])
  })

  it('잘못된 productIds(0/음수/NaN)는 필터 — 전부 무효면 스코프 없는 기존 동작', async () => {
    const { DB, calls } = stubDB()
    await reverseSupplierOnWholesaleRefund(DB, 99, '테스트', 5, [0, -1, NaN as unknown as number])
    const sel = settlementSelect(calls)
    expect(sel!.sql).not.toContain('product_id IN')
    expect(sel!.binds).toEqual([99, 5])
  })
})
