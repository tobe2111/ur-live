# [LOADING_ADDITIVE] 2026-11-12 숙소 목록 PC — 서버 첫 화면(상단 네비 포함)

- 대상: `src/worker/index.ts` 숙소 분기(기존 한 줄 — 폰 조건 제거 + PC 경로 인자) · `src/worker/utils/stays-first-screen.ts` · `css-first-boot.ts` `firstScreenApplies` PC 에 `/stays`
- 왜: PC `/stays` 는 서버가 로더만 보내 첫 글자 2.3~3.0초(PC 1440 · CPU 4배). 폰 첫 화면(제목 · 칩 · 날짜 · 첫 큐레이션 줄)은 반응형 클래스라 PC 에서도
  같은 모양이고, 앱의 `DesktopTopNav`(풀너비 표면)만 위에 더 선다 → 그 네비를 `pcTopNavBlockHtml('/stays')` 로 먼저 그린다.
- 교환권 상세의 교훈(#2346): 그리는 곳엔 첫 화면 CSS 도 넣는다 — `firstScreenApplies` PC 분기에 함께 추가. 숙소 표면 CSS 37.4KB(상한 40KB 안).
- 배포 전 측정은 **이 빌드가 실제로 낼 숙소 표면 CSS 그대로** 끼웠다(2회): FCP **2.36 · 2.30s → 0.88 · 0.97s** · CLS 0.0016~0.0018 → 0.0015.
- 롤백: index.ts 의 PC 인자를 `undefined` 로 + `firstScreenApplies` 의 `/stays` 제거(둘 다 한 줄).
