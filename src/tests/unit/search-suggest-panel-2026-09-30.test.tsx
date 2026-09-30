/**
 * 🔎 **검색 제안 — 덮지 않고 대신한다** 〔2026-09-30〕
 *
 * 대표: *"검색하는데 연관검색? 처럼 나오는거 별로야"* → 레퍼런스(전체폭 행 목록) → *"이런 식으로 나오는거 좋다"*
 *
 * ## 무엇이었나 — 둘이 겹쳤고 둘 다 에러를 안 낸다
 *  ① 떠 있는 카드가 **결과를 가렸다**(대표 스크린샷: 제안 하나가 첫 결과를 통째로 덮었다).
 *  ② 서버가 `products.name` **통짜**를 줘서 제안이 바로 아래 첫 결과와 **같은 문자열**이었다.
 *
 * ## 이 시험이 **못** 보는 것
 * 실제 제안 품질(무엇이 유용한가)은 못 잰다 — 라이브 데이터에 달렸다. 여기서 지키는 것은
 * *구조*다: 덮지 않는가 · 상품명만 내보내지 않는가 · 눌러서 0건이 안 나는가.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { render } from '@testing-library/react'
import SearchSuggestPanel from '@/components/search/SearchSuggestPanel'
import { stripComments } from '../helpers/source-text'

const header = stripComments(readFileSync('src/components/search/SearchHeader.tsx', 'utf8'))
const page = stripComments(readFileSync('src/pages/SearchPage.tsx', 'utf8'))
const routes = stripComments(readFileSync('src/features/products/api/products.routes.ts', 'utf8'))
const searchQuery = readFileSync('src/features/products/repositories/search-query.ts', 'utf8')
/** 무엇을 제안할지는 이 모듈이 정한다(2026-09-30 라우트에서 분리 — 파일 크기 래칫). */
const alias = stripComments(readFileSync('src/features/products/api/search-suggestions.ts', 'utf8'))

/** 실제로 부르는 핸들러는 `/suggestions` **별칭**이다(`/search/suggestions` 가 아니라 — 라우트 마운트 때문). */
const handler = routes.slice(routes.indexOf("productsRoutes.get('/suggestions'"), routes.indexOf("productsRoutes.get('/popular'"))

describe('① 제안이 결과를 덮지 않는다', () => {
  it('🔴 헤더에 떠 있는 드롭다운이 없다', () => {
    expect(alias.length, '제안 모듈을 못 찾으면 아래가 전부 헛돈다').toBeGreaterThan(200)
    // 🔌 배선 — 별칭 핸들러가 그 모듈을 실제로 부른다(안 부르면 위 검사가 통째로 헛돈다).
    expect(handler).toContain('buildSearchSuggestions(c.env.DB, q)')
    expect(routes).toContain("from './search-suggestions'")
    expect(header).not.toMatch(/absolute top-full/)
    expect(header).not.toMatch(/showSuggestions/)
  })

  it('🔴 페이지가 결과 **자리**에 패널을 넣는다 (삼항 — 둘이 동시에 뜨지 않는다)', () => {
    expect(page).toContain('<SearchSuggestPanel')
    expect(page).toContain('{showPanel ? (')
    // 제안이 0건이면 열지 않는다 — 빈 화면이 결과를 가리는 게 제일 나쁘다.
    expect(page).toContain('panel.open && suggestions.length > 0')
  })

  it('🔴 blur 로 닫지 않는다 — 모바일에서 탭이 먹지 않는 최다 버그', () => {
    // blur 가 click 보다 먼저 나서, 닫힌 뒤 click 이 오면 아무 일도 안 일어난다.
    expect(header).toMatch(/onBlur=\{\(\) => \{[^}]*\}\}/)
    expect(header).not.toMatch(/onBlur=\{\(\) => setIsFocused\(false\)\}/)
  })
})

describe('② 서버 제안이 결과의 복사본이 아니다', () => {
  it('🔴 인기 검색어와 **매장명**을 함께 낸다 (상품명만이 아니다)', () => {
    // ⚠️ 테이블 이름만 보면 안 된다 — `WHERE 0` 으로 무력화해도 이름은 남는다(주입이 잡았다).
    //    **친 글자로 고르는 술어**까지 본다.
    expect(alias).toMatch(/FROM popular_searches WHERE keyword LIKE \?/)
    expect(alias).toContain('.bind(`${q}%`)')
    expect(alias).toMatch(/restaurant_name AS s/)
  })

  it('🔴 상품명은 **마지막**이다 — 부족분만 채운다', () => {
    const iStore = alias.indexOf('restaurant_name AS s')
    const iName = alias.indexOf('name AS s FROM products WHERE name LIKE')
    expect(iStore).toBeGreaterThan(-1)
    expect(iName).toBeGreaterThan(iStore)
    expect(alias).toContain('if (out.length >= SUGGEST_LIMIT) break')
  })

  it('🔴 매장명을 제안하려면 검색이 매장명을 찾을 수 있어야 한다 (짝 — 어기면 눌러서 0건)', () => {
    expect(searchQuery).toMatch(/SEARCH_COLUMNS\s*=\s*\[[^\]]*'restaurant_name'/)
  })

  it('🔴 세 쿼리가 같은 이용권 스코프를 쓴다 — 스코프가 갈리면 눌러서 0건이 난다', () => {
    expect(alias).toContain('const scope = `is_active = 1')
    // scope 를 실제로 쓰는 자리가 둘(매장명·상품명) 이어야 한다.
    expect((alias.match(/\$\{scope\}/g) ?? []).length).toBe(2)
  })
})

describe('③ 패널 — 친 글자를 굵게, 없으면 안 그린다', () => {
  it('🔴 친 글자가 강조된다', () => {
    const { container } = render(
      <SearchSuggestPanel query="돈가스" suggestions={['홍대돈까스', '돈가스 맛집']} onPick={() => {}} />,
    )
    const strong = [...container.querySelectorAll('.font-extrabold')].map((e) => e.textContent)
    expect(strong).toContain('돈가스')
  })

  it('🔴 제안이 0건이면 아무것도 안 그린다', () => {
    const { container } = render(<SearchSuggestPanel query="x" suggestions={[]} onPick={() => {}} />)
    expect(container.querySelector('ul')).toBeNull()
  })

  it('행을 누르면 그 말로 검색한다', () => {
    const picked: string[] = []
    const { getAllByRole } = render(
      <SearchSuggestPanel query="돈" suggestions={['돈가스']} onPick={(t) => picked.push(t)} />,
    )
    getAllByRole('option')[0].click()
    expect(picked).toEqual(['돈가스'])
  })
})
