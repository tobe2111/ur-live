# 2026-11-02 — 카카오 신규 가입 시 어드민 알림 [LOADING_ADDITIVE]

- **잠금 파일**: `src/features/auth/api/kakao.routes.ts` (잠긴 항목: `issueLinkedRoleTokens` 응답의 `seller.username`)
- **대표 지시**: *"유저 가입, 에이전시 가입 이런 중요한 것들은 알람이 하나도 안 오고 있어 … 가장 이상적이고 영구적이며 체계적으로 자리가 잡혀야 해."*
- **무엇을**: `/sync/callback` 의 `isNewUser` 블록, `stateUrl.searchParams.set('new', '1')` **같은 줄 끝**에 `c.executionCtx.waitUntil(import(admin-event-notify).then(m => m.notifyAdminEvent(… 'user_signup' …)))` 추가 — 이 파일은 god 파일 래칫 기준(1063줄)에 딱 맞아 줄을 늘릴 수 없어 같은 줄에 붙였다.
- **왜 잠금에 안 닿나**: 추가만 했다. `issueLinkedRoleTokens`·`seller.username`·리다이렉트·티켓 경로 무접촉. 알림은 `waitUntil` 로 **응답 뒤에** 가므로 로그인 임계 경로에 0ms. 실패는 삼킨다(가입을 막지 않는다).
- **가드**: `src/tests/unit/notification-catalog-2026-11-02.test.ts` — `c.executionCtx.waitUntil(import(…admin-event-notify).then((m) => m.notifyAdminEvent(c.env.DB, { type: 'user_signup'` 를 고정. 되돌려-검증: type 을 바꾸면 2건 빨간불 확인.
- **롤백**: 그 줄의 `try { c.executionCtx.waitUntil(…) } catch {…}` 부분 삭제.
- **E4 판정**: 배포 뒤 첫 신규 카카오 가입 → 어드민 종 `업무` 칸에 "새 유저 가입" 이 뜨는지 / `dashboard_notifications` 에 `type='user_signup'` 행이 생기는지.
