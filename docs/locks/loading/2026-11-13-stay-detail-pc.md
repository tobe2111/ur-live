# [LOADING_ADDITIVE] 2026-11-13 숙소 상세 PC — 첫 화면 CSS + 상단 네비 (CLS 1.0 → 0.017)

- 대상: `src/worker/index.ts` 숙소 상세 분기(인자 한 개) · `stay-detail-ssr-body.ts` · `css-first-boot.ts` `firstScreenApplies` PC 에 `/stays/:id`
- 왜: PC `/stays/2967` CLS **1.017**. 서버 첫 화면은 PC 에도 그려지는데(빵부스러기 `hidden lg:block` + 폰 본문 `lg:hidden`) PC 엔 첫 화면 CSS 가
  안 들어가 **폰 본문(큰 사진)이 PC 에 그대로 보였다가** 앱 CSS 가 오는 순간 사라졌다 — 교환권 상세(#2346)와 같은 클래스.
- 무엇: PC 면 앱의 상단 네비를 먼저 그리고(교환권 상세와 같은 `pcTopNavBlockHtml`), 첫 화면 CSS 도 넣는다.
- 🩸 숙소 상세 표면 CSS 가 네비를 더하자 42KB(상한 40KB) — 별점 클래스 셋 때문에 `detail-ssr-body` 가 홈 첫 화면 모듈을 통째로 import
  하고 있었다 → `shared/star-rating-fs.ts` 로 떼어 **36.1KB**. 덤: 이용권 상세 표면 37.3KB → **29.7KB**.
- 이 빌드의 숙소 상세 표면 CSS 그대로 라이브 HTML 에 끼워 재기(PC · CPU 4배 · 2회): CLS **1.017 → 0.017**(남은 0.017 은 앱 마운트 뒤 아래쪽 버튼·후기 — 별건).
- 롤백: index.ts 인자 `undefined` + 정규식을 `vouchers` 만으로.
