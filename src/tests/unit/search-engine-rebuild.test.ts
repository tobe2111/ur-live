/**
 * 🔎 2026-09-03 대표 신고 — *"검색 기능이 제대로 이상적이지 못해. 키워드 단어만 검색해도 되어야 하는데"*
 *   + *"검색에 이용권 UI 가 원래 쓰는 것대로 안 나오네. 5줄짜리 말이야"*
 *
 * 라이브 실측으로 밝힌 것(모두 D1/응답 직접 조회):
 *   · `products_fts` 토크나이저가 **porter unicode61** → `돈가스` 로 "치즈**돈가스**…" 를 못 찾음(0건)
 *   · FTS 인덱스에 **`restaurant_name` 이 없음** → 매장명 검색 불가
 *   · LIKE 폴백은 FTS 가 **예외를 던질 때만** 돌아 사실상 죽어 있었음(0건 성공은 폴백 안 함)
 *   · `/search` 결과가 쇼핑용 2열 카드 + **아무것도 안 거르는 칩 5개**
 *
 * ⚠️ 이 파일이 못 잡는 것: 실제 D1 실행 결과와 성능. SQL 문자열·배선 계약만 본다.
 *   (실측 판정은 배포 후 `/api/search?q=돈가스` 가 1건 이상인지로 한다.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSearchClause, tokenizeQuery, escapeLike, SEARCH_COLUMNS } from '@/features/products/repositories/search-query'

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
/** 설명 주석이 스스로를 만족시키지 않도록 — 판정은 코드 줄만 본다. */
const codeOnly = (src: string) => src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('① 매칭 — 단어 안쪽도, 두 글자도, 매장명도', () => {
  it('부분 매칭이다 — `돈가스` 가 "치즈돈가스"를 잡는다', () => {
    // 이게 이번 수정의 핵심. 접두사(`토큰%`)면 라이브와 똑같이 0건이 된다.
    // ⚠️ params 뒤쪽에는 **랭킹**용 값(`돈가스%` = 이름이 그 말로 시작 → 가점)이 따로 붙는다.
    //   그래서 "접두사가 아예 없다" 로 재면 안 되고, **매칭 조건이 쓰는 앞부분**만 봐야 한다.
    const { where, params } = buildSearchClause('돈가스')
    const matchParams = params.slice(0, SEARCH_COLUMNS.length)
    expect(matchParams).toHaveLength(SEARCH_COLUMNS.length)
    expect(matchParams.every(p => p === '%돈가스%')).toBe(true)
    expect(where).toContain('name LIKE ?')
  })

  it('두 글자 검색어도 그대로 동작한다 (trigram 이면 여기서 죽는다)', () => {
    const { where, params } = buildSearchClause('커트')
    expect(where).not.toBe('')
    expect(params).toContain('%커트%')
  })

  it('매장명을 검색 대상에 포함한다 — 이용권은 매장이 본질', () => {
    expect(SEARCH_COLUMNS).toContain('restaurant_name')
    const { where } = buildSearchClause('홍대돈가스')
    expect(where).toMatch(/restaurant_name LIKE \?/)
  })

  it('여러 낱말은 AND 로 좁힌다 — "홍대 돈가스" 는 둘 다 있어야', () => {
    const { where } = buildSearchClause('홍대 돈가스')
    // 토큰 그룹이 둘, 그 사이가 AND
    expect(where.split(' AND ').length).toBe(2)
    expect(where).toContain('(')
  })

  it('한 토큰 안에서는 컬럼 OR — 어디에 걸리든 통과', () => {
    const { where } = buildSearchClause('커피')
    const group = where.split(' AND ')[0]
    for (const col of SEARCH_COLUMNS) expect(group).toContain(`${col} LIKE ?`)
  })

  it('동의어는 같은 토큰 그룹 안에서 OR 된다', () => {
    const { params } = buildSearchClause('커피', t => (t === '커피' ? ['카페'] : []))
    expect(params).toContain('%커피%')
    expect(params).toContain('%카페%')
  })

  it('빈 검색어는 조건을 만들지 않는다 (전체 조회로 새지 않게)', () => {
    expect(buildSearchClause('').where).toBe('')
    expect(buildSearchClause('   ').where).toBe('')
  })
})

