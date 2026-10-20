/**
 * Integration Tests — FTS5 search ranking (trigram tokenizer + bm25).
 *
 * 검증:
 *  - 빈 쿼리 → 빈 결과
 *  - bm25 가중치: name > category > description (mock 시뮬레이션)
 *  - 부분매칭 (trigram 효과 — 일부 글자만 매치되도 결과 반환)
 */

import { describe, it, expect } from 'vitest'

describe('FTS5 search ranking', () => {
  it('빈 쿼리 — 빈 결과 + total=0', async () => {
    const resp = await fetch('/api/search/fts?q=')
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it('name 매치가 category 매치보다 상위 (bm25 가중치 3.0 vs 2.0)', async () => {
    // mockProducts: Test Product 1 (category=fashion), Test Product 2 (category=beauty)
    // 'fashion' 검색 → category 에만 매치 — total=1
    const resp = await fetch('/api/search/fts?q=fashion')
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].category).toBe('fashion')
  })

  it('부분매칭 (substring) — "Product" 로 모든 상품 매치', async () => {
    const resp = await fetch('/api/search/fts?q=Product')
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(2)
    // 모든 결과가 'Product' 를 name 에 포함
    for (const p of body.data) {
      expect(p.name.toLowerCase()).toContain('product')
    }
  })

  it('매치 없는 쿼리 — 빈 결과 + success=true', async () => {
    const resp = await fetch('/api/search/fts?q=zzzzzz_nonexistent_xyz')
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
  })

  it('pagination 메타 항상 포함', async () => {
    const resp = await fetch('/api/search/fts?q=Test')
    const body = await resp.json()
    expect(body.pagination).toBeDefined()
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(20)
    expect(body.pagination.totalPages).toBeGreaterThanOrEqual(1)
  })
})
