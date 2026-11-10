# [LOADING_ADDITIVE] 2026-11-10 — 검색 결과 첫 줄 썸네일 preload (대표 "계속 최적화")

시드 배포(#2293) 뒤 실측: `/search?q=돈가스` LCP 3.7 → **2.6~2.8s**, 요소가 첫 줄 썸네일(`IMG.w-[88px]`). 줄은 시드로 마운트 즉시 그려지는데 사진이 그때서야 출발했다.

## 잠금표 접촉(추가만)
`src/worker/index.ts` — 유어쇼츠 썸네일 preload 줄 앞에 `ssrTarget?.slot === 'SEARCH'` 한 토막(같은 줄, 2672줄 유지). 기존 동작 제거·약화 없음.

## 내용
`worker/utils/search-thumb-preload.ts` — 시드에서 **화면이 그릴** 앞 4줄(범위 필터가 `SearchPage` 와 같은 세 문장)의 사진을 `appendLcpLink(…, 'auto')`. 주소는 줄과 같은 `cfImage(src, ROW_THUMB_OPTS)`(`shared/row-thumb.ts` — `RestaurantRow` 가 같은 상수, 값은 종전 리터럴 그대로라 지도 목록 불변). 같은 출처 경로만 싣는다.

## 못 보는 것
브라우저의 preload 재사용 여부(배포 뒤 요청 목록에서 같은 주소가 한 번인지) · Save-Data 사용자는 `cfImage` 가 화질을 낮춰 주소가 갈릴 수 있다(그땐 preload 4장이 버려진다 — 썸네일 4×약 5KB).

## 가드
`search-thumb-preload-2026-11-10.test.ts` 7건 · 주입 5건 되돌려 전부 빨간불.
