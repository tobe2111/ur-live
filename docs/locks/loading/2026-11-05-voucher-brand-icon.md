# [LOADING_ADDITIVE] 2026-11-05 — 교환권 브랜드 로고를 우리 주소로 바꿔 낸다

- 파일: `src/worker/routes/public-utility.routes.ts`(`/api/vouchers/categories` — 잠긴 것은 Cache-Control 분리 · **불변**)
- 대표: *"교환권 페이지도 마찬가지야"* · 잠금 허가 2026-11-04
- 무엇: 집계와 **같은 왕복**에 대응표(`brand_icon_rehost`)를 읽어, 옮긴 로고는 우리 주소로 바꿔 낀다. 표가 없거나 실패하면 원본 그대로(종전).
- 왜: 원천 `gift_catalog.brand_icon_url` 은 카탈로그 동기화가 매번 덮어써 거기에 쓰면 되돌아간다. giftishow 가 CF 를 막아 32px 칩에 원본(실측 176KB)이 갔다.
- 시험: `voucher-image-upload-2026-11-05` 브랜드 3건.
