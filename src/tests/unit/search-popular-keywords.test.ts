/**
 * 🔎 검색 화면의 "인기 검색어" — **누르면 결과가 나오는 것만 보여준다.**
 *
 * 2026-09-04 이전: 검색 결과 화면이 *"함께 검색된 키워드"* 라는 이름으로 **하드코딩 6개**
 * (`인기상품 · 신상품 · 할인특가 · 무료배송 · 베스트셀러 · 한정판`)를 띄웠다.
 *   · 검색어와 **아무 상관이 없었고**(연관검색어가 아니다 — 이름부터 거짓)
 *   · 누르면 **0건**이 나왔으며
 *   · `무료배송` 은 이용권 서비스에 **개념 자체가 없다**(`SortFilterBar` 가 같은 이유로 칩을 걷어냈다).
 *
 * 진짜 인기 검색어 API(`/api/search/popular`, `popular_searches` 테이블)는 **이미 있었고**
 * 빈 검색 화면에서만 쓰이고 있었다. 두 화면이 같은 값을 보게 훅으로 묶었다.
 *
 * ⚠️ 못 막는 것: 서버가 실제로 무엇을 돌려주는지는 안 본다(소스 불변식만).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 주석 제거 — **설명이 위반으로 잡히면 안 된다.** 이 파일 자체가 그 함정을 밟았다:
 * 왜 그 여섯이 문제였는지 주석에 적었더니 "하드코딩이 되살아났다" 고 빨간불이 났다.
 * (반대 방향의 같은 사고 — 주석에만 있는 이름을 배선으로 읽는 것 — 도 이 레포가 겪은 적 있다.)
 */
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const PAGE = codeOnly(readFileSync('src/pages/SearchPage.tsx', 'utf8'))
const STATES = codeOnly(readFileSync('src/components/search/SearchStates.tsx', 'utf8'))
const HOOK = codeOnly(readFileSync('src/hooks/queries/usePopularSearches.ts', 'utf8'))
const BAR = readFileSync('src/components/search/SortFilterBar.tsx', 'utf8')

describe('하드코딩 키워드는 돌아오지 않는다', () => {
  it('검색 결과 화면에 하드코딩 목록이 없다', () => {
    expect(PAGE, '하드코딩 상수가 되살아났다').not.toContain('DEFAULT_RELATED_KEYWORD_KEYS')
    for (const dead of ['인기상품', '할인특가', '무료배송', '베스트셀러', '한정판']) {
      expect(PAGE, `"${dead}" 가 다시 하드코딩됐다 — 누르면 0건이다`).not.toContain(dead)
    }
  })

  it('두 화면이 같은 훅을 쓴다 (값이 두 벌이면 결국 갈린다)', () => {
    expect(PAGE, '검색 결과 화면이 공유 훅을 안 쓴다').toContain('usePopularSearches(')
    expect(STATES, '빈 검색 화면이 공유 훅을 안 쓴다').toContain('usePopularSearches(')
    expect(STATES, '빈 검색 화면이 아직 자체 fetch 를 한다').not.toContain("api.get('/api/search/popular')")
  })

  it('훅은 실패·빈 응답에 빈 배열을 준다 (없는 걸 지어내지 않는다)', () => {
    expect(HOOK, '폴백 목록이 생겼다 — 그건 다시 하드코딩이다').not.toMatch(/인기상품|베스트셀러|한정판/)
    expect(HOOK).toContain("queryKey: ['popularSearches']")
  })
})

describe('보여줄 게 없으면 섹션도 없다', () => {
  it('키워드가 0개면 제목까지 안 그린다', () => {
    expect(PAGE, '빈 제목만 남는다').toContain('{relatedKeywords.length > 0 && (')
  })

  it('지금 검색 중인 말은 제안하지 않는다', () => {
    expect(PAGE, '자기 자신을 제안한다').toMatch(/filter\(\(k\) => k !== query\)/)
  })

  it('라벨이 "함께 검색된" 이 아니다 — 연관검색어가 아니므로 그렇게 부르면 거짓이다', () => {
    expect(PAGE).not.toContain('함께 검색된 키워드')
    expect(PAGE).toContain("'인기 검색어'")
  })
})

describe('결과 개수는 기능 빨강이 아니다', () => {
  it('빨강은 오류·위험에 예약돼 있다 — 개수는 그냥 숫자다', () => {
    const line = BAR.split('\n').find((l) => l.includes('{totalResults}'))
    expect(line, '개수 렌더 줄을 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    expect(line!, '개수에 기능 빨강을 쓴다').not.toMatch(/text-red-\d/)
  })
})
