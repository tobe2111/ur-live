/**
 * 🧱 유어딜 소비자 ↔ 도매몰(유통스타트) 분리 불변식 (정적 가드)
 *
 * 2026-06-26 분리 전수감사: 도매 카탈로그 마스터(is_supply_product=1, supply_source_id 없음)가
 *   소비자 상품쿼리 여러 곳으로 누수(쇼핑/검색/sitemap/링크샵추천/공구피드). 전 소비자 상품쿼리에
 *   동일 제외절을 강제. 도매몰(/api/wholesale/*)은 별도 엔드포인트로 항상 is_supply_product=1 만 봄.
 *
 * 2026-07-29 (대표 지시 — 픽업 공구 연계 설계 §4 개정 후속): ①~③ 은 **행**(어떤 상품이 보이는가) 누수를
 *   막는다. **컬럼**(매입가가 페이로드에 실리는가) 은 아무도 안 보고 있었다. 재판매 복제본은
 *   `supply_price` 를 **행에 실제로 저장**하므로(`supply.routes.ts:333~344`), 격리는 *행의 부재*가 아니라
 *   **SELECT 컬럼 선택**으로만 이뤄진다 — 소비자 노출면에 컬럼 하나 잘못 얹으면 매장이 마진 구조를 본다.
 *   문서 기재로 끝내지 말고 테스트로 고정하라는 지시(§4 · docs/design/pickup-groupbuy-wholesale-link.md).
 *
 * 불변식:
 *   ① 모든 소비자 상품쿼리(리스트/카운트/검색/sitemap/추천/공구피드/cron)는 도매 마스터를 제외한다.
 *   ② 도매몰 카탈로그는 여전히 도매 상품(is_supply_product=1)만 노출한다(반대 방향).
 *   ③ 계정 전환 시 도매/셀러/에이전시/관리자 토큰을 모두 wipe 한다(공유기기 누출 차단).
 *   ④ **매입가 컬럼은 소비자 응답 페이로드에 절대 실리지 않는다** (컬럼 목록 + 실제 발행 SQL 양쪽).
 * 깨지면(제외절 제거/토큰 wipe 누락/매입가 노출) CI 빨강.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PRODUCT_DETAIL_FIELDS, productDetailCols, productDetailColsHealed } from '@/shared/db/product-columns'
import { ProductRepository } from '@/features/products/repositories/ProductRepository'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

// 도매 마스터 제외절 — 공백/별칭(p.) 무관 매칭.
const EXCL = /NOT\s*\(\s*COALESCE\(\s*[a-z]*\.?is_supply_product\s*,\s*0\s*\)\s*=\s*1\s+AND\s+COALESCE\(\s*[a-z]*\.?supply_source_id\s*,\s*0\s*\)\s*=\s*0\s*\)/gi
const count = (s: string) => (s.match(EXCL) || []).length

// [파일, 최소 제외절 개수] — 소비자에게 상품을 노출하는 전 경로.
const CONSUMER_PRODUCT_QUERIES: Array<[string, number]> = [
  ['src/features/products/repositories/ProductRepository.ts', 3], // 리스트 + 카운트 + FTS
  ['src/features/products/api/products.routes.ts', 3],            // /count + 자동완성 ×2
  ['src/worker/routes/sitemap.routes.ts', 2],                     // 공구 + 일반상품
  ['src/worker/routes/curator.routes.ts', 1],                     // 링크샵 추천 피드
  ['src/features/group-buy/api/group-buy-public.routes.ts', 2],   // gift-catalog + fallback
  ['src/worker/cron/group-buy-feed-cache.ts', 1],                 // 홈/공구 피드 cron
]

describe('유어딜 소비자 ↔ 도매몰 분리 불변식', () => {
  for (const [file, min] of CONSUMER_PRODUCT_QUERIES) {
    it(`① ${file} — 도매 마스터 제외절 ${min}회+`, () => {
      expect(count(read(file))).toBeGreaterThanOrEqual(min)
    })
  }

  it('② 도매몰 카탈로그는 여전히 is_supply_product=1 만 노출(반대 방향)', () => {
    expect(/is_supply_product\s*=\s*1/.test(read('src/features/supply/api/wholesale.routes.ts'))).toBe(true)
  })

  it('③ 계정 전환 시 도매/셀러/에이전시/관리자 토큰 모두 wipe (KakaoCallbackPage)', () => {
    const cb = read('src/pages/KakaoCallbackPage.tsx')
    for (const k of ['supplier_token', 'admin_token', 'seller_token', 'agency_token']) {
      expect(cb.includes(`'${k}'`)).toBe(true)
    }
  })

  // ④ 매입가 누수 — 컬럼 축.
  describe('④ 매입가 컬럼은 소비자 페이로드에 실리지 않는다', () => {
    // 매입/원가 성격 컬럼. 여기에 이름을 추가하면 그 컬럼도 자동으로 소비자 노출 금지가 된다.
    const COST_COLS = [
      'supply_price', 'pending_supply_price', 'base_supply_price',
      'cost_price', 'wholesale_price', 'purchase_price', 'supply_cost',
    ]
    // `supply_source_id` 는 가격이 아니라 연결키 → 금지 대상 아님(오탐 방지).
    const hasCostCol = (sql: string) =>
      COST_COLS.filter((c) => new RegExp(`\\b${c}\\b`).test(sql))

    it('PRODUCT_DETAIL_FIELDS(상세 명시 목록)에 매입가 없음', () => {
      expect(hasCostCol((PRODUCT_DETAIL_FIELDS as readonly string[]).join(' '))).toEqual([])
      expect(hasCostCol(productDetailCols())).toEqual([])
      expect(hasCostCol(productDetailColsHealed())).toEqual([])
    })

    // 정적 목록만 보면 인라인 baseCols 를 놓친다 → 실제 발행 SQL 을 캡처해 확인.
    const captureSql = async (run: (repo: ProductRepository) => Promise<unknown>) => {
      const seen: string[] = []
      const stmt = {
        bind: () => stmt,
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } }),
      }
      const db = { prepare: (sql: string) => { seen.push(sql); return stmt } }
      await run(new ProductRepository(db as unknown as D1Database)).catch(() => {})
      expect(seen.length).toBeGreaterThan(0) // SQL 을 한 번도 안 잡았으면 이 테스트가 헛돈 것
      return seen.join('\n')
    }

    it('findById(상세) 발행 SQL 에 매입가 없음', async () => {
      expect(hasCostCol(await captureSql((r) => r.findById(1)))).toEqual([])
    })

    it('findAll(목록/검색) 발행 SQL 에 매입가 없음', async () => {
      expect(hasCostCol(await captureSql((r) => r.findAll({} as never, 0, 20)))).toEqual([])
    })

    // 라우트의 인라인 SELECT 목록 — 소비자 노출면.
    for (const f of [
      'src/features/group-buy/api/group-buy-public.routes.ts',
      'src/features/products/api/products.routes.ts',
      'src/worker/routes/curator.routes.ts',
    ]) {
      it(`${f} SELECT 목록에 매입가 없음`, () => {
        expect(hasCostCol(read(f))).toEqual([])
      })
    }

    // products 는 D1 컬럼 한도(100)에 붙어 있어 `SELECT *` 가 곧 매입가 동반 노출이다.
    it('소비자 상품 경로에 products SELECT * / p.* 없음', () => {
      for (const f of [
        'src/features/products/repositories/ProductRepository.ts',
        'src/features/group-buy/api/group-buy-public.routes.ts',
      ]) {
        expect(/SELECT\s+(?:\*|[a-z]+\.\*)\s+FROM\s+products/i.test(read(f))).toBe(false)
      }
    })
  })
})
