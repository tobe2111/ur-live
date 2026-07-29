/**
 * 🔴 sitemap 몰 격리 불변식 〔2026-07-29 세션 ②〕
 *
 * **왜 sitemap 이 별도 순위인가**: 운영자 몰 상품이 본진 노출 경로로 새는 사고는 여러 표면에서 나는데,
 * 다른 표면은 **배포 한 번으로 되돌아간다**(조건 고치면 다음 요청부터 안 나오고, 캐시는 TTL 로 빠진다).
 * **sitemap 은 아니다** — 색인은 우리 배포와 무관하게 검색엔진 쪽에 남고, 회수는 재크롤링·삭제요청에
 * 달려 있어 **시간도 통제권도 우리에게 없다.** 그래서 이 가드는 **첫 운영자 몰 개설보다 먼저** 들어간다.
 *
 * 왜 기존 보호막이 안 먹히는가: 오늘 본진과 도매가 안 섞이는 이유는 `mall_id` 가 아니라
 * **`is_supply_product`** 인데(불변식 ①), 운영자 몰 상품은 `is_supply_product=0`(소비자 셀러 상품)이라
 * **그 필터를 그냥 통과한다.**
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 라이브 데이터·실제 색인 상태. 발행 SQL 만 본다.
 *   - sitemap **밖**의 노출 경로(홈 피드·검색·`/browse`·피드 cron 캐시). 그건 세션 ③ 범위이고,
 *     커버리지는 래칫(`FROM products` 새 파일 감지)이 따로 맡아야 한다 — 여기서 열거하지 않는다.
 *   - `mall_id` 컬럼이 있는데 값이 잘못 스탬프된 경우(등록 경로의 문제 → ③-b 가드).
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { mainScopeClause, mallScopeClause, MAIN_MALL_ID } from '@/worker/utils/consumer-scope'
import { sitemapRoutes } from '@/worker/routes/sitemap.routes'

/** 발행된 SQL 을 전부 캡처하는 fake D1. `hasMallIdColumn` 으로 PRAGMA 응답을 갈아끼운다. */
function makeDB(hasMallIdColumn: boolean) {
  const sqls: string[] = []
  const rows = (sql: string) =>
    /PRAGMA table_info/i.test(sql)
      ? (hasMallIdColumn ? [{ name: 'id' }, { name: 'mall_id' }] : [{ name: 'id' }])
      : []
  const DB = {
    prepare: (sql: string) => {
      sqls.push(sql)
      const res = { results: rows(sql) }
      return {
        bind: () => ({ all: () => Promise.resolve(res), first: () => Promise.resolve(null), run: () => Promise.resolve({ meta: {} }) }),
        all: () => Promise.resolve(res),
        first: () => Promise.resolve(null),
        run: () => Promise.resolve({ meta: {} }),
      }
    },
  } as unknown as D1Database
  return { DB, sqls }
}

async function emitSitemapSql(hasMallIdColumn: boolean): Promise<string[]> {
  const { DB, sqls } = makeDB(hasMallIdColumn)
  const app = new Hono()
  app.use('*', async (c, next) => { c.env = { DB } as never; await next() })
  app.route('/', sitemapRoutes)
  const res = await app.request('https://urdeal.kr/sitemap.xml')
  expect(res.status).toBe(200)
  return sqls
}

/** 상품/셀러 행을 실제로 뽑는 쿼리들(PRAGMA 제외). */
const rowQueries = (sqls: string[]) =>
  sqls.filter((s) => !/PRAGMA/i.test(s) && /\bFROM\s+(products|sellers)\b/i.test(s))

describe('sitemap 몰 격리 — 발행 SQL 행위 검증', () => {
  it('상품·셀러 쿼리 전부에 본진 몰 조건이 실린다', async () => {
    const sqls = await emitSitemapSql(true)
    const queries = rowQueries(sqls)

    // 🛡️ 빈 스캔 방지: 쿼리가 사라졌는데 "위반 0" 으로 통과하면 가드가 헛돈다.
    //   현재 sitemap 은 공구·일반상품·셀러 3종을 발행한다.
    expect(queries.length).toBeGreaterThanOrEqual(3)

    for (const q of queries) {
      expect(q, `몰 조건 누락:\n${q}`).toMatch(/COALESCE\((?:\w+\.)?mall_id,\s*1\)\s*=\s*1/)
    }
  })

  it('JOIN 쿼리는 별칭으로 한정한다 — 모호한 컬럼 참조로 SQL 이 깨지지 않게', async () => {
    const sqls = await emitSitemapSql(true)
    const joined = rowQueries(sqls).filter((q) => /JOIN/i.test(q))
    expect(joined.length).toBeGreaterThanOrEqual(1) // 셀러 쿼리(sellers ⨝ users)
    for (const q of joined) expect(q).toMatch(/COALESCE\(\w+\.mall_id/)
  })

  it('mall_id 컬럼이 없는 환경에선 조건을 빼고도 SQL 이 정상 발행된다', async () => {
    // 컬럼이 없으면 **몰을 스탬프할 수단 자체가 없으므로** 운영자 몰 행이 존재할 수 없다.
    //   ⇒ 조건 생략은 "조용한 우회"가 아니라 구조적으로 안전한 폴백이다.
    const sqls = await emitSitemapSql(false)
    const queries = rowQueries(sqls)
    expect(queries.length).toBeGreaterThanOrEqual(3)
    for (const q of queries) expect(q).not.toMatch(/mall_id/)
  })
})

describe('스코프 조각 — 순수 함수', () => {
  it('본진 조건은 COALESCE 기반 — NULL 을 판별자로 쓰지 않는다', () => {
    // ❌ `mall_id IS NULL` 은 판별자가 될 수 없다: ALTER ... DEFAULT 1 이라 기존 행이 전부 1 로 채워졌다.
    const c = mainScopeClause(true)
    expect(c).toContain(`COALESCE(mall_id, ${MAIN_MALL_ID}) = ${MAIN_MALL_ID}`)
    expect(c).not.toMatch(/IS\s+NULL/i)
  })

  it('컬럼 부재면 빈 조각', () => {
    expect(mainScopeClause(false)).toBe('')
  })

  it('별칭을 주면 한정된 컬럼 참조', () => {
    expect(mainScopeClause(true, 's')).toContain('s.mall_id')
    expect(mallScopeClause(7, 'p')).toContain('p.mall_id')
  })

  it('몰 조회는 지정 몰만 — 신규 운영자 몰(id ≥ 3)', () => {
    expect(mallScopeClause(3)).toContain('= 3')
    expect(mallScopeClause(3)).not.toContain('= 1)')
  })

  it('잘못된 몰 id 는 fail-closed — 전체 카탈로그 노출로 무너지지 않는다', () => {
    // 가장 나쁜 실패는 "조건이 사라져 유어딜 본진 카탈로그가 남의 몰에 통째로 뜨는 것"이다.
    for (const bad of [NaN, 0, -1, Infinity]) {
      expect(mallScopeClause(bad as number)).toBe(' AND 0 = 1')
    }
  })
})
