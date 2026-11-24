import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { AUX_TABLE_REPAIRS } from '@/worker/routes/repair-schema/aux-tables'

/**
 * 🩸 2026-11-24 — 코드의 정적 SQL 5,624개를 라이브 D1 스키마 사본에 EXPLAIN 해서 찾은 두 고장.
 *   ① 셀러 상품 옵션 목록이 라이브에 없는 `product_options.stock_quantity` 를 읽어 매번 실패했다.
 *   ② `abuse_detections` 는 migrations/0242 에만 있고 라이브에 없었다 — 부정 탐지 기록 7곳이 조용히 실패.
 * 못 막는 것: 다른 곳의 같은 종류(그건 라이브 스키마 대조 검사가 맡아야 한다 — 이 파일은 두 건만 고정).
 */
describe('라이브 스키마 대조로 찾은 고장 — 되돌아오지 않는다', () => {
  it('① 옵션 목록 조회가 product_options.stock_quantity 를 읽지 않는다', () => {
    const s = readFileSync('src/features/seller/api/seller-management.routes.ts', 'utf8')
    const q = s.slice(s.indexOf("'/products/:id/options'"), s.indexOf("'/products/:id/options'") + 1500)
    expect(q).toContain('FROM product_options')
    expect(q).not.toMatch(/COALESCE\(stock,\s*stock_quantity/)
  })
  it('② 매일 schema-repair 가 abuse_detections 를 만든다', () => {
    const t = AUX_TABLE_REPAIRS.find((x) => x.name === 'abuse_detections')
    expect(t?.sql).toMatch(/CREATE TABLE IF NOT EXISTS abuse_detections/)
    expect(t?.sql).toMatch(/severity TEXT NOT NULL CHECK/)
  })
})
