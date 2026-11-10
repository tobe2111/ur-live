/** 🧬 주입 — 검색 결과 시드 (2026-11-10) */
const T = 'src/tests/unit/search-seed-2026-11-10.test.ts'
const S = 'src/shared/search-page.ts'
export default [
  { name: '검색시드 — 경로의 장 크기가 훅과 갈린다', file: S, find: "const params = new URLSearchParams({ q, page: '1', limit: String(SEARCH_PAGE_SIZE), scope: searchScopeOf(search) })", replace: "const params = new URLSearchParams({ q, page: '1', limit: '20', scope: searchScopeOf(search) })", test: T, why: '시드가 훅 요청과 다른 키라 엣지 사본이 안 맞고 첫 장이 20개라 두 번째 장 계산이 틀어진다.' },
  { name: '검색시드 — 읽기가 검색어를 대조하지 않는다', file: S, find: "const ok = el.getAttribute('data-q') === q && el.getAttribute('data-scope') === scope", replace: "const ok = true", test: T, why: '다른 검색어의 시드가 첫 장으로 쓰인다(거짓 결과).' },
  { name: '검색시드 — 읽은 뒤 안 지운다', file: S, find: "    el.remove()\n    if (!ok || !el.textContent) return null", replace: "    if (!ok || !el.textContent) return null", test: T, why: 'SPA 로 다른 검색어에 갔다 돌아올 때 옛 시드가 다시 읽힌다.' },
  { name: '검색시드 — 워커가 마감 없이 기다린다', file: 'src/worker/index.ts', find: "ssrTarget.slot === 'SEARCH' ? withSeedDeadline(seedP, SEARCH_SEED_DEADLINE_MS).then((x) => x ?? { payload: null, status: 'deadline', timings: [] }) : seedP,", replace: 'seedP,', test: T, why: '차가운 검색어의 D1 질의가 HTML 전체를 붙잡는다.' },
  { name: '검색시드 — 표식을 안 단다', file: 'src/worker/index.ts', find: "${ssrSlot === 'SEARCH' ? searchSeedAttrs(url.search) : ''}", replace: '', test: T, why: '읽는 쪽이 대조할 표식이 없어 시드를 영영 못 쓴다(또는 대조를 빼면 거짓 결과).' },
  { name: '검색시드 — 훅이 시드를 안 쓴다', file: 'src/hooks/useSearch.ts', find: 'initialData: seed ? { pages: [toSearchResult(seed)], pageParams: [1] } : undefined,', replace: 'initialData: undefined,', test: T, why: '시드를 실어도 결과가 다시 한 왕복 뒤에 그려진다(LCP 3.7s 재발).' },
]
