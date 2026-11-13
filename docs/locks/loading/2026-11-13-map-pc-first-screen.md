# [LOADING_ADDITIVE] 2026-11-13 지도(/map) PC — 서버 첫 화면(상단 네비 + 왼쪽 패널 + 지도 자리)

- 대상: `src/worker/index.ts` 지도 분기(기존 한 줄 — 폰 조건 제거 + PC 경로 인자) · `src/worker/utils/map-first-screen.ts` · `pc-topnav-first-screen.ts`(`hideDealCats`) · `css-first-boot.ts` `firstScreenApplies` PC 에 `/map`
- 왜: PC `/map` 첫 글자 2.9~3.4초(서버는 로더뿐 — 폰 첫 화면이 `lg:hidden` 이었다).
- 무엇: PC 면 [상단 네비 — 앱처럼 딜 카테고리 숨김] + [왼쪽 400px 패널: `MapTopBar variant='panel'` 과 같은 검색 · 칩 7칸 그리드 · 개수/정렬 줄] + [오른쪽 "지도를 불러오는 중..."].
- 🩸 지도 첫 화면이 `escText` 하나 때문에 홈 첫 화면 모듈을 import 해 **지도 표면 CSS 가 홈 카드 클래스까지 끌고 왔다**(38.4KB). 네비를 더하자 42.6KB 로 상한(40KB) 초과 → 로컬 함수로 바꿔 **33.8KB**(네비 포함, 종전보다 가볍다).
- 이 빌드의 지도 표면 CSS 그대로 라이브 HTML 에 끼워 재기(PC · CPU 4배 · 2회): FCP **3.41 · 2.92s → 0.90 · 0.94s** · CLS 0.0063 → 0.0063.
- 롤백: index.ts 의 PC 인자를 `undefined` 로 + `firstScreenApplies` 의 `/map` 제거.
