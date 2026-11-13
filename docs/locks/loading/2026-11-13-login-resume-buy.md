# [LOADING_ADDITIVE] 2026-11-13 이용권 상세 — 로그인 벽에서 돌아오면 그 수량으로 구매 창

- 대상: `src/pages/GroupBuyDetailPage.tsx` `handleJoin` 의 로그인 전 복귀 주소 한 줄(줄 수 불변) · `src/features/auth/api/kakao.routes.ts` `safeRedirect` 보존 키(화이트리스트 추가)
- 대표 승인: *"응, 고쳐줘 (추천)"* — 질문 "로그인하고 돌아오면 고르던 수량 그대로 구매 창이 바로 다시 열리게 고칠까요? (잠금 파일이라 허가 필요)"
- 왜(실측): 30일 이용권 화면 로그인 벽 ~7명 → 결제 화면 1명 → 결제 0. 돌아온 손님이 [구매하기] 를 다시 누르고 수량을 다시 골라야 했다.
- 무엇: 복귀 주소를 `/pass/:id?via=login&qty=N` 로 저장 → `useAgentHandoff` 가 `via=login` 도 받아 창을 그 수량으로 연다(비서 문구는 안 보임).
  `safe-internal-path`·`kakao.routes safeRedirect` 의 보존 키에 `via`(값 `login` 만)·`qty`(1~100) 추가 — 안 하면 카카오 왕복에서 지워진다(시험이 실제로 잡았다).
- **불변으로 지킨 잠금 항목**: `__SSR_INITIAL_DETAIL__` 즉시 사용 · CountdownRing/폴링 · below-fold lazy — 무접촉. `issueLinkedRoleTokens` 무접촉.
- 가드: `src/tests/unit/login-resume-buy-2026-11-13.test.ts` 4 + 주입 3(`scripts/mutations/login-resume-buy-2026-11-13.mjs`).
- E4 판정: 로그아웃 폰으로 이용권 → 수량 2 → 구매하기 → 카카오 로그인 → 돌아왔을 때 구매 창이 수량 2 로 열려 있는가. 퍼널 `login_succeeded`(같은 날 #2352) → `checkout_started` 비율.
- 롤백: `handleJoin` 의 복귀 주소를 `window.location.pathname` 으로 되돌린다(보존 키 추가는 무해하므로 남겨도 된다).
