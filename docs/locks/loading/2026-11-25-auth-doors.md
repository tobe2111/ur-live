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
