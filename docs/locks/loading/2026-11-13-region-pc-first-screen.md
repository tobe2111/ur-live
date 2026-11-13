# [LOADING_ADDITIVE] 2026-11-13 지역 착지 PC — 서버 첫 화면(상단 네비 + 같은 본문)

- 대상: `src/worker/index.ts` 지역 분기(폰 조건 제거 + `pcPath` 인자) · `region-first-screen.ts`(`pcTopNavBlockHtml`) · `css-first-boot.ts` `firstScreenApplies` PC 에 `/region/*`
- 왜: 라이브 PC `/region/서울` 첫 글자 **1.9~2.4s** — 서버 첫 화면이 폰 전용이라 PC 는 앱이 다 올 때까지 로더뿐이었다(sitemap 이 내는 검색 착지점 38곳).
- 무엇: 숙소·교환권 상세(#2346·#2354)와 같은 처방 — PC 면 앱 상단 네비를 먼저 그리고 같은 본문(빵부스러기·제목·칩·카드 4장), 첫 화면 CSS 도 넣는다.
  지역 표면 CSS 36.9KB(상한 40KB).
- 끼워 재기(PC 1440 · CPU 4배 · 2회): 서버 그림이 0.6s 에 보이고(종전 로더) CLS 0.0004 → 0.0001~0.0002. 0.6s 화면과 7s 화면이 같은 자리(스크린샷 대조).
- 롤백: index.ts 인자 `undefined` + 조건에 `shouldRenderMobileFirstScreen` 복귀 + PC 정규식 제거.
