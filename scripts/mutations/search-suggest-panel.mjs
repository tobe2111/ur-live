/**
 * 🧬 주입 — 검색 제안 패널 (2026-09-30)
 *   가드: src/tests/unit/search-suggest-panel-2026-09-30.test.tsx
 */
const HEADER = 'src/components/search/SearchHeader.tsx'
const PAGE = 'src/pages/SearchPage.tsx'
const ROUTES = 'src/features/products/api/products.routes.ts'
const SUGGEST = 'src/features/products/api/search-suggestions.ts'
const PANEL = 'src/components/search/SearchSuggestPanel.tsx'
const T = 'src/tests/unit/search-suggest-panel-2026-09-30.test.tsx'

export default [
  {
    name: '🔎제안이 다시 결과 위에 떠서 가린다',
    file: PAGE,
    find: `      {showPanel ? (`,
    replace: `      {false ? (`,
    test: T,
    why:
      '대표 신고의 절반이 이것이다 — 둥근 카드가 결과 위를 덮어 정작 찾던 첫 줄이 안 보였다. ' +
      '제안은 결과를 **덮지 않고 대신해야** 한다.',
  },
  {
    name: '🔎제안이 0건이어도 패널을 연다(빈 화면이 결과를 가린다)',
    file: PAGE,
    find: `  const showPanel = panel.open && suggestions.length > 0`,
    replace: `  const showPanel = panel.open`,
    test: T,
    why: '제안이 없는데 자리를 차지하면 결과가 사라진 것처럼 보인다 — 덮는 것보다 나쁘다.',
  },
  {
    name: '🔎blur 로 제안을 닫아 모바일에서 탭이 안 먹는다',
    file: HEADER,
    find: `              onBlur={() => { /* 의도적 무동작 — 위 주석 */ }}`,
    replace: `              onBlur={() => setIsFocused(false)}`,
    test: T,
    why:
      '모바일에서 행을 탭하면 blur 가 click 보다 **먼저** 난다 → 패널이 닫힌 뒤 click 이 와서 ' +
      '아무 일도 안 일어난다. 자동완성에서 가장 흔한 버그이고, 에러도 안 난다.',
  },
  {
    name: '🔎별칭 핸들러가 제안 모듈을 안 쓴다(배선 끊김)',
    file: ROUTES,
    find: `    return c.json({ success: true, data: await buildSearchSuggestions(c.env.DB, q) });`,
    replace: `    return c.json({ success: true, data: [] });`,
    test: T,
    why: '모듈을 아무리 잘 짜도 라우트가 안 부르면 화면엔 아무것도 안 나온다 — 텍스트 가드의 고전적 사각지대.',
  },
  {
    name: '🔎서버 제안이 다시 상품명 통짜만 낸다',
    file: SUGGEST,
    find: `    DB.prepare(
      \`SELECT DISTINCT restaurant_name AS s FROM products`,
    replace: `      DB.prepare(
        \`SELECT DISTINCT NULL AS s FROM products`,
    test: T,
    why:
      '"돈가스" 를 치면 제안이 "홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트" 이고 **바로 아래 첫 결과가 ' +
      '같은 문자열**이었다. 매장명이 있어야 제안이 결과와 다른 일을 한다.',
  },
  {
    name: '🔎서버 제안에서 인기 검색어가 빠진다',
    file: SUGGEST,
    find: `    DB.prepare(\`SELECT keyword FROM popular_searches WHERE keyword LIKE ? ORDER BY search_count DESC LIMIT 5\`)`,
    replace: `      DB.prepare(\`SELECT keyword FROM popular_searches WHERE 0 ORDER BY search_count DESC LIMIT 5\`)`,
    test: T,
    why: '다른 사람이 실제로 친 말이 가장 좋은 제안이다. 빠지면 상품명 목록으로 되돌아간다.',
  },
  {
    name: '🔎매장명 제안의 스코프가 결과와 갈린다(눌러서 0건)',
    file: SUGGEST,
    find: `           AND \${scope}
         ORDER BY restaurant_name ASC LIMIT 6\``,
    replace: `         ORDER BY restaurant_name ASC LIMIT 6\``,
    test: T,
    why:
      '2026-07-20 대표 "이용권만" — 제안 스코프가 결과 스코프와 다르면 눌러도 0건이 나온다. ' +
      '세 쿼리가 **같은** scope 를 써야 한다.',
  },
  {
    name: '🔎검색이 매장명을 못 찾는데 매장명을 제안한다',
    file: 'src/features/products/repositories/search-query.ts',
    find: `export const SEARCH_COLUMNS = ['name', 'restaurant_name', 'description', 'category'] as const`,
    replace: `export const SEARCH_COLUMNS = ['name', 'description', 'category'] as const`,
    test: T,
    why:
      '제안과 검색은 **짝**이다. 검색이 restaurant_name 을 안 보면 매장명 제안을 눌러도 0건이라 ' +
      '"제안이 거짓말하는" 상태가 된다.',
  },
  {
    name: '🔎제안에서 친 글자 강조가 사라진다',
    file: PANEL,
    find: `      <span className="font-extrabold text-gray-900 dark:text-white">{text.slice(i, i + q.length)}</span>`,
    replace: `      <span>{text.slice(i, i + q.length)}</span>`,
    test: T,
    why: '"내가 친 것 + 이어지는 말"로 읽히게 하는 유일한 장치다. 없으면 그냥 글자 목록이다.',
  },
]
