# [LOADING_ADDITIVE] 2026-11-13 유어쇼츠 목록 PC — 서버 첫 화면(430 액자)

- 대상: `src/worker/index.ts` `/urshorts` 분기(UA 조건 제거 + `isMobile` 인자) · `urshorts-first-screen.ts`(PC 면 `PC_FRAME` 액자) · `css-first-boot.ts` PC 에 `/urshorts`
- 왜: 라이브 PC 첫 글자 1.9~2.4s — PC 유어쇼츠는 430 액자 화면(위 네비 없음)인데 서버 첫 화면이 폰 전용이라 로더뿐이었다.
- 무엇: 검색·FAQ PC 와 같은 액자 값(`GUEST_PC_FRAME` — import 하면 손님 탭 CSS 가 끌려와 값만 복제, 시험이 대조). 표면 CSS 36.2KB.
- 끼워 재기(PC 1440 · CPU 4배 · 2회): 0.8~1.1s 에 최종과 같은 모양(스크린샷) · CLS 0.0001(현재와 같음).
- 롤백: index.ts 에 `shouldRenderMobileFirstScreen` 조건 복귀 + PC 정규식에서 `/urshorts` 제거.
