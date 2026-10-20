/**
 * 🔎 **등록된 동네딜을 이름으로 찾을 수 있어야 한다** (2026-09-16 대표 "매장명이라던지. 급해").
 *
 * `/admin/dongnedeal-import` 의 목록에는 지역·카테고리·형태·데모여부·상태·정렬 필터가 있었는데
 * **검색이 없었다.** 라이브에 동네딜이 수백 건이라, 이름을 아는 한 곳을 찾으려면 필터를 좁혀 놓고
 * 눈으로 훑는 수밖에 없었다.
 *
 * 여기서 고정하는 것은 **문자열이 아니라 나온 SQL 과 바인딩**이다 — `dongnedealTextFilters` 를
 * 실제로 불러서 잰다.
 *
 * ⚠️ 이 테스트가 **못 하는 것**: D1 이 그 SQL 로 실제로 무엇을 돌려주는지, 화면 렌더·디바운스.
 *   라이브 판정은 어드민 화면에서 한 번 쳐 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as strip } from '../helpers/source-text'
import { dongnedealTextFilters } from '@/features/admin/api/dongnedeal-search'

const ROUTE = strip(readFileSync('src/features/admin/api/admin-products.routes.ts', 'utf8'))
const LIST_UI = strip(readFileSync('src/pages/admin-dongnedeal/DealList.tsx', 'utf8'))

/** 조각 수와 바인딩 수가 맞는지 — 어긋나면 D1 이 'wrong number of bindings' 로 죽는다. */
function bindCount(sql: string[]): number {
  return sql.join(' AND ').split('?').length - 1
}

describe('① 검색이 실제로 조건을 만든다', () => {
  it('매장명 한 낱말 — 매장명·상품명·주소를 한꺼번에 본다', () => {
    const f = dongnedealTextFilters({ q: '홍대돈까스' })
    expect(f.sql).toHaveLength(1)
    expect(f.sql[0]).toContain('restaurant_name')
    expect(f.sql[0]).toContain('name')
    expect(f.sql[0]).toContain('restaurant_address')
    expect(f.params).toEqual(['%홍대돈까스%', '%홍대돈까스%', '%홍대돈까스%'])
  })

  it('🔒 조각의 물음표 수와 바인딩 수가 정확히 맞는다', () => {
    for (const q of ['돈까스', '강남 파스타', '서울 강남 파스타', '2888', '  ']) {
      const f = dongnedealTextFilters({ q, region: '서울 강남' })
      expect(bindCount(f.sql), `q=${JSON.stringify(q)}`).toBe(f.params.length)
    }
  })

  it('공백은 AND — "강남 파스타" 는 둘 다 든 것만 (OR 면 흔한 낱말에 목록 전체가 걸린다)', () => {
    const f = dongnedealTextFilters({ q: '강남 파스타' })
    expect(f.sql[0]).toContain(') AND (')
    expect(f.params).toEqual(['%강남%', '%강남%', '%강남%', '%파스타%', '%파스타%', '%파스타%'])
  })

  it('토큰은 3개까지 — 더 넣어도 LIKE 만 늘고 느려진다', () => {
    const f = dongnedealTextFilters({ q: 'a b c d e' })
    expect(f.params).toHaveLength(3 * 3)
  })

  it('숫자만 넣으면 상품 id 도 함께 본다 (어드민이 로그·URL 에서 집어오는 값)', () => {
    const f = dongnedealTextFilters({ q: '2888' })
    expect(f.sql[0]).toContain('OR id = ?')
    expect(f.params[f.params.length - 1]).toBe(2888)
    // 숫자여도 이름 검색을 포기하지 않는다 — '2888' 이 상품명에 든 것도 나와야 한다.
    expect(f.params).toContain('%2888%')
  })

  it('글자가 아닌 id 검색으로 오해하지 않는다 — "2888번" 은 텍스트', () => {
    const f = dongnedealTextFilters({ q: '2888번' })
    expect(f.sql[0]).not.toContain('OR id = ?')
    expect(f.params.every((p) => typeof p === 'string')).toBe(true)
  })

  it('빈 검색어는 조건을 안 만든다 — 기본 목록이 종전과 같아야 한다', () => {
    for (const q of ['', '   ', undefined, null]) {
      const f = dongnedealTextFilters({ q })
      expect(f.sql).toEqual([])
      expect(f.params).toEqual([])
    }
  })
})

