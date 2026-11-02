/**
 * 🏷️📝 2026-11-02 (대표 — *"더 개선할 건 없어?"*) — 라이브 실측으로 찾은 검색 구멍 둘.
 *
 * ① **분류 버튼 이름으로 검색하면 0건** — 화면의 분류가 `식사 · 미용 · 숙소 · 생활` 인데
 *    `숙소` 0건 · `맛집` 0건(숙소 이용권 20 · 식사 72 가 있는데). 카테고리 칸엔 영문 키가 들어 있다.
 * ② **검색 기록이 한 줄도 안 쌓였다** — `logSearch` 가 `search_query`·`results_count` 로 썼는데
 *    라이브 테이블은 `query`·`result_count`(pragma 실측). 매번 실패 → catch 가 삼킴 → **0행**.
 *    그래서 "무엇을 찾다 0건이 났는가" 를 한 번도 볼 수 없었다.
 *
 * 둘 다 **진짜 SQLite** 로 잰다 — ②는 레포가 가진 CREATE TABLE 두 벌(aux-tables · repair-schema)을
 * 소스에서 떼어 실제로 만들고, `logSearch` 의 INSERT 를 소스에서 떼어 실제로 넣는다.
 * ⚠️ 못 보는 것: 라이브 테이블이 정말 이 모양인지(그건 pragma 로 본다 — 2026-11-02 확인).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSearchClause, categoryVariants } from '@/features/products/repositories/search-query'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')

describe('① 분류 이름으로 검색한다', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, restaurant_name TEXT,
    restaurant_address TEXT, description TEXT, category TEXT, is_active INTEGER DEFAULT 1)`)
  const ins = db.prepare('INSERT INTO products (id,name,restaurant_name,restaurant_address,category) VALUES (?,?,?,?,?)')
  ins.run(1, '오션뷰 1박', '바다스테이', '부산 해운대구 1', 'stay_voucher')
  ins.run(2, '김치찌개 2인', '할매집', '서울 마포구 2', 'meal_voucher')
  ins.run(3, '여성 커트', '블루헤어', '서울 강남구 3', 'beauty_voucher')
  ins.run(4, '젤네일 기본', '네일룸', '서울 강남구 4', 'beauty_voucher')
  ins.run(5, '에어컨 청소', '클린홈', '경기 수원시 5', 'home_voucher')
  const search = (q: string) => {
    const { where, whereParams } = buildSearchClause(q, () => [], 'p')
    return (db.prepare(`SELECT p.id FROM products p WHERE ${where} ORDER BY p.id`).all(...whereParams) as Array<{ id: number }>).map(r => r.id)
  }

  it('`숙소`·`호텔` → 숙소 이용권', () => {
    expect(search('숙소')).toEqual([1])
    expect(search('호텔')).toEqual([1])
  })
  it('`맛집`·`식사`·`식당` → 식사 이용권', () => {
    expect(search('맛집')).toEqual([2])
    expect(search('식사')).toEqual([2])
    expect(search('식당')).toEqual([2])
  })
  it('`미용` → 미용 전부, `생활` → 생활 서비스', () => {
    expect(search('미용')).toEqual([3, 4])
    expect(search('생활')).toEqual([5])
  })
  it('업종 *안쪽* 낱말은 넓히지 않는다 — `헤어` 에 네일숍이 섞이면 안 된다', () => {
    expect(categoryVariants('헤어')).toEqual([])
    expect(search('헤어')).toEqual([3])
  })
  it('`기타` 는 넓히지 않는다 (뜻이 없어 전부를 끌고 온다)', () => {
    expect(categoryVariants('기타')).toEqual([])
  })
  it('지역 + 업종으로 좁힌다 — `부산 숙소`', () => {
    expect(search('부산 숙소')).toEqual([1])
    expect(search('서울 숙소')).toEqual([])
  })
})

describe('② 검색 기록이 실제로 들어간다', () => {
  const REPO = read('features/products/repositories/ProductRepository.ts')
  // VALUES 안에 `datetime('now')` 의 괄호가 있어 `[^)]*` 로는 잘린다 — 줄 끝까지 잡는다.
  const insert = REPO.match(/INSERT INTO search_logs \([^)]*\)\s*VALUES \(.*\)\s*$/m)?.[0]
  const ddl = (file: string) =>
    read(file).match(/CREATE TABLE IF NOT EXISTS search_logs \([\s\S]*?\n\s*\)/)?.[0]

  it('소스에서 INSERT 와 CREATE TABLE 두 벌을 실제로 찾았다 (못 찾으면 통과가 아니라 고장)', () => {
    expect(insert).toBeTruthy()
    expect(ddl('worker/routes/repair-schema/aux-tables.ts')).toBeTruthy()
    expect(ddl('worker/routes/repair-schema.routes.ts')).toBeTruthy()
  })

  for (const file of ['worker/routes/repair-schema/aux-tables.ts', 'worker/routes/repair-schema.routes.ts']) {
    it(`logSearch 의 INSERT 가 ${file.split('/').pop()} 의 테이블에 실제로 들어간다`, () => {
      const db = new DatabaseSync(':memory:')
      db.exec(ddl(file)!)
      db.prepare(insert!).run(null, '부산', 7)
      expect(db.prepare('SELECT query, result_count FROM search_logs').all()).toEqual([{ query: '부산', result_count: 7 }])
    })
  }

  it('인기 검색어 집계도 같은 컬럼을 읽는다', () => {
    const at = REPO.indexOf('async getPopularSearches(')
    const body = REPO.slice(at, REPO.indexOf('return result.results', at))
    expect(body).toContain('GROUP BY query')
    expect(body).not.toContain('search_query')
  })
})
