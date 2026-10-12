# 번들 다이어트 — Sentry 를 쓰는 함수만 (2026-10-11)

서비스: 공통·인프라(소비자 번들) · 머니 경로 없음 · 대표 지시 "Shrink large lazy chunks … 여기에서 진행"

## 다음 세션의 첫 액션
배포 뒤 Sentry 대시보드에서 새 오류 이벤트가 여전히 들어오는지 확인(진입점만 바꿨으므로 이벤트 경로는 같아야 한다).
`npm run build && node scripts/check-bundle-size.mjs` 로 sentry 청크 ~129 KB raw · 총 raw ≤ 7.38 MB 확인.

## 완료분
- `src/lib/sentry-sdk.ts` — 쓰는 6개(init·browserTracingIntegration·captureException·captureMessage·addBreadcrumb·setUser)만 재수출.
  `sentry.ts`·`performance-monitor.ts`·`api.ts` 의 동적 import 가 이 파일을 가리킨다. vite manualChunks 에서 sentry 청크로 묶음.
- 실측: sentry 청크 **431 → 129 KB raw**, 총 raw **7.67 → 7.37 MB**, gzip **2.450 → 2.357 MB**, critical path 그대로.
- 예산 첫 하향: raw 7.68 → 7.38 · gzip 2.46 → 2.36.
- 가드 `sentry-sdk-slim-2026-10-11.test.ts` 4건 + 주입 3건 빨간불 확인.

## 이번에 틀렸던 판단 / 발견
- charts(379 KB)는 import 방식 문제가 아니다 — 이미 이름 import 이고 recharts 본체(원본 755 KB) + redux·immer 가 대부분.
  줄이려면 어드민·셀러 차트 두 개를 직접 그린 SVG 로 바꿔야 한다(대표 판단 — 화면 회귀 위험).
- 조사 중 #1698 에서 소비자 화면으로 셀러 청크가 새는 회귀를 발견해 #1698 에서 고쳤다(`shared/agency-seat-token.ts`).

## 남은 결정
- 차트를 직접 그려 recharts 를 걷어낼지(약 380 KB raw 추가 절감, 어드민·셀러 대시보드 화면만 영향).
