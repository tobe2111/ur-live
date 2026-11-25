# 2026-11-25 [LOADING_ADDITIVE] 로그인 문 수리 — `kakao.routes.ts` · `KakaoAuthService.ts` · `App.tsx`

- **무엇을**:
  - `src/features/auth/api/kakao.routes.ts`: state 가 아예 없는 콜백을 돌려보내는 분기(종전 `redirectTarget = safeRedirect('')` 로 진행) · 서비스 오류 중 "같은 이메일이 다른 방법으로 가입돼 있음" 을 `error=email_already_linked` 로 보내는 분기.
  - `src/features/auth/services/KakaoAuthService.ts`: 그 오류를 `Database error:` 로 감싸지 않고 그대로 던지는 한 줄.
  - `src/App.tsx`: 오류 안내 문구 목록에 `email_already_linked` 한 줄 + 흔적 정리 목록에 같은 코드.
- **왜**: ① 쿠키도 `?state=` 도 없는 요청은 검사 없이 로그인됐다(로그인 CSRF). 라이브 5개월 성공 111건 중 이 길은 0건이다. ② 카카오 계정의 이메일이 이미 다른 방법으로 가입돼 있으면 "서버 오류, 잠시 후 다시 시도" 가 영영 떴다.
- **잠긴 항목에 닿았나**: 아니다. `issueLinkedRoleTokens` 응답의 `seller.username` · `upsertUser` 의 같은 이메일 셀러 자동 연결 · `App.tsx` 의 idle prefetch 는 그대로다.
- **로딩에 주는 영향**: 없다. 정상 로그인 경로(쿠키 일치 · 서명 state)는 한 줄도 바뀌지 않았다.
- **되돌리는 법**: PR revert.
- **근거 시험**: `src/tests/unit/auth-doors-2026-11-25.test.ts` (7건 · 주입 7).

## 같은 날 덧붙임 — 로그인 오류 문구 표를 첫 화면 코드 밖으로 (`[LOADING_ADDITIVE]` `App.tsx` · `vite.config.ts`)

- **무엇을**: `App.tsx` 안의 로그인 오류 문구 표(16줄)를 `src/utils/oauth-error-messages.ts` 로 옮기고, 로그인이 실패해 돌아온 그 순간에만 토스트와 함께 동적으로 불러온다. `vite.config.ts` 의 `app-utils-deferred` 파일 목록에 `oauth-error-messages` 한 이름 추가.
- **왜**: 위에서 문구 한 줄(`email_already_linked`)을 `App.tsx` 에 더한 것이 소개 화면(`about`)의 첫 화면 무게를 예산 +1.5KB 밖으로 밀었다. **main 의 "Bundle budget" 이 그 머지(`e3fc65df1`)부터 세 번 빨간불이었다** — PR 검사는 초록이었고 머지 뒤 검사만 빨갛게 됐는데 세션이 보지 않았다.
- **먼저 틀린 처방**: 문구 파일을 `src/utils/` 에 두기만 하면 빠질 줄 알았다. 그 폴더는 빌드 규칙(catch-all)이 `app-utils`(첫 화면 봉투)로 보낸다 — 동적 import 여도 같다. 다시 재니 오히려 +1.6KB 가 됐다. 이름을 `app-utils-deferred` 목록에 넣어야 빠진다.
- **잠긴 항목에 닿았나**: 아니다. `manualChunks` 의 기존 봉투는 그대로이고 목록에 이름 하나를 **더했다**. `App.tsx` 의 idle prefetch 도 그대로다. 흔적 정리 목록(`authErrors`)은 `App.tsx` 에 남겼다(즉시 돌아야 한다).
- **전후 실측**(로컬 빌드, brotli KB · 기준 → 고치기 전 → 고친 뒤): `__boot__` 162.6 → 164.0 → **163.7** · `about` 211.2 → 212.7 → **212.5** · `refund` 218.5 → 220.0 → **219.7**. 35개 화면 전부 예산 안.
- **되돌리는 법**: PR revert.
- **근거 시험**: `auth-doors-2026-11-25.test.ts`(문구는 새 모듈에서 · `App.tsx` 에는 문구가 없고 동적 import 가 있다) · `node scripts/check-surface-budgets.mjs`.

## 같은 날 덧붙임 2 — 로그인 문 3차 (`[LOADING_ADDITIVE]` `kakao.routes.ts` · `KakaoCallbackPage.tsx`)

- **무엇을**:
  - `src/features/auth/api/kakao.routes.ts`: 로그인 문 `POST /callback` 이 `state` 를 확인(쿠키와 맞거나 서명이 유효)한 뒤에만 코드를 바꾼다 · 동의 전용 문 `POST /consent-callback` 신설(세션을 만들지 않고, 지금 로그인한 손님과 카카오 번호가 같을 때만 토큰 저장).
  - `src/pages/KakaoCallbackPage.tsx`: 그 POST 에 주소의 `state` 를 실어 보내는 한 줄.
- **왜**: 두 문이 `state` 없이 코드를 받아 그 코드의 주인으로 브라우저를 로그인시켰다(로그인 CSRF). 동의 흐름은 state 쿠키를 굽기만 하고 아무도 읽지 않았다.
- **잠긴 항목에 닿았나**: 아니다. `issueLinkedRoleTokens` 응답의 `seller.username` · `KakaoCallbackPage` 의 `seller_username` 저장과 `user_type` 보존은 한 글자도 안 바뀌었다. 정상 로그인(GET `/sync/callback`)은 무접촉.
- **로딩에 주는 영향**: 없다. 이 두 화면은 로그인 왕복에서만 뜬다.
- **되돌리는 법**: PR revert.
- **근거 시험**: `src/tests/unit/auth-doors-3-2026-11-25.test.ts` (25건 · 주입 16).

