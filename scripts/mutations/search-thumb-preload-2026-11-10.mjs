/** 🧬 주입 — 검색 결과 첫 줄 썸네일 preload (2026-11-10) */
const T = 'src/tests/unit/search-thumb-preload-2026-11-10.test.ts'
const B = 'src/worker/utils/search-thumb-preload.ts'
export default [
  { name: '검색썸네일 — 줄이 옵션을 손으로 적는다', file: 'src/pages/restaurant-map/RestaurantRow.tsx', find: 'cfImage(r.image_url, ROW_THUMB_OPTS) || r.image_url', replace: "cfImage(r.image_url, { width: 176, quality: 85, format: 'auto' }) || r.image_url", test: T, why: '옵션이 한쪽만 바뀌면 preload 주소와 줄 주소가 갈려 같은 사진을 두 번 받는다.' },
  { name: '검색썸네일 — preload 가 다른 폭을 쓴다', file: B, find: '.map((src) => cfImage(src, ROW_THUMB_OPTS))', replace: '.map((src) => cfImage(src, { width: 240 }))', test: T, why: '브라우저가 미리 받은 것을 버리고 줄의 주소로 다시 받는다(무게만 는다).' },
  { name: '검색썸네일 — 범위 필터 없이 앞 4줄을 당긴다', file: B, find: 'return parsed.data.filter((p) => searchRowVisible(p, scope)).slice(0, n)', replace: 'return parsed.data.slice(0, n)', test: T, why: '화면이 안 그리는 줄(교환권·비이용권)의 사진을 받는다.' },
  { name: '검색썸네일 — 교환권 범위 판정이 뒤집힌다', file: B, find: "if (scope === 'exchange') return Number(p.deal_only) === 1", replace: "if (scope === 'exchange') return Number(p.deal_only) !== 1", test: T, why: '교환권 검색에서 이용권 사진을 당긴다.' },
  { name: '검색썸네일 — 워커가 안 싣는다', file: 'src/worker/index.ts', find: "if (ssrTarget?.slot === 'SEARCH' && ssrPayload) for (const th of searchThumbPreloadHrefs(ssrPayload, searchScopeOf(url.search))) appendLcpLink(c.res.headers, th, 'auto');", replace: '', test: T, why: '첫 줄 사진이 다시 마운트 뒤에 출발한다(LCP 2.6s 재발).' },
]
