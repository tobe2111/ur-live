import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ⭐ **본진에서 가장 큰 테이블에 인덱스가 없었다** — 2026-08-27, 라이브 실측.
 *
 * ## 실측
 * ```
 *   product_reviews 119,292행 (본진 다음 테이블이 3,790 — 압도적 1위)   ·   인덱스 0개
 *   EXPLAIN QUERY PLAN → SCAN product_reviews
 *   리뷰 8건 조회      → rows_read 119,292 · 17.6ms
 *   평점 집계 1건      → rows_read 119,292 · 21.4ms
 *   본진 읽기 7,790만 행/일 ÷ 119,292 = 하루 653회 전수 스캔에 해당
 * ```
 * 상품 상세를 열 때마다, 리뷰 목록을 넘길 때마다, 평점을 다시 셀 때마다 11.9만 행을 통째로 읽었다.
 *
 * ## 왜 이 컬럼 순서인가
 * 코드의 지배적 형태가 `WHERE product_id = ? AND is_visible = 1 ORDER BY created_at DESC` 다
 * (`reviews.routes.ts` 목록·카운트·집계). 셋을 그 순서로 담으면 탐색과 정렬을 한 인덱스가 받는다.
 *
 * ## 이 테스트가 **못** 막는 것
 * - 인덱스가 실제로 쓰이는지 — SQLite 옵티마이저 판단이라 레포에서 확인 불가.
 *   **배포 후 `rows_read` 로만 판정된다**(기준: 119,292 → 한 자리~두 자리).
 * - 인덱스가 실제로 **생성됐는지** — `repair-schema` 가 돌아야 만들어진다(즉시 반영 아님).
 */
// 📍 2026-08-27 후속: 선언이 `repair-schema/index-repairs.ts` 로 옮겨졌다(god 파일 래칫).
//   **옮긴 뒤에도 지도가 낡지 않도록** 선언(모듈)과 배선(routes 의 `...INDEX_REPAIRS`)을 따로 본다 —
//   선언만 검사하면 배선이 빠져도 초록불이고, 인덱스는 영원히 생성되지 않는다.
const indexRepairs = readFileSync('src/worker/routes/repair-schema/index-repairs.ts', 'utf8')
const repair = readFileSync('src/worker/routes/repair-schema.routes.ts', 'utf8')
const reviews = readFileSync('src/features/reviews/api/reviews.routes.ts', 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('리뷰 조회 인덱스', () => {
  it('🩸 product_reviews 에 조회 인덱스가 선언돼 있다 — 없으면 조회마다 11.9만 행 전수 스캔', () => {
    expect(code(indexRepairs)).toMatch(/CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews\(/)
  })

  it('🩸 컬럼 순서가 실제 WHERE·ORDER BY 와 맞는다 — 어긋나면 인덱스가 있어도 안 쓰인다', () => {
    expect(code(indexRepairs)).toMatch(/idx_product_reviews_product ON product_reviews\(product_id, is_visible, created_at DESC\)/)
  })

  it('🩸 그 형태가 코드에 실재한다 — 인덱스만 있고 쿼리가 다르면 헛돈다', () => {
    const body = code(reviews)
    expect(body, 'product_id + is_visible 조합').toMatch(/WHERE r?\.?product_id = \? AND r?\.?is_visible = 1/)
    expect(body, '최신순 정렬').toMatch(/ORDER BY r\.created_at DESC/)
  })

  it('repair-schema 의 인덱스 선언 관례를 따른다(name + sql 쌍)', () => {
    expect(code(indexRepairs)).toMatch(/\{ name: 'idx_product_reviews_product', sql: `CREATE INDEX/)
  })

  it('🩸 배선 — 그 목록이 실제 복구 실행 목록에 펼쳐진다(선언만 있으면 인덱스는 안 생긴다)', () => {
    expect(code(repair)).toMatch(/\.\.\.INDEX_REPAIRS,/)
    expect(code(repair)).toMatch(/import \{ INDEX_REPAIRS \} from '\.\/repair-schema\/index-repairs'/)
  })
})
