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
const ROUTES = 'src/features/products/api/products.routes.ts'
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

/** 상품명/매장명을 `LIKE` 로 긁는 SQL 리터럴을 전부 모은다 — 자동완성 표면의 정의. */
function productNameQueries(file: string): string[] {
  const text = src(file)
  const out: string[] = []
  for (const m of text.matchAll(/`[^`]*\bFROM products\b[^`]*`/g)) {
    if (/name\s+LIKE/i.test(m[0])) out.push(m[0])
  }
  return out
}

/**
 * SQL 리터럴 안의 `${지역변수}` 를 그 파일의 `const 지역변수 = …` 정의로 한 단계씩 펼친다.
 *
 * 🩸 왜 필요한가: `search-suggestions.ts` 는 술어를 `const scope = \`… ${sellerLive} …\`` 로
 *   **간접** 보유한다. 리터럴 본문만 보면 "술어 없음" 으로 읽혀 **멀쩡한 코드에 빨간불**이 난다
 *   (첫 판이 실제로 그랬다). 반대로 펼치지 않으면 복제본을 놓친다.
 */
function expandLocalTemplates(fileText: string, sql: string): string {
  let out = sql
  for (let pass = 0; pass < 4; pass++) {
    const before = out
    out = out.replace(/\$\{(\w+)\}/g, (whole, name) => {
      const m = fileText.match(new RegExp(String.raw`const\s+${name}\s*=\s*([\s\S]*?);\n`))
      return m ? m[1] : whole
    })
    if (out === before) break
  }
  return out
}

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

  // ── ④ 자동완성은 구현이 **두 벌**이다 ─────────────────────────────────────
  //
  // 🩸 2026-10-01: ③-2 를 통과시키고도 라이브 `/api/products/search/suggestions` 가 그대로 샜다.
  //   `search-suggestions.ts`(SearchPage 가 부르는 `/api/search/suggestions`)만 고쳤고,
  //   `products.routes.ts` 안의 **인라인 SQL 복제본**은 손대지 않았기 때문이다.
  //   그 핸들러는 소스 주석이 *"안 닿는다"* 고 적어 둔 자리였는데 **실제로는 200 이 나온다**.
  //   ⇒ 한 파일만 앵커하는 배선 검사는 복제본을 구조적으로 못 본다. 아래는 **전수**로 센다.
  it('④ products.routes 의 인라인 자동완성 SQL 도 같은 술어를 쓴다', () => {
    expect(src(ROUTES)).toContain("AND ${activeSellerProductSql('products')}")
  })

  it('④-2 상품명을 LIKE 로 긁는 쿼리는 **전부** 셀러 술어를 갖는다 (세 번째 복제본 차단)', () => {
    const leaks: string[] = []
    for (const f of [ROUTES, SUGG]) {
      for (const sql of productNameQueries(f)) {
        if (!expandLocalTemplates(src(f), sql).includes('activeSellerProductSql')) {
          leaks.push(`${f}: ${sql.slice(0, 90).replace(/\s+/g, ' ')}…`)
        }
      }
    }
    expect(leaks).toEqual([])
  })

  it('④-2-1 술어에 넘긴 별칭이 그 쿼리의 FROM 과 맞는다 (어긋나면 조용히 빈 결과)', () => {
    // 🩸 2026-10-01 주입이 찾아낸 사각지대: `FROM products p` 로 바꾸면 술어 안의
    //   `products.seller_id` 가 해석 불가라 SQLite 가 던지는데, 호출부의
    //   `.catch(() => ({ results: [] }))` 가 삼켜 **자동완성이 조용히 비어 버린다**.
    //   빨간불도 에러 로그도 없어서 "제안이 원래 안 뜨나 보다" 로 지나간다.
    const bad: string[] = []
    for (const f of [ROUTES, SUGG]) {
      for (const sql of productNameQueries(f)) {
        const full = expandLocalTemplates(src(f), sql)
        const used = [...full.matchAll(/activeSellerProductSql\(\s*'([^']+)'\s*\)/g)].map(m => m[1])
        if (!used.length) continue
        // `FROM products` → 바인딩은 'products' / `FROM products p` → 'p'
        const from = full.match(/\bFROM\s+products(?:\s+(?!WHERE\b|JOIN\b|ORDER\b|LIMIT\b)(\w+))?/i)
        const bound = from?.[1] ?? 'products'
        for (const u of used) if (u !== bound) bad.push(`${f}: 술어 별칭 '${u}' ≠ FROM 별칭 '${bound}'`)
      }
    }
    expect(bad).toEqual([])
  })

  it('④-3 그런 쿼리가 실제로 발견된다 — 0건이면 통과가 아니라 수집기가 낡은 것이다', () => {
    const n = [ROUTES, SUGG].reduce((a, f) => a + productNameQueries(f).length, 0)
    expect(n).toBeGreaterThanOrEqual(3) // 인라인 복제본 1 + search-suggestions 2(매장명·상품명)
  })
})