describe('② 지역 필터는 종전과 같다 (검색을 붙이며 같이 옮겼다)', () => {
  it('주소에만 걸고, 공백은 AND, 3토큰까지', () => {
    const f = dongnedealTextFilters({ region: '서울 강남' })
    expect(f.sql).toEqual(['restaurant_address LIKE ?', 'restaurant_address LIKE ?'])
    expect(f.params).toEqual(['%서울%', '%강남%'])
    expect(dongnedealTextFilters({ region: 'a b c d' }).params).toHaveLength(3)
  })

  it('🔒 지역이 먼저, 검색이 나중 — 조각과 값의 순서가 짝이어야 한다', () => {
    const f = dongnedealTextFilters({ region: '서울', q: '돈까스' })
    expect(f.sql[0]).toBe('restaurant_address LIKE ?')
    expect(f.params[0]).toBe('%서울%')
    expect(f.sql[1]).toContain('restaurant_name')
    expect(f.params.slice(1)).toEqual(['%돈까스%', '%돈까스%', '%돈까스%'])
  })
})

describe('③ 배선 — 만든 조건이 실제 쿼리까지 간다', () => {
  it('라우트가 q 를 읽어 빌더에 넘기고, 나온 조각·값을 둘 다 쓴다', () => {
    expect(ROUTE).toMatch(/dongnedealTextFilters\(\{ region: c\.req\.query\('region'\), q: c\.req\.query\('q'\) \}\)/)
    expect(ROUTE).toContain('where.push(...textFilters.sql)')
    expect(ROUTE).toContain('params.push(...textFilters.params)')
  })

  it('🔒 화면이 검색어를 서버로 보낸다 (안 보내면 칸만 있고 아무 일도 안 난다)', () => {
    expect(LIST_UI).toMatch(/if \(fQuery\) qs\.set\('q', fQuery\)/)
  })

  it('🔒 검색어가 바뀌면 처음부터 다시 읽는다 — 안 하면 옛 목록 위에 덧붙는다', () => {
    // 🩸 처음엔 앵커에서 200자를 잘라 훑었는데, 그 창이 **다음 줄까지 넘쳐** 아래의
    //   `anyFilter`·`resetFilters` 에 있는 fQuery 에 걸렸다 — 의존성에서 빼도 초록이었다
    //   (주입 검증이 잡았다). ⇒ **의존성 배열 자체**를 본다.
    const deps = LIST_UI.match(/setSelected\(new Set\(\)\); load\(false\) \}, \[([^\]]*)\]/)
    expect(deps, '재조회 effect 의 의존성 배열을 못 찾았다 — 이 검사가 헛돌고 있다').toBeTruthy()
    expect(deps![1]).toContain('fQuery')
  })

  it('타이핑마다 요청하지 않는다 (디바운스) — 느린 응답이 지운 검색어의 결과를 남긴다', () => {
    expect(LIST_UI).toMatch(/setTimeout\(\(\) => setFQuery\(qInput\.trim\(\)\)/)
    expect(LIST_UI).toContain('clearTimeout(t)')
  })

  it('Enter 는 디바운스를 건너뛴다 — 급할 때 0.3초도 길다', () => {
    expect(LIST_UI).toMatch(/if \(e\.key === 'Enter'\)[\s\S]{0,80}?setFQuery\(qInput\.trim\(\)\)/)
  })

  it('검색어도 "필터 초기화" 로 지워진다', () => {
    const reset = LIST_UI.slice(LIST_UI.indexOf('const resetFilters'), LIST_UI.indexOf('const toggleActive'))
    expect(reset).toContain("setQInput('')")
    expect(reset).toContain("setFQuery('')")
  })
})
