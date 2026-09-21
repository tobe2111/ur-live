/**
 * 🛠️ 셀러 상품 수정이 라이브에서 항상 500 — `seller-orders.routes.ts` PUT /products/:id (2026-09-21).
 *
 * E5 실사용(S-BROKER 준비로 테스트 이용권을 숨기려다)에서 발견: `is_active:false` PUT 이 **500** 을 돌려주는데
 * D1 에는 이미 반영돼 있었다. 원인은 UPDATE 뒤 응답용 SELECT 의 `COALESCE(thumbnail_url, image_url, image)` —
 * 라이브 `products` 에 **`image` 컬럼이 없다**(D1 실측: `no such column: image`). 마이그레이션엔 있고 repair-schema 는
 * 안 만들어서, 코드만 보면 있는 컬럼이다. 셀러는 "수정 실패" 를 보고 다시 누르고, 실제론 매번 저장된다.
 *
 * 같은 응답 SELECT 의 `COALESCE(stock_quantity, stock, 0)` 도 뒤집혀 있었다 — 등록은 `stock` 에만 쓰고
 * `stock_quantity` 는 DEFAULT 0 이라 등록 직후 응답이 **재고 0** 으로 보인다(목록 쿼리 `seller-products-query.ts` 는 이미 canonical 우선).
 *
 * 이 시험이 **못 막는** 것: 라이브 스키마와 마이그레이션의 다른 편차(이건 `image` 하나를 못 박는다) · 실제 500 재현(소스 검사).
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'
import { sellerProductAfterUpdateSql, readSellerProductAfterUpdate } from '@/features/seller/api/seller-product-response'

const SRC = 'src/features/seller/api/seller-orders.routes.ts'

function fakeDb(failWith: string | null, row: Record<string, unknown>) {
  const sqls: string[] = []
  return {
    sqls,
    db: {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            sqls.push(sql)
            if (failWith && sql.includes(failWith)) throw new Error(`no such column: ${failWith}`)
            return row
          },
        }),
      }),
    } as unknown as D1Database,
  }
}

describe('셀러 상품 PUT 응답 SELECT — 라이브에 없는 컬럼을 읽지 않는다', () => {
  const code = readCode(SRC)
  const put = sliceFrom(code, "sellerOrdersRoutes.put('/products/:id'", "sellerOrdersRoutes.delete('/products/:id'", 20000)

  it('`image` 컬럼(라이브 부재)을 어떤 SELECT 에서도 읽지 않는다', () => {
    for (const withLive of [true, false]) {
      expect(sellerProductAfterUpdateSql(withLive)).not.toMatch(/image_url,\s*image\)/)
      // 등록 응답과 같은 모양이어야 한다 — 한쪽만 고치면 다음 사람이 다른 쪽을 복사한다
      expect(sellerProductAfterUpdateSql(withLive)).toMatch(/COALESCE\(thumbnail_url,\s*image_url\)\s+AS image_url/)
    }
    expect(put).not.toMatch(/COALESCE\(thumbnail_url,\s*image_url,\s*image\)/)
  })

  it('live_* 컬럼이 없는 라이브에선 그 둘만 빼고 다시 읽는다 (다른 에러는 삼키지 않는다)', async () => {
    const row = { id: 1, stock: 10 }
    const a = fakeDb('live_only_price', row)
    await expect(readSellerProductAfterUpdate(a.db, 1)).resolves.toEqual(row)
    expect(a.sqls.length).toBe(2)
    expect(a.sqls[1]).not.toContain('live_only_price')
    const b = fakeDb(null, row)
    await expect(readSellerProductAfterUpdate(b.db, 1)).resolves.toEqual(row)
    expect(b.sqls.length).toBe(1)
    // 첫 호출만 잠금 에러, 두 번째는 성공 — 폴백이 "없는 컬럼" 외 에러까지 삼키면 여기서 (틀리게) 성공한다
    let calls = 0
    const c = { prepare: () => ({ bind: () => ({ first: async () => { calls += 1; if (calls === 1) throw new Error('D1_ERROR: database is locked'); return row } }) }) } as unknown as D1Database
    await expect(readSellerProductAfterUpdate(c, 1)).rejects.toThrow('locked')
    expect(calls).toBe(1)
  })

  it('PUT 이 그 헬퍼를 쓴다 (인라인 SELECT 로 되돌아가면 같은 500 이 재발한다)', () => {
    expect(put).toContain('readSellerProductAfterUpdate(db, productId)')
    expect(put).not.toMatch(/FROM products WHERE id = \?`\s*\)\.bind\(productId\)\.first/)
  })

  it('재고는 canonical `stock` 을 먼저 읽는다 (등록·수정·삭제 응답 셋 다)', () => {
    const wrong = code.match(/COALESCE\((?:p\.)?stock_quantity,\s*(?:p\.)?stock,\s*0\)/g) || []
    expect(wrong).toEqual([])
    const right = code.match(/COALESCE\((?:p\.)?stock,\s*(?:p\.)?stock_quantity,\s*0\)/g) || []
    expect(right.length).toBeGreaterThanOrEqual(2)
    expect(sellerProductAfterUpdateSql(true)).toMatch(/COALESCE\(stock,\s*stock_quantity,\s*0\)/)
  })
})
