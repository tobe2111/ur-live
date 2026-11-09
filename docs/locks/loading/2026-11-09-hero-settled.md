# [UNLOCK_LOADING] 2026-11-09 상세 맨 위 큰 사진이 다 뜬 뒤 아래쪽을 받는다

- 대표 승인: `AskUserQuestion` — *"허가 — 진행"* (이용권 상세 잠금 `GroupBuyDetailPage`).
- 실측(폰 흉내 · CPU 4배 · 느린 4G, 라이브 홈 → 카드 탭): 큰 사진(960px)과 같은 순간 아래쪽 15건
  (카카오 지도 SDK·그림 9 · 리뷰 2 · 다녀온 사람들 · 같은 가게 목록 `status=active` 한 페이지 등)이 출발해 회선을 나눴다 — 사진 완료 1.33s.
- 처방:
  ① `lib/hero-settled.ts` — 갤러리가 대기 시작(`beginHero`, 커밋 직후 `useLayoutEffect`), 첫 사진 load/error 에 해제, 최대 1.5s 뒤 자동 해제, 떠날 때 해제.
  ② `pages/group-buy/DeferUntilVisible.tsx` — 기존 "보이면 그린다" 에 "큰 사진이 왔으면" 을 더했다(지도·리뷰·다녀온 사람들이 이 문을 지난다).
     잠금 계약(below-fold = lazy + 이 게이트)은 그대로 — 게이트가 한 조건 더 엄격해졌을 뿐.
  ③ `GroupBuyDetailPage` — 같은 가게 다른 이용권 목록 요청에 같은 조건 한 줄.
- 숙소 상세도 같은 갤러리·같은 게이트라 함께 적용된다. 갤러리가 없는 화면은 처음부터 해제(종전과 같다).
- 가드: `hero-settled-2026-11-09.test.tsx` + 재조준 1(시험) · 1(주입, 빨간불 확인). 전체 단위 시험 16,453 통과 · 용량 기준 33화면 안.
- 롤백: revert(또는 `DeferUntilVisible` 의 `&& heroSettled` 만 제거).
- 판정(E4): 배포 후 같은 조건으로 카드 탭 → 큰 사진 완료 시각(전 1.33s) · 아래쪽 요청 출발이 사진 완료 뒤인지.
