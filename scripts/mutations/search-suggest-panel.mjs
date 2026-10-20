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
const REPAIR = 'src/worker/routes/repair-schema.routes.ts'

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
    find: `    return c.json({ success: true, data: await buildSearchSuggestions(c.env.DB, q, scope) });`,
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
  {
    name: '🔎제안이 결과와 다른 범위를 본다(교환권 검색에 이용권을 제안)',
    file: ROUTES,
    find: `    const scope = normalizeScope(c.req.query('scope'));`,
    replace: `    const scope = 'voucher' as const;`,
    test: T,
    why:
      '검색은 어디서 왔느냐에 따라 범위가 **정반대**다(기본=이용권 / scope=exchange=교환권). ' +
      '고정하면 교환권 검색창에 이용권이 뜨고 눌러도 0건이다 — 2026-09-30 실측으로 교환권 2,260건이 ' +
      '제안에서 통째로 빠져 있었다.',
  },
  {
    name: '🔎클라가 scope 를 안 실어 보낸다',
    file: PAGE,
    find: "      const scopeQs = scope ? `&scope=${encodeURIComponent(scope)}` : ''",
    replace: "      const scopeQs = ''",
    test: T,
    why: '서버가 아무리 스코프를 받아도 클라가 안 보내면 그대로 기본값으로 떨어진다 — 배선 절반만 하는 고전적 실패.',
  },
  {
    name: '🔎exchange 에서 카테고리 바인딩을 그대로 넘긴다(D1 거절)',
    file: SUGGEST,
    find: `  const scopeArgs = exchange ? [] : vc.values;`,
    replace: `  const scopeArgs = vc.values;`,
    test: T,
    why: 'exchange 분기의 SQL 엔 `?` 자리가 없다. 바인딩 개수가 어긋나면 D1 이 쿼리를 거절하고, catch 가 삼켜 **빈 제안**이 된다.',
  },
  {
    name: '🔎제안 요청 디바운스가 사라진다(키마다 D1 쿼리 3개)',
    file: HEADER,
    find: `    const t = setTimeout(() => onLoadSuggestions(inputValue), 180)`,
    replace: `    onLoadSuggestions(inputValue)`,
    test: T,
    why:
      '한글 IME 는 자모마다 입력 이벤트를 낸다. 제안 한 번이 D1 쿼리 셋이라 "돈가스" 다섯 타에 ' +
      '15 쿼리다 — 이 레포는 이미 D1 일일 읽기 한도에 닿아 소비자 API 가 전부 500 이 난 적이 있다.',
  },
  {
    name: '🔎인기 검색어 테이블 생성이 다시 빠진다',
    file: REPAIR,
    find: `    { name: 'popular_searches', sql: \`CREATE TABLE IF NOT EXISTS popular_searches (`,
    replace: `    { name: 'popular_searches', sql: \`CREATE TABLE IF NOT EXISTS popular_searches_unused (`,
    test: T,
    why:
      '2026-09-30 실측: 라이브에 이 테이블이 **없었다**(migration 0273 미적용 + repair-schema 누락). ' +
      '그래서 /api/search/popular 가 항상 빈 배열이고 인기 검색어 UI 가 영영 안 떴다 — 에러는 전혀 안 났다.',
  },
]
