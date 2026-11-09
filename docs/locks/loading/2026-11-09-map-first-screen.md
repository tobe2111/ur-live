# [LOADING_ADDITIVE] 2026-11-09 — 동네딜 지도(`/map`) 껍데기 첫 화면 + 번역 키 원문 노출 수리

대표 *"계속 최적화"*. 라이브 실측(폰 4G 흉내): first-paint 1.96s · **첫 글자 2.93s**(소비자 화면 중 최하) — 그 첫 글자가 `restaurantMap.mapLoading` **번역 키 원문**(사전 청크 2.56s 도착 전 React 가 먼저 그림).

## 잠금표 접촉
- `src/worker/index.ts` HTMLRewriter SSR inject 블록 — `/life·/urshorts` 줄에 분기 하나(폰 UA · 쿼리 없음). 줄 수 2672 유지.
- `src/components/RestaurantMiniMap.tsx` 등 잠금 항목 무접촉. `RestaurantMapPage` 는 잠금표 밖(문구 defaultValue 2곳만).

## 그리는 것(폰만, `lg:hidden`)
[회색 지도 자리 + "지도를 불러오는 중..." / "카카오맵 SDK 로딩 중"] + [상단 플로팅 바: 뒤로 칸·검색 상자·칩 줄(필터·내 주변·전체(선택)·식사·뷰티·헬스·숙소·생활·기타)] + [하단 시트 peek 껍데기: 손잡이 + `…곳`·`할인율순` 줄]. 시트 자리는 `useSheetDrag` 상수(top·peek transform) 그대로. 목록은 안 그린다(앱이 받는다). 아이콘은 빈 칸.
`MAP_FS_CLASS` 는 `MapTopBar`·`SheetFilterBar`·`RestaurantMapPage` 의 클래스 사본 — 시험이 **진짜 컴포넌트를 렌더**해 대조.

## critical CSS
표면 `map` 38KB. 전체판 **68,971B / 상한 70,000B** — 다음 첫 화면을 더하면 상한을 넘는다. 그때는 표면별 판만 쓰고 전체판 상한을 올리는 결정이 필요(전체판은 폴백 전용).

## 못 보는 것
픽셀 밀림(jsdom) · 실제 FCP(배포 뒤 라이브). PC(lg+)는 안 그린다.

## 가드
`map-first-screen-2026-11-09.test.tsx` 8건 · 주입 `map-first-screen-2026-11-09.mjs` 4건(되돌려 빨간불) · css-first-boot(`/map` 적용으로 재조준) · critical-css 표면 14.
