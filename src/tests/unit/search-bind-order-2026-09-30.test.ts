/**
 * 🔎 2026-09-30 — 검색이 **에러 없이 조용히 틀린 결과**를 주던 것 (대표 *"검색기능도 지금 완벽한지 확인해줘"*)
 *
 * ## 무엇이 틀렸나
 *
 * `buildSearchClause` 는 바인드 값을 `params = [...where, ...rank]` **한 배열**로 돌려줬고,
 * 호출부(`ProductRepository.searchByText`)는 랭킹 식을 **SELECT 에** 놓는다:
 *
 * ```sql
 * SELECT …, (CASE WHEN name = ? … END) AS _rank   ← rank 의 ? 가 먼저 나온다
 * FROM products p WHERE (name LIKE ? OR …) AND …  ← where 의 ? 는 그다음
 * ```
 *
 * SQLite 는 **SQL 텍스트 등장 순서**로 바인딩하므로 두 묶음이 통째로 5칸 어긋났다.
 * 개수가 맞아 예외가 안 나고, 어긋난 값도 전부 `%…%` LIKE 패턴이라 **아무 신호가 없었다.**
 *
 * 라이브 실측(2026-09-30, `urdeal.kr`):
 *
 * | 검색어 | 결과 | 왜 이상한가 |
 * |---|---|---|
 * | `홍대` | 21건 | 정상 |
 * | `홍대 홍대` | **0건** | 같은 말을 두 번 썼을 뿐인데 사라진다 |
 * | `홍대 돈가스 버크셔 프리미엄` | 1건 | 정상 |
 * | `홍대 돈가스 버크셔 프리미엄 세트` | **0건** | 그 1건의 **상품명에 다섯 낱말이 전부 있다** |
 * | `스타벅스 카드` | — | 2위가 "다함께 즐거운 파티 세트"(둘 다 없는 상품) |
 *
 * 마지막 줄이 이 결함의 얼굴이다 — **검색창이 제안한 상품명을 그대로 눌렀는데 0건.**
 *
 * ## 왜 기존 가드가 못 잡았나
 *
 * `search-engine-rebuild.test.ts` 는 **SQL 문자열과 배열 내용**만 본다(그 파일 머리말이 그렇게
 * 적어 뒀다). 이 결함은 문자열도 배열도 전부 맞고 **순서만** 틀렸다 ⇒ 실행해야만 보인다.
 * 그래서 이 파일은 `node:sqlite` 로 **진짜 SQL 을 돌린다.**
 *
 * ⚠️ 이 파일이 **못** 보는 것: D1 고유 동작(바인드 한도·컬럼 한도), 성능, 동의어 사전의 내용,
 *   그리고 `productDetailColsHealed` 가 만드는 실제 컬럼 목록(여기선 최소 컬럼만 만든다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import type { DatabaseSync as Sqlite } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSearchClause, SEARCH_COLUMNS } from '@/features/products/repositories/search-query'
import { stripComments } from '../helpers/source-text'

// 기본 환경이 jsdom 이라 `node:sqlite` 를 정적 import 하면 번들러가 막는다(기존 SQLite 시험과 같은 방식).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const REPO = stripComments(
  readFileSync(resolve(__dirname, '../../features/products/repositories/ProductRepository.ts'), 'utf-8'),
)

/** 라이브에서 실제로 0건이 나왔던 그 상품(id 2915) + 대조군 몇 개. */
const ROWS = [
  [2915, '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트', '홍대돈까스', null, 'meal_voucher'],
  [1001, '드들돈가스 정식 2인', '드들돈가스', null, 'meal_voucher'],
  [1002, '치즈돈가스 2인 세트', '한밭돈까스', '바삭한 등심', 'meal_voucher'],
  [1003, '남성 커트 + 다운펌', '블루클럽', null, 'beauty_voucher'],
  [1004, '다함께 즐거운 파티 세트', '파티하우스', null, 'meal_voucher'],
]

function freshDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT, restaurant_name TEXT, description TEXT, category TEXT,
    is_active INTEGER DEFAULT 1, sold_count INTEGER DEFAULT 0, rating REAL DEFAULT 0)`)
  const ins = db.prepare('INSERT INTO products (id,name,restaurant_name,description,category) VALUES (?,?,?,?,?)')
  for (const r of ROWS) ins.run(...(r as [number, string, string, string | null, string]))
  return db
}

/**
 * 🔴 **호출부(`searchByText`)와 같은 모양**의 SQL — 랭킹 식이 SELECT 에, 조건이 WHERE 에.
 *   그 모양이 맞는지는 아래 "③ 배선" 이 리포지토리 소스로 따로 확인한다(여기서 지어내지 않는다).
 */
function runSearch(db: Sqlite, q: string, order: 'rank-first' | 'where-first' = 'rank-first') {
  const { where, rank, whereParams, rankParams } = buildSearchClause(q, () => [], 'p')
  if (!where) return []
  const sql = `SELECT p.id, p.name, (${rank}) AS _rank FROM products p
    WHERE ${where} AND p.is_active = 1
    ORDER BY _rank DESC, COALESCE(p.sold_count,0) DESC, p.id DESC LIMIT ? OFFSET ?`
  const bound = order === 'rank-first' ? [...rankParams, ...whereParams] : [...whereParams, ...rankParams]
  return db.prepare(sql).all(...bound, 20, 0) as Array<{ id: number; name: string; _rank: number }>
}

describe('① 실행 — 라이브에서 0건이 나왔던 검색어들', () => {
  const db = freshDb()

  it('🩸 제안으로 띄운 상품명을 그대로 검색하면 그 상품이 나온다', () => {
    // 이 한 줄이 이번 결함의 얼굴이다. 검색창이 권한 말을 눌렀는데 0건이면 안 된다.
    const rows = runSearch(db, '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트')
    expect(rows.map(r => r.id)).toContain(2915)
  })

  it('🩸 같은 말을 두 번 써도 사라지지 않는다 (`홍대` → `홍대 홍대`)', () => {
    const one = runSearch(db, '홍대')
    const twice = runSearch(db, '홍대 홍대')
    expect(one.length).toBeGreaterThan(0)
    expect(twice.map(r => r.id)).toEqual(one.map(r => r.id))
  })

  it('🩸 다섯 낱말이 전부 이름에 있으면 찾는다', () => {
    expect(runSearch(db, '홍대 돈가스 버크셔 프리미엄 세트').map(r => r.id)).toEqual([2915])
  })

  it('상품이 자기 이름·매장명으로 자신을 찾는다 (전 행 전수)', () => {
    expect(ROWS.length).toBeGreaterThan(3) // 표본이 비면 통과가 아니라 고장이다
    for (const [id, name, store] of ROWS as Array<[number, string, string, unknown, unknown]>) {
      expect(runSearch(db, name).map(r => r.id), `이름: ${name}`).toContain(id)
      expect(runSearch(db, store).map(r => r.id), `매장명: ${store}`).toContain(id)
    }
  })

  it('단어 *안쪽*도 잡는다 — `돈가스` 가 "치즈돈가스"를', () => {
    expect(runSearch(db, '돈가스').map(r => r.id)).toContain(1002)
  })

  it('AND 로 좁힌다 — 둘 다 없는 상품은 안 나온다', () => {
    expect(runSearch(db, '홍대 커트').map(r => r.id)).toEqual([])
    expect(runSearch(db, '스타벅스 카드').map(r => r.id)).not.toContain(1004)
  })
})

describe('② 랭킹 — 값이 제자리에 들어갔을 때만 맞는다', () => {
  const db = freshDb()

  it('이름이 정확히 일치하면 1000점', () => {
    const [top] = runSearch(db, '다함께 즐거운 파티 세트')
    expect(top?.id).toBe(1004)
    expect(top?._rank).toBe(1000)
  })

  it('이름으로 시작하면 800점 — 매장명만 걸린 것(500)보다 위', () => {
    const rows = runSearch(db, '드들돈가스')
    expect(rows[0]?.id).toBe(1001)
    expect(rows[0]?._rank).toBe(800)
  })

  it('🔁 되돌려-검증: 순서를 다시 뒤바꾸면 이 시험들이 **빨간불**이 된다', () => {
    // 가드가 실패할 수 있음을 스스로 증명한다 — 못 하면 이 파일 전체가 헛돈다.
    const broken = runSearch(db, '홍대 돈가스 버크셔 프리미엄 세트', 'where-first')
    expect(broken.map(r => r.id)).toEqual([]) // 종전 라이브 동작(0건)을 그대로 재현
    const brokenTwice = runSearch(db, '홍대 홍대', 'where-first')
    expect(brokenTwice.map(r => r.id)).not.toEqual(runSearch(db, '홍대').map(r => r.id))
  })
})

describe('③ 배선 — 리포지토리가 SQL 등장 순서대로 넘긴다', () => {
  it('랭킹 식은 SELECT 에, 조건은 WHERE 에 있다 (이 파일의 SQL 모양 근거)', () => {
    expect(REPO).toMatch(/SELECT \$\{productDetailColsHealed\('p'\)\}, \(\$\{rank\}\) AS _rank/)
    expect(REPO).toMatch(/WHERE \$\{where\}/)
  })

  it('🔴 rank 값을 **먼저**, where 값을 나중에 바인딩한다', () => {
    expect(REPO).toMatch(/params\.push\(\.\.\.rankParams,\s*\.\.\.whereParams\)/)
    expect(REPO).not.toMatch(/params\.push\(\.\.\.whereParams,\s*\.\.\.rankParams\)/)
  })

  it('합쳐진 `params` 를 다시 만들지 않는다 — 순서를 아는 사람이 없어진다', () => {
    const src = readFileSync(resolve(__dirname, '../../features/products/repositories/search-query.ts'), 'utf-8')
    expect(src).toMatch(/whereParams: string\[\]/)
    expect(src).toMatch(/rankParams: string\[\]/)
    expect(stripComments(src)).not.toMatch(/^\s*params: string\[\]/m)
  })

  it('랭킹 식의 `?` 개수와 `rankParams` 길이가 같다', () => {
    const { rank, rankParams } = buildSearchClause('아무거나', () => [], 'p')
    expect((rank.match(/\?/g) || []).length).toBe(rankParams.length)
  })

  it('조건식의 `?` 개수와 `whereParams` 길이가 같다 (동의어 포함)', () => {
    const { where, whereParams } = buildSearchClause('커피 세트', t => (t === '커피' ? ['카페', 'coffee'] : []))
    expect((where.match(/\?/g) || []).length).toBe(whereParams.length)
    expect(whereParams.length).toBe((3 + 1) * SEARCH_COLUMNS.length)
  })
})
