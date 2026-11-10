/** 🧬 주입 — 검색 결과 줄을 서버가 그린다. 가드: src/tests/unit/search-results-first-screen-2026-11-10.test.tsx */
const T = 'src/tests/unit/search-results-first-screen-2026-11-10.test.tsx'
const B = 'src/worker/utils/search-first-screen.ts'
export default [
  { name: '검색결과줄 — 워커가 결과를 안 넘긴다(LCP 가 다시 앱 마운트 뒤)', file: 'src/worker/index.ts', find: "ssrTarget?.slot === 'SEARCH' ? searchResultsHtml(ssrPayload, searchScopeOf(url.search)) : '');", replace: "'');", test: T, why: '시드가 있어도 줄이 앱 부팅 뒤에 그려진다 — 2026-11-10 실측 LCP 2.8~3.7s.' },
  { name: '검색결과줄 — 서버가 범위 필터를 안 건다(교환권이 섞였다 마운트 때 사라진다)', file: B, find: " && searchRowVisible(p, scope) })", replace: " })", test: T, why: '화면은 이용권만 그린다 — 서버가 그린 교환권 줄이 마운트 때 빠지며 목록이 튄다.' },
  { name: '검색결과줄 — 서버가 가격 범위를 안 본다(개수가 화면과 갈린다)', file: B, find: "return price >= SR_PRICE_RANGE.min && price <= SR_PRICE_RANGE.max && ", replace: "return ", test: T, why: '화면의 첫 렌더는 가격 기본 범위로 거른다 — 개수·줄이 갈린다.' },
  { name: '검색결과줄 — 사진 주소가 줄과 갈린다(두 번 받는다)', file: B, find: "const src = p.image_url ? (cfImage(p.image_url, ROW_THUMB_OPTS) || p.image_url) : ''", replace: "const src = p.image_url ? (cfImage(p.image_url, { width: 400, quality: 85, format: 'auto' }) || p.image_url) : ''", test: T, why: '서버 줄·preload·앱 줄의 주소가 한 글자라도 다르면 같은 사진을 다시 받는다.' },
  { name: '검색결과줄 — 줄을 그리고도 로더를 붙인다(목록 아래 큰 로더)', file: B, find: "${query && resultsHtml ? '' : loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}", replace: "${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}", test: T, why: '결과가 다 보이는데 로더가 같이 돈다.' },
  { name: '검색결과줄 — 앱이 서버가 그린 목록을 다시 움직인다(줄이 사라졌다 다시 올라온다)', file: 'src/pages/SearchPage.tsx', find: "className={`${SR_CLS.list}${skipListMotion ? '' : ` ${SR_CLS.listMotion}`}`}", replace: "className={`${SR_CLS.list} ${SR_CLS.listMotion}`}", test: T, why: '서버 줄이 보이다가 마운트 때 투명해졌다 다시 올라온다(깜빡임).' },
  { name: '검색결과줄 — 검색어를 바꿔도 움직임이 영영 꺼진다', file: 'src/pages/SearchPage.tsx', find: "if (`${query}|${sortBy}` !== firstListKey.current) leftFirstList.current = true", replace: "", test: T, why: '반대 방향 — 승인된 등장 움직임이 그 세션 내내 사라진다.' },
  { name: '검색결과줄 — 줄이 자기 클래스를 다시 손으로 적는다(두 벌)', file: 'src/pages/restaurant-map/RestaurantRow.tsx', find: "<p className={ROW_CLS.title}>", replace: '<p className="font-bold text-gray-900 dark:text-white text-[15px] truncate">', test: T, why: '워커는 React 를 못 돌려 마크업이 두 벌이다 — 한 토큰이 갈리면 마운트 때 줄이 튄다.' },
  { name: '검색결과줄 — 서버 목록에 움직임 클래스가 빠진다(등장 모션 실종)', file: B, find: 'class="${SR_CLS.list} ${SR_CLS.listMotion}" ${SR_SERVER_ROWS_ATTR}=""', replace: 'class="${SR_CLS.list}" ${SR_SERVER_ROWS_ATTR}=""', test: T, why: '앱은 첫 목록을 안 움직이므로 서버도 안 움직이면 승인된 등장 모션이 사라진다.' },
]
