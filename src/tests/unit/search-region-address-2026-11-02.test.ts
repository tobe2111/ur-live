/**
 * 📍 2026-11-02 (대표 — *"부산 같이 지역을 검색 시에 이용권이 왜이렇게 안나오지? 검색 로직 지금 완벽한 거 맞아?"*)
 *
 * 검색은 상품명·매장명·설명·카테고리만 봤고 **매장 주소를 안 봤다.** 그래서 지역 검색은 상품명이나
 * 설명에 지명이 *우연히* 적힌 이용권만 잡았다. 라이브 실측(활성 이용권 182개):
 *
 *   검색어   주소에 그 지명이 있는 이용권   실제 검색에 걸린 이용권
 *   부산              7                          1
 *   해운대            3                          0
 *   서울             86                          2
 *   강남              8                          1
 *
 * 이 시험은 **진짜 SQLite** 에 `buildSearchClause` 가 만든 SQL 을 그대로 먹인다 — 문자열 검사로는
 * "주소 칸이 있다" 는 볼 수 있어도 "부산으로 쳤을 때 부산 매장이 나온다" 는 못 본다.
 *
 * ⚠️ 못 보는 것: 라이브 주소가 실제로 어떤 꼴로 저장돼 있는지(그건 라이브 실측으로 본다) ·
 *   검색 화면이 서버 결과를 이용권만 남기도록 거르는 클라이언트 필터(SearchPage).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { buildSearchClause, regionVariants, SEARCH_COLUMNS } from '@/features/products/repositories/search-query'

type Sqlite = import('node:sqlite').DatabaseSync
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const ROWS: Array<[number, string, string, string, string]> = [
  [1, '월남쌈 + 샤브 2인 세트', '샤브향', '부산 해운대구 우동 123', 'meal_voucher'],
  [2, '돼지국밥 2인', '할매국밥', '부산광역시 부산진구 서면로 10', 'meal_voucher'],
  [3, '남성 커트', '블루클럽', '서울 강남구 테헤란로 1', 'beauty_voucher'],
  [4, '한우 오마카세', '소고기집', '경북 경주시 첨성로 5', 'meal_voucher'],
  [5, '흑돼지 모둠구이', '돈사돈', '제주특별자치도 제주시 1', 'meal_voucher'],
]

function freshDb(): Sqlite {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT, restaurant_name TEXT, restaurant_address TEXT,
    description TEXT, category TEXT, is_active INTEGER DEFAULT 1, sold_count INTEGER DEFAULT 0)`)
  const ins = db.prepare('INSERT INTO products (id,name,restaurant_name,restaurant_address,category) VALUES (?,?,?,?,?)')
  for (const r of ROWS) ins.run(...r)
  return db
}

/** 호출부(`ProductRepository.searchByText`)와 같은 모양 — 랭킹 식이 SELECT, 조건이 WHERE. */
function search(db: Sqlite, q: string): number[] {
  const { where, rank, whereParams, rankParams } = buildSearchClause(q, () => [], 'p')
  if (!where) return []
  const sql = `SELECT p.id, (${rank}) AS _rank FROM products p WHERE ${where} AND p.is_active = 1
    ORDER BY _rank DESC, p.id ASC`
  return (db.prepare(sql).all(...rankParams, ...whereParams) as Array<{ id: number }>).map(r => r.id)
}

describe('① 주소가 검색 대상이다', () => {
  it('SEARCH_COLUMNS 에 restaurant_address 가 있다', () => {
    expect(SEARCH_COLUMNS).toContain('restaurant_address')
  })

  const db = freshDb()
  it('`부산` 으로 치면 주소가 부산인 매장이 전부 나온다 (짧은 표기·긴 표기 둘 다)', () => {
    expect(search(db, '부산').sort()).toEqual([1, 2])
  })
  it('구 이름(`해운대`)으로도 나온다', () => {
    expect(search(db, '해운대')).toEqual([1])
  })
  it('지역 + 메뉴로 좁힌다 — `부산 국밥` 은 부산의 국밥만', () => {
    expect(search(db, '부산 국밥')).toEqual([2])
  })
  it('🩸 `대구` 가 `부산 해운대구 …` 를 잡지 않는다 — 시·도는 주소 맨 앞에서만 맞춘다', () => {
    // 첫 판(어디든 부분매칭)이 실제로 여기서 [1] 을 냈다.
    expect(search(db, '대구')).toEqual([])
  })
  it('`대구` 로 치면 대구 주소는 나온다 (위 대조군이 "아무것도 안 잡는" 고장이 아님을 확인)', () => {
    const d = freshDb()
    d.prepare('INSERT INTO products (id,name,restaurant_name,restaurant_address,category) VALUES (?,?,?,?,?)')
      .run(7, '막창 2인', '막창집', '대구 중구 동성로 3', 'meal_voucher')
    expect(search(d, '대구')).toEqual([7])
  })
})

describe('② 시·도 표기 차이', () => {
  const db = freshDb()
  it('`부산시` · `부산광역시` 로 쳐도 `부산 …` 주소가 나온다', () => {
    expect(search(db, '부산시').sort()).toEqual([1, 2])
    expect(search(db, '부산광역시').sort()).toEqual([1, 2])
  })
  it('`경상북도` 로 치면 `경북 …` 주소가, `경북` 으로 치면 그대로 나온다', () => {
    expect(search(db, '경상북도')).toEqual([4])
    expect(search(db, '경북')).toEqual([4])
  })
  it('`제주도` 로 치면 `제주특별자치도 …` 가 나온다', () => {
    expect(search(db, '제주도')).toEqual([5])
  })
  it('짧은 표기 하나로 충분하면 LIKE 를 늘리지 않는다', () => {
    expect(regionVariants('부산')).toEqual([])
    expect(regionVariants('부산광역시')).toEqual(['부산'])
    expect(regionVariants('경상북도')).toEqual(['경북'])
    expect(regionVariants('돈가스')).toEqual([])
  })
})

describe('③ 랭킹 — 주소로 걸린 이용권이 설명에만 지명이 있는 것보다 앞선다', () => {
  it('주소 일치(400) > 설명만(100)', () => {
    const db = freshDb()
    db.prepare('INSERT INTO products (id,name,restaurant_name,restaurant_address,description,category) VALUES (?,?,?,?,?,?)')
      .run(9, '전국 교환권', '본사', null, '부산에서도 사용 가능', 'gift')
    const ids = search(db, '부산')
    expect(ids.indexOf(9)).toBeGreaterThan(ids.indexOf(1))
    expect(ids.indexOf(9)).toBeGreaterThan(ids.indexOf(2))
  })
})
