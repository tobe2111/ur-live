import { describe, it, expect } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { readFileSync } from 'node:fs'
import { resolveSectionProducts } from '@/features/sections/api/section-rules'

/**
 * 🖼️ 2026-09-06 대표 *"메인에서 보면 이용권의 똑같은 사진이 두번 나오는 경우가 있는데 확인해볼래?"*
 *
 * ## 무엇이었나 (라이브 실측)
 * 커버 사진이 중복된 상품은 **0건**이었다 — 데이터가 아니라 편성이 문제였다.
 * 홈 섹션은 각자 독립으로 채워졌고 **서로 겹치는지 아무도 안 봤다**:
 *
 * ```
 * [지금 인기 이용권]   2888, 2712, 2765, 2725
 * [주말에 떠나는 숙소]       2712, 2764, 2765, 2725   ← 4개 중 3개가 같다
 * ```
 *
 * 인기 상위가 대부분 숙소(활성 이용권 338 중 숙소 51, 그런데 인기 점수 상위를 숙소가 차지)라
 * 두 규칙이 거의 같은 목록을 냈다. 사용자에겐 **같은 사진이 위아래로 두 번**이다.
 *
 * ## 이 테스트가 실제로 돌리는 것
 * 문자열 검사로는 **바인드 위치 오류를 못 잡는다** — `NOT IN (?)` 을 넣으면서 바인드를 엉뚱한
 * 자리에 넣으면 SQL 은 통과하고 결과만 조용히 틀린다. 그래서 진짜 SQLite 에 상품을 넣고
 * `resolveSectionProducts` 를 **실행**해 결과 id 를 본다.
 *
 * ⚠️ **이 테스트가 못 막는 것**: 라우트가 `excludeIds` 를 실제로 넘기는지(그건 아래 배선 검사가
 *    소스로 고정한다) · 화면에서 진짜로 안 겹치는지(그건 라이브 확인).
 */
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  // 리졸버가 SELECT 하는 컬럼 + WHERE 가 보는 컬럼만.
  db.prepare(`CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT, price INTEGER, original_price INTEGER,
    image_url TEXT, category TEXT, discount_rate INTEGER, sold_count INTEGER,
    dominant_color TEXT, avg_rating REAL, review_count INTEGER, view_count INTEGER,
    deal_only INTEGER, restaurant_name TEXT, restaurant_address TEXT, slug TEXT,
    images TEXT, is_active INTEGER, group_buy_status TEXT, created_at TEXT,
    seller_id INTEGER, is_supply_product INTEGER, supply_source_id INTEGER, mall_id INTEGER
  )`).run()
  const ins = db.prepare(`INSERT INTO products
    (id,name,price,original_price,image_url,category,discount_rate,sold_count,dominant_color,
     avg_rating,review_count,view_count,deal_only,restaurant_name,restaurant_address,slug,images,
     is_active,group_buy_status,created_at,seller_id,is_supply_product,supply_source_id,mall_id)
    VALUES (?,?,1000,2000,'x',?,50,?,NULL,4.5,?,?,0,'가게','주소',?,NULL,1,'active','2026-09-01',1,0,NULL,1)`)
  // 숙소 6개(인기순 내림차순) + 식사 2개. 숙소가 인기 상위를 독점하는 라이브 상황의 축소판.
  for (let i = 1; i <= 6; i++) ins.run(...([i, `숙소${i}`, 'stay_voucher', 100 - i, 10, 10, `stay-${i}`] as never[]))
  for (let i = 7; i <= 8; i++) ins.run(...([i, `식사${i}`, 'meal_voucher', 10, 1, 1, `meal-${i}`] as never[]))
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

const env = () => ({ DB: makeD1() } as unknown as Parameters<typeof resolveSectionProducts>[0])

