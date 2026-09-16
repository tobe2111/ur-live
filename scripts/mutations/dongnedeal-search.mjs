/**
 * 🔎 "등록된 동네딜을 이름으로 찾을 수 있어야 한다" (2026-09-16 대표 "매장명이라던지. 급해").
 *
 * 검색은 조용히 망가지는 기능이다 — 결과가 0건이어도 에러가 안 나고,
 * 사람은 "그 딜이 없나 보다" 로 읽는다. 아래 주입들이 그 조용한 고장을 하나씩 만들어 본다.
 *
 * 가드: src/tests/unit/dongnedeal-search-2026-09-16.test.ts
 */
const QUERY = 'src/features/admin/api/dongnedeal-search.ts'
const ROUTE = 'src/features/admin/api/admin-products.routes.ts'
const UI = 'src/pages/admin-dongnedeal/DealList.tsx'
const TEST = 'src/tests/unit/dongnedeal-search-2026-09-16.test.ts'

export default [
  {
    name: '🕳️ Enter 가 디바운스를 못 건너뛴다 (급할 때 매번 0.3초를 기다린다)',
    file: UI,
    find: "            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setFQuery(qInput.trim()) } }}",
    replace: '            onKeyDown={undefined}',
    test: TEST,
    why:
      '대표가 "급해" 라고 한 화면이다. Enter 가 안 먹으면 한 번 찾을 때마다 손을 멈추고 기다려야 하고, ' +
      '그 지연은 고장으로 안 보여서 아무도 신고하지 않는다.',
  },
  {
    name: '🕳️ 검색어를 서버로 안 보낸다 (칸은 있는데 아무 일도 안 일어난다)',
    file: UI,
    find: "    if (fQuery) qs.set('q', fQuery)",
    replace: '    void fQuery',
    test: TEST,
    why:
      '이 레포가 반복해 당한 "조용한 부재" 다 — 쳐도 목록이 그대로라, 사람은 검색이 고장 난 게 아니라 ' +
      '그 딜이 없다고 믿는다.',
  },
  {
    name: '🕳️ 검색어가 바뀌어도 다시 안 읽는다 (첫 글자 결과가 굳는다)',
    file: UI,
    find: "}, [nonce, fSido, fDistrict, fCategory, fMode, fSource, fStatus, fSort, fQuery])",
    replace: "}, [nonce, fSido, fDistrict, fCategory, fMode, fSource, fStatus, fSort])",
    test: TEST,
    why: '검색어를 지워도 목록이 안 돌아온다. 화면은 멀쩡해 보이고 값만 낡는다.',
  },
  {
    name: '🕳️ 타이핑마다 요청한다 (디바운스 제거 — 지운 검색어의 결과가 뒤늦게 덮는다)',
    file: UI,
    find: '    const t = setTimeout(() => setFQuery(qInput.trim()), 300)',
    replace: '    setFQuery(qInput.trim()); const t = setTimeout(() => {}, 0)',
    test: TEST,
    why:
      '"강남불백" 을 치는 동안 왕복이 다섯 번이고, 느린 응답이 나중에 도착하면 이미 지운 ' +
      '검색어의 결과가 화면에 남는다(경합). 어드민 D1 읽기도 그만큼 늘어난다.',
  },
  {
    name: '🕳️ 공백을 AND 대신 OR 로 (흔한 낱말 하나에 목록 전체가 걸린다)',
    file: QUERY,
    find: "    sql.push(byId ? `((${toks.map(() => one).join(' AND ')}) OR id = ?)` : toks.map(() => one).join(' AND '))",
    replace: "    sql.push(byId ? `((${toks.map(() => one).join(' OR ')}) OR id = ?)` : toks.map(() => one).join(' OR '))",
    test: TEST,
    why:
      '"강남 파스타" 가 강남의 모든 딜을 끌고 온다. 결과가 많아지는 것은 에러가 아니라서 ' +
      '아무도 고장으로 신고하지 않는다 — 그냥 검색이 쓸모없어진다.',
  },
  {
    name: '🕳️ 검색을 매장명 한 열로 좁힌다 (상품명·주소로는 못 찾는다)',
    file: QUERY,
    find: "const Q_COLUMNS = ['restaurant_name', 'name', 'restaurant_address'] as const",
    replace: "const Q_COLUMNS = ['restaurant_name'] as const",
    test: TEST,
    why:
      '어드민이 손에 쥔 단서가 상품명이나 주소일 때 0건이 나온다. ' +
      '그리고 0건은 "없다" 로 읽히지 "검색이 그 열을 안 본다" 로 읽히지 않는다.',
  },
  {
    name: '🕳️ 바인딩을 하나 덜 넣는다 (D1 wrong number of bindings — 목록이 통째로 죽는다)',
    file: QUERY,
    find: '    for (const t of toks) for (let i = 0; i < Q_COLUMNS.length; i++) params.push(`%${t}%`)',
    replace: '    for (const t of toks) for (let i = 0; i < Q_COLUMNS.length - 1; i++) params.push(`%${t}%`)',
    test: TEST,
    why:
      '물음표 수와 값 수가 어긋나는 클래스다. 이 레포에 전용 가드(check-sql-bind-params)가 있을 만큼 ' +
      '자주 났고, 검색 한 글자에 목록 전체가 500 이 된다.',
  },
  {
    name: '🕳️ 지역과 검색의 순서를 바꾼다 (조각과 값이 어긋난다)',
    file: QUERY,
    find: '  // 지역: 주소에만 건다(종전 동작 그대로).',
    replace: '  if (String(input.q || "").trim()) { sql.push("1=1"); }\n  // 지역: 주소에만 건다(종전 동작 그대로).',
    test: TEST,
    why:
      'sql[] 과 params[] 는 **같은 순서**라는 약속으로만 맞물린다. 한쪽에 조각을 끼워 넣으면 ' +
      '지역 값이 검색 자리로 들어가 엉뚱한 결과가 나온다 — 역시 에러 없이.',
  },
  {
    name: '🕳️ 라우트가 만든 조건을 안 쓴다 (빌더만 돌고 쿼리엔 안 붙는다)',
    file: ROUTE,
    find: '    where.push(...textFilters.sql); params.push(...textFilters.params);',
    replace: '    void textFilters;',
    test: TEST,
    why:
      '검색도 지역 필터도 통째로 무력화된다. 순수 함수가 잘 도는 것과 그 결과가 쿼리에 닿는 것은 ' +
      '다른 일이고, 전자만 테스트하면 이걸 못 잡는다.',
  },
]
