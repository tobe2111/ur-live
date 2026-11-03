# [UNLOCK_LOADING] 2026-11-03 — 이용권 상세(/pass)에 들어온 숙소를 숙소 상세로

- 파일: `src/pages/GroupBuyDetailPage.tsx` (잠금표: `__SSR_INITIAL_DETAIL__` 즉시 사용 · below-fold lazy 등)
- 허가: 대표 2026-11-03 *"잠금 파일도 다 허가해줄테니 순서대로 다 해줘"*
- 바꾼 것: 상세 데이터가 온 뒤 `category === 'stay_voucher'` 이면 `<Navigate replace to="/stays/:id?…">`. import 에 `Navigate` 추가.
- 안 바꾼 것: SSR 시드 소비 · 폴링 · lazy 경계 · prefetch — 전부 그대로(분기는 데이터가 온 뒤 한 줄).
- 왜: 유어샵 핀 클릭(2026-11-03 A 에서 /stays 로 수정) 말고도 옛 공유 링크·외부 링크로 `/pass/<숙소id>` 가 들어오면 객실·날짜 없이 이용권 화면으로 열렸다.
- 회귀 시: 숙소 id 로 /pass 를 열면 이용권 구매 버튼이 보인다. 가드: `stay-unify-b-2026-11-03.test.ts`.
