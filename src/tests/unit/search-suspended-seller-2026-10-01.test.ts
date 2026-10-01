/**
 * 🔎 **검색·자동완성이 정지 매장의 상품을 그대로 보여 주던 것** (2026-10-01)
 *
 * `ProductRepository.findAll` 머리말은 2026-04-22 부터 셀러 술어를 *"(검색/브라우즈 방어)"* 라고
 * 적어 두고 있었다. 그런데 **검색은 그 방어를 갖고 있지 않았다** — 2026-09-03 FTS 재작성이
 * `searchProducts` 를 새로 쓰며 술어를 빠뜨렸고, 자동완성(`search-suggestions`)은 애초에 없었다.
 *
 * ## 왜 몇 달간 안 보였나
 * 둘 다 `is_active = 1` 은 갖고 있고, 정지 엔드포인트(`DELETE /admin/sellers/:id`)가 그 매장
 * 상품을 **전부** `is_active = 0` 으로 만든다. 그래서 "정지 매장 + 활성 상품" 조합이 라이브에
 * 존재한 적이 없었다. 2026-10-01 에 *"메인에선 숨기고 직링크로는 팔리게"*(매장만 정지, 상품은
 * 수동 재활성)를 만들자 **그 순간 드러났다**: 피드·섹션·카탈로그에선 사라졌는데
 * `이용권`·`분식` 검색과 자동완성에는 그대로 떴다(라이브 실측).
 *
 * ## 왜 문자열이 아니라 SQL 을 돌리나
 * 실패 모드 둘 다 조용하다 — 너무 조이면 플랫폼 상품(`seller_id IS NULL`)이 통째로 사라지고,
 * 너무 풀면 오늘과 똑같이 보여 티가 안 난다. `NOT EXISTS` 상관 서브쿼리가 의도대로 도는지는
 * 소스를 읽어선 알 수 없다 ⇒ **실제 SQLite 에 넣고 행을 센다**.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - 직링크 상세·구매는 대상이 아니다(의도적 — `activeSellerProductSql` 주석 참조).
 *   - `status`(승인) 축은 다른 술어(`approvedSellerProductSql`)의 일이고 메인 노출에만 걸린다.
 *   - D1 과 node:sqlite 의 차이.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { activeSellerProductSql } from '@/shared/db/consumer-visible-product'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

const REPO = 'src/features/products/repositories/ProductRepository.ts'
const SUGG = 'src/features/products/api/search-suggestions.ts'
const src = (p: string) => stripComments(readFileSync(p, 'utf-8'))

/** 매장 상태별 상품을 깔고, 주어진 술어로 걸러 **보이는 상품 id** 를 돌려준다. */
function visibleIds(predicate: string, alias: 'products' | 'p'): number[] {
  const db: Db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, is_active INTEGER, status TEXT);
    CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, is_active INTEGER);
    INSERT INTO sellers (id, is_active, status) VALUES
      (1, 1, 'approved'),    -- 살아 있는 매장
      (2, 0, 'suspended'),   -- 정지 매장  ← 2026-10-01 의 그 조합
      (3, 1, 'pending');     -- 미승인이지만 활성 — 이 술어의 대상이 아니다
    INSERT INTO products (id, seller_id, is_active) VALUES
      (10, 1, 1),      -- 보여야 한다
      (20, 2, 1),      -- 가려야 한다 (매장 정지 + 상품 활성)
      (30, NULL, 1),   -- 플랫폼 상품(교환권·KT·데모) — 보여야 한다
      (40, 999, 1),    -- dangling seller_id — 관대한 쪽: 보여야 한다
      (50, 3, 1);      -- 승인 전 매장 — 이 축은 안 가린다
  `)
  const from = alias === 'p' ? 'products p' : 'products'
  const rows = db.prepare(
    `SELECT ${alias}.id AS id FROM ${from} WHERE ${alias}.is_active = 1 AND ${predicate} ORDER BY ${alias}.id`
  ).all() as { id: number }[]
  db.close()
  return rows.map(r => Number(r.id))
}

/** `findAll`/`count` 가 인라인으로 갖고 있는 쌍둥이 술어 — 네 자리가 안 갈리는지 대조용. */
const INLINE_TWIN = `NOT EXISTS (SELECT 1 FROM sellers s WHERE s.id = products.seller_id AND s.is_active = 0)`

describe('검색·자동완성이 정지 매장 상품을 가린다 (2026-10-01)', () => {
  // ── ① 술어 자체가 의도대로 도는가 (실제 SQL) ──────────────────────────────
  it('① 정지 매장(is_active=0)의 활성 상품만 사라진다', () => {
    expect(visibleIds(activeSellerProductSql('p'), 'p')).toEqual([10, 30, 40, 50])
  })

  it('①-2 별칭 없이(products) 써도 같은 판정이다 — 자동완성이 그 형태로 쓴다', () => {
    expect(visibleIds(activeSellerProductSql('products'), 'products')).toEqual([10, 30, 40, 50])
  })

  it('①-3 플랫폼 상품(seller_id NULL)·dangling 은 관대하게 통과한다', () => {
    const ids = visibleIds(activeSellerProductSql('p'), 'p')
    expect(ids).toContain(30) // seller_id NULL — 조이면 홈이 통째로 빈다
    expect(ids).toContain(40) // 셀러 행 없음 — 조인이 깨진 날 전멸 방지
  })

  it('①-4 승인 축(status)은 건드리지 않는다 — 겹쳐 쓰면 어느 쪽이 가렸는지 못 읽는다', () => {
    expect(visibleIds(activeSellerProductSql('p'), 'p')).toContain(50) // pending 매장
  })

  it('①-5 가드가 헛돌지 않는다 — 술어 없이는 정지 매장 상품이 실제로 보인다', () => {
    expect(visibleIds('1=1', 'p')).toContain(20)
  })

  // ── ② 네 자리가 안 갈리는가 ───────────────────────────────────────────────
  it('② findAll 의 인라인 쌍둥이와 판정이 같다', () => {
    expect(visibleIds(INLINE_TWIN, 'products')).toEqual(visibleIds(activeSellerProductSql('products'), 'products'))
  })

  it('②-2 findAll·count 가 아직 그 인라인 술어를 갖고 있다', () => {
    const s = src(REPO)
    const hits = s.split(INLINE_TWIN).length - 1
    expect(hits).toBe(2) // findAll + count
  })

  // ── ③ 배선 — import 가 아니라 **호출 형태**로 앵커한다 ────────────────────
  it('③ searchProducts(FTS) 가 술어를 쓴다', () => {
    expect(src(REPO)).toContain("AND ${activeSellerProductSql('p')}")
  })

  it('③-2 자동완성 scope 가 같은 술어를 쓴다', () => {
    const s = src(SUGG)
    expect(s).toContain("activeSellerProductSql('products')")
    // exchange / voucher 두 분기 **모두** 에 걸려 있어야 한다 — 한쪽만이면 그쪽으로 샌다.
    expect(s.split('AND ${sellerLive}').length - 1).toBe(2)
  })

  it('③-3 검사 대상이 비어 있지 않다 — 파일이 옮겨가면 위 toContain 이 전부 헛돈다', () => {
    expect(src(REPO).length).toBeGreaterThan(5000)
    expect(src(SUGG).length).toBeGreaterThan(1000)
  })
})
