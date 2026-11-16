# [LOADING_ADDITIVE] 2026-11-16 PC 홈 — 서버 첫 화면이 첫 섹션 아래 유어쇼츠 줄 + 둘째 섹션까지

- 대상: `src/worker/index.ts` PC 홈 분기 넷째 인자 `homeShortsPayload`(폰 홈과 같은 시드) · `pc-home-first-screen.ts`(`pcBelowFirstHtml`).
- 왜: 라이브 PC(CPU 4배) 첫 섹션 0.5~0.6s, 그 아래 유어쇼츠·'지금 인기 이용권' 2.1~2.7s(앱 마운트 뒤). PC 1440×900 에서 바로 아래라 조금만 내려도 빈칸.
- 화면 순서(`HomeSections rail`, shortsAfter=0): 첫 섹션 → 유어쇼츠 → inline 배너 → 둘째 섹션. 유어쇼츠 줄은 폰 홈의 `homeShortsPanelHtml` 그대로(같은 컴포넌트).
- 안 그리는 경우: 유어쇼츠 시드 없음 · 배너 시드 없음 · (둘째 섹션만) inline 배너 있음 · 위치 정렬 섹션.
- 끼워 재기(PC·CPU 4배 3+3회): 유어쇼츠·둘째 섹션 2.7~3.6s → **첫 섹션과 함께 0.37~1.0s** · CLS 0.0001 그대로. 스크린샷 대조 — 서버·앱 위치 동일.
- 롤백: 넷째 인자 제거(기본값 null → 첫 섹션만, 종전).