describe('홈 섹션 — 한 상품은 한 화면에 한 번', () => {
  it('배제 없이 두 규칙을 돌리면 실제로 겹친다 (고치기 전 상태를 이 테스트가 재현한다)', async () => {
    const e = env()
    const popular = await resolveSectionProducts(e, { source: 'popular', limit: 4 })
    const stays = await resolveSectionProducts(e, { source: 'category', sourceValue: 'stay_voucher', limit: 4 })
    const overlap = popular.map(p => p.id).filter(id => stays.some(s => s.id === id))
    expect(overlap.length, '픽스처가 겹침을 못 만들면 이 테스트는 아무것도 증명하지 않는다').toBeGreaterThan(0)
  })

  it('excludeIds 를 주면 그 상품은 빠진다', async () => {
    const e = env()
    const first = await resolveSectionProducts(e, { source: 'popular', limit: 4 })
    const firstIds = first.map(p => p.id as number)
    const second = await resolveSectionProducts(e, {
      source: 'category', sourceValue: 'stay_voucher', limit: 4, excludeIds: firstIds,
    })
    expect(second.map(p => p.id).filter(id => firstIds.includes(id as number))).toEqual([])
  })

  it('빠진 자리는 다음 후보가 메운다 — 줄이 짧아지지 않는다', async () => {
    const e = env()
    const first = await resolveSectionProducts(e, { source: 'popular', limit: 4 })
    const second = await resolveSectionProducts(e, {
      source: 'category', sourceValue: 'stay_voucher', limit: 4,
      excludeIds: first.map(p => p.id as number),
    })
    // 숙소 후보 6개 · 인기 4개(전부 숙소) → 남은 2개. limit 4 라도 있는 만큼 채우고 멈춘다.
    expect(second.length).toBe(2)
    expect(new Set(second.map(p => p.id)).size).toBe(second.length)
  })

  it('바인드 위치가 맞다 — 인기순(CROSS JOIN 분모)에서도 배제가 실제로 먹는다', async () => {
    // 🩸 이게 이 파일의 핵심이다. `NOT IN` 은 joinSql 뒤에 오므로 바인드를 앞에 끼우면
    //   cats 와 id 가 어긋나 **에러 없이 결과만 틀린다**. 문자열 검사로는 절대 못 잡는다.
    const e = env()
    const all = await resolveSectionProducts(e, { source: 'popular', limit: 6 })
    const drop = all.slice(0, 2).map(p => p.id as number)
    const rest = await resolveSectionProducts(e, { source: 'popular', limit: 6, excludeIds: drop })
    // 배제가 안 먹으면 `rest` 는 `all` 과 같아져 아래 둘이 빨간불이 된다.
    expect(rest.map(p => p.id)).not.toContain(drop[0])
    expect(rest.map(p => p.id)).not.toContain(drop[1])
    // 후보가 8개(숙소 6 + 식사 2)라 2개를 빼도 limit 6 은 그대로 채워진다 — 그게 정상이다.
    //   (처음 이 줄을 `all.length - 2` 로 썼다가 틀렸다. 배제는 자리를 비우는 게 아니라 **미룬다**.)
    expect(rest.length).toBe(6)
  })

  it('빈 excludeIds 는 아무것도 바꾸지 않는다 (기존 동작 불변)', async () => {
    const e = env()
    const a = await resolveSectionProducts(e, { source: 'popular', limit: 4 })
    const b = await resolveSectionProducts(e, { source: 'popular', limit: 4, excludeIds: [] })
    expect(b.map(p => p.id)).toEqual(a.map(p => p.id))
  })
})

describe('라우트 배선 — 리졸버만 고치면 화면은 안 바뀐다', () => {
  const RAW = readFileSync('src/features/sections/api/sections.routes.ts', 'utf-8')
  const SRC = RAW
  /**
   * 🩸 주석은 판정에서 뺀다. 처음 이 파일을 쓸 때 "딜 피드는 안 건드린다" 를 원문 검사로 짰는데
   *   **그 사실을 설명하는 내 주석**이 `/api/group-buy/products` 를 적고 있어서 빨간불이 떴다.
   *   이 레포가 이미 기록해 둔 함정인데 같은 날 두 번 밟았다.
   */
  const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('규칙 섹션에 excludeIds 를 실제로 넘긴다', () => {
    expect(SRC).toMatch(/excludeIds:\s*\[\.\.\.claimed\]/)
  })

  it('수동 큐레이션이 규칙보다 먼저 자기 몫을 확정한다 (사람의 결정이 질의에 안 밀린다)', () => {
    const manualClaim = SRC.indexOf("if (normalizeSectionSource(s.source) !== 'manual') continue")
    const ruleLoop = SRC.indexOf("if (normalizeSectionSource(s.source) === 'manual') continue")
    expect(manualClaim).toBeGreaterThan(-1)
    expect(ruleLoop).toBeGreaterThan(-1)
    expect(manualClaim, '수동 확정이 규칙 루프보다 뒤에 있다').toBeLessThan(ruleLoop)
  })

  it('규칙 섹션을 렌더 순서대로 돈다 — 위에서부터 자리를 가져간다', () => {
    // sectionList 는 `ORDER BY sort_order ASC` 로 왔다. 그 배열을 그대로 돌아야 한다.
    expect(SRC).toMatch(/for \(const s of sectionList\) \{\s*\n\s*if \(normalizeSectionSource\(s\.source\) === 'manual'\) continue/)
  })

  it('아래 딜 피드는 건드리지 않는다 — 전체 목록에서 상품을 빼면 목록이 거짓말이 된다', () => {
    expect(CODE).not.toMatch(/group-buy\/products/)
  })
})
