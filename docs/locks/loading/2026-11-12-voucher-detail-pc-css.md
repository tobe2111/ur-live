# [LOADING_ADDITIVE] 2026-11-12 교환권 상세 PC — 첫 화면 CSS 를 넣는다 (#2345 후속)

- 대상: `src/worker/utils/css-first-boot.ts` `firstScreenApplies` PC 분기에 `/vouchers/:id` 추가
- 🩸 틀렸던 판단: #2345 배포 전 측정에서 라이브 HTML 에 네비를 끼우며 **첫 화면 CSS 도 같이 갈아 끼웠다.** 그런데 라이브는
  PC 교환권 상세에 첫 화면 CSS 를 넣지 않는다(토큰판 2KB 만) → 새 네비(`hidden md:block`)가 숨었다가 전체 CSS 도착 때 나타나
  본문 전체를 밀었다. 배포 뒤 실측 CLS **0.33 → 1.0**(악화). 시험 `css-first-boot` 이 *"교환권 상세는 PC 첫 화면이 없다"* 고
  고정하고 있었는데 워커는 PC 에도 그리고 있었다 — 그 어긋남이 원래 0.33 의 절반 원인이기도 했다.
- 라이브 HTML 에 표면 CSS 만 끼워 재기(2회씩): **1.0003 → 0.0003**.
- 롤백: 그 정규식 한 개를 뺀다.
