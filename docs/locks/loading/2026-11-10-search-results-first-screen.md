# [LOADING_ADDITIVE] 2026-11-10 — 검색 결과 줄을 서버가 그린다 (대표 "계속 최적화")

시드(#2293)·썸네일 preload(#2296) 뒤 라이브 실측: 사진은 0.6~2.5s 에 오는데 LCP 는 2.8~3.7s — 줄이 **앱 마운트 뒤에** 그려져서다.

## 잠금표 접촉(추가만)
`src/worker/index.ts` — `/search` 분기의 `buildSearchFirstScreen(…)` 에 다섯째 인자(`searchResultsHtml(ssrPayload, scope)`) + import 한 토막(같은 줄, 2672줄 유지). 시드가 없으면 '' 라 종전과 같다.

## 내용
- `shared/row-thumb.ts` `ROW_CLS`·`ROW_PIN`·`ROW_NO_ADDRESS` — 이용권 줄(`RestaurantRow`)의 클래스를 상수로(값은 리터럴 그대로 · 지도 목록 시각 변화 0 · 이미 `MAP_ROW_MODULES` 안).
- `shared/search-page.ts` `SR_*` — 개수·정렬 줄, 목록, 등장 움직임 CSS, 가격 기본 범위.
- `worker/utils/search-first-screen.ts` `searchResultsHtml` — [총 N개 · 관련도순] + 앞 8줄(앞 4줄 사진 eager). 고르는 줄은 `SearchPage` 첫 렌더와 같다. 줄을 그리면 로더는 없다.
- **움직임은 한 번**: 서버 목록이 `ur-sr-list` 로 올라오고(같은 CSS 를 인라인), 앱은 서버가 그린 첫 목록만 움직임을 생략한다(검색어·정렬이 바뀌면 그 뒤로 늘 움직인다).

## 실측(로컬 렌더 ↔ 라이브 앱, 390px)
정렬 줄 `[20,76,350,34]` · 정렬 버튼 `[263.4,76,106.6,34]` · 첫 줄 `[20,130,350,129.3]` · 둘째 줄 `y 259.3` · 제목 `[120,146,250,22]` · 가격 줄 `y 219.3` — **전부 일치**.

## 못 보는 것
마감(700ms) 안에 시드가 못 온 요청은 종전대로 로더 · 한국어가 아닌 사용자의 '총/개/관련도순' · 서버 줄은 눌러도 반응이 없다(마운트 전 0.5~2초).

## 가드
`search-results-first-screen-2026-11-10.test.tsx` 19건 · 주입 9건(둘은 반대 방향) 되돌려 전부 빨간불 · 전체 단위 시험 17,010건 통과 · 주입 앵커 5,642건 실재 · `build:client`(청크 순환 없음) · 화면 무게 search 194.4/194.1(+0.3, 허용 1.5 안).
