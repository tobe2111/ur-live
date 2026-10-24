# 2026-10-24 이용권 상세 그루폰식 (모바일)

대표 승인 "승인해줄게 그루폰식으로 하자" (시안: 캔버스 PassGroupon).

## 한 것
- `PassHeadCard`: 제목 → 가게·종류·지역(`passSubLine`, `shared/pass-head.ts`) → 주소·거리 → 별점·리뷰·구매 수
- 신규 `PassOptionCard`: 옵션 선택 카드(모바일). 구매하기 = 하단 바와 같은 구매 창(`DealBottomBar` `openRequest`)
- 서버 첫 화면 `detail-ssr-body.ts` 제목·가게 줄 순서 동기, critical-css 재생성
- 가드 `pass-groupon-2026-10-24.test.ts` + `scripts/mutations/pass-groupon-2026-10-24.mjs`

## 다음 세션 첫 액션
- 배포 후 폰 `/pass/2835` 하드로드 프레임 — 제목이 마운트 때 안 움직이는지(E4)
- 시안과 다른 점 둘: 사진 썸네일 2장 미적용(첫 화면 preload 계약 재정합 필요 — 별건), 선물하기 링크 없음

## 남은 결정
- npm audit vite·zod 허용목록: `docs/decisions/2026-10-24-npm-audit-vite-zod.md` (CI 가 이것 때문에 전 PR 빨강)