describe('② 안전 — 와일드카드·과도한 입력', () => {
  it('LIKE 특수문자를 이스케이프한다', () => {
    expect(escapeLike('50%')).toBe('50\\%')
    expect(escapeLike('a_b')).toBe('a\\_b')
    expect(escapeLike('a\\b')).toBe('a\\\\b')
  })

  it('사용자가 넣은 %가 와일드카드로 새지 않는다', () => {
    const { params } = buildSearchClause('50%')
    expect(params).toContain('%50\\%%')
  })

  it('토큰 수·길이를 자른다 (거대 LIKE 방지)', () => {
    const many = tokenizeQuery('a b c d e f g h')
    expect(many.length).toBeLessThanOrEqual(5)
    expect(tokenizeQuery('x'.repeat(200))[0].length).toBeLessThanOrEqual(40)
  })
})

describe('③ 랭킹 — 이름이 먼저', () => {
  it('상품명 정확 > 시작 > 포함 > 매장명 > 카테고리 순으로 점수가 내려간다', () => {
    const { rank } = buildSearchClause('커트')
    const score = (n: number) => rank.indexOf(`THEN ${n}`)
    expect(score(1000)).toBeGreaterThan(-1)
    expect(score(1000)).toBeLessThan(score(800))
    expect(score(800)).toBeLessThan(score(600))
    expect(score(600)).toBeLessThan(score(500))
    expect(score(500)).toBeLessThan(score(300))
  })

  it('테이블 별칭을 붙여도 식이 깨지지 않는다', () => {
    const { where, rank } = buildSearchClause('커트', () => [], 'p')
    expect(where).toContain('p.name LIKE ?')
    expect(rank).toContain('p.restaurant_name LIKE ?')
  })
})

describe('④ 배선 — 리포지토리가 실제로 이 SSOT 를 쓴다', () => {
  const repo = codeOnly(read('features/products/repositories/ProductRepository.ts'))

  it('searchByText 가 buildSearchClause 로 조건을 만든다', () => {
    expect(repo).toMatch(/buildSearchClause\(query, expandSynonyms, 'p'\)/)
  })

  it('FTS MATCH 를 1급 경로에서 걷어냈다 (porter 토크나이저가 단어 안쪽을 못 잡는다)', () => {
    expect(repo).not.toMatch(/products_fts MATCH/)
  })

  it('랭킹으로 정렬한다 — 동점은 판매량·평점·최신 순', () => {
    expect(repo).toMatch(/ORDER BY _rank DESC/)
    expect(repo).toMatch(/sold_count.*DESC.*rating.*DESC/s)
  })

  it('도매 원본·고아 general 격리 조건을 그대로 승계한다 (서비스 분리)', () => {
    const at = repo.indexOf('buildSearchClause(query')
    const block = repo.slice(at, at + 1200)
    expect(block).toMatch(/is_supply_product/)
    expect(block).toMatch(/category, ''\) = 'general'/)
  })
})

describe('⑤ 검색 결과 UI — 이용권 행으로', () => {
  const page = codeOnly(read('pages/SearchPage.tsx'))

  it('쇼핑용 2열 카드를 쓰지 않는다', () => {
    expect(page).not.toMatch(/<ProductCard/)
    expect(page).not.toMatch(/grid-cols-2 sm:grid-cols-3/)
  })

  it('홈이 쓰는 것과 **같은 행 컴포넌트**를 쓴다 (두 표면이 갈리지 않게)', () => {
    expect(page).toMatch(/import RestaurantRow from '@\/pages\/restaurant-map\/RestaurantRow'/)
    expect(page).toMatch(/<RestaurantRow/)
  })

  it('행을 누르면 이용권 상세로 간다', () => {
    expect(page).toMatch(/onSelect=\{\(r\) => navigate\(`\/group-buy\/\$\{r\.id\}`\)\}/)
  })

  it('홈의 행 마크업은 옮기기만 했다 — 원본 파일이 그 행을 import 해 쓴다', () => {
    const list = codeOnly(read('pages/restaurant-map/RestaurantList.tsx'))
    expect(list).toMatch(/import RestaurantRow from '\.\/RestaurantRow'/)
    expect(list).not.toMatch(/const RestaurantRow = memo/)
  })

  it('아무것도 안 거르던 칩을 지웠다 (작동 안 하는 컨트롤 금지)', () => {
    const bar = codeOnly(read('components/search/SortFilterBar.tsx'))
    for (const dead of ['filterFreeShip', 'filterPrice30k', 'filterBrand', 'filterApplied']) {
      expect(bar).not.toContain(dead)
    }
    // 실제로 동작하는 정렬은 남아 있어야 한다.
    expect(bar).toMatch(/onSortChange/)
  })
})
