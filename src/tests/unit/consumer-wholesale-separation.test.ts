/**
 * 🧱 유어딜 소비자 ↔ 도매몰(유통스타트) 분리 불변식 (정적 가드)
 *
 * 2026-06-26 분리 전수감사: 도매 카탈로그 마스터(is_supply_product=1, supply_source_id 없음)가
 *   소비자 상품쿼리 여러 곳으로 누수(쇼핑/검색/sitemap/유어샵추천/공구피드). 전 소비자 상품쿼리에
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
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { PRODUCT_DETAIL_FIELDS, productDetailCols, productDetailColsHealed } from '@/shared/db/product-columns'
import { ProductRepository } from '@/features/products/repositories/ProductRepository'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

// 도매 마스터 제외절 — 공백/별칭(p.) 무관 매칭.
const EXCL = /NOT\s*\(\s*COALESCE\(\s*[a-z]*\.?is_supply_product\s*,\s*0\s*\)\s*=\s*1\s+AND\s+COALESCE\(\s*[a-z]*\.?supply_source_id\s*,\s*0\s*\)\s*=\s*0\s*\)/gi
// 🧱 2026-09-03: 같은 규칙을 **상수로 부르는** 형태도 센다.
//   이 가드는 술어의 *문자열*을 세는데, 규칙을 SSOT(`shared/db/consumer-visible-product`)로 모으면
//   문자열이 사라져 **규칙을 지켰는데 빨간불**이 된다(실제로 그렇게 한 번 깨졌다 — PR #1330).
//   두 형태를 모두 세면 "인라인으로 두든 상수로 모으든, 조건이 그 쿼리에 붙어 있는가"만 남는다.
//   ⚠️ 상수 자체의 내용은 `qa-round1-fixes-2026-09-03.test.ts` 가 따로 고정한다 —
//     여기서 호출만 세면 빈 함수여도 통과하므로, 그 짝이 없으면 이 완화는 가드를 약화시킨다.
const EXCL_HELPER = /consumerVisibleProductSql\s*\(/g
const count = (s: string) => (s.match(EXCL) || []).length + (s.match(EXCL_HELPER) || []).length

// [파일, 최소 제외절 개수] — 소비자에게 상품을 노출하는 전 경로.
const CONSUMER_PRODUCT_QUERIES: Array<[string, number]> = [
  ['src/features/products/repositories/ProductRepository.ts', 3], // 리스트 + 카운트 + FTS
  ['src/features/products/api/products.routes.ts', 3],            // /count + 자동완성 ×2
  ['src/worker/routes/sitemap.routes.ts', 2],                     // 공구 + 일반상품
  ['src/worker/routes/curator.routes.ts', 2],                     // 유어샵 추천 피드 + 담긴 핀 목록(2026-09-03)
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

    // 소비자 노출면 전체 — **열거가 아니라 glob 래칫**(2026-07-29 대표 승인).
    //   이전엔 파일 3개를 손으로 열거해, 새 라우트가 생기면 자동으로 안 잡혔다(노출면이 늘 때마다
    //   사람이 목록에 추가해야 했고, 잊으면 무방비). 지금은 소비자 디렉터리를 통째로 훑고
    //   baseline(scripts/consumer-cost-column-baseline.json)에 등록된 파일만 예외로 둔다.
    //
    // ⚠️ 이 래칫이 보장하는 것 / 못 하는 것 (baseline 파일에도 같은 문구가 있다 — 과신 금지):
    //   보장 O — 새로 생긴 파일이 조용히 검사에서 빠지지 않는다.
    //   보장 X — "모든 노출 경로가 옳다"가 아니다. 텍스트 언급이 없어도 SELECT * / 동적 컬럼 조립 /
    //            타 테이블 조인으로 매입가가 실릴 수 있다. 그 축은 위 '발행 SQL 캡처' 테스트가 맡고,
    //            진입점(findById/findAll)은 여전히 사람이 지정한다.
    const CONSUMER_DIRS = [
      'src/features/products',
      'src/features/group-buy',
      'src/worker/routes',
      'src/worker/cron',
    ]
    const baseline = JSON.parse(read('scripts/consumer-cost-column-baseline.json')) as {
      allow: Record<string, string>
    }
    const walk = (dir: string): string[] => {
      const abs = resolve(process.cwd(), dir)
      if (!existsSync(abs)) return []
      return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) return walk(rel)
        return /\.(ts|tsx)$/.test(e.name) ? [rel] : []
      })
    }

    it('소비자 노출면 어디에도 매입가 컬럼이 없다 (glob 래칫 — 새 파일 자동 검출)', () => {
      const scanned = CONSUMER_DIRS.flatMap(walk)
      expect(scanned.length).toBeGreaterThan(20) // 스캔이 헛돌면(경로 오타 등) 여기서 잡힌다
      const offenders = scanned
        .filter((f) => !(f in baseline.allow))
        .map((f) => ({ f, cols: hasCostCol(read(f)) }))
        .filter((x) => x.cols.length > 0)
        .map((x) => `${x.f} → ${x.cols.join(',')}`)
      expect(offenders).toEqual([])
    })

    it('baseline 예외는 전부 실재하고 사유가 붙어 있다 (죽은 예외 방지)', () => {
      for (const [f, reason] of Object.entries(baseline.allow)) {
        expect(existsSync(resolve(process.cwd(), f)), `${f} 없음 — 예외 정리 필요`).toBe(true)
        expect(String(reason).length, `${f} 사유 누락`).toBeGreaterThan(10)
      }
    })

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
