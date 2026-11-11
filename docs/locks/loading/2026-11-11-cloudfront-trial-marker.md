# 2026-11-11 [LOADING_ADDITIVE] CloudFront 시험 표시 (`src/worker/index.ts` 한 줄)

- **결재**: `docs/decisions/2026-11-10-cloudfront-trial-edge.md` — 대표 *"홈이었어. 1번으로 하고"*.
- **무엇**: `appendEdgeHeaders(…, colo)` 호출에 요청의 `Via` 를 넘긴다. AWS CloudFront 를 거쳐 온 요청이면 `Server-Timing: colo` 값이 `A`+콜로(`AICN`)가 된다. 실사용 측정이 시험 주소를 따로 모은다.
- **성격**: 추가만. SSR 주입·캐시·HOT_PATHS 무변경. 줄 수 2672 유지(같은 줄 안).
- **가드**: `email-off-2026-11-11.test.ts` 의 "CloudFront 경유 표시" 3건 + 주입 2건. 옛 시험 1건 재조준(`css-first-boot-2026-10-12`).
- **롤백**: 넷째 인자 제거.
